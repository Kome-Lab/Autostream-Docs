# Observability Ingest API

Observability は AutoStream 各 service から signal を受け取り、rule detection、incident、diagnostic、remediation、notification delivery history を管理します。Control Panel は表示と承認 UI を担当し、検知と診断の主体は Observability service です。

## 認証

Ingest API は service token を要求します。Token は Control Panel で作成し、一度だけ表示します。保存時は hash 化し、raw token は logs、audit、UI、docs に残しません。

代表 scope:

- `observability.ingest`
- `service.heartbeat`
- `service.status.write`
- `service.logs.write`

割り当て外 stream の event は拒否します。

## Signal Types

```text
heartbeat
metric
log
event
warning
error
incident
diagnostic_report
remediation_action
notification_event
```

## POST /signals

service は metric、event、warning、error をまとめて送信できます。

```json
{
  "service_id": "encoder-01",
  "service_type": "encoder_recorder",
  "stream_id": "stream-01",
  "signals": [
    {
      "type": "metric",
      "name": "encoder.output_fps",
      "value": 59.94,
      "unit": "fps",
      "timestamp": "2026-06-10T00:00:00Z",
      "metadata": {
        "profile_id": "encoder-profile-01"
      }
    }
  ]
}
```

secret、stream key、credential 付き URL、webhook URL、SMTP password、OAuth token は `metadata` に入れません。

## Required Metrics

Stream:

- `stream.status`
- `stream.start_duration_ms`
- `stream.live_duration_sec`
- `stream.stop_duration_ms`
- `stream.restart_count`

Encoder/Recorder:

- `encoder.process_alive`
- `encoder.output_fps`
- `encoder.output_bitrate_kbps`
- `encoder.dropped_frames_total`
- `encoder.encode_lag_ms`
- `encoder.audio_level_db`
- `encoder.audio_silence_sec`
- `encoder.audio_clipping_total`
- `encoder.rtmp_reconnect_count`
- `recorder.file_size_bytes`
- `recorder.write_bitrate_kbps`
- `recorder.disk_free_bytes`
- `recorder.remux_duration_ms`

Discord Bot:

- `discord.gateway_connected`
- `discord.voice_connected`
- `discord.audio_receiving`
- `discord.audio_forward_active`
- `discord.audio_forwarded_total`
- `discord.participant_count`
- `discord.worker_event_publish_failures_total`
- `discord.reconnect_count`
- `discord.voice_disconnect_count`

Archive / upload:

- `archive.final_mkv_exists`
- `archive.final_mp4_exists`
- `archive.package_status`
- `gdrive.upload_status`
- `gdrive.upload_progress_percent`
- `gdrive.upload_retry_count`
- `gdrive.upload_duration_sec`
- `gdrive.upload_file_count`
- `gdrive.upload_folder_fingerprint_present`
- `gdrive.upload_final_mp4_fingerprint_present`
- `gdrive.upload_metadata_fingerprint_present`

Host:

- `host.cpu_percent`
- `host.memory_percent`
- `host.disk_free_bytes`
- `host.network_tx_bps`
- `host.network_rx_bps`

## Diagnostics

Diagnostic report は日本語で作成します。

- summary
- likely cause
- confidence
- evidence
- impact
- recommended actions
- safe auto-remediation candidates
- actions requiring approval

## Remediation Dispatch

Observability が Control Panel に remediation dispatch する場合は、次の context を必須にします。

- `action_id`
- `action`
- `incident_id`
- `stream_id`

Control Panel は Observability service token と `remediation.execute` scope を検証し、Observability read API の `GET /remediation-actions/{id}/dispatch-context` で action / incident / stream context を照合します。その後、対象 stream の primary service assignment を確認してから Encoder/Recorder へ dispatch します。

Control Panel は `action_id` を一度だけ claim し、同じ `action_id` の再送を `409 remediation_action_replayed` で拒否します。

次段の hardening として、dispatch request に署名付き nonce を導入できます。

## Notification Events

通知対象 event:

- `stream.started`
- `stream.live`
- `stream.completed`
- `stream.failed`
- `stream.warning`
- `stream.error`
- `incident.opened`
- `incident.updated`
- `incident.resolved`
- `diagnostic.created`
- `remediation.pending_approval`
- `remediation.executed`
- `archive.upload.completed`
- `archive.upload.failed`
- `service.offline`
- `service.recovered`

## Operational Notes

Ingest API の証跡は、service がどの signal を送ったか、Observability がどの incident / diagnostic / notification に変換したかを追える粒度にします。本文には service token、webhook URL、SMTP password、credential path を含めず、service ID、event type、stream ID、dedupe key、masked target、delivery status だけを残します。

新しい event type を追加する場合は、送信元 repository、contract schema、Observability の ingestion rule、Control Panel UI の表示、docs の runbook を同時に確認します。外部確認では event が届いたことだけで pass にせず、同一 `stream_id` の media proof、archive proof、provider verification record と結びついた incident / recovery signal だけを completion record に含めます。

Discord、Slack、generic webhook、email channel は複数登録できます。Webhook URL、SMTP password、OAuth token は secret として扱い、response / logs / audit では raw 表示しません。

## 受信時の所有境界

Observability Ingest は signal の受付点ですが、すべての復旧責務を所有するわけではありません。Discord Bot が送る audio signal は Bot repo、Encoder/Recorder が送る archive signal は Encoder repo、Worker が送る event signal は Worker repo、notification secret storage は Observability repo、承認と dispatch は Control Panel repo が所有します。ingest payload には、この切り分けに必要な service type、stream ID、event type、safe category を含め、raw provider payload は含めません。

新しい signal を追加するときは、metric 名だけを増やさず、dedupe key、incident rule、UI 表示、diagnostic report、evidence checker の扱いを同時に決めます。特に provider response、upload error、webhook failure、SMTP failure を扱う signal は、本文や metadata に credential-bearing URL、password、token、raw Drive ID が混入しないことを test で固定します。受信後に incident へ変換する場合も、masked target と fingerprint だけを残します。

外部確認では Observability signal の存在だけで pass としません。media proof、archive proof、provider verification record、readiness check が同じ stream ID で揃い、その過程で Observability が secret-safe な incident / recovery signal を記録したことを確認します。古い signal や別 stream の signal は、diagnostics の参考にはできますが、MVP verification の completion record には使いません。
