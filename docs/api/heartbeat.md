# Heartbeat API

各 AutoStream service は Control Panel に heartbeat を送信し、稼働状態、現在担当している stream、軽量 metrics を報告します。Control Panel はこの情報を Service Health と Streams 画面に表示し、start / stop / retry dispatch 前の readiness 判定にも使います。

## Endpoint

```http
POST /services/heartbeat
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "service_id": "discord-bot-01",
  "status": "online",
  "current_stream_id": "stream-01",
  "metrics": {
    "discord.voice_connected": 1,
    "discord.audio_receiving": 1,
    "discord.audio_forward_active": 1,
    "discord.audio_forwarded_total": 128,
    "discord.reconnect_count": 0,
    "discord.voice_disconnect_count": 0
  }
}
```

## 認証と assignment 検証

- `service.heartbeat` scope を持つ service token が必要です。
- token の service type と登録済み service type が一致しない場合は拒否します。
- `current_stream_id` が指定された場合、その service が対象 stream に割り当て済みでなければ拒否します。
- heartbeat には raw secret、stream key、credential 付き URL を含めません。

## 保存される metrics

Control Panel は heartbeat metrics を service record に保存し、`GET /service-health` で返します。保存対象は数値のみです。boolean 状態は `1` / `0` で送信します。文字列 metric は secret 混入を避けるため保存しません。

Discord Bot の代表例:

```text
discord.gateway_connected
discord.voice_connected
discord.audio_receiving
discord.audio_forward_enabled
discord.audio_forward_active
discord.audio_packets_total
discord.audio_forwarded_total
discord.audio_forward_errors_total
discord.audio_last_packet_age_sec
discord.audio_last_forward_age_sec
discord.participant_count
discord.worker_event_publish_failures_total
discord.reconnect_count
discord.voice_disconnect_count
```

Worker の代表例:

```text
worker.overlay_events_total
worker.caption_events_total
worker.scene_updates_total
worker.event_send_failures_total
```

Encoder/Recorder の代表例:

```text
encoder.process_alive
encoder.output_fps
encoder.output_bitrate_kbps
recorder.file_size_bytes
recorder.disk_free_bytes
```

## UI での見え方

- Service Health は heartbeat age、health status、capabilities、重要 metrics を表示します。
- Streams 画面では Discord Bot の音声受信 / forward 状態、Worker の event 送信状態、Encoder/Recorder の audio bridge status を並べて確認できます。
- `discord.audio_forward_active=1` でも Encoder 側 `packets_total=0` の場合は、Bot から Encoder への到達性や token を確認します。
- `worker.event_send_failures_total>0` の場合は、Worker から Encoder/Recorder への URL、token、対象 stream assignment を確認します。

## 失敗時の確認

| 状態 | 確認先 |
| --- | --- |
| `401 missing_or_invalid_service_token` | token、scope、revocation |
| `403 service_not_assigned_to_stream` | stream assignment |
| heartbeat stale | service process、network、Control Panel URL |
| metrics が表示されない | heartbeat payload、数値以外の metric、Service Health reload |

## Evidence

heartbeat evidence には service ID、service type、stream assignment、observed timestamp、runtime config version、freshness 判定を残します。Control Panel service token や dispatch token は記録せず、offline / stale / assigned mismatch の分類だけを operator に返します。

## Operator Notes

Heartbeat は health check ではなく、Control Panel が dispatch してよい service かを判断する runtime contract です。service が listening していても、assignment が古い、runtime config version が違う、service ID が別 stream に紐づく、public URL が allowlist 外である場合は start / stop / retry dispatch の前提を満たしません。

外部確認では heartbeat freshness を、Discord packet delta、Worker event send result、Encoder archive/upload result、Observability incident signal と同じ `stream_id` で確認します。証跡には service token や inbound dispatch token を書かず、service ID、role、assigned stream、last heartbeat age、runtime config version、primary/standby state だけを残します。

運用証跡では heartbeat の raw payload 全体を保存せず、service ID、service type、assignment role、heartbeat age、主要 metric の configured/present 状態だけを残します。token、public URL の credential、provider credential、runtime secret reference は evidence に展開しません。

外部確認では heartbeat freshness を単独の成功条件にしません。同じ stream ID の start readiness、runtime config version、Discord audio、Worker event、Encoder/Recorder media metric と結び付いている場合だけ、service が実行経路に参加している証跡として扱います。
