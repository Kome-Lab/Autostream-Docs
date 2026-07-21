# 秘密情報とtoken生成

AutoStream の新規構成では、サービス間認証は Control Panel の Node登録に寄せます。Worker、Encoder Recorder、Discord Bot、Observability はサービス間tokenを env に手入力せず、Node登録で生成される `config.yml` の Node Runtime Token を使います。Worker と Encoder Recorder の stream ingest signing key も同じ `config.yml` で配布します。Update Agentも中央管理ホストに1つだけ登録し、sampleとlocal inventoryを準備したroot所有`/etc/autostream/updater.json`へAuto Configureで接続identityを設定します。

Observability も例外ではありません。Control Panel は登録済み `observability` Node の公開URLと暗号化保存された Node Runtime Tokenを使って、Monitoring、Incidents、Notification Channels、signal転送を呼び出します。Observability用の別admin tokenや直接ingest tokenは作りません。

## 生成コマンド

Linux / macOS では、32 byte の random hex を使います。

```bash
openssl rand -hex 32
```

Windows PowerShell では、PowerShell の文字化けや改行混入を避けるため、.NET の乱数生成器で作ります。

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

## 最初に生成する値

| 管理名 | 入力先 | 生成方法 | 注意 |
| --- | --- | --- | --- |
| `AUTOSTREAM_SESSION_SECRET` | Control Panel env | random hex | session 保護用。Control Panel だけで使います |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Control Panel env、Observability env | 32 byte以上のrandom hex | 保存 secret と Node Runtime Token の暗号化用。32 byte以上を運用要件とし、Control PanelのNode操作はplaceholderや短い値を拒否します。環境ごとに固定し、紛失しないでください |
| `AUTOSTREAM_SETUP_TOKEN` | Control Panel env | random hex | 初回管理者作成用。初回作成後は rotation するか無効値へ変えます |
| `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Control Panel env | 32 byte以上のrandom hex | Control Panel が stream scoped token を発行し、Node登録時に Worker / Encoder Recorder の `config.yml` へ配布します。`CHANGE_ME`等のplaceholderは拒否します |

## Node登録で生成される値

| token | 扱い |
| --- | --- |
| Node Runtime Token | Control Panel の Node登録で生成され、`config.yml` の `auth.token` に入ります。Control Panel 側では暗号化保存されます |
| Configure Token | Node登録のConfigurationで短期tokenとして表示され、`autostream-<service> configure`が通常Nodeの`config.yml`またはUpdate Agentの接続identityを取得するために使います。Update Agentではcommandやprocess argvへ含めず、TTYまたは標準入力から渡します |
| Stream ingest signing key | Worker / Encoder Recorder の `config.yml` の `stream_ingest.signing_key` に入ります。通常のNode参照APIでは再表示されません |
| `CONTROL_PANEL_TOKEN` | env へ手入力しません。`config.yml` 内の Node Runtime Token として配布されます |

Node Runtime TokenとConfigure Tokenを紛失した場合は、Control PanelのNode登録Configurationから再生成します。通常serviceは`config.yml`を更新し、中央Update Agentは新しいAuto Configure commandで`updater.json`の接続identityだけを更新してから再起動します。管理対象host helperにはRuntime Tokenがありません。

## サービス別の入力一覧

| service | 手生成してenvに入れる値 | Control Panel が生成する値 | provider から取得する値 |
| --- | --- | --- | --- |
| Control Panel | `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_SETUP_TOKEN`、`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | なし | Google OAuth client secret、Webhook URL、SMTP password、Cloudflare Turnstile secret などを画面から保存 |
| Observability | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Node Runtime Token を `config.yml` で受け取る | 通知先 webhook などを必要に応じて画面から保存 |
| Encoder Recorder | なし | Node Runtime Token と stream ingest signing key を `config.yml` で受け取る | YouTube stream key は標準運用では Control Panel の YouTube Outputs に保存 |
| Worker | なし | Node Runtime Token と stream ingest signing key を `config.yml` で受け取る | なし |
| Discord Bot | なし | Node Runtime Token を `config.yml` で受け取る | Discord developer portal の Bot token を Control Panel の Discord Settings に保存 |
| 中央Update Agent | なし | 共通service scopeと`updates.claim` / `updates.report` / `updates.authorize`を持つNode Runtime TokenをAuto Configureで中央のroot所有`updater.json`へ設定 | private GitHub Releasesを読むtokenを中央の`updater.json`だけにlocal設定 |
| 管理対象host helper | なし | Node Runtime Tokenなし。root変更時だけ90秒のone-time mutation grantをSSH RPCで受け取る | release tokenはstage中だけSSH stdinで受け取り、保存しない |

Update Agent用のNode Runtime TokenとGitHub tokenは中央`updater.json`へ入り、通常Nodeより強い更新権限の境界にあります。fileをroot所有、group `autostream-updater`、mode `0640`にし、管理対象host、Control Panel container、service containerへcopyしないでください。Auto Configureは`panel_url`、`node_id`、`runtime_token`、`service_name`だけを更新し、localのGitHub token、API、host/target inventory、SSH設定は変更しません。private release tokenはremote stageのbounded SSH stdinだけで一時送信され、remote config、state、logへ永続化しません。`updates.authorize`追加前のtokenは、対応Control Panelのdeploy後にConfigure Tokenを再生成して新しいAuto Configure commandで反映します。

## 手入力しないtoken

次の token は、新規構成では手で生成して env に貼りません。

| token | 標準の扱い |
| --- | --- |
| Observability 接続URL | Control Panel env には入れません。登録済み Observability Node の URL を使います |
| Observability API token | Control Panel env には入れません。登録済み Observability Node の Runtime Token を使います |
| Observability admin token | 作りません |
| Observability ingest token | 作りません。Worker / Encoder Recorder は Control Panel へ signal を送り、Control Panel が Observability へ転送します |
| `SERVICE_CALL_TOKEN` | 古い構成からの移行用です。新規 Node は `config.yml` の Node Runtime Token を使います |
| `SERVICE_CONTROL_TOKEN_SHA256` | 古い構成からの移行用です。新規構成では `AUTOSTREAM_NODE_CONFIG` を使います |

## Provider から発行するsecret

Discord Bot token、YouTube stream key、Google OAuth client secret、Google Drive credential、Webhook URL、SMTP password、Cloudflare Turnstile secret は、AutoStream が生成する値ではありません。各 provider で発行し、Control Panel の画面や secret manager に保存します。公開docs、GitHub、チャット、スクリーンショットには載せないでください。
