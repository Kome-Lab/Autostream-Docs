# 秘密情報とtoken生成

AutoStream の新規構成では、サービス間認証は Control Panel の Node登録に寄せます。Worker、Encoder Recorder、Discord Bot、Observability はサービス間tokenを env に手入力せず、Node登録で生成される `config.yml` の Node Runtime Token を使います。Worker と Encoder Recorder の stream ingest signing key も同じ `config.yml` で配布します。Updaterは物理ホストごとにendpointlessな`pull_v2`を登録し、Auto Configureで4項目だけを含むroot所有`/etc/autostream-host-agent/identity.json`を生成します。

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
| Configure Token | Node登録のConfigurationで短期tokenとして表示され、`autostream-<service> configure`が通常Nodeの`config.yml`、`autostream-host-agent configure`がHost Agentの4項目identityを取得するために使います。commandやprocess argvへ含めず、TTYまたは標準入力から非表示で渡します |
| Stream ingest signing key | Worker / Encoder Recorder の `config.yml` の `stream_ingest.signing_key` に入ります。通常のNode参照APIでは再表示されません |
| `CONTROL_PANEL_TOKEN` | env へ手入力しません。`config.yml` 内の Node Runtime Token として配布されます |

通常serviceのNode Runtime Token/Configure Tokenを紛失した場合は、Control PanelのNode登録Configurationから再生成して`config.yml`を更新します。未起動Host AgentのConfigure Tokenは再発行できますが、activeな`pull_v2` Host Agentの即時Runtime Token再生成は`staged_runtime_token_rotation_required`で拒否されます。専用rotationはstage→旧tokenで1回だけclaim→`identity.staged.json`のlocal ack→staged token heartbeat proof→activate→canonical identity昇格→旧token revokeの順です。activate前はcancelでき、emergency revokeは通信断とlocal recoveryを伴うbreak-glass操作です。generic Rotateで旧tokenを先に失効させません。`execution_host_id`と`ownership_epoch`はserver-ownedなのでconfigへ入れません。

## サービス別の入力一覧

| service | 手生成してenvに入れる値 | Control Panel が生成する値 | provider から取得する値 |
| --- | --- | --- | --- |
| Control Panel | `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_SETUP_TOKEN`、`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | なし | Google OAuth client secret、Webhook URL、SMTP password、Cloudflare Turnstile secret などを画面から保存 |
| Observability | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Node Runtime Token を `config.yml` で受け取る | 通知先 webhook などを必要に応じて画面から保存 |
| Encoder Recorder | なし | Node Runtime Token と stream ingest signing key を `config.yml` で受け取る | YouTube stream key は標準運用では Control Panel の YouTube Outputs に保存 |
| Worker | なし | Node Runtime Token と stream ingest signing key を `config.yml` で受け取る | なし |
| Discord Bot | なし | Node Runtime Token を `config.yml` で受け取る | Discord developer portal の Bot token を Control Panel の Discord Settings に保存 |
| `pull_v2` Host Agent | なし | Node Runtime Tokenを物理ホストごとのroot所有`/etc/autostream-host-agent/identity.json`へ設定。epoch `0`ではobserver、明示的ownership切替後だけclaim/reportに使用 | provider secretなし |
| root Local Executor | なし | policy/grantとgeneric requestにNode Runtime Tokenやprovider tokenを含めない。専用credential-stageのprivate Unix socket requestだけがraw tokenをroot境界へ渡し、log/durable request stateへ残さない。rotation/recoveryは固定canonical/staged identityだけを読み書きし、caller指定path/tokenは受け付けない | root所有policy、固定operation、短命mutation grantだけを受理 |

Host Agent用のNode Runtime Tokenは`/etc/autostream-host-agent/identity.json`へ入り、通常Nodeより強い更新境界にあります。fileをroot所有、group `autostream-host-agent`、mode `0640`にし、別hostへcopyしないでください。legacy `/etc/autostream/host-agent.json`はcanonical不在時のread-only fallbackだけで、両方が存在すればfail closedです。rotation前にmanaged migrationしてください。Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。

Bridge期間のlegacy `ssh_v1`では、中央Updater用Node Runtime TokenとGitHub Release Token、SSH鍵を既存の境界で扱います。これらを`pull_v2`の4項目configへコピーしません。`pull_v2`は固定Kome-Lab repositoryの公開immutable releaseを匿名HTTPSで取得し、長期release tokenをHost Agentへ配送しません。root applyのsource実装はありますが、公開releaseと実host canaryは未検証です。

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
