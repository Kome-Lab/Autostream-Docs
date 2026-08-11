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
AUTOSTREAM_IMAGE_REGISTRY=ghcr.io/kome-lab/autostream-docker
AUTOSTREAM_DOCKER_VERSION=<PUBLISHED_BUNDLE_TAG>
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
    image: mariadb:11.8
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
      AUTOSTREAM_ENV: production
      AUTOSTREAM_BIND_ADDR: 0.0.0.0:8080
      AUTOSTREAM_OUTPUT_RELAY_URL: rtmp://output-relay:1935/autostream/{stream_id}
      AUTOSTREAM_OUTPUT_RELAY_MODE: legacy_stream_key
      # Docker Compose内のこのservice DNSだけをrelayとして許可します。
      AUTOSTREAM_COMPOSE_OUTPUT_RELAY: "1"
    ports:
      - "127.0.0.1:8081:8080"
    volumes:
      - ${SERVICE_CONFIG_ROOT}/encoder-recorder/config.yml:/etc/autostream-encoder-recorder/config.yml:ro
      - archives:/var/lib/autostream/archives

  output-relay:
    image: tiangolo/nginx-rtmp:latest
    restart: unless-stopped
    depends_on:
      encoder-recorder:
        condition: service_started
    volumes:
      - ./relay/nginx-rtmp.conf:/etc/nginx/nginx.conf:ro

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
      AUTOSTREAM_BIND_ADDR: 0.0.0.0:8080
      TZ: ${TZ}
    ports:
      - "127.0.0.1:8083:8080"
    volumes:
      - ${SERVICE_CONFIG_ROOT}/discord-bot/config.yml:/etc/autostream-discord-bot/config.yml:ro

volumes:
  mariadb:
  control-panel-data:
  archives:
```

### Node portを変更する

上のCompose例はcontainer内listen portを`8080`にそろえていますが、通常Node serviceのportは`1024..65535`の任意番号へ変更できます。変更する場合は、同じserviceの次の値を一組として変更します。

1. serviceのbind設定。例: `AUTOSTREAM_BIND_ADDR=0.0.0.0:18080`
2. Composeのcontainer port。例: `"127.0.0.1:18081:18080"`の右側`18080`
3. Control PanelのNode登録で指定するPort。Compose network内から接続する場合はcontainer portの`18080`
4. reverse proxyを使う場合はupstreamのorigin port

同じ「port」でも役割が異なります。

| 値 | 例 | 意味 |
| --- | --- | --- |
| container listen port | `18080` | service processがcontainer内で待ち受けるport |
| host published port | `18081` | hostのloopbackなどへ公開するport |
| Node登録のPort | `18080` | Control Panel containerからserviceへ到達するport |
| reverse proxy public port | `443` | browser向けHTTPS入口。Node service本来のportではない |
| reverse proxy origin port | `18081` | proxyからhost上のserviceへ転送するport |

Control Panelはendpointを`desired`、`applied`、`reported`に分けて扱います。Node編集でPortを保存した値が`desired`、hostへ最後に適用した値が`applied`、serviceのheartbeatやprobeで観測した値が`reported`です。

固定Docker target policyと承認済みfrozen Compose baselineがあるWorker、Encoder Recorder、Discord Bot、Observabilityでは、専用`port_reconfigure` job/grant/Local Executor operationを使えます。jobは次の3値を別々に扱います。

| job入力 | 範囲 | 境界 |
| --- | --- | --- |
| advertised port | `1..65535` | Control Panelから到達するNode endpoint |
| host published port | `1024..65535` | hostは`127.0.0.1`固定。外部interfaceへ公開しない |
| container listen port | `1024..65535` | service processがcontainer内で待ち受けるport |

Local Executorは`/opt/autostream/local-executor/docker/ports/<service>.env`の固定env、固定Compose project/service、承認済みCompose revision/digestだけを使って対象containerをrecreateします。container ID、image ID、repository digest、env digest、healthを再検証し、失敗または応答不明時はdurable ledgerからrollback/reconcileします。UIのdesired/applied/reported endpointはadvertised側を示し、published/containerはverified current mapping、pending plan、完了履歴のold/new tripleで確認します。unavailable、busy、stale、drift、recovery中はblockします。

Auto Configureが自動生成するのはsystemdのroot policy/sidecarだけです。Docker authorityはNode登録値から推測せず、既存のroot-owned fixed Docker target policyとapproved frozen Compose baselineがなければfail closedです。Control Panel自身とUpdate AgentはDocker port jobの対象外です。reverse proxy設定は自動変更しないため、originをpublished portへ追従させる場合はNginx/Caddy等を別手順で変更して確認してください。

ローカルではDocker 29.6.2 / Compose 5.3.1のisolated root DIND上で`TestDockerPortDaemonSmoke`を実行し、初回・連続変更、実process crash後のfresh-process reconcile、grant二重消費なし、unhealthy mappingの旧値rollback、foreign containerによるpublished port占有のgrant前拒否を確認しました。これはローカル実daemonのPASSであり、全5image build、公開image、実Docker host canary、release/deployの証拠ではありません。

Encoderプレビューは既存のEncoder Recorder API portと`archives` volumeを使います。プレビュー専用の追加port、追加env、追加volumeは不要です。Encoder imageのDebian `ffmpeg` packageがHLSを生成し、`archives` volume内の`tmp/<stream_id>/preview/`へrolling segmentを置きます。final artifactの保持設定だけでは終了済み`tmp` directoryの削除を保証しないため、volume容量監視には`tmp`も含めます。

本番の配信出力は、YouTubeのstream keyをFFmpeg引数へ出さないため`output-relay`を経由します。Encoder Recorderとrelayは通常のCompose networkへ接続し、Encoder Recorderからservice DNS名`output-relay:1935`へ送ります。`AUTOSTREAM_COMPOSE_OUTPUT_RELAY: "1"`はこのCompose内の固定service DNSだけをrelayとして許可するDocker専用の制限です。host/systemd配置へコピーしたり、任意のhost名を許可する値として使ったりしません。network namespaceは共有しません。全サービスを起動する前にEncoder Recorder repositoryの`relay/nginx-rtmp.conf.example`を`/opt/autostream/relay/nginx-rtmp.conf`へコピーし、upstreamを設定してください。この実値入りファイルはGit管理しません。

上のCompose例は、既存の固定key relayを維持する`legacy_stream_key`です。既存hostで`AUTOSTREAM_OUTPUT_RELAY_URL`だけを設定してmodeを省略した場合も、移行互換として同じmodeになります。`legacy_stream_key`ではYouTube Outputの`stream_key`だけを使い、通常の`live_api`や`live_api_dry_run`を固定relayへ流すことはできません。

固定relayで新しいYouTube Live API方式を使う場合は、ComposeのEncoder環境を次のように明示的に切り替えます。これは既存の`stream_key` profileやrelayの固定keyを変換する手順ではありません。先にControl Panelで別の`live_api_relay_static` Output、Google OAuth account、再利用するYouTube Live Stream ID、同じ`relay-` + 小文字UUID形式の非secret binding IDをreadyにしてから適用してください。

```yaml
      AUTOSTREAM_OUTPUT_RELAY_URL: rtmp://output-relay:1935/autostream/{stream_id}
      AUTOSTREAM_OUTPUT_RELAY_MODE: live_api_static
      AUTOSTREAM_OUTPUT_RELAY_BINDING_ID: ${AUTOSTREAM_OUTPUT_RELAY_BINDING_ID:-}
```

`live_api_static`へ切り替える前に、`.env`へ同じbinding IDを設定します。

```text
AUTOSTREAM_OUTPUT_RELAY_BINDING_ID=relay-123e4567-e89b-42d3-a456-426614174000
```

bindingは`relay-` + 小文字UUID形式だけを使い、stream key、外部RTMPS URL、視聴URL、任意の説明名を入れません。bindingが空・形式不正・不一致の場合は、Compose interpolationで既存stackを起動不能にするのではなく、relay `unavailable`としてEncoderのpreflight/startがfail closedします。`direct`へ読み替えたりrelay URLを無視したりしません。`live_api_static`はURLと正しいbinding IDを必要とし、`relay_binding_id`が完全一致する`live_api_relay_static`だけを開始できます。URLありの`direct`、URLなしの`legacy_stream_key`/`live_api_static`、未知のmodeも同様にfail closedします。relayを使わない`direct`はURLを設定せず、この`output-relay` Compose例を使わない別構成にします。

切替前に配信枠がinactiveであることを確認し、切替後はService Health / preflightと小さな開始・停止を確認します。戻す必要がある場合は、まず新方式の配信を停止し、不明な開始結果があればControl Panelの固定Relay回復を完了します。その後でOutput選択を旧`stream_key` profileへ戻し、Composeを`legacy_stream_key`へ戻して再作成します。同じbindingを別の配信枠へ再利用したり、relay設定からkeyを読み出してControl Panelへ貼り付けたりしません。

```bash
sudo install -d -m 0750 /opt/autostream/relay
sudo install -m 0640 /opt/autostream/src/autostream-encoder-recorder/relay/nginx-rtmp.conf.example /opt/autostream/relay/nginx-rtmp.conf
sudoedit /opt/autostream/relay/nginx-rtmp.conf
```

production でregistry imageを使う場合は、5サービスすべてで同じDocker bundle tagを使い、各`build:`を次のcanonical形式の`image:`へ置き換えます。

```yaml
image: ${AUTOSTREAM_IMAGE_REGISTRY:-ghcr.io/kome-lab/autostream-docker}/control-panel:${AUTOSTREAM_DOCKER_VERSION:-latest}
```

service名は`control-panel`、`discord-bot`、`encoder-recorder`、`observability`、`worker`です。本番の`.env`では`latest`ではなく、`release-manifest.json`が付いた公開済みbundle tagを固定します。Docker bundle versionと各serviceのsource versionは別管理であり、表示差は異常ではありません。

Bridge移行後の`pull_v2`では、Docker serviceごとではなく物理Docker hostごとに非rootの`autostream-host-agent`を1つだけ置きます。Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCPや`8090`を開きません。Control Panel、Host Agent、各service containerへ`/var/run/docker.sock`をmountしないでください。

privileged Docker software updateとport mapping変更は、Host AgentとはUnix socketで分離したroot Local Executorが固定Compose project、service、repository、version/port overlay、credential pathだけを使って実行します。Host Agent requestからDocker path、image、commandを指定できません。Docker port jobも上記のexact policy/baselineがあるhostだけで有効です。ローカルDINDが成功していても、公開release、全imageの公開証拠、実Docker canaryが揃うまでは、既存hostでlegacy `ssh_v1`を維持します。Host Agentの導入だけでlegacy helperやSSH資産を削除しないでください。移行状態とavailability gateは[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

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

同じCompose network内では、Control Panel containerから到達できるservice名とcontainer portを登録します。

| Node type | Host | Port | SSL |
| --- | --- | ---: | --- |
| Encoder/Recorder | `encoder-recorder` | `8080` | OFF |
| Worker | `worker` | `8080` | OFF |
| Discord Bot | `discord-bot` | `8080` | OFF |
| Observability | `observability` | `8080` | OFF |

host側へ公開する`127.0.0.1:8081`〜`8084`は、hostからのhealth確認やreverse proxy用です。Control Panel containerからNodeへ接続するHost / Portには指定しません。

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

    # Keep the version probe on the local origin; do not publish it here.
    location = /updater/version {
        return 404;
    }

    # The path contains a signed bearer capability for VLC/HLS playback.
    location ^~ /stream-previews/ {
        access_log off;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

`AUTOSTREAM_PUBLIC_URL` はブラウザで開く URL と一致させます。

reverse proxyが受ける公開`443`と、Control Panel containerのlisten port、host published portは別endpointです。この例ではbrowserは`https://control.example.com:443`、nginxのoriginは`127.0.0.1:8080`、container内のControl Panelも`8080`です。どれかを変更する場合は役割を取り違えず、Nodeの`desired`、実際の`applied`、serviceが`reported`した値を確認してください。

`/stream-previews/` のpathには署名tokenが含まれます。nginxだけでなく、前段のCDN、WAF、load balancer、APMでもfull pathを記録しないかredactしてください。previewのplaylistとsegmentはControl Panelを通るため、同時preview数に応じたControl Panelの帯域も監視します。Encoder Recorderのportをinternetへ追加公開する必要はありません。

## 10. 外部 provider を登録する

Control Panel UI で登録します。compose `.env` に直接入れないでください。

| 項目 | 登録先 |
| --- | --- |
| Discord bot token | Discord Bot config |
| YouTube OAuth / stream key | YouTube output |
| Google OAuth / Drive destination | Integration / Drive destination |
| webhook URL | Notification channel |
| SMTP password | Email notification channel |

Google Drive の archive upload は Service Account fallback を使いません。Control Panel のArchive画面で OAuth account、folder ID、必要に応じてshared drive設定を持つDrive保存先と録画プロファイルを作り、配信枠で選択します。

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
