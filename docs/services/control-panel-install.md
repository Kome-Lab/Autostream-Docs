# Control Panelを導入する

Control Panel は最初に起動するサービスです。ユーザー、権限、配信設定、外部連携、サービス登録、監視画面の入口になるため、ほかのサービスより先に database、公開URL、session secret、暗号化keyを整えます。

## 導入前に決めること

| 決めるもの | 例 | メモ |
| --- | --- | --- |
| 公開URL | `https://<CONTROL_PANEL_HOST>` | OAuth callback と cookie に関係します |
| database | MariaDB | `DATABASE_URL` に入れます |
| session secret | `<SESSION_SECRET>` | 長くランダムな値にします |
| secret encryption key | `<SECRET_ENCRYPTION_KEY>` | 保存 secret の暗号化に使います |
| Node Runtime Token暗号化 | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Node登録で生成した runtime token の暗号化保存に使います |
| stream ingest signing key | `<STREAM_INGEST_SIGNING_KEY>` | Control Panel が stream scoped ingest token を発行するために使います |
| allowed service hosts | `<SERVICE_HOSTS>` | 各サービスの公開URLを許可します |

Discord token、YouTube stream key、Google OAuth secret、通知Webhook URLは、Control Panel起動用envではなく、画面から登録する運用値です。

secret と token の生成方法は [秘密情報とtoken生成](/security/tokens) を参照してください。Observability との接続は Control Panel env ではなく、Node登録済み `observability` Node の公開URLと Node Runtime Token から解決します。

## host直接起動

`artifact-manifest.json`を含むarchive-only形式のhost releaseを使います。管理端末で
archive本体だけをdownloadしてGitHub Attestationを確認し、確認済みの元`.tar.gz`
だけをサーバーへ転送します。サーバーではarchive basenameを変更せずroot-owned
directoryへ固定し、元archiveと展開directoryを隣接させて、archive直下で次を
実行します。

公開`v1.9.10`のarchive-only releaseを使用し、古いreleaseへ読み替えないでください。

管理端末:

```bash
gh release download v1.9.10 --repo Kome-Lab/Autostream-ControlPanel \
  --pattern 'autostream-control-panel_v1.9.10_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-control-panel_v1.9.10_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元archiveだけを`/tmp`へ転送した後のサーバー:

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-control-panel_v1.9.10_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-control-panel_v1.9.10_linux_amd64
sudo test ! -L autostream-control-panel_v1.9.10_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-control-panel_v1.9.10_linux_amd64.tar.gz
sudo ./autostream-control-panel_v1.9.10_linux_amd64/install-autostream-control-panel
```

installerはarchive内部の`artifact-manifest.json`、`checksums.txt`、host
architecture、binary versionを検証し、元archiveのSHA-256を記録してから、
`autostream` account、rollback可能な内部release、systemd unit、env
placeholder、backup executableとdirectory、MariaDB defaults placeholderを
配置します。operatorとsystemdは`/usr/local/bin/control-panel`、web assetsは
`/usr/share/autostream-control-panel`を使います。内部の
`/opt/autostream/control-panel/current`、digest、markerはinstallerとupdaterが
管理するため、手動で作成、編集しません。

既存の直接配置binary/web assetsは初回実行時にmanaged配置へ移行し、既存envは
上書きしません。旧fileは`/var/backups/autostream/install-migrations/control-panel`
へroot専用で退避します。installerはserviceを開始せず、Docker Compose、container、
image、Docker repository、MariaDB、reverse proxyを変更しません。詳しい取得と
検証手順は[Linuxホストで直接動かす](/deployment/host)を参照してください。

外部archive sidecarと`release-manifest.json*`は自動Updater/旧client互換のため
releaseには残りますが、この手動導入ではdownloadもuploadもしません。手動導入には
`artifact-manifest.json`を含む公開`v1.9.10` archiveだけを使用します。

backup executableとroot-only defaults placeholderの配置は自動ですが、実際の
MariaDB backup account、password、database grant、database nameはarchive同梱
`README.install.md`に従ってoperatorが設定し、実dumpを確認してください。

Control Panel `v1.8.x`からの更新では既存envと起動中の旧`MainPID`を維持したまま
installerを実行し、database backup、旧backup credential pathの確認、明示的な
restartとhealth確認を行います。`v1.8.0` / `v1.8.1`からの初回起動ではmigration
059が適用され、`v1.8.2`には既に059があります。手順は
[既存環境を更新するとき](/deployment/host#既存環境を更新するとき)を参照して
ください。service installerはHost Agentを自動導入しません。

`/etc/autostream/control-panel.env` を編集します。

```text
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://<CONTROL_PANEL_HOST>
AUTOSTREAM_WEB_DIR=/usr/share/autostream-control-panel
DATABASE_URL=mysql://<DB_USER>:<DB_PASSWORD>@tcp(<DB_HOST>:3306)/autostream_control_panel?parseTime=true
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
# 既存構成からの移行中だけ使う fallback。新規 Node は config.yml の Node Runtime Token を使います。
SERVICE_CALL_TOKEN=
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=<SERVICE_HOSTS>
AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true
# 任意。Control Panel と各Nodeサービスは、それぞれ対応する Kome-Lab GitHub Releases を確認します。
# private repo の release 確認には AUTOSTREAM_UPDATE_CHECK_TOKEN が必要です。
# 固定値を使う場合は *_LATEST_VERSION、ネットワーク確認を止める場合は *_UPDATE_CHECK_URL=off を設定します。
AUTOSTREAM_LATEST_VERSION=
AUTOSTREAM_UPDATE_CHECK_URL=
AUTOSTREAM_WORKER_LATEST_VERSION=
AUTOSTREAM_WORKER_UPDATE_CHECK_URL=
AUTOSTREAM_ENCODER_RECORDER_LATEST_VERSION=
AUTOSTREAM_ENCODER_RECORDER_UPDATE_CHECK_URL=
AUTOSTREAM_DISCORD_BOT_LATEST_VERSION=
AUTOSTREAM_DISCORD_BOT_UPDATE_CHECK_URL=
AUTOSTREAM_OBSERVABILITY_LATEST_VERSION=
AUTOSTREAM_OBSERVABILITY_UPDATE_CHECK_URL=
AUTOSTREAM_DOCKER_LATEST_VERSION=
AUTOSTREAM_DOCKER_UPDATE_CHECK_URL=
AUTOSTREAM_UPDATE_CHECK_TOKEN=
TZ=Asia/Tokyo
```

Control Panel の現在 version は画面左上とヘッダーに表示されます。Host Release workflow と Docker build は build 時に version / commit / build date を埋め込むため、通常は `SERVICE_VERSION` を手入力する必要はありません。systemd配備はControl Panel、Worker、Encoder/Recorder、Discord Bot、ObservabilityそれぞれのGitHub Releases API、Docker配備は`Autostream-Docker`のbundle releaseを確認します。private repo のため、本番ではreleaseを読めるGitHub tokenを `AUTOSTREAM_UPDATE_CHECK_TOKEN` に設定してください。これはversion表示用の確認tokenであり、システム更新画面へ保存する必須のGitHub Release Tokenとは別です。固定値や別endpointを使う場合は、上記のサービス別環境変数を設定します。URLはHTTPSを使います。固定latest-version値やcustom endpointは検出・表示専用です。GitHub Releaseの`release-manifest.json` assetを検証できないため、Application Infoからの自動更新は`manifest_unverified`として無効になります。

新規hostでは、物理ホストごとにendpointlessな`pull_v2` Update Agentを登録し、非rootの`autostream-host-agent`とroot Local Executorを1つずつ置きます。登録直後はepoch `0`のobserverで、Control Panel上の明示的なownership切替後だけ更新jobをclaimします。公開releaseと実host canaryが未確認の間、更新適用が必要な既存hostはBridge期間中のlegacy `ssh_v1`を維持します。Control Panel自身はfleetの最後に移行します。詳細は[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-control-panel
sudo systemctl start autostream-control-panel
sudo systemctl status autostream-control-panel
```

## Dockerで起動する場合

compose を使う場合も、考え方は同じです。

1. MariaDB を先に起動します。
2. Control Panel の env を作ります。
3. Control Panel container を起動します。
4. reverse proxy から HTTPS で公開します。
5. `AUTOSTREAM_PUBLIC_URL` が実際にブラウザで開くURLと一致することを確認します。

`AUTOSTREAM_BIND_ADDR` は container 内では `0.0.0.0:<PORT>`、host直接起動でreverse proxyの後ろに置く場合は `127.0.0.1:<PORT>` が扱いやすいです。

## 初回ログインまで

1. database migration が成功していることをログで確認します。
2. ブラウザで `AUTOSTREAM_PUBLIC_URL` を開きます。
3. [初回管理者を作る](/runbooks/create-first-admin) の手順で管理者を作ります。
4. Settings でメールサーバーを保存してテスト送信し、必要なら Cloudflare Turnstile の site key / secret key を保存します。
5. Security Settings で password policy、session、MFA方針を確認します。
6. Users / Roles で運用担当者の権限を分けます。
7. Node登録で各サービス用 Node を作り、Configuration から `config.yml` を取得します。

## Nodeを作る

Control Panel の [Node Agent登録](/control-panel/node-agent-registration) で、サービスごとに Node を分けて作ります。

| サービス | Node type | Configurationで取得するもの |
| --- | --- | --- |
| Discord Bot | `discord_bot` | `config.yml`、Configure Token、Node Runtime Token |
| Worker | `worker` | `config.yml`、Configure Token、Node Runtime Token |
| Encoder Recorder | `encoder_recorder` | `config.yml`、Configure Token、Node Runtime Token |
| Observability | `observability` | `config.yml`、Configure Token、Node Runtime Token |
| `pull_v2` Host Agent | `update_agent` | 物理ホストごとにAuto Configureを1回実行し、root所有`/etc/autostream-host-agent/identity.json`へ4項目identityだけを生成。受信TCP、`8090`、SSH設定なし |

Configure TokenとNode Runtime Tokenは作成時だけ表示されます。通常serviceはConfigurationから再生成して`config.yml`を更新します。未起動のHost AgentはConfigure Tokenを再発行して4項目identityを作り直せますが、activeな`pull_v2` Host AgentのRuntime Tokenをgeneric再生成してはいけません。専用のstage→claim→local ack→heartbeat proof→activateを使い、漏えい時のbreak-glassは`emergency-revoke`後に固定canonical identityとroot recovery commandで復旧します。`execution_host_id`と`ownership_epoch`はserver-ownedでconfigへ入れません。

## 他サービスを許可する

`AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS` には、Control Panel が到達してよいサービスの host を入れます。

```text
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=<ENCODER_HOST>,<WORKER_HOST>,<BOT_HOST>,<OBSERVABILITY_HOST>
```

本番では `AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true` を維持します。新しいサービスhostを増やしたら env を更新して Control Panel を再起動してください。

## 起動確認

| 確認 | 正常な状態 |
| --- | --- |
| `/` を開く | login画面またはdashboardが表示される |
| `journalctl` | database接続、migration、static file のエラーがない |
| Security Settings | 本番向けのsession、MFA方針が設定できる |
| Node登録 | サービス用Nodeを作成し、`config.yml` を取得できる |
| Service Health | 後続サービスが起動後にonlineになる |

## よくあるトラブル

| 症状 | 対応 |
| --- | --- |
| ログイン後に戻される | `AUTOSTREAM_PUBLIC_URL`、cookie secure、reverse proxy の `X-Forwarded-Proto` を確認 |
| OAuth callback が失敗する | provider側のcallback URLと `AUTOSTREAM_PUBLIC_URL` を合わせる |
| サービスURLが拒否される | `AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS` にhostを追加 |
| secret更新後も反映されない | 対象サービスのruntime config更新、service再起動、Service Healthを確認 |
| 画面が真っ白 | web assets の配置先と `AUTOSTREAM_WEB_DIR` を確認 |

## 次にやること

- [DiscordとYouTube](/control-panel/discord-youtube) を設定する
- [OAuthとDrive保存先](/control-panel/integrations-drive) を設定する
- [サービス割り当て](/control-panel/services-workers) で各サービスの online を確認する
- [最初の配信を始める](/runbooks/start-first-stream) に進む
