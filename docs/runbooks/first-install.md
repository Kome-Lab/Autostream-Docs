# 最初のインストール

この手順は、AutoStream を初めて Linux サーバーに入れて、Control Panel にログインし、各サービスが online になるところまでを対象にします。Docker でまとめて動かす場合は [Dockerでインストールする](../deployment/docker.md) を使ってください。

このページのservice installerはhostへ直接置くsystemd serviceだけを対象にし、
Docker Compose、container、image、Docker repositoryは変更しません。

実 token、stream key、OAuth refresh token、webhook URL、SMTP password はこのページや Git 管理ファイルに書きません。ここでは placeholder を使い、実値は `/etc/autostream/*.env`、Control Panel の secret 設定、または secret manager に入れます。

## 1. 構成を決める

MVP の最小構成は 1 台でも動かせます。

```text
1台構成:
  Control Panel
  MariaDB
  Observability
  Discord Bot
  Worker
  Encoder/Recorder
```

負荷を分ける場合は、管理系と実行系を分けます。

```text
管理サーバー:
  Control Panel
  MariaDB
  Observability

実行サーバー:
  Discord Bot
  Worker
  Encoder/Recorder
```

各サービスは同じサーバー上に置いても、別プロセス、別 systemd unit、別 env、別 Node ID、別 `config.yml`、別 data directory として扱います。

## 2. OS と共通パッケージを入れる

Ubuntu / Debian 系の例です。

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates coreutils curl findutils gawk jq openssl tar util-linux mariadb-client ffmpeg fontconfig fonts-noto-cjk
```

service installerが`autostream` OS account、`/etc/autostream`、serviceごとの
data directoryを必要に応じて作成します。Encoder Recorderが使う`ffmpeg`、Workerの画像生成が使う`fontconfig`と`fonts-noto-cjk`、MariaDB、reverse proxyなどの
外部packageや設定はinstallerの対象外です。GitHub CLIはarchiveを取得・検証する
管理端末だけで使い、対象サーバーには導入しません。

### 管理端末にGitHub CLIを用意する

GitHub Releaseからprivate repoのartifactを取得するため、管理端末でGitHub CLIを
使います。次はUbuntu / Debian系の管理端末の例です。すでに`gh`が入っていて
ログイン済みなら、このblockは`gh auth status`だけ確認してください。

```bash
if ! command -v gh >/dev/null 2>&1; then
  sudo install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y gh
fi

gh auth status || gh auth login
```

同じサーバーに MariaDB も置く場合:

```bash
sudo apt-get install -y mariadb-server
sudo systemctl enable --now mariadb
sudo systemctl status mariadb
```

## 3. MariaDB に database を作る

現時点で DB に直接接続するサービスは Control Panel と Observability です。Encoder/Recorder、Worker、Discord Bot は Control Panel から runtime config を受け取り、個別 database は作りません。

DB password は実値に置き換えてください。ここに書いた password は例です。

```bash
sudo mariadb <<'SQL'
CREATE DATABASE IF NOT EXISTS autostream_control_panel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS autostream_observability CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'autostream'@'%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON autostream_control_panel.* TO 'autostream'@'%';
GRANT ALL PRIVILEGES ON autostream_observability.* TO 'autostream'@'%';
FLUSH PRIVILEGES;
SQL
```

DB 接続を確認します。

```bash
mariadb -h 127.0.0.1 -u autostream -p autostream_control_panel -e "SELECT 1;"
```

## 4. secret を生成する

まずローカルで生成できる値を作ります。出力は password manager または secret manager に保存してください。

```bash
openssl rand -hex 32   # AUTOSTREAM_SESSION_SECRET
openssl rand -hex 32   # AUTOSTREAM_SECRET_ENCRYPTION_KEY
openssl rand -hex 32   # AUTOSTREAM_SETUP_TOKEN
openssl rand -hex 32   # AUTOSTREAM_STREAM_INGEST_SIGNING_KEY
```

Observability 用の別admin tokenや直接ingest tokenは作りません。Control Panel は登録済み Observability Node の公開URLと Node Runtime Token で Observability API を呼びます。詳しい対応表と PowerShell での生成方法は [秘密情報とtoken生成](../security/tokens.md) を参照してください。

各サービスの登録、heartbeat、PanelからNodeへの操作には、必須のNode `config.yml`から読み込むrotating Runtime Tokenだけを使います。Worker / Encoder Recorderのstream ingest signing keyも同じファイルで配布します。共有tokenやNode側の署名鍵envへのfallbackはありません。

## 5. 1つのhost release archiveをinstallerで配置する

新しいarchive-only形式のhost releaseでは、手動導入のためにサーバーへ渡すrelease
assetは対象serviceの`.tar.gz` 1つだけです。archiveには
`artifact-manifest.json`、`checksums.txt`、installer、binary、unit、設定例が
含まれます。service repositoryごとにsource versionは独立しているため、全serviceへ
同じtagを指定しません。

> [!IMPORTANT]
> 以下は公開済みapplication archiveに固定した説明で、v2対応releaseの公開証拠ではありません。
> application用archive-only Host ReleaseはControl Panelが`v1.9.11`、
> 4つのruntime serviceが`v1.3.1`です。componentごとにrepositoryとtagを一致させ、
> 古いreleaseへ読み替えず、その版を使う場合だけ次のliteral commandを使います。
> v2を導入する場合は、対応する新しいimmutable releaseと全componentを先に検証してください。

| component | release repo | 使うarchive | 安定した実行path |
| --- | --- | --- | --- |
| Control Panel | `Kome-Lab/Autostream-ControlPanel` | `autostream-control-panel_v1.9.11_linux_amd64.tar.gz` | `/usr/local/bin/control-panel` |
| Discord Bot | `Kome-Lab/Autostream-DiscordBot` | `autostream-discord-bot_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-discord-bot` |
| Encoder/Recorder | `Kome-Lab/Autostream-Encoder-Recorder` | `autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-encoder-recorder` |
| Observability | `Kome-Lab/Autostream-Observability` | `autostream-observability_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-observability` |
| Worker | `Kome-Lab/Autostream-Worker` | `autostream-worker_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-worker` |

独立Updaterは上表のservice installerから自動導入されません。検証済みの独立releaseからHost Agent / Local Executorを物理ホストごとに1組導入します。v2 releaseの公開とcanaryは別gateです。
`autostream-contracts`は各binaryが利用するsource contract repositoryであり、
サーバーへ単独導入するdaemonやrelease archiveはありません。

releaseを取得できる管理端末で必要なarchive本体だけを
downloadし、rootとして実行する前にGitHub Attestationを確認します。次は全component
を同じ物理ホストへ置く場合のamd64用commandです。実際には、そのhostへ配置する
componentだけを取得してください。

```bash
gh release download v1.9.11 --repo Kome-Lab/Autostream-ControlPanel \
  --pattern 'autostream-control-panel_v1.9.11_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-control-panel_v1.9.11_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners

gh release download v1.3.1 --repo Kome-Lab/Autostream-Encoder-Recorder \
  --pattern 'autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-Encoder-Recorder \
  --signer-workflow Kome-Lab/Autostream-Encoder-Recorder/.github/workflows/release-host.yml \
  --deny-self-hosted-runners

gh release download v1.3.1 --repo Kome-Lab/Autostream-Worker \
  --pattern 'autostream-worker_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-worker_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-Worker \
  --signer-workflow Kome-Lab/Autostream-Worker/.github/workflows/release-host.yml \
  --deny-self-hosted-runners

gh release download v1.3.1 --repo Kome-Lab/Autostream-DiscordBot \
  --pattern 'autostream-discord-bot_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-discord-bot_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-DiscordBot \
  --signer-workflow Kome-Lab/Autostream-DiscordBot/.github/workflows/release-host.yml \
  --deny-self-hosted-runners

gh release download v1.3.1 --repo Kome-Lab/Autostream-Observability \
  --pattern 'autostream-observability_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-observability_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-Observability \
  --signer-workflow Kome-Lab/Autostream-Observability/.github/workflows/release-host.yml \
  --deny-self-hosted-runners

```

成功した元の`.tar.gz`だけを安全な経路で該当サーバーの`/tmp`へ転送します。サーバーに
GitHub CLI、`.tar.gz.sha256`、`release-manifest.json`、
`release-manifest.json.sha256`を持ち込む必要はありません。サーバーでは元の
basenameを変更せずroot所有directoryへ固定し、archiveと展開directoryが隣接した
状態でinstallerを実行します。

同じhostへ5 serviceを置く場合は、次を上から実行します。各installerは
serviceを開始・再起動しないため、この時点で起動中processはありません。

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-control-panel_v1.9.11_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/autostream-worker_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/autostream-discord-bot_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/autostream-observability_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts

sudo test ! -e autostream-control-panel_v1.9.11_linux_amd64
sudo test ! -L autostream-control-panel_v1.9.11_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-control-panel_v1.9.11_linux_amd64.tar.gz
sudo ./autostream-control-panel_v1.9.11_linux_amd64/install-autostream-control-panel

sudo test ! -e autostream-encoder-recorder_v1.3.1_linux_amd64
sudo test ! -L autostream-encoder-recorder_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-encoder-recorder_v1.3.1_linux_amd64/install-autostream-encoder-recorder

sudo test ! -e autostream-worker_v1.3.1_linux_amd64
sudo test ! -L autostream-worker_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-worker_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-worker_v1.3.1_linux_amd64/install-autostream-worker

sudo test ! -e autostream-discord-bot_v1.3.1_linux_amd64
sudo test ! -L autostream-discord-bot_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-discord-bot_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-discord-bot_v1.3.1_linux_amd64/install-autostream-discord-bot

sudo test ! -e autostream-observability_v1.3.1_linux_amd64
sudo test ! -L autostream-observability_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-observability_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-observability_v1.3.1_linux_amd64/install-autostream-observability
```

物理ホストごとのHost Agent / Local Executorは独立Updaterの検証済みpackageをprepareしてからconfigureします。Control Panelと同じarchiveを流用しません。[システム更新](/operations/system-updates)の前提、取得元、順序、公開・実機gateを確認してください。

Auto Configureは`/etc/autostream/updater/agent.yaml`と`/etc/autostream/updater/executor-policy.json`だけへidentityとpolicyを保存します。旧identityやenvへのfallbackはありません。安全なowner/modeとparent traversalは独立Updater installerが管理し、手動で広い権限を付与しません。

installerは元archiveを安定して読み取り、
`artifact-manifest.json`、archive内`checksums.txt`、host architecture、binary
versionを確認し、元archiveのSHA-256を算出して記録してから、`autostream`
account、managed release、systemd unit、env placeholder、data directory、安定した
`/usr/local/bin` pathを配置します。Control Panelでは
`/usr/share/autostream-control-panel`も配置します。内部checksumはarchive内の
整合性確認であり、GitHub由来の真正性は転送前のAttestation確認が担います。

内部の`/opt/autostream/<service>/releases/`、`current` symlink、digest、
markerはinstallerとupdaterが管理します。手動で作成、編集しないでください。
既存の直接配置binaryやControl Panel web assetsは初回実行時にmanaged配置へ
移行し、既存envは上書きせず保持します。旧fileはserviceの書込範囲外にある
`/var/backups/autostream/install-migrations/<service>`へroot専用で退避します。
source checkoutからbuildしたbinaryや
manifestなしreleaseは自動更新へ使わず、新しいimmutable releaseを公開します。

GitHub Releaseには、自動Updaterの検証用としてarchive sidecar、
`release-manifest.json`、manifest sidecarも引き続き公開されます。これらは
自動Updaterが取得・検証するassetであり、archive-onlyの手動導入ではdownloadも
uploadもしません。既存のimmutableな旧release assetは書き換えません。上記は
公開Control Panel `v1.9.11`とruntime service `v1.3.1`の版固定のapplication archive手順です。
v2 listenerや独立Updaterの契約を満たす証拠にはならず、v2導入では対応する新しいimmutable releaseを検証してください。
Control Panel `v1.8.x`、runtime service `v1.2.x`から更新する
場合は、[Linuxホストで直接動かす](/deployment/host#既存環境を更新するとき)の
backupと再起動境界も先に確認します。

独立Updaterの検証済みreleaseでHost Agent / Local Executorを更新します。Control Panelとのprotocol major 2、policy、identity probeの一致が前提です。通常の`--upgrade`は既存identity/policyとRuntime Tokenを保持するためConfigure Tokenは不要です。`--upgrade --recover-active-job`はreleaseが許可したexact pairとactive interrupted jobだけに使います。

rescue modeは再stage・再applyしません。journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。systemd conditionを回避しないでください。完全な前提と順序は[システム更新](/operations/system-updates)を参照してください。

## 6. Control Panel を入れる

前節の`install-autostream-control-panel`を実行すると、binary、web asset、
systemd unit、envのplaceholderまで配置されます。systemdは安定した
`/usr/local/bin/control-panel`を実行します。installerはserviceを開始しないため、
envを編集してから明示的に起動します。

`/etc/autostream/control-panel.env` を編集します。

```bash
sudoedit /etc/autostream/control-panel.env
```

最低限、次を実値にします。

```text
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_WEB_DIR=/usr/share/autostream-control-panel
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
DATABASE_URL=mysql://autostream:<DB_PASSWORD>@tcp(127.0.0.1:3306)/autostream_control_panel?parseTime=true
# 既存構成からの移行中だけ使う fallback。新規 Node は config.yml の Node Runtime Token を使います。
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=encoder.example.com,worker.example.com,discord-bot.example.com,observability.example.com
AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-control-panel
sudo systemctl start autostream-control-panel
sudo systemctl status autostream-control-panel
journalctl -u autostream-control-panel -n 100 --no-pager
```

health を確認します。

```bash
curl -fsS http://127.0.0.1:8080/health
```

## 7. 初回管理者を作る

ブラウザで `AUTOSTREAM_PUBLIC_URL` を開くか、API で作成します。

```bash
curl -fsS -X POST http://127.0.0.1:8080/setup/first-admin \
  -H 'Content-Type: application/json' \
  -d '{"setup_token":"<SETUP_TOKEN>","username":"admin","password":"<ADMIN_PASSWORD>"}'
```

初回管理者を作ったら、`AUTOSTREAM_SETUP_TOKEN` を rotation するか、以後使わない値に変更して Control Panel を再起動してください。

```bash
sudoedit /etc/autostream/control-panel.env
sudo systemctl restart autostream-control-panel
```

## 8. Nodeを作って `config.yml` を保存する

Control Panel の Node登録画面で、Encoder/Recorder、Worker、Discord Bot、Observability を Node として作ります。入力するのは Node名、Host、Port、SSL、説明です。version、capability、public URL 全体は入力しません。

| service | Node type | 保存する config |
| --- | --- | --- |
| Encoder/Recorder | `encoder_recorder` | `/etc/autostream-encoder-recorder/config.yml` |
| Worker | `worker` | `/etc/autostream-worker/config.yml` |
| Discord Bot | `discord_bot` | `/etc/autostream-discord-bot/config.yml` |
| Observability | `observability` | `/etc/autostream-observability/config.yml` |

各 Node の Configuration から `config.yml` を保存します。

```bash
sudo install -d -o root -g autostream -m 0750 /etc/autostream-encoder-recorder
sudo install -d -o root -g autostream -m 0750 /etc/autostream-worker
sudo install -d -o root -g autostream -m 0750 /etc/autostream-discord-bot
sudo install -d -o root -g autostream -m 0750 /etc/autostream-observability
sudo install -o root -g autostream -m 0640 encoder-recorder.yml /etc/autostream-encoder-recorder/config.yml
sudo install -o root -g autostream -m 0640 worker.yml /etc/autostream-worker/config.yml
sudo install -o root -g autostream -m 0640 discord-bot.yml /etc/autostream-discord-bot/config.yml
sudo install -o root -g autostream -m 0640 observability.yml /etc/autostream-observability/config.yml
```

Auto Configure command を使う場合も、各サービスの `/etc/autostream-<service>` 配下は同じ権限で自動作成されます。

各 env の `AUTOSTREAM_NODE_CONFIG` で、対応するサービス専用の config path を指定します。

Configure Token と Node Runtime Token は作成直後だけ表示されます。紛失した場合は Configuration から再生成してください。

サービスごとの詳しい env、systemd、起動確認は次のページも参照してください。

| service | 詳細手順 |
| --- | --- |
| Control Panel | [Control Panelを導入する](../services/control-panel-install.md) |
| Encoder/Recorder | [Encoder Recorderを導入する](../services/encoder-recorder-install.md) |
| Worker | [Workerを導入する](../services/worker-install.md) |
| Discord Bot | [Discord Botを導入する](../services/discord-bot-install.md) |
| Observability | [Observabilityを導入する](../services/observability-install.md) |

## 9. 各 service を入れる

手順5で各archiveのservice installerを実行すると、次の安定したbinary path、
systemd unit、env placeholderが配置されます。

| service | systemdが実行するbinary |
| --- | --- |
| Discord Bot | `/usr/local/bin/autostream-discord-bot` |
| Worker | `/usr/local/bin/autostream-worker` |
| Encoder/Recorder | `/usr/local/bin/autostream-encoder-recorder` |
| Observability | `/usr/local/bin/autostream-observability` |

`/usr/local/bin/autostream-<service>`はoperator、systemd、Auto Configureが使う
安定したpathです。その先のmanaged releaseはinstallerが管理します。envを編集後、
serviceを明示的に起動し、各`README.install.md`の`MainPID`確認まで実行します。

各 env を編集します。

```bash
sudoedit /etc/autostream/encoder-recorder.env
sudoedit /etc/autostream/worker.env
sudoedit /etc/autostream/discord-bot.env
sudoedit /etc/autostream/observability.env
```

最低限そろえる値:

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-<SERVICE>/config.yml
```

`config.yml` の中に Node ID、Node API URL、Control Panel URL、Node Runtime Token が入ります。Worker / Encoder Recorder では `stream_ingest.signing_key` も入ります。`CONTROL_PANEL_TOKEN`、`SERVICE_ID`、`SERVICE_PUBLIC_URL`、Node側の `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` を手でそろえる運用にはしません。

Observability だけは DB を直接使うため、追加で次を設定します。Control Panel の `DATABASE_URL` は手順 6 で設定済みです。

```text
DATABASE_URL=mysql://autostream:<DB_PASSWORD>@tcp(127.0.0.1:3306)/autostream_observability?parseTime=true
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
```

Encoder/Recorder ではarchive path、FFmpeg、Worker映像用SRT/UDP endpointを設定します。

```text
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
FFMPEG_BIN=ffmpeg
AUTOSTREAM_WORKER_VIDEO_BIND_ADDR=0.0.0.0:10080
AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST=encoder-media.example.internal
```

`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST`はprimary WorkerからUDP到達できるhost名またはIPへ置き換え、scheme、port、pathを含めません。host firewall、cloud firewall、NATではWorker hostからUDP `10080`だけを許可します。

Workerでは画像生成用の日本語fontを確認し、font pathを必ず設定します。WorkerにFFmpegは不要です。

```text
AUTOSTREAM_SCENE_FONT_FILE=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

Worker は `config.yml` の stream ingest signing key で Discord Bot からの stream-scoped `worker_events` token を検証し、同じファイルの Node Runtime Token で Control Panel 経由の signal 送信を行います。参加者、発言中状態、現在時刻、字幕、チャットからscene画像を生成し、低頻度のMJPEG画像列として配信jobで選択されたEncoder Recorderへjob-scopedに暗号化したSRT over UDPで送ります。動画encodeと音声MUXはEncoder Recorderが担当します。

Encoder RecorderのSRT bind/advertise UDP endpointは、Node APIのHTTPS URLやCloudflare Tunnelとは別に設定します。primary Worker hostからadvertise先へUDP到達できることを、host firewall、cloud firewall、NATを含めて確認してください。Control Panelがjobごとに渡すSRT token/passphraseはFFmpeg argv、URL、service log、audit、env、永続fileへ出しません。

Discord token、YouTube stream key、Google Drive folder、OAuth refresh token、webhook URL、SMTP password は、MVP 標準では Control Panel の Integration / Secret / Notification から登録します。互換 fallback を使う場合だけ service env に入れます。

## 10. service を起動する

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-observability
sudo systemctl enable autostream-encoder-recorder
sudo systemctl enable autostream-worker
sudo systemctl enable autostream-discord-bot
sudo systemctl start autostream-observability
sudo systemctl start autostream-encoder-recorder
sudo systemctl start autostream-worker
sudo systemctl start autostream-discord-bot

systemctl status autostream-observability
systemctl status autostream-encoder-recorder
systemctl status autostream-worker
systemctl status autostream-discord-bot
```

v2のWorker、Encoder Recorder、Discord Bot、Observabilityでは、Node `config.yml`と`listener.credential: node-listener.json`が指定するlistener credentialを起動前に配置します。systemd `LoadCredential`が固定JSONを渡し、欠落や不正なservice type / revisionではstartupがfail closedで停止します。Auto Configureで設定を揃えてから対象serviceを明示的にrestartし、登録とruntime configの初期読込を確認してください。

各 service の health を確認します。

```bash
curl -fsS http://127.0.0.1:8081/health  # Encoder/Recorder の local port 例
curl -fsS http://127.0.0.1:8082/health  # Observability の local port 例
curl -fsS http://127.0.0.1:8083/health  # Discord Bot の local port 例
curl -fsS http://127.0.0.1:8084/health  # Worker の local port 例
```

実際のportはControl Panelでは`AUTOSTREAM_BIND_ADDR`、4種類の通常Nodeでは`node-listener.json`の`bind_address`に合わせてください。Nodeの公開接続先を示す`api.host` / `api.port`とは分離します。

## 11. Control Panel で確認する

1. Control Panel に admin でログインします。
2. Service Health で Encoder/Recorder、Worker、Discord Bot、Observability が online になり、version、OS、arch、capability が Node から自動報告されていることを確認します。
3. Services / Assignments で stream 用の primary service を割り当てます。
4. Integrations で Discord、YouTube、Google Drive、notification channel を登録します。
5. Start readiness を実行し、不足している設定がないことを確認します。
6. host更新を使う場合は配信serviceのhealth確認後に[システム更新](/operations/system-updates)へ進みます。物理hostごとに独立Updaterを1つ登録し、protocol major 2、exact policy、host fence、実canaryを確認してから更新を許可します。

## 12. 初回確認コマンド

docs repo がある場合は、ローカル検証を実行します。

```bash
cd /opt/autostream/src/autostream-docs
npm ci
npm run docs:check
npm run docs:build
```

Control Panel と Node Agent の疎通は次で見ます。

```bash
journalctl -u autostream-control-panel -n 100 --no-pager
journalctl -u autostream-encoder-recorder -n 100 --no-pager
journalctl -u autostream-worker -n 100 --no-pager
journalctl -u autostream-discord-bot -n 100 --no-pager
journalctl -u autostream-observability -n 100 --no-pager
```

ここまで通ったら、[最初の配信を始める](./start-first-stream.md) に進みます。
