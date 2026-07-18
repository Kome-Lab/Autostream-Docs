# 最初のインストール

この手順は、AutoStream を初めて Linux サーバーに入れて、Control Panel にログインし、各サービスが online になるところまでを対象にします。Docker でまとめて動かす場合は [Dockerでインストールする](../deployment/docker.md) を使ってください。

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
sudo apt-get install -y ca-certificates curl tar git jq openssl mariadb-client ffmpeg
sudo useradd --system --home /var/lib/autostream --shell /usr/sbin/nologin autostream || true
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/archives
```

GitHub Release から private repo の artifact を取得するため、GitHub CLI を使います。すでに `gh` が入っていてログイン済みなら、この block は `gh auth status` だけ確認してください。

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

## 5. 検証済みmanaged releaseを配置する

Control Panelからの更新を使う新規構成では、各serviceのmanifest付きhost releaseを初期releaseにします。service repositoryごとにsource versionは独立しているため、全serviceへ同じtagを指定しません。

| service | release repo | managed path |
| --- | --- | --- |
| Control Panel | `Kome-Lab/Autostream-ControlPanel` | `/opt/autostream/control-panel/current` |
| Discord Bot | `Kome-Lab/Autostream-DiscordBot` | `/opt/autostream/discord-bot/current` |
| Encoder/Recorder | `Kome-Lab/Autostream-Encoder-Recorder` | `/opt/autostream/encoder-recorder/current` |
| Observability | `Kome-Lab/Autostream-Observability` | `/opt/autostream/observability/current` |
| Worker | `Kome-Lab/Autostream-Worker` | `/opt/autostream/worker/current` |

対象repositoryごとに、公開済みのmanifest付きversionとarchitectureを指定してassetを取得します。次はControl Panelの形です。ほかのserviceでは`REPO`と`ASSET`を読み替えます。

```bash
VERSION=vX.Y.Z
ARCH=amd64 # arm64 hostではarm64
REPO=Kome-Lab/Autostream-ControlPanel
ASSET="autostream-control-panel_${VERSION}_linux_${ARCH}.tar.gz"

sudo install -d -o root -g root -m 0755 /opt/autostream/releases
sudo install -d -o "$USER" -g "$USER" -m 0755 /opt/autostream/releases/artifacts
cd /opt/autostream/releases
gh release download "$VERSION" --repo "$REPO" \
  --pattern "$ASSET" --pattern "$ASSET.sha256" \
  --pattern release-manifest.json --pattern release-manifest.json.sha256 \
  --dir artifacts --clobber
(cd artifacts && sha256sum --check --strict "$ASSET.sha256")
(cd artifacts && sha256sum --check --strict release-manifest.json.sha256)
tar -xzf "artifacts/$ASSET" -C /opt/autostream/releases
cd "/opt/autostream/releases/${ASSET%.tar.gz}"
```

展開した各archiveの`README.install.md`にある **Install a verified managed release** の配置blockを実行します。READMEはmanifest内のservice、source version、asset名、digest、archive内`checksums.txt`を照合し、root所有の`releases/<version>-<digest12>`、`.artifact-sha256`、`.version`、`current` symlink、systemd unit、envを作ります。env編集、service起動、`MainPID`確認は以降の対応service手順で行います。markerはlocal binaryから手作業で捏造しないでください。

既存のControl Panel/Node `v1.0.0`とWorker `v1.0.16`はmanual-onlyです。既存tagへmanifestを後付けせず、自動更新には新しいmanifest付きreleaseを使います。source checkoutからbuildしたbinaryも開発確認用であり、Updaterへ渡す前に新しいimmutable releaseとして公開します。

## 6. Control Panel を入れる

前節のControl Panel `README.install.md`を実行すると、binary、web asset、systemd unit、envのplaceholderまで配置されます。`ExecStart`が`/opt/autostream/control-panel/current/bin/control-panel`を参照していることを確認してください。

`/etc/autostream/control-panel.env` を編集します。

```bash
sudoedit /etc/autostream/control-panel.env
```

最低限、次を実値にします。

```text
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_WEB_DIR=/opt/autostream/control-panel/current/share/autostream-control-panel
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
sudo systemctl enable --now autostream-control-panel
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

手順5で各archiveの`README.install.md`の配置blockを実行すると、次の`current` link、systemd unit、env placeholderが配置されます。

| service | systemdが実行するbinary |
| --- | --- |
| Discord Bot | `/opt/autostream/discord-bot/current/bin/autostream-discord-bot` |
| Worker | `/opt/autostream/worker/current/bin/autostream-worker` |
| Encoder/Recorder | `/opt/autostream/encoder-recorder/current/bin/autostream-encoder-recorder` |
| Observability | `/opt/autostream/observability/current/bin/autostream-observability` |

`/usr/local/bin/autostream-<service>`はAuto Configureなどの互換コマンド用symlinkです。systemd unitはこのsymlinkではなく`current`配下を実行します。envを編集してserviceを起動した後、各`README.install.md`の最後にある`MainPID`確認まで実行します。

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

Encoder/Recorder では archive path と FFmpeg も確認します。

```text
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
FFMPEG_BIN=ffmpeg
```

Worker は `config.yml` の stream ingest signing key で Discord Bot からの stream-scoped `worker_events` token を検証し、同じファイルの Node Runtime Token で Control Panel 経由の signal 送信を行います。

Discord token、YouTube stream key、Google Drive folder、OAuth refresh token、webhook URL、SMTP password は、MVP 標準では Control Panel の Integration / Secret / Notification から登録します。互換 fallback を使う場合だけ service env に入れます。

## 10. service を起動する

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-observability
sudo systemctl enable --now autostream-encoder-recorder
sudo systemctl enable --now autostream-worker
sudo systemctl enable --now autostream-discord-bot

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
6. Control Panelからの更新を使う場合は、配信serviceのhealth確認後に[Control Panelからサービスを更新する](/operations/system-updates)へ進みます。中央Update Agentを1つだけ登録し、各hostへ非常駐helperを一度だけbootstrapしてtargetを対応付けます。中央Updaterがonline、各hostが到達可、各targetの現在versionが一致するまで更新jobは実行しません。

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
