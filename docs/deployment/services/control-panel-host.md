# Host デプロイ

Linux host に `autostream-control-panel` を直接インストールする手順です。実行ユーザーは `autostream` を推奨します。

## 配置先

```text
binary: /usr/local/bin/control-panel
config: /etc/autostream/control-panel.env
data:   /var/lib/autostream/control-panel
unit:   /etc/systemd/system/autostream-control-panel.service
user:   autostream
```

SQLite fallback はありません。`DATABASE_URL` には MariaDB を指定してください。

## Linux user と directory

```bash
sudo useradd --system --home /var/lib/autostream/control-panel --shell /usr/sbin/nologin autostream
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/control-panel
sudo install -d -o root -g root -m 0750 /etc/autostream
```

## MariaDB

例:

```sql
CREATE DATABASE autostream_control_panel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'autostream_control_panel'@'%' IDENTIFIED BY '<PASSWORD>';
GRANT ALL PRIVILEGES ON autostream_control_panel.* TO 'autostream_control_panel'@'%';
FLUSH PRIVILEGES;
```

実際の password は docs や shell history に残さないでください。

## 環境変数

`/etc/autostream/control-panel.env` を作成します。

```text
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_DATA_DIR=/var/lib/autostream/control-panel
AUTOSTREAM_TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
DATABASE_URL=mysql://autostream_control_panel:<PASSWORD>@tcp(db.example.com:3306)/autostream_control_panel?parseTime=true
SERVICE_CALL_TOKEN=<CONTROL_PANEL_TO_SERVICE_TOKEN>
SERVICE_CALL_TIMEOUT_SEC=5
AUTOSTREAM_YOUTUBE_COMPLETE_RETRY_INTERVAL=60s
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
OBSERVABILITY_TIMEOUT_SEC=5
TZ=Asia/Tokyo
```

env file の権限:

```bash
sudo install -o root -g autostream -m 0640 /tmp/control-panel.env /etc/autostream/control-panel.env
```

`AUTOSTREAM_SESSION_SECRET` と `AUTOSTREAM_SECRET_ENCRYPTION_KEY` は十分長いランダム値を使います。`SERVICE_CALL_TOKEN` は Control Panel から各 service へ dispatch する token で、各 service 側では同じ raw token の SHA-256 を `SERVICE_CONTROL_TOKEN_SHA256` に設定します。

## Build と install

```bash
cd /opt/autostream-control-panel
go test ./...
go build -o control-panel ./cmd/control-panel

sudo install -o root -g root -m 0755 control-panel /usr/local/bin/control-panel
sudo install -o root -g root -m 0644 systemd/autostream-control-panel.service.example /etc/systemd/system/autostream-control-panel.service
```

UI build を同梱する運用では、事前に `web` 側も build します。

```bash
cd web
npm install
npm run build
```

## systemd 起動

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-control-panel
sudo systemctl status autostream-control-panel
```

ログ確認:

```bash
journalctl -u autostream-control-panel -f
```

session secret、service token、Observability token、secret value が log に出ていないことを確認してください。

## Health check

```bash
curl http://127.0.0.1:8080/health
```

初回 admin 作成は `AUTOSTREAM_SETUP_TOKEN` を使って行います。setup token は初回設定後に無効化または rotation する運用を推奨します。

## Observability 連携

Control Panel は incident、diagnostic、metrics、remediation、notification delivery を表示するために Observability API へ proxy します。

```text
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
OBSERVABILITY_TIMEOUT_SEC=5
```

`OBSERVABILITY_TOKEN` は secret です。log、API response、frontend に出しません。

## Service dispatch

Control Panel から各 service へ dispatch するには、各 service の `SERVICE_PUBLIC_URL` が Control Panel から到達可能である必要があります。同一 Docker network 前提にしないでください。

dispatch 先:

```text
discord_bot      -> /jobs/start, /jobs/{id}/stop
worker           -> /jobs/start, /jobs/{id}/stop
encoder_recorder -> /streams/start, /streams/{id}/stop, /streams/package
```

必須 service が stream に割り当てられていない場合は `409 missing_stream_assignments` を返し、dispatch しません。

## systemd hardening

付属 unit は次の hardening を含みます。

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/autostream/control-panel
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
```

追加の state file や log file を使う場合は、必要最小限の path だけを `ReadWritePaths` に追加してください。

## トラブルシュート

- 起動しない場合は `DATABASE_URL`、MariaDB 到達性、migration 権限を確認します。
- login / setup ができない場合は `AUTOSTREAM_SETUP_TOKEN`、session secret、cookie secure 設定、reverse proxy を確認します。
- stream start が `missing_stream_assignments` になる場合は Discord Bot、Worker、Encoder/Recorder の assignment を確認します。
- `stream_start_not_ready` の場合は service public URL、stale heartbeat、`SERVICE_CALL_TOKEN`、Encoder/Recorder preflight を確認します。
- Observability 画面が空の場合は `OBSERVABILITY_URL` と `OBSERVABILITY_TOKEN` を確認します。
