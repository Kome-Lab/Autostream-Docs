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

各サービスは同じサーバー上に置いても、別プロセス、別 systemd unit、別 env、別 `SERVICE_ID`、別 token、別 data directory として扱います。

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

同じサーバーに MariaDB も置く場合:

```bash
sudo apt-get install -y mariadb-server
sudo systemctl enable --now mariadb
sudo systemctl status mariadb
```

## 3. MariaDB に database を作る

DB password は実値に置き換えてください。ここに書いた password は例です。

```bash
sudo mariadb <<'SQL'
CREATE DATABASE IF NOT EXISTS autostream_control_panel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS autostream_observability CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS autostream_encoder_recorder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS autostream_worker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS autostream_discord_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'autostream'@'%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON autostream_control_panel.* TO 'autostream'@'%';
GRANT ALL PRIVILEGES ON autostream_observability.* TO 'autostream'@'%';
GRANT ALL PRIVILEGES ON autostream_encoder_recorder.* TO 'autostream'@'%';
GRANT ALL PRIVILEGES ON autostream_worker.* TO 'autostream'@'%';
GRANT ALL PRIVILEGES ON autostream_discord_bot.* TO 'autostream'@'%';
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
openssl rand -hex 32   # SERVICE_CALL_TOKEN
openssl rand -hex 32   # AUTOSTREAM_STREAM_INGEST_SIGNING_KEY
openssl rand -hex 32   # OBSERVABILITY_TOKEN
```

`SERVICE_CALL_TOKEN` の SHA-256 を、各 service の `SERVICE_CONTROL_TOKEN_SHA256` に入れます。

```bash
printf '%s' '<SERVICE_CALL_TOKEN>' | sha256sum | awk '{print $1}'
```

## 5. release artifact を配置する

release artifact を使う場合は、各サービスの archive を `/opt/autostream/releases` に展開してから配置します。

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases
cd /opt/autostream/releases

# 例。実際の release URL に置き換えてください。
curl -fL -o autostream-control-panel.tar.gz '<CONTROL_PANEL_RELEASE_TARBALL_URL>'
curl -fL -o autostream-discord-bot.tar.gz '<DISCORD_BOT_RELEASE_TARBALL_URL>'
curl -fL -o autostream-worker.tar.gz '<WORKER_RELEASE_TARBALL_URL>'
curl -fL -o autostream-encoder-recorder.tar.gz '<ENCODER_RECORDER_RELEASE_TARBALL_URL>'
curl -fL -o autostream-observability.tar.gz '<OBSERVABILITY_RELEASE_TARBALL_URL>'

for f in autostream-*.tar.gz; do
  sudo tar -xzf "$f" -C /opt/autostream/releases
done
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
sudo install -o root -g root -m 0755 bin/control-panel /usr/local/bin/control-panel
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/control-panel
sudo install -d -o root -g root -m 0755 /usr/share/autostream-control-panel
sudo cp -a web/dist/. /usr/share/autostream-control-panel/
sudo install -o root -g root -m 0644 systemd/autostream-control-panel.service.example /etc/systemd/system/autostream-control-panel.service
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
SERVICE_CALL_TOKEN=<SERVICE_CALL_TOKEN>
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

## 8. service token を作る

Control Panel の API Tokens / Services 画面で、次の service 用 token を作ります。token は作成時だけ表示されます。

| service | service type | env に入れる場所 |
| --- | --- | --- |
| Encoder/Recorder | `encoder_recorder` | `/etc/autostream/encoder-recorder.env` の `CONTROL_PANEL_TOKEN` |
| Worker | `worker` | `/etc/autostream/worker.env` の `CONTROL_PANEL_TOKEN` |
| Discord Bot | `discord_bot` | `/etc/autostream/discord-bot.env` の `CONTROL_PANEL_TOKEN` |
| Observability | `observability` | `/etc/autostream/observability.env` の `CONTROL_PANEL_TOKEN` |

Control Panel から service へ送る token は `SERVICE_CALL_TOKEN` です。service 側では raw token ではなく、SHA-256 を `SERVICE_CONTROL_TOKEN_SHA256` に入れます。

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
sudo install -o root -g root -m 0755 bin/discord-bot /usr/local/bin/discord-bot
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/discord-bot
sudo install -o root -g root -m 0644 systemd/autostream-discord-bot.service.example /etc/systemd/system/autostream-discord-bot.service
sudo install -o root -g root -m 0640 .env.example /etc/autostream/discord-bot.env

# Worker
sudo install -o root -g root -m 0755 bin/worker /usr/local/bin/worker
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/worker
sudo install -o root -g root -m 0644 systemd/autostream-worker.service.example /etc/systemd/system/autostream-worker.service
sudo install -o root -g root -m 0640 .env.example /etc/autostream/worker.env

# Encoder/Recorder
sudo install -o root -g root -m 0755 bin/encoder-recorder /usr/local/bin/encoder-recorder
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/encoder-recorder /var/lib/autostream/archives
sudo install -o root -g root -m 0644 systemd/autostream-encoder-recorder.service.example /etc/systemd/system/autostream-encoder-recorder.service
sudo install -o root -g root -m 0640 .env.example /etc/autostream/encoder-recorder.env

# Observability
sudo install -o root -g root -m 0755 bin/observability /usr/local/bin/observability
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/observability
sudo install -o root -g root -m 0644 systemd/autostream-observability.service.example /etc/systemd/system/autostream-observability.service
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
SERVICE_ID=<SERVICE_ID>
SERVICE_PUBLIC_URL=https://<SERVICE_HOST>
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN_FROM_CONTROL_PANEL>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
DATABASE_URL=mysql://autostream:<DB_PASSWORD>@tcp(127.0.0.1:3306)/<SERVICE_DATABASE>?parseTime=true
```

Encoder/Recorder では archive path と FFmpeg も確認します。

```text
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
FFMPEG_BIN=ffmpeg
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
2. Service Health で Encoder/Recorder、Worker、Discord Bot、Observability が online になっていることを確認します。
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

Control Panel と service の疎通は次で見ます。

```bash
journalctl -u autostream-control-panel -n 100 --no-pager
journalctl -u autostream-encoder-recorder -n 100 --no-pager
journalctl -u autostream-worker -n 100 --no-pager
journalctl -u autostream-discord-bot -n 100 --no-pager
journalctl -u autostream-observability -n 100 --no-pager
```

ここまで通ったら、[最初の配信を始める](./start-first-stream.md) に進みます。
