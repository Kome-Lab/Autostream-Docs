# Worker Events API

Worker は stream context を受け取り、overlay、caption、participant、active speaker、current time の event を生成します。生成した event は Encoder/Recorder の `POST /worker-events` に送信され、archive sidecar として保存されます。

## Event types

```text
overlay.current_time
overlay.participants
overlay.active_speaker
caption.telop
caption.final
```

custom event は `overlay.` または `caption.` prefix のみ許可します。

## Control Panel から Worker への API

Control Panel は割り当て済み Worker に job と event 生成指示を送ります。

```text
POST /jobs/start
POST /jobs/{id}/stop
GET  /streams/{id}/events
POST /streams/{id}/events/current-time
POST /streams/{id}/events/caption
POST /streams/{id}/events/participants
POST /streams/{id}/events/active-speaker
POST /streams/{id}/events/overlay
```

`/health` と `/status` 以外は `Authorization: Bearer <SERVICE_CALL_TOKEN>` を要求します。Worker 側では対応する `SERVICE_CONTROL_TOKEN_SHA256` で検証します。

Job start 例:

```json
{
  "stream_id": "stream-01",
  "stream_name": "週次配信",
  "encoder_recorder_url": "https://encoder.example.com",
  "stream_ingest_token": "<SHORT_LIVED_STREAM_INGEST_TOKEN>",
  "overlay_profile_id": "overlay-profile-01",
  "caption_profile_id": "caption-profile-01"
}
```

`stream_ingest_token` は Control Panel が stream start 時に発行する短命 token です。Worker はこの token を Encoder/Recorder への event publish に使います。Worker の status API では返しません。

## Worker から Encoder/Recorder への API

```http
POST /worker-events
Authorization: Bearer <STREAM_INGEST_TOKEN_OR_ENCODER_RECORDER_TOKEN>
Content-Type: application/json
```

```json
{
  "id": "event-01",
  "stream_id": "stream-01",
  "type": "caption.telop",
  "payload": {
    "text": "こんにちは",
    "speaker_user_id": "discord-user-01"
  },
  "timestamp": "2026-06-01T00:00:00Z"
}
```

Encoder/Recorder は短命 `stream_ingest_token` の署名、期限、stream ID、service type、purpose、audience を検証します。静的 scoped token を使う場合は、Encoder/Recorder 側に `ENCODER_WORKER_EVENTS_TOKEN_SHA256`、Worker 側に raw `ENCODER_RECORDER_TOKEN` を設定します。どちらもない場合、`POST /worker-events` は拒否されます。

Encoder/Recorder は event を `tmp/{stream_id}/logs.jsonl` に追記します。caption event は `captions.vtt` と `transcript.json` にも反映します。payload 内の secret らしい値は sidecar 保存前に redaction されます。

## Encoder/Recorder から sidecar を確認する API

Control Panel は割り当て済み Encoder/Recorder から worker event sidecar を取得できます。

```http
GET /streams/{stream_id}/worker-events
Authorization: Bearer <SERVICE_CALL_TOKEN>
```

Encoder/Recorder 側では Control Panel command token に対応する `SERVICE_CONTROL_TOKEN_SHA256` で検証します。

## Retry

Worker から Encoder/Recorder への publish は、通信断、`429`、`5xx` の transient failure に限って再送します。`400`、`401`、`403` は payload または token 設定の問題として扱い、無限 retry しません。

```text
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
```

retry 後も失敗した場合、Worker は `worker.event.send_failed` event と `worker.event_send_failures_total` metric を Observability へ送ります。upstream response body や token は返しません。

## Archive sidecar

```text
/var/lib/autostream/archives/
  tmp/{stream_id}/
    captions.vtt
    transcript.json
    logs.jsonl
```

配信終了後の package flow で、sidecar は `final/{stream_id}/` にコピーされ、`metadata.json` とともに Google Drive upload 対象になります。

## Security

Worker event API は stream-scoped な service token と assignment を前提にします。event payload には overlay/caption の必要最小限の値だけを含め、provider credential、Discord token、credential 付き URL、raw archive path は送らず、Encoder/Recorder 側でも対象 stream 以外の event を拒否します。

## Operational Notes

Worker Events API は、Worker が生成した overlay / caption / participant state を Encoder/Recorder 側の archive sidecar に渡すための境界です。Control Panel は stream assignment と runtime config version を所有しますが、event payload の生成、retry、send failure metric は Worker repository の責務です。Encoder/Recorder は受信後に sidecar と metadata へ保存し、upload 証跡には fingerprint と count だけを残します。

外部確認でこの API を確認する場合は、Worker の `send_failed` が増えていないこと、Encoder/Recorder 側で sidecar artifact が同じ `stream_id` に紐づくこと、archive package が `final.mkv` / `final.mp4` と同じ run の成果物であることを見ます。payload に token、provider URL、credential path を混ぜた証跡は verification record として扱いません。

- `stream_id` は path traversal と FFmpeg syntax 注入を防ぐため、制限された文字だけを許可します。
- Authorization token は log や response に出しません。
- Worker event payload に raw secret を含めないでください。Encoder/Recorder 側でも保存前に redaction します。
- Control Panel 側では、未割り当て service から対象 stream への event / heartbeat を拒否します。
