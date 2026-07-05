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
sudo apt-get install -y ca-certificates curl tar git openssl mariadb-client ffmpeg
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
openssl rand -hex 32   # OBSERVABILITY_ADMIN_TOKEN
```

Observability は生 token ではなく SHA-256 を env に置きます。改行を混ぜないように `printf` で hash 化します。

```bash
printf '%s' '<OBSERVABILITY_ADMIN_TOKEN>' | sha256sum | awk '{print $1}'    # OBSERVABILITY_ADMIN_TOKEN_SHA256
```

`OBSERVABILITY_ADMIN_TOKEN` は Control Panel の `OBSERVABILITY_TOKEN` に入れます。Worker と Encoder/Recorder には標準構成で `OBSERVABILITY_TOKEN` を入れず、Node Runtime Token で Control Panel 経由の signal 送信にします。詳しい対応表、PowerShell での生成方法、直接ingest互換fallbackの生成方法は [秘密情報とtoken生成](../security/tokens.md) を参照してください。

新方式では、各サービスの登録、heartbeat、Panel から Node への操作に使う token は Node登録後の `config.yml` で配布します。`SERVICE_CALL_TOKEN` は古い構成からの移行用 fallback としてだけ使います。

## 5. release artifact を配置する

release artifact を使う場合は、各サービスの archive を `/opt/autostream/releases` に展開してから配置します。

2026-06-29 時点の GitHub Release `v1.0.0` は、次の名前で配布されています。

| service | release repo | asset |
| --- | --- | --- |
| Control Panel | `Kome-Lab/Autostream-ControlPanel` | `autostream-control-panel_v1.0.0_linux_amd64.tar.gz` / `autostream-control-panel_v1.0.0_linux_arm64.tar.gz` |
| Discord Bot | `Kome-Lab/Autostream-DiscordBot` | `autostream-discord-bot_v1.0.0_linux_amd64.tar.gz` / `autostream-discord-bot_v1.0.0_linux_arm64.tar.gz` |
| Encoder/Recorder | `Kome-Lab/Autostream-Encoder-Recorder` | `autostream-encoder-recorder_v1.0.0_linux_amd64.tar.gz` / `autostream-encoder-recorder_v1.0.0_linux_arm64.tar.gz` |
| Observability | `Kome-Lab/Autostream-Observability` | `autostream-observability_v1.0.0_linux_amd64.tar.gz` / `autostream-observability_v1.0.0_linux_arm64.tar.gz` |

Worker は同じ `release-host.yml` を持っていますが、2026-06-29 時点では `Kome-Lab/Autostream-Worker` に GitHub Release asset が公開されていません。Worker はこのページの source checkout 手順で build するか、Worker repo の Host Release workflow を実行して同じ形式の artifact を作ってください。

```bash
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更

sudo install -d -o "$USER" -g "$USER" -m 0755 /opt/autostream/releases
sudo install -d -o "$USER" -g "$USER" -m 0755 /opt/autostream/releases/artifacts
cd /opt/autostream/releases

for service in \
  autostream-control-panel \
  autostream-discord-bot \
  autostream-encoder-recorder \
  autostream-observability
do
  case "$service" in
    autostream-control-panel) repo=Autostream-ControlPanel ;;
    autostream-discord-bot) repo=Autostream-DiscordBot ;;
    autostream-encoder-recorder) repo=Autostream-Encoder-Recorder ;;
    autostream-observability) repo=Autostream-Observability ;;
  esac
  asset="${service}_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}.tar.gz"
  gh release download "${AUTOSTREAM_VERSION}" \
    --repo "Kome-Lab/${repo}" \
    --pattern "${asset}" \
    --pattern "${asset}.sha256" \
    --dir artifacts \
    --clobber
  sha256sum -c "artifacts/${asset}.sha256"
  tar -xzf "artifacts/${asset}" -C /opt/autostream/releases
done

export CONTROL_PANEL_RELEASE_DIR="/opt/autostream/releases/autostream-control-panel_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
export DISCORD_BOT_RELEASE_DIR="/opt/autostream/releases/autostream-discord-bot_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
export ENCODER_RECORDER_RELEASE_DIR="/opt/autostream/releases/autostream-encoder-recorder_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
export OBSERVABILITY_RELEASE_DIR="/opt/autostream/releases/autostream-observability_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
```

source checkout から build する場合は、各 repo で次を実行します。

```bash
cd /opt/autostream/src/autostream-control-panel
cd web
npm ci
npm run build
cd ..
go build -o bin/control-panel ./cmd/control-panel

cd /opt/autostream/src/autostream-discord-bot
go build -o bin/discord-bot ./cmd/discord-bot

cd /opt/autostream/src/autostream-worker
go build -o bin/worker ./cmd/worker

cd /opt/autostream/src/autostream-encoder-recorder
go build -o bin/encoder-recorder ./cmd/encoder-recorder

cd /opt/autostream/src/autostream-observability
go build -o bin/observability ./cmd/observability
```

## 6. Control Panel を入れる

```bash
cd "$CONTROL_PANEL_RELEASE_DIR"
sudo install -o root -g root -m 0755 bin/control-panel /usr/local/bin/control-panel
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/control-panel
sudo install -d -o root -g root -m 0755 /usr/share/autostream-control-panel
sudo cp -a share/autostream-control-panel/. /usr/share/autostream-control-panel/
sudo install -o root -g root -m 0644 systemd/autostream-control-panel.service.example /etc/systemd/system/autostream-control-panel.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/control-panel.env
```

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
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<OBSERVABILITY_ADMIN_TOKEN>
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
| Encoder/Recorder | `encoder_recorder` | `/etc/autostream-node/encoder-recorder.yml` |
| Worker | `worker` | `/etc/autostream-node/worker.yml` |
| Discord Bot | `discord_bot` | `/etc/autostream-node/discord-bot.yml` |
| Observability | `observability` | `/etc/autostream-node/observability.yml` |

各 Node の Configuration から `config.yml` を保存します。

```bash
sudo install -d -o root -g root -m 0750 /etc/autostream-node
sudo install -o root -g root -m 0640 encoder-recorder.yml /etc/autostream-node/encoder-recorder.yml
sudo install -o root -g root -m 0640 worker.yml /etc/autostream-node/worker.yml
sudo install -o root -g root -m 0640 discord-bot.yml /etc/autostream-node/discord-bot.yml
sudo install -o root -g root -m 0640 observability.yml /etc/autostream-node/observability.yml
```

1サービスだけを単独ホストで動かす場合は `/etc/autostream-node/config.yml` を使えます。複数サービスを同じホストで動かす場合は、上のようにファイルを分け、各 env の `AUTOSTREAM_NODE_CONFIG` で参照先を指定します。

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

各 repo または release artifact の directory で実行します。

```bash
# Discord Bot
cd "$DISCORD_BOT_RELEASE_DIR"
sudo install -o root -g root -m 0755 bin/autostream-discord-bot /usr/local/bin/autostream-discord-bot
sudo ln -sf /usr/local/bin/autostream-discord-bot /usr/local/bin/discord-bot
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/discord-bot
sudo install -o root -g root -m 0644 systemd/autostream-discord-bot.service.example /etc/systemd/system/autostream-discord-bot.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/discord-bot.env

# Worker
cd /opt/autostream/src/autostream-worker
sudo install -o root -g root -m 0755 bin/autostream-worker /usr/local/bin/autostream-worker
sudo ln -sf /usr/local/bin/autostream-worker /usr/local/bin/worker
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/worker
sudo install -o root -g root -m 0644 systemd/autostream-worker.service.example /etc/systemd/system/autostream-worker.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/worker.env

# Encoder/Recorder
cd "$ENCODER_RECORDER_RELEASE_DIR"
sudo install -o root -g root -m 0755 bin/autostream-encoder-recorder /usr/local/bin/autostream-encoder-recorder
sudo ln -sf /usr/local/bin/autostream-encoder-recorder /usr/local/bin/encoder-recorder
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/encoder-recorder /var/lib/autostream/archives
sudo install -o root -g root -m 0644 systemd/autostream-encoder-recorder.service.example /etc/systemd/system/autostream-encoder-recorder.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/encoder-recorder.env

# Observability
cd "$OBSERVABILITY_RELEASE_DIR"
sudo install -o root -g root -m 0755 bin/autostream-observability /usr/local/bin/autostream-observability
sudo ln -sf /usr/local/bin/autostream-observability /usr/local/bin/observability
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/observability
sudo install -o root -g root -m 0644 systemd/autostream-observability.service.example /etc/systemd/system/autostream-observability.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/observability.env
```

各 env を編集します。

```bash
sudoedit /etc/autostream/encoder-recorder.env
sudoedit /etc/autostream/worker.env
sudoedit /etc/autostream/discord-bot.env
sudoedit /etc/autostream/observability.env
```

最低限そろえる値:

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-node/<SERVICE>.yml
```

`config.yml` の中に Node ID、Node API URL、Control Panel URL、Node Runtime Token が入ります。`CONTROL_PANEL_TOKEN`、`SERVICE_ID`、`SERVICE_PUBLIC_URL` を手でそろえる運用にはしません。

Observability だけは DB を直接使うため、追加で次を設定します。Control Panel の `DATABASE_URL` は手順 6 で設定済みです。

```text
DATABASE_URL=mysql://autostream:<DB_PASSWORD>@tcp(127.0.0.1:3306)/autostream_observability?parseTime=true
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>:observability.read|observability.ingest|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
```

直接ingest互換fallbackを使う場合だけ、別途 `OBSERVABILITY_INGEST_TOKEN_SHA256`、`OBSERVABILITY_INGEST_TOKEN_BINDINGS`、`OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true` を追加します。binding の service ID は、手順 8 で登録した Encoder/Recorder と Worker の Node ID に合わせます。

Encoder/Recorder では archive path と FFmpeg も確認します。

```text
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
FFMPEG_BIN=ffmpeg
```

Worker では標準構成の追加envはありません。`AUTOSTREAM_NODE_CONFIG` の Node Runtime Token で Control Panel 経由の signal 送信を行います。直接ingest互換fallbackを使う場合だけ、Worker と Encoder/Recorder に次を追加します。

```text
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<OBSERVABILITY_INGEST_TOKEN>
```

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

各 service の health を確認します。

```bash
curl -fsS http://127.0.0.1:8081/health  # Encoder/Recorder の local port 例
curl -fsS http://127.0.0.1:8082/health  # Observability の local port 例
curl -fsS http://127.0.0.1:8083/health  # Discord Bot の local port 例
curl -fsS http://127.0.0.1:8084/health  # Worker の local port 例
```

実際の port は各 env の `AUTOSTREAM_BIND_ADDR` に合わせてください。

## 11. Control Panel で確認する

1. Control Panel に admin でログインします。
2. Service Health で Encoder/Recorder、Worker、Discord Bot、Observability が online になり、version、OS、arch、capability が Node から自動報告されていることを確認します。
3. Services / Assignments で stream 用の primary service を割り当てます。
4. Integrations で Discord、YouTube、Google Drive、notification channel を登録します。
5. Start readiness を実行し、不足している設定がないことを確認します。

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
