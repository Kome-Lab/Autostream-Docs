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
data directoryを必要に応じて作成します。Encoder RecorderとWorkerが使う`ffmpeg`、Workerの映像生成が使う`fontconfig`と`fonts-noto-cjk`、MariaDB、reverse proxyなどの
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

新方式では、各サービスの登録、heartbeat、Panel から Node への操作に使う token は Node登録後の `config.yml` で配布します。Worker / Encoder Recorder の stream ingest signing key も同じファイルへ入ります。`SERVICE_CALL_TOKEN` とNode側の署名鍵envは古い構成からの移行用 fallback としてだけ使います。

## 5. 1つのhost release archiveをinstallerで配置する

新しいarchive-only形式のhost releaseでは、手動導入のためにサーバーへ渡すrelease
assetは対象serviceの`.tar.gz` 1つだけです。archiveには
`artifact-manifest.json`、`checksums.txt`、installer、binary、unit、設定例が
含まれます。service repositoryごとにsource versionは独立しているため、全serviceへ
同じtagを指定しません。

> [!IMPORTANT]
> 現在のarchive-only Host ReleaseはControl Panel / Host Agentが`v1.9.11`、
> 4つのruntime serviceが`v1.3.1`です。componentごとにrepositoryとtagを一致させ、
> 古いreleaseへ読み替えず、次のliteral commandをそのまま使ってください。

| component | release repo | 使うarchive | 安定した実行path |
| --- | --- | --- | --- |
| Control Panel | `Kome-Lab/Autostream-ControlPanel` | `autostream-control-panel_v1.9.11_linux_amd64.tar.gz` | `/usr/local/bin/control-panel` |
| Host Agent + Local Executor | `Kome-Lab/Autostream-ControlPanel` | `autostream-host-agent_v1.9.11_linux_amd64.tar.gz` | `/usr/local/bin/autostream-host-agent` |
| Discord Bot | `Kome-Lab/Autostream-DiscordBot` | `autostream-discord-bot_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-discord-bot` |
| Encoder/Recorder | `Kome-Lab/Autostream-Encoder-Recorder` | `autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-encoder-recorder` |
| Observability | `Kome-Lab/Autostream-Observability` | `autostream-observability_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-observability` |
| Worker | `Kome-Lab/Autostream-Worker` | `autostream-worker_v1.3.1_linux_amd64.tar.gz` | `/usr/local/bin/autostream-worker` |

Host Agentは上表のservice installerから自動導入されません。
Control Panelと同じrepositoryにある別の
`autostream-host-agent_v1.9.11_linux_amd64.tar.gz`を使い、物理ホストごとに
1つだけ導入します。このarchiveにはroot Local Executorも含まれます。
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

gh release download v1.9.11 --repo Kome-Lab/Autostream-ControlPanel \
  --pattern 'autostream-host-agent_v1.9.11_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-host-agent_v1.9.11_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
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

物理ホストごとにHost Agentも新規導入する場合は、そのhostで別archiveを配置して
fresh-only prepareを実行します。既存Host Agentがあるhostでは実行せず、専用
self-updateを使ってください。

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-host-agent_v1.9.11_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-host-agent_v1.9.11_linux_amd64
sudo test ! -L autostream-host-agent_v1.9.11_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-host-agent_v1.9.11_linux_amd64.tar.gz
sudo ./autostream-host-agent_v1.9.11_linux_amd64/install/install-autostream-host-agent --prepare
```

prepare後もHost Agent / Local Executorは起動しません。Control Panelで`pull_v2`
Update Agentを登録し、生成されたConfigure commandを実行してからLocal Executorを
明示的にactivateします。完全な順序は
[Host Agent Bridgeでサービスを更新する](/operations/system-updates#pull_v2-host-agentを登録する)
を参照してください。

Auto Configureが書くHost Agent identityはcanonical
`/etc/autostream-host-agent/identity.json`だけです。通常serviceのsecret directory
`/etc/autostream`は`root:root 0750`を維持し、Host Agent userへACLやgroupで恒久的な
traverse権限を追加しません。legacy `/etc/autostream/host-agent.json`はcanonical不在時の
read-only fallbackだけです。このlegacy pathが存在する、
dangling symlinkである、または安全に検査できない場合は、先にmanaged migrationを
完了してください。affected `v1.9.9` hostではcandidate rollback時にも旧Agentを
再起動できるよう、exact access-only ACLをmatching `v1.9.11` upgrade完了まで保持します。
upgrade前から[ACL bridgeとcleanupの一続きの手順](/operations/system-updates#remove-v199-acl)
を実行してください。

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

GitHub Releaseには、自動Updaterと旧clientの互換用としてarchive sidecar、
`release-manifest.json`、manifest sidecarも引き続き公開されます。これらは
自動Updaterが取得・検証するassetであり、archive-onlyの手動導入ではdownloadも
uploadもしません。既存のimmutableな旧release assetは書き換えません。新規導入では
公開Control Panel / Host Agent `v1.9.11`とruntime service `v1.3.1`のarchive-only
releaseを使用してください。Control Panel `v1.8.x`、runtime service `v1.2.x`から更新する
場合は、[Linuxホストで直接動かす](/deployment/host#既存環境を更新するとき)の
backupと再起動境界も先に確認します。

既存Host Agent / Local Executorを`v1.9.11`へmanual upgradeする場合は、新規用の`--prepare`やAuto Configureを再実行しません。Control Panel `v1.9.11`を先に導入・再起動してから、通常は次を実行します。

```bash
sudo /opt/autostream/releases/artifacts/autostream-host-agent_v1.9.11_linux_amd64/install/install-autostream-host-agent --upgrade
```

Panel更新が`99%`の中断状態にあるときだけ、installed Agent / Executorが同じexact `v1.9.9` pairまたは同じexact `v1.9.10` pairであることをinstallerに検証させ、通常commandの代わりに`--upgrade --recover-active-job`を使います。Configure Tokenは不要です。rescueは同じjobのreconcileだけを行います。rescue modeは再stage・再applyしません。journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。systemd conditionを回避しないでください。直書きcommandとfail-closed条件は[既存Host Agent / Local Executorを`v1.9.11`へ更新する](/operations/system-updates#upgrade-host-agent-v1911)にまとめています。

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
SERVICE_CALL_TOKEN=
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
OBSERVABILITY_BIND_ADDR=127.0.0.1:8082
```

Encoder/Recorder ではarchive path、FFmpeg、Worker映像用SRT/UDP endpointを設定します。

```text
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
FFMPEG_BIN=ffmpeg
AUTOSTREAM_WORKER_VIDEO_BIND_ADDR=0.0.0.0:10080
AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST=encoder-media.example.internal
```

`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST`はprimary WorkerからUDP到達できるhost名またはIPへ置き換え、scheme、port、pathを含めません。host firewall、cloud firewall、NATではWorker hostからUDP `10080`だけを許可します。

Workerでも映像生成用のFFmpegと日本語fontを確認し、font pathを必ず設定します。

```text
FFMPEG_BIN=ffmpeg
AUTOSTREAM_SCENE_FONT_FILE=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

Worker は `config.yml` の stream ingest signing key で Discord Bot からの stream-scoped `worker_events` token を検証し、同じファイルの Node Runtime Token で Control Panel 経由の signal 送信を行います。参加者、発言中状態、現在時刻、字幕、チャットから映像を生成し、配信jobで選択されたEncoder Recorderへjob-scopedに暗号化したSRT over UDPで送ります。

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

`config.yml` を保存する前に Node Agent を起動した場合は `node config pending` として待機します。Auto Configure コマンドで `config.yml` を作成した後、Worker、Encoder Recorder、Discord Bot は `systemctl restart` で登録と runtime config の初期読込をそろえます。Observability は起動中に `config.yml` を再読込して登録を開始します。

各 service の health を確認します。

```bash
curl -fsS http://127.0.0.1:8081/health  # Encoder/Recorder の local port 例
curl -fsS http://127.0.0.1:8082/health  # Observability の local port 例
curl -fsS http://127.0.0.1:8083/health  # Discord Bot の local port 例
curl -fsS http://127.0.0.1:8084/health  # Worker の local port 例
```

実際の port は Control Panel では `AUTOSTREAM_BIND_ADDR`、Observability では `OBSERVABILITY_BIND_ADDR` に合わせてください。

## 11. Control Panel で確認する

1. Control Panel に admin でログインします。
2. Service Health で Encoder/Recorder、Worker、Discord Bot、Observability が online になり、version、OS、arch、capability が Node から自動報告されていることを確認します。
3. Services / Assignments で stream 用の primary service を割り当てます。
4. Integrations で Discord、YouTube、Google Drive、notification channel を登録します。
5. Start readiness を実行し、不足している設定がないことを確認します。
6. Host Agent Bridgeを準備する場合は、配信serviceのhealth確認後に[Host Agent Bridgeでサービスを更新する](/operations/system-updates)へ進みます。物理ホストごとにendpointlessな`pull_v2` Update Agent Nodeを1つ登録し、非rootの`autostream-host-agent`とroot Local Executorを導入します。Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。初回はepoch `0`のobserverとして起動し、公開`v1.9.11`のAttestation、実host canary、rollback drillを確認するまではownershipを切り替えず、legacy `ssh_v1`を維持してください。

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
