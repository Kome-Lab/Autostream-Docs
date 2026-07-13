# Dockerでインストールする

このページは、AutoStream を Docker / Docker Compose で起動する手順です。host に直接入れる場合は [最初のインストール](../runbooks/first-install.md) を使ってください。

Docker でも、実 secret を compose file や Git 管理ファイルに書かない方針は同じです。compose file には placeholder と構成だけを置き、実値は `.env`、Docker secret、または本番の secret manager から渡します。

## 1. Docker を入れる

Ubuntu / Debian 系の例です。

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
docker compose version
```

Debian で使う場合は Docker 公式手順に合わせて repository URL を Debian 用に変えてください。

## 2. 配置場所を作る

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream
sudo install -d -o root -g root -m 0750 /opt/autostream/secrets
sudo install -d -o 1000 -g 1000 -m 0750 /var/lib/autostream
sudo install -d -o 1000 -g 1000 -m 0750 /var/lib/autostream/archives
cd /opt/autostream
```

source checkout から build する場合は、各 repo を `/opt/autostream/src` に置きます。

```bash
sudo install -d -o "$USER" -g "$USER" /opt/autostream/src
cd /opt/autostream/src

# URL は実際の repository URL に置き換えてください。
git clone <AUTOSTREAM_CONTROL_PANEL_GIT_URL> autostream-control-panel
git clone <AUTOSTREAM_DISCORD_BOT_GIT_URL> autostream-discord-bot
git clone <AUTOSTREAM_WORKER_GIT_URL> autostream-worker
git clone <AUTOSTREAM_ENCODER_RECORDER_GIT_URL> autostream-encoder-recorder
git clone <AUTOSTREAM_OBSERVABILITY_GIT_URL> autostream-observability
```

image registry から pull する場合は clone は不要です。compose の `build:` を `image:` に置き換えてください。

## 3. secret を生成する

```bash
openssl rand -hex 32   # AUTOSTREAM_SESSION_SECRET
openssl rand -hex 32   # AUTOSTREAM_SECRET_ENCRYPTION_KEY
openssl rand -hex 32   # AUTOSTREAM_SETUP_TOKEN
openssl rand -hex 32   # AUTOSTREAM_STREAM_INGEST_SIGNING_KEY
```

Observability 用の別admin tokenや直接ingest tokenは作りません。Control Panel は登録済み Observability Node の公開URLと Node Runtime Token で Observability API を呼びます。詳しい対応表と PowerShell での生成方法は [秘密情報とtoken生成](../security/tokens.md) を参照してください。

## 4. `.env` を作る

```bash
cd /opt/autostream
sudo install -o root -g root -m 0640 /dev/null .env
sudoedit .env
```

例:

```dotenv
TZ=Asia/Tokyo

MARIADB_PASSWORD=<DB_PASSWORD>
MARIADB_ROOT_PASSWORD=<DB_ROOT_PASSWORD>
CONTROL_PANEL_DATABASE_URL=mysql://autostream:<DB_PASSWORD>@tcp(mariadb:3306)/autostream_control_panel?parseTime=true
OBSERVABILITY_DATABASE_URL=mysql://autostream:<DB_PASSWORD>@tcp(mariadb:3306)/autostream_observability?parseTime=true

AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
SERVICE_CALL_TOKEN=
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
SERVICE_CONFIG_ROOT=/opt/autostream/config
```

初回は Node Agent 用 `config.yml` がまだないため、Control Panel 起動後に Node登録で各Nodeを作り、Configuration から `config.yml` を `SERVICE_CONFIG_ROOT` 配下のサービス別 directory に保存してから各 service container を起動します。Worker / Encoder Recorder の stream ingest signing key もこのファイルへ入るため、`CONTROL_PANEL_TOKEN` やNode側の `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` を `.env` に手入力しません。

DB URL は Control Panel と Observability だけに必要です。Encoder/Recorder、Worker、Discord Bot は個別 database を持たず、Control Panel から runtime config を取得します。

各サービスの env 項目、token の意味、起動後の確認はサービス別導入ページに分けています。Docker で動かす場合も、確認する値と責務は同じです。

| service | 詳細手順 |
| --- | --- |
| Control Panel | [Control Panelを導入する](../services/control-panel-install.md) |
| Encoder/Recorder | [Encoder Recorderを導入する](../services/encoder-recorder-install.md) |
| Worker | [Workerを導入する](../services/worker-install.md) |
| Discord Bot | [Discord Botを導入する](../services/discord-bot-install.md) |
| Observability | [Observabilityを導入する](../services/observability-install.md) |

## 5. MariaDB 初期化 SQL と compose file を作る

Control Panel と Observability 用の database を初回起動時に作る SQL を置きます。

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/mariadb-init
sudo tee /opt/autostream/mariadb-init/01-databases.sql >/dev/null <<'SQL'
CREATE DATABASE IF NOT EXISTS autostream_control_panel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS autostream_observability CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON autostream_control_panel.* TO 'autostream'@'%';
GRANT ALL PRIVILEGES ON autostream_observability.* TO 'autostream'@'%';
SQL
```

続いて `/opt/autostream/compose.yml` を作ります。

```bash
sudoedit /opt/autostream/compose.yml
```

source checkout から build する例:

```yaml
services:
  mariadb:
    image: mariadb:11
    restart: unless-stopped
    environment:
      MARIADB_DATABASE: autostream_control_panel
      MARIADB_USER: autostream
      MARIADB_PASSWORD: ${MARIADB_PASSWORD}
      MARIADB_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD}
    volumes:
      - mariadb:/var/lib/mysql
      - ./mariadb-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10

  control-panel:
    build: ./src/autostream-control-panel
    restart: unless-stopped
    depends_on:
      mariadb:
        condition: service_healthy
    environment:
      AUTOSTREAM_BIND_ADDR: 0.0.0.0:8080
      AUTOSTREAM_PUBLIC_URL: ${AUTOSTREAM_PUBLIC_URL}
      AUTOSTREAM_DATA_DIR: /var/lib/autostream/control-panel
      AUTOSTREAM_SESSION_SECRET: ${AUTOSTREAM_SESSION_SECRET}
      AUTOSTREAM_SECRET_ENCRYPTION_KEY: ${AUTOSTREAM_SECRET_ENCRYPTION_KEY}
      AUTOSTREAM_SETUP_TOKEN: ${AUTOSTREAM_SETUP_TOKEN}
      DATABASE_URL: ${CONTROL_PANEL_DATABASE_URL}
      SERVICE_CALL_TOKEN: ${SERVICE_CALL_TOKEN}
      AUTOSTREAM_STREAM_INGEST_SIGNING_KEY: ${AUTOSTREAM_STREAM_INGEST_SIGNING_KEY}
      AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS: encoder-recorder,worker,discord-bot,observability
      AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS: "true"
      TZ: ${TZ}
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - control-panel-data:/var/lib/autostream/control-panel

  observability:
    build: ./src/autostream-observability
    restart: unless-stopped
    depends_on:
      mariadb:
        condition: service_healthy
      control-panel:
        condition: service_started
    environment:
      AUTOSTREAM_NODE_CONFIG: /etc/autostream-observability/config.yml
      AUTOSTREAM_SECRET_ENCRYPTION_KEY: ${AUTOSTREAM_SECRET_ENCRYPTION_KEY}
      DATABASE_URL: ${OBSERVABILITY_DATABASE_URL}
      OBSERVABILITY_BIND_ADDR: 0.0.0.0:8080
      TZ: ${TZ}
    ports:
      - "127.0.0.1:8082:8080"
    volumes:
      - ${SERVICE_CONFIG_ROOT}/observability/config.yml:/etc/autostream-observability/config.yml:ro

  encoder-recorder:
    build: ./src/autostream-encoder-recorder
    restart: unless-stopped
    depends_on:
      control-panel:
        condition: service_started
    environment:
      AUTOSTREAM_NODE_CONFIG: /etc/autostream-encoder-recorder/config.yml
      AUTOSTREAM_REQUIRE_SIGNED_INGEST_TOKENS: "true"
      AUTOSTREAM_BIND_ADDR: 0.0.0.0:8080
      AUTOSTREAM_DATA_DIR: /var/lib/autostream/encoder-recorder
      AUTOSTREAM_ARCHIVE_DIR: /var/lib/autostream/archives
      FFMPEG_BIN: ffmpeg
      TZ: ${TZ}
    ports:
      - "127.0.0.1:8081:8080"
    volumes:
      - ${SERVICE_CONFIG_ROOT}/encoder-recorder/config.yml:/etc/autostream-encoder-recorder/config.yml:ro
      - encoder-data:/var/lib/autostream/encoder-recorder
      - archives:/var/lib/autostream/archives

  worker:
    build: ./src/autostream-worker
    restart: unless-stopped
    depends_on:
      control-panel:
        condition: service_started
      encoder-recorder:
        condition: service_started
    environment:
      AUTOSTREAM_NODE_CONFIG: /etc/autostream-worker/config.yml
      ENCODER_RECORDER_URL: http://encoder-recorder:8080
      AUTOSTREAM_BIND_ADDR: 0.0.0.0:8080
      TZ: ${TZ}
    ports:
      - "127.0.0.1:8084:8080"
    volumes:
      - ${SERVICE_CONFIG_ROOT}/worker/config.yml:/etc/autostream-worker/config.yml:ro

  discord-bot:
    build: ./src/autostream-discord-bot
    restart: unless-stopped
    depends_on:
      control-panel:
        condition: service_started
      encoder-recorder:
        condition: service_started
      worker:
        condition: service_started
    environment:
      AUTOSTREAM_NODE_CONFIG: /etc/autostream-discord-bot/config.yml
      ENCODER_AUDIO_TOKEN: ""
      AUTOSTREAM_BIND_ADDR: 0.0.0.0:8080
      TZ: ${TZ}
    ports:
      - "127.0.0.1:8083:8080"
    volumes:
      - ${SERVICE_CONFIG_ROOT}/discord-bot/config.yml:/etc/autostream-discord-bot/config.yml:ro

volumes:
  mariadb:
  control-panel-data:
  encoder-data:
  archives:
```

production で registry image を使う場合は、各 `build:` を次のような `image:` に置き換えます。

```yaml
image: ghcr.io/<ORG>/autostream-control-panel:<VERSION>
```

## 6. Control Panel だけ先に起動する

Node Agent 用 `config.yml` を Control Panel で作るため、最初は MariaDB と Control Panel だけ起動します。

```bash
cd /opt/autostream
docker compose --env-file .env -f compose.yml up -d mariadb control-panel
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs -f control-panel
```

health を確認します。

```bash
curl -fsS http://127.0.0.1:8080/health
```

初回管理者を作ります。

```bash
curl -fsS -X POST http://127.0.0.1:8080/setup/first-admin \
  -H 'Content-Type: application/json' \
  -d '{"setup_token":"<SETUP_TOKEN>","username":"admin","password":"<ADMIN_PASSWORD>"}'
```

## 7. Nodeを作って `config.yml` を保存する

Control Panel にログインし、Node登録で Encoder/Recorder、Worker、Discord Bot、Observability を作ります。入力するのは Node名、Host、Port、SSL、説明です。バージョンやCapabilityは入力しません。

各Nodeの Configuration から `config.yml` を取得し、次のように保存します。Node service container は nonroot で起動するため、bind mount する `config.yml` は container 側の group `65532` が読める権限にします。

```bash
sudo install -d -m 0750 /opt/autostream/config/encoder-recorder
sudo install -d -m 0750 /opt/autostream/config/worker
sudo install -d -m 0750 /opt/autostream/config/discord-bot
sudo install -d -m 0750 /opt/autostream/config/observability
sudo install -m 0640 encoder-recorder.yml /opt/autostream/config/encoder-recorder/config.yml
sudo install -m 0640 worker.yml /opt/autostream/config/worker/config.yml
sudo install -m 0640 discord-bot.yml /opt/autostream/config/discord-bot/config.yml
sudo install -m 0640 observability.yml /opt/autostream/config/observability/config.yml
sudo chown -R root:65532 /opt/autostream/config
```

Configure Token と Node Runtime Token は生成直後だけ表示されます。紛失した場合は Configuration で再生成します。

## 8. 全サービスを起動する

```bash
cd /opt/autostream
docker compose --env-file .env -f compose.yml config
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

ログを確認します。

```bash
docker compose --env-file .env -f compose.yml logs -f control-panel
docker compose --env-file .env -f compose.yml logs -f encoder-recorder
docker compose --env-file .env -f compose.yml logs -f worker
docker compose --env-file .env -f compose.yml logs -f discord-bot
docker compose --env-file .env -f compose.yml logs -f observability
```

health を確認します。

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8082/health
curl -fsS http://127.0.0.1:8083/health
curl -fsS http://127.0.0.1:8084/health
```

## 9. reverse proxy を置く

本番では Control Panel を HTTPS で公開します。Go service を直接 internet に公開しないでください。

nginx 例:

```nginx
server {
    listen 443 ssl http2;
    server_name control.example.com;

    ssl_certificate /etc/letsencrypt/live/control.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/control.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

`AUTOSTREAM_PUBLIC_URL` はブラウザで開く URL と一致させます。

## 10. 外部 provider を登録する

Control Panel UI で登録します。compose `.env` に直接入れないでください。

| 項目 | 登録先 |
| --- | --- |
| Discord bot token | Discord Bot config |
| YouTube OAuth / stream key | YouTube output |
| Google OAuth / Drive destination | Integration / Drive destination |
| webhook URL | Notification channel |
| SMTP password | Email notification channel |

Google Drive の archive upload は Service Account fallback を使いません。Control Panel の配信枠設定で OAuth account、folder ID、必要に応じて shared drive ID と archive file name を指定します。

Encoder/Recorder の container へ Google credential JSON を mount しないでください。Drive folder ID、OAuth client secret、refresh token は Control Panel の runtime secret lease で Encoder/Recorder へ渡され、request body、env、logs、docs には残しません。

## 11. 起動後の確認

Control Panel で次を確認します。

1. admin でログインできる。
2. Service Health に全 service が表示される。
3. heartbeat が fresh である。
4. Encoder/Recorder、Worker、Discord Bot を stream に primary assignment できる。
5. Start readiness が secret を表示せず、missing 設定だけを出す。
6. dry-run stream start が実行できる。

CLI では次を確認します。

```bash
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail=200
docker volume ls | grep autostream
```

## 12. 更新する

```bash
cd /opt/autostream
cp compose.yml compose.yml.bak.$(date +%Y%m%d%H%M%S)
cp .env .env.bak.$(date +%Y%m%d%H%M%S)

docker compose --env-file .env -f compose.yml pull
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

更新後は Control Panel の Service Health と短い dry-run stream を確認します。

## 13. 停止する

```bash
cd /opt/autostream
docker compose --env-file .env -f compose.yml stop
```

データを消す場合だけ volume を削除します。通常の再起動や更新では実行しません。

```bash
docker compose --env-file .env -f compose.yml down --volumes
```

インストールできたら、[最初の配信を始める](../runbooks/start-first-stream.md) に進みます。
