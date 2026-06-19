# Docker デプロイ

```bash
cp .env.example .env
docker compose up --build
```

標準 DB は MariaDB です。SQLite fallback はありません。

```text
mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_worker?parseTime=true
```

Control Panel、Encoder/Recorder、Observability と同じ Docker network にいる前提にはしません。各 URL は HTTPS の到達可能な URL として設定してください。

実 token は Docker secret、環境変数、または運用基盤の secret 管理から注入してください。compose file には placeholder だけを置きます。

## Encoder/Recorder publish retry

Worker から Encoder/Recorder への `/worker-events` 送信は、通信断、`429`、`5xx` の transient failure に限って再送します。

```text
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
```

## Runtime config readiness

本番 Docker では Worker 自身の bootstrap env と job-scoped runtime config を分けます。`CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN`、`SERVICE_ID`、`SERVICE_PUBLIC_URL`、`SERVICE_CONTROL_TOKEN_SHA256` は起動時に必要です。Encoder/Recorder の送信先、`stream_ingest_token`、dispatch secret は Control Panel の service registry と stream assignment から job ごとに配布されます。

`ENCODER_RECORDER_URL` と `ENCODER_RECORDER_TOKEN` は local migration / dry-run 用 fallback です。本番 compose では設定せず、Control Panel から配布されない job は fail closed として開始しません。

## Production readiness

- `SERVICE_PUBLIC_URL` は Control Panel から到達できる HTTPS URL にします。
- `SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Worker を呼び出す inbound token の SHA-256 です。`CONTROL_PANEL_TOKEN` とは別の値にします。
- `OBSERVABILITY_URL` と `OBSERVABILITY_TOKEN` は通知・signal 送信用です。到達不能時も job 本体を止めるかどうかは運用 policy で決め、失敗は structured log に残します。
- Docker compose には secret の実値を書かず、Docker secret、環境変数注入、または運用基盤の secret manager から渡します。

## Evidence / rollback

起動後は `GET /health` と `GET /status`、Control Panel の heartbeat、`/worker-events` の retry log、Observability signal log を 1 job 分保存します。rollback は image tag を戻し、Control Panel 側の assignment を standby Worker に切り替え、失敗した job の runtime config を再配布してから再実行します。
