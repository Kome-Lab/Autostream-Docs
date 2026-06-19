# Observability 環境変数

Observability は signal ingest、rule detection、incident、diagnostic、remediation、notification を担当します。例には placeholder だけを使用してください。

## Source / ownership

`DATABASE_URL` と `AUTOSTREAM_SECRET_ENCRYPTION_KEY` は operator が password manager / secret manager から bootstrap env に入れる値です。`OBSERVABILITY_INGEST_TOKEN_*` は Encoder/Recorder / Worker 用に generated した ingest token の hash と binding で、raw token は service env または secret manager 側だけに置きます。notification webhook URL、SMTP password、provider credential は Control Panel / Observability の encrypted channel record が source of truth で、API response と evidence には configured / masked / fingerprint だけを出します。

## 基本設定

```text
SERVICE_ID=observability-01
SERVICE_NAME=Observability 01
SERVICE_PUBLIC_URL=https://observability.example.com
SERVICE_VERSION=0.1.0
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_observability?parseTime=true
TZ=Asia/Tokyo
```

MariaDB が必須です。SQLite fallback はありません。

## Ingest token

```text
OBSERVABILITY_INGEST_TOKEN_SHA256_LIST=<SHA256_OF_ENCODER_TOKEN>,<SHA256_OF_WORKER_TOKEN>
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_ENCODER_TOKEN>:encoder_recorder:encoder-recorder-prod-01,<SHA256_OF_WORKER_TOKEN>:worker:worker-prod-01
OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_ENCODER_TOKEN>:encoder_recorder:encoder-recorder-01
```

Encoder/Recorder と Worker は異なる ingest token を使います。複数 token hash は `OBSERVABILITY_INGEST_TOKEN_SHA256_LIST` に comma-separated で指定し、全hashを `OBSERVABILITY_INGEST_TOKEN_BINDINGS` で service type と `SERVICE_ID` へ束縛します。productionでは旧 `OBSERVABILITY_INGEST_TOKEN_SHA256` を設定しません。binding不足や形式不正がある場合、ingest認証は全件fail closedになります。

## Admin token scope

```text
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_OBSERVABILITY_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_CONTROL_PANEL_OBSERVABILITY_TOKEN>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
```

本番では `OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true` を維持します。Binding がない token は認証できても管理 API の認可に失敗します。

## Control Panel 連携

```text
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<OBSERVABILITY_SERVICE_TOKEN_WITH_REMEDIATION_EXECUTE>
CONTROL_PANEL_TIMEOUT_SEC=5
CONTROL_PANEL_HEARTBEAT_INTERVAL_SEC=30
```

`CONTROL_PANEL_TOKEN` は `service_type=observability` の service token です。remediation dispatch を使用する場合は Control Panel 側で `remediation.execute` scope を付与します。Observability が Control Panel から runtime config を読む場合は `service.config.read`、raw runtime secret を解決する設計にする場合は `service.secret.resolve` を別途付けます。

## Notification

```text
NOTIFICATION_WEBHOOK_TYPE=discord
NOTIFICATION_WEBHOOK_URL=https://discord.com/api/webhooks/<WEBHOOK_ID>/<WEBHOOK_TOKEN>
NOTIFICATION_WEBHOOK_TIMEOUT_SEC=5
OBSERVABILITY_ALLOW_PRIVATE_WEBHOOKS=false
```

Webhook URL は secret です。remote destination は HTTPS 必須です。

本番の標準は Control Panel / Observability の encrypted notification channel です。`NOTIFICATION_WEBHOOK_URL` のような env fallback は local smoke または一時互換に限定し、production channel の source of truth にはしません。MariaDB backend では webhook URL と SMTP password が ciphertext/nonce として保存され、API response、diagnostic、delivery history には masked target だけを返します。

private webhook / SMTP host は production では env allow flag があっても拒否します。local 検証で private endpoint を使う場合は `AUTOSTREAM_ENV`、allow flag、network scope、test evidence を分け、本番 channel へ昇格する前に public HTTPS endpoint と provider-side delivery proof を確認します。

## Rate limit

```text
OBSERVABILITY_RATE_LIMIT_BACKEND=store
OBSERVABILITY_TRUSTED_PROXIES=127.0.0.1
OBSERVABILITY_RATE_LIMIT_BURST=120
OBSERVABILITY_RATE_LIMIT_WINDOW_SEC=60
OBSERVABILITY_RATE_LIMIT_MAX_BUCKETS=10000
```

Multi-replica 本番環境では `store` backend を使用します。

## Remediation

```text
REMEDIATION_MODE=suggest_only
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<32_BYTE_BASE64_OR_HEX_ENCRYPTION_KEY>
```

危険な action は自動実行しません。

## Detection threshold

```text
OBSERVABILITY_THRESHOLD_HEARTBEAT_AGE_SEC=30
OBSERVABILITY_THRESHOLD_DISK_FREE_BYTES=10737418240
OBSERVABILITY_THRESHOLD_REMUX_SLOW_MS=300000
OBSERVABILITY_THRESHOLD_GDRIVE_UPLOAD_RETRY_COUNT=3
OBSERVABILITY_THRESHOLD_PACKET_LOSS_PERCENT=5
OBSERVABILITY_THRESHOLD_RTMPS_RECONNECT_COUNT=3
OBSERVABILITY_THRESHOLD_ENCODER_LOW_FPS=45
OBSERVABILITY_THRESHOLD_ENCODER_LOW_BITRATE_KBPS=3000
OBSERVABILITY_THRESHOLD_ENCODER_DROPPED_FRAMES_TOTAL=30
OBSERVABILITY_THRESHOLD_AUDIO_SILENCE_SEC=5
OBSERVABILITY_THRESHOLD_AUDIO_CLIPPING_TOTAL=10
OBSERVABILITY_THRESHOLD_DISCORD_AUDIO_FORWARD_STALE_SEC=5
OBSERVABILITY_THRESHOLD_DISCORD_AUDIO_FORWARD_ERRORS_TOTAL=3
OBSERVABILITY_THRESHOLD_MEDIA_INPUT_TIMEOUT_SEC=5
OBSERVABILITY_THRESHOLD_STREAM_START_TIMEOUT_MS=120000
OBSERVABILITY_THRESHOLD_STREAM_STOP_TIMEOUT_MS=120000
```

実 Discord、YouTube、Google Drive E2E 後に incident 頻度と実測値を確認し、誤検知を避けながら調整してください。

threshold を変更した場合は、Observability rule、Control Panel incident hint、docs の monitoring threshold、external verification record checker の期待値が矛盾しないかを確認します。緩める場合は false positive の evidence、厳しくする場合は provider 実測値と recovery signal を添えて、raw metric payload や token を共有しません。
