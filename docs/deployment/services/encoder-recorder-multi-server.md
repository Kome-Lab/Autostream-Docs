# Multi-server Deployment

Encoder/Recorder は Control Panel、Worker、Discord Bot、Observability と別 host に配置できます。同一 Docker network を前提にせず、各 service URL と token を明示して運用します。

## 必須 bootstrap

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder
SERVICE_PUBLIC_URL=https://encoder.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
```

YouTube stream key、Drive folder ID、OAuth refresh token は env に置かず、Control Panel の YouTube Output、Drive Destination、OAuth Connected Account、Archive Profile から stream runtime config として渡します。

## 通信方向

- Encoder/Recorder から Control Panel: `/services/register`、`/services/heartbeat`
- Control Panel から Encoder/Recorder: stream start / stop / package / preflight
- Worker から Encoder/Recorder: `/worker-events`
- Discord Bot から Encoder/Recorder: `/streams/{stream_id}/audio/opus`
- Encoder/Recorder から Observability: `/signals`
- Encoder/Recorder から local output relay: RTMP loopback
- output relay から YouTube: RTMPS
- Encoder/Recorder から Google Drive API: archive upload

## firewall

本番では `AUTOSTREAM_BIND_ADDR=127.0.0.1:8080` とし、reverse proxy で HTTPS 終端する構成を推奨します。Control Panel、Worker、Discord Bot からの inbound API だけを許可してください。

output relay は loopback または同一 private host 内に閉じ、外部から relay ingest endpoint に接続できないようにします。

## assignment

Control Panel では Encoder/Recorder を複数登録できます。stream には primary Encoder/Recorder を 1 つ割り当て、standby は将来の failover 候補として保持します。start dispatch と runtime secret 解決は primary に限定します。

## Secret

service token、YouTube stream key、Google credential、Drive folder ID、OAuth refresh token は log や API response に raw 値で出しません。`.env.example` と docs には placeholder のみを使います。
