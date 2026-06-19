# Worker

Worker は stream context から overlay、caption、participant、active speaker、current time の event を生成し、Encoder/Recorder へ送るサービスです。Control Panel から job を受け取り、Encoder/Recorder の `/worker-events` に event を publish します。

## Source / ownership

Worker の job、assignment、Encoder/Recorder route は Control Panel runtime config が source of truth です。`<SERVICE_CALL_TOKEN>` は Control Panel から Worker への inbound dispatch secret、`<ENCODER_RECORDER_TOKEN>` は Worker から Encoder/Recorder への publish secret で、raw value は logs、event payload、evidence に残しません。event schema は `autostream-contracts` が所有し、Worker repo はその schema に従って event を生成します。
外部確認の記録 では configured route、masked service ID、event count、sidecar fingerprint を残し、generated token や raw event credential は残しません。

## 役割

- Control Panel へ service registration と heartbeat を送る。
- stream job の start / stop を受け取る。
- overlay / caption / participant / active speaker / current time event を生成する。
- event を Encoder/Recorder へ送信する。
- event counters と送信失敗を heartbeat / Observability に報告する。
- Control Panel からの test event を通常経路で Encoder/Recorder へ流す。

Worker は配信 final output の encode、録画、Google Drive upload を行いません。video layer stream は MVP 後の拡張として扱います。

## Event types

標準 event type は次の通りです。

```text
overlay.current_time
overlay.participants
overlay.active_speaker
caption.telop
caption.final
```

custom event を追加する場合は、contracts 側で `overlay.` または `caption.` の prefix と payload schema を先に定義します。

## Job flow

Control Panel は stream start 時に Worker へ job を送ります。

```text
POST /jobs/start
Authorization: Bearer <SERVICE_CALL_TOKEN>
```

job には stream id、stream name、profile id、Encoder/Recorder URL が含まれます。Worker は job の context を保持し、event を次へ送ります。

```text
POST /worker-events
Authorization: Bearer <ENCODER_RECORDER_TOKEN>
```

Encoder/Recorder は受け取った event を `tmp/{stream_id}/logs.jsonl`、`captions.vtt`、`transcript.json` などの sidecar に保存します。

## Control Panel test event

Control Panel の Streams 画面から Worker event path を確認できます。

```text
POST /streams/{id}/worker-events/test
```

この endpoint は Control Panel から割り当て済み Worker へ test event を dispatch します。Control Panel が直接 Encoder/Recorder に sidecar を書き込むわけではありません。

## Heartbeat metrics

```text
worker.overlay_events_total
worker.caption_events_total
worker.scene_updates_total
worker.event_send_failures_total
```

metrics が増えているのに Encoder/Recorder の sidecar が空の場合は、Worker から Encoder/Recorder への URL、token、network、`/worker-events` の認証を確認します。

## Environment

```text
SERVICE_ID=worker-01
SERVICE_NAME=Worker 01
SERVICE_PUBLIC_URL=https://worker.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
ENCODER_RECORDER_URL=https://encoder.example.com
ENCODER_RECORDER_TOKEN=<WORKER_TO_ENCODER_EVENTS_TOKEN>
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
TZ=Asia/Tokyo
```

Control Panel から Worker への inbound call は `SERVICE_CALL_TOKEN` で検証します。Worker から Encoder/Recorder への publish も bearer token を使います。

## Retry

Worker から Encoder/Recorder への event publish は、network error、`429`、`5xx` の transient failure に限り retry します。`400`、`401`、`403` は payload または token 設定の問題として扱い、無限 retry しません。

```text
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
```

## Security

Worker の security 境界は、Control Panel runtime config、stream-scoped event generation、Encoder/Recorder sidecar ingest に分かれます。Worker は割り当て外 stream の config や secret を読まず、caption / overlay content を user-generated data として扱い、event evidence には stream ID、event type、sidecar status だけを残します。

- service token は response、log、event payload に含めません。
- `stream_id` は path traversal を防ぐため `/`、`\`、`..` を拒否します。
- 未割り当て stream への heartbeat / event は Control Panel 側で拒否します。
- caption text は user-generated content として扱い、UI では escape します。

## 残タスク

- participant / active speaker event の実 Discord E2E。
- caption final と `captions.vtt` / `transcript.json` の実配信中検証。
- video layer stream は MVP 完了後に別フェーズで実装します。
