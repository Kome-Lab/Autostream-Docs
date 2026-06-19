# Worker 環境変数

Worker は overlay、caption、participant、active speaker、current time の event を生成し、Encoder/Recorder へ送信します。

## Source / ownership

`CONTROL_PANEL_TOKEN` は Control Panel で generated する Worker service token です。`SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Worker へ dispatch する outbound token の hash で、raw token は Control Panel 側の bootstrap secret として扱います。`ENCODER_RECORDER_TOKEN` は Worker から Encoder/Recorder へ event を送る service-to-service token で、production では runtime config で配布する方向を優先し、static env は compatibility fallback として扱います。

```text
SERVICE_ID=worker-01
SERVICE_NAME=Worker 01
SERVICE_PUBLIC_URL=https://worker.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_WORKER_TOKEN>
ENCODER_RECORDER_URL=https://encoder.example.com
ENCODER_RECORDER_TOKEN=<WORKER_TO_ENCODER_EVENTS_TOKEN>
ENCODER_RECORDER_TIMEOUT_SEC=5
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
OBSERVABILITY_TIMEOUT_SEC=5
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_worker?parseTime=true
TZ=Asia/Tokyo
```

`CONTROL_PANEL_TOKEN` は Worker が Control Panel へ register / heartbeat / runtime config 取得を行うための service token です。通常の Worker では `service.config.read`、`service.heartbeat`、`worker.events.write` が中心です。将来 raw runtime secret を解決する Worker には `service.secret.resolve` も付けます。

`SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Worker へ job start / stop や test event command を送る token の hash です。

`ENCODER_RECORDER_TOKEN` は Worker が Encoder/Recorder の `/worker-events` へ event を送る raw token です。Encoder/Recorder 側には対応する `ENCODER_WORKER_EVENTS_TOKEN_SHA256` を設定してください。

## Runtime route ownership

本番では Worker が stream ごとに Encoder/Recorder route を Control Panel runtime config から受け取ります。`ENCODER_RECORDER_URL` と `ENCODER_RECORDER_TOKEN` は互換 fallback であり、新しい stream assignment の source of truth ではありません。Control Panel から job-scoped route と token が返っている場合、env fallback で補完したり別 stream の route を再利用したりしません。

Worker は primary assignment の stream にだけ event を publish します。standby Worker は heartbeat、capability、readiness を返せますが、primary へ昇格するまで `/worker-events` へ overlay / caption / participant event を送信しません。assignment mismatch、runtime config version mismatch、token mismatch は retry ではなく設定不整合として扱います。

## Retry

`ENCODER_RECORDER_RETRY_MAX` は Worker から Encoder/Recorder への `/worker-events` 送信 retry 回数です。通信断、`429`、`5xx` のみ再送します。`400`、`401`、`403` は payload または token 設定の問題として扱い、無限 retry しません。

## Secret

service token、credential 付き URL、webhook URL はログや API response に出さないでください。Worker event payload にも raw secret を含めないでください。

## Production baseline

production では Worker も Control Panel runtime config を優先し、static Encoder route は互換 fallback として扱います。stream ごとの Encoder route、event token、assignment role が Control Panel から返らない場合は start を fail closed にし、古い env fallback で別 stream へ event を送らないでください。heartbeat には own service ID、capabilities、last event status、publish failure count を載せ、raw token や credential URL は載せません。

Worker 変更後は、Control Panel の Worker event test、`worker.scene_updates_total`、`worker.event_send_failures_total`、Encoder/Recorder sidecar を同じ stream ID で確認します。event path が増えて sidecar が空なら publish 経路、sidecar に event があり archive sidecar に出ないなら Encoder/Recorder の package phase を調査します。
