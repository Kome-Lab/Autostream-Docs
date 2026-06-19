# セキュリティ

`autostream-worker` は stream context とサービス間 token を扱います。raw secret を UI、ログ、API response に返さないことを前提にします。

## Secret

- `CONTROL_PANEL_TOKEN` は Control Panel への registration / heartbeat にだけ使います。
- `SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Worker への job/event 指示を検証する inbound token hash です。
- Encoder/Recorder への event publish token は、標準では Control Panel が stream job context の `stream_ingest_token` として渡します。`ENCODER_RECORDER_TOKEN` は local migration / dry-run 互換 fallback のみです。
- `OBSERVABILITY_TOKEN` は Observability への signal report にだけ使います。
- token、webhook URL、credential 付き URL はログや API response に含めません。

## API 認証

以下は bearer token 必須です。

- `POST /heartbeat`
- `POST /jobs/start`
- `POST /jobs/{id}/stop`
- `GET /streams/{id}/events`
- `POST /streams/{id}/events/*`

本番では reverse proxy と firewall で Control Panel からの inbound だけを許可してください。

## イベント検証

custom overlay event の type は `overlay.` または `caption.` prefix のみ許可します。任意 shell command や任意 file path を payload として解釈しません。

Encoder/Recorder への publish に失敗した場合、API response には汎用的な `event publish failed` を返し、job-scoped token、fallback token、upstream response body は含めません。Observability には `worker.event.send_failed` と `worker.event_send_failures_total` を送信します。

## Retry

Encoder/Recorder publish は通信断、`429`、`5xx` の transient failure に限って再送します。`400` や認証失敗は再送せず、設定や payload の問題として扱います。

```text
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
```

## 後続実装の注意

映像レイヤー stream 生成を追加する場合でも、外部プロセスは shell 文字列ではなく引数配列で起動してください。
