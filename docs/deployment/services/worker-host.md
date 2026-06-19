# Worker host deployment

Linux host に `autostream-worker` を直接インストールする手順です。実行ユーザーは `autostream` を推奨します。

## 配置先

```text
binary: /usr/local/bin/worker
config: /etc/autostream/worker.env
data:   /var/lib/autostream/worker
unit:   /etc/systemd/system/autostream-worker.service
user:   autostream
```

現時点の job/event state は in-memory です。`DATABASE_URL` は将来の永続化と環境統一のために残しています。永続化を追加する場合は MariaDB を使い、SQLite fallback は追加しません。

## Linux user と directory

```bash
sudo useradd --system --home /var/lib/autostream/worker --shell /usr/sbin/nologin autostream
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/worker
sudo install -d -o root -g root -m 0750 /etc/autostream
```

## 環境変数

`/etc/autostream/worker.env` を作成します。

```text
SERVICE_ID=worker-01
SERVICE_NAME=Worker
SERVICE_PUBLIC_URL=https://worker.example.com
SERVICE_VERSION=dev
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true

CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
CONTROL_PANEL_HEARTBEAT_INTERVAL_SEC=30

SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>

ENCODER_RECORDER_TIMEOUT_SEC=5
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1

# Compatibility fallback only. Standard operation receives these per stream job
# from Control Panel as encoder_recorder_url and stream_ingest_token.
# ENCODER_RECORDER_URL=https://encoder.example.com
# ENCODER_RECORDER_TOKEN=<WORKER_TO_ENCODER_EVENTS_TOKEN>

OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
OBSERVABILITY_TIMEOUT_SEC=5

AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_worker?parseTime=true
TZ=Asia/Tokyo
```

env file の権限:

```bash
sudo install -o root -g autostream -m 0640 /tmp/worker.env /etc/autostream/worker.env
```

`CONTROL_PANEL_TOKEN` は Control Panel への registration / heartbeat 用 token です。`SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Worker へ job や test event を dispatch する inbound token の hash です。Worker から Encoder/Recorder の `/worker-events` に送る URL と token は、標準では Control Panel が stream job context の `encoder_recorder_url` と `stream_ingest_token` として渡します。`ENCODER_RECORDER_URL` / `ENCODER_RECORDER_TOKEN` は local migration / dry-run 互換 fallback であり、本番 env には置かないでください。

`AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` または `AUTOSTREAM_ENV=production` の場合、Worker は Control Panel registration と runtime config 取得に失敗すると起動を停止します。runtime config に含まれる自 service の primary assignment だけを受け付け、standby または別 Worker に割り当てられた stream の `/jobs/start` は拒否します。

## Build と install

```bash
cd /opt/autostream-worker
go test ./...
go build -o worker ./cmd/worker

sudo install -o root -g root -m 0755 worker /usr/local/bin/worker
sudo install -o root -g root -m 0644 systemd/autostream-worker.service.example /etc/systemd/system/autostream-worker.service
```

## systemd 起動

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-worker
sudo systemctl status autostream-worker
```

ログ確認:

```bash
journalctl -u autostream-worker -f
```

service token、webhook URL、credential 付き URL が log に出ていないことを確認してください。

## Health と status

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/status
```

`/status` では current stream、event count、event type ごとの counter、send failure を確認できます。

## Control Panel 連携

Control Panel から stream に Worker を割り当てた後、start 時に次が呼ばれます。

```text
POST /jobs/start
Authorization: Bearer <SERVICE_CALL_TOKEN>
```

stop 時:

```text
POST /jobs/{stream_id}/stop
Authorization: Bearer <SERVICE_CALL_TOKEN>
```

Control Panel の Worker test event は、割り当て済み Worker に送られ、Worker が通常経路で Encoder/Recorder の `/worker-events` へ publish します。

## Event path 確認

current time test:

```bash
curl -X POST http://127.0.0.1:8080/streams/<STREAM_ID>/events/current-time \
  -H "Authorization: Bearer <SERVICE_CALL_TOKEN>"
```

caption test:

```bash
curl -X POST http://127.0.0.1:8080/streams/<STREAM_ID>/events/caption \
  -H "Authorization: Bearer <SERVICE_CALL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Control Panel test caption","speaker_user_id":"control-panel-test"}'
```

成功すると Worker の status counter が増え、Encoder/Recorder 側の `GET /streams/{id}/worker-events` で sidecar に保存された event を確認できます。

## 監視 metrics

```text
worker.overlay_events_total
worker.caption_events_total
worker.scene_updates_total
worker.event_send_failures_total
```

`worker.event_send_failures_total` が増える場合は、Control Panel の stream assignment、job context の `encoder_recorder_url` / `stream_ingest_token`、network 到達性、Encoder/Recorder の worker-event ingest token 設定を確認します。local fallback を使っている場合だけ `ENCODER_RECORDER_URL` と `ENCODER_RECORDER_TOKEN` を確認します。

## systemd hardening

付属 unit は次の hardening を含みます。

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/autostream/worker
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
```

追加の state file や log file を使う場合は、必要最小限の path だけを `ReadWritePaths` に追加してください。

## トラブルシュート

- Control Panel に表示されない場合は `CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN`、`SERVICE_PUBLIC_URL` を確認します。
- job start が `401` になる場合は Control Panel の `SERVICE_CALL_TOKEN` と Worker の `SERVICE_CONTROL_TOKEN_SHA256` の対応を確認します。
- event publish が失敗する場合は Control Panel の assignment と job-scoped Encoder route / ingest token を確認します。local fallback を使っている場合だけ `ENCODER_RECORDER_URL` と `ENCODER_RECORDER_TOKEN` を確認します。
- status counter が増えているのに archive sidecar が空の場合は、Encoder/Recorder の `/worker-events` 認証と archive path を確認します。
