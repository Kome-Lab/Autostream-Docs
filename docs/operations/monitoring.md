# Monitoring

AutoStream の monitoring は、配信状態、service heartbeat、Encoder/Recorder metrics、Discord 音声入力、Worker event path、archive/upload 状態、host resource、Observability incident を継続的に確認する運用です。

## 監視対象

| 項目 | 主な metrics / signals |
| --- | --- |
| Stream | `stream.status`, `stream.start_duration_ms`, `stream.live_duration_sec`, `stream.stop_duration_ms` |
| Encoder | `encoder.process_alive`, `encoder.output_fps`, `encoder.output_bitrate_kbps`, `encoder.dropped_frames_total` |
| Audio | `discord.audio_receiving`, `discord.audio_forward_enabled`, `discord.audio_forward_active`, `discord.audio_packets_total`, `encoder.audio_level_db`, `encoder.audio_silence_sec`, `encoder.audio_clipping_total`, `media.input_timeout_sec` |
| Recorder | `recorder.file_size_bytes`, `recorder.write_bitrate_kbps`, `recorder.disk_free_bytes`, `recorder.remux_duration_ms` |
| Discord Bot | `discord.gateway_connected`, `discord.voice_connected`, `discord.participant_count`, `discord.worker_event_publish_failures_total`, `discord.reconnect_count`, `discord.voice_disconnect_count` |
| Worker | `worker.overlay_events_total`, `worker.caption_events_total`, `worker.scene_updates_total`, `worker.event_send_failures_total` |
| Archive | `archive.final_mkv_exists`, `archive.final_mp4_exists`, `archive.package_status`, `gdrive.upload_status`, `gdrive.upload_retry_count`, `gdrive.upload_duration_sec`, `gdrive.upload_file_count`, `gdrive.upload_folder_fingerprint_present`, `gdrive.upload_final_mp4_fingerprint_present`, `gdrive.upload_metadata_fingerprint_present` |
| Host | `host.cpu_percent`, `host.memory_percent`, `host.disk_free_bytes`, network throughput |

## Control Panel で見る場所

- `Dashboard`: active stream、service status、audio/input health、worker event metrics、recent incidents、recent logs。
- `Streams`: stream start/stop/retry、service assignment readiness、Check Readiness、Discord audio bridge、Worker event path、Worker event sidecar、Last service dispatch。
- `Service Health`: service registry、heartbeat、current stream、heartbeat metrics。
- `Monitoring Dashboard`: incidents、remediation、notification delivery、主要 metrics。
- `Metrics`: Encoder/Recorder、Audio/Input、Worker Event、Archive/Google Drive metrics。
- `Incidents`: open / acknowledged / investigating の incident と rule ごとの evidence。
- `Diagnostics`: 日本語 diagnostic report、推奨確認項目、関連 metrics。

## 基本ルール

1. heartbeat が止まった service は offline または stale として扱います。
2. live 中に Encoder/Recorder が止まった場合は critical incident とします。
3. recorder file size や write bitrate が止まった場合は archive risk として扱います。
4. `discord.audio_forward_active=0`、`discord.audio_receiving=0`、または `media.input_timeout_sec>=5` は音声/入力途絶の候補です。
5. `worker.event_send_failures_total>0` は Worker から Encoder/Recorder への overlay/caption event 送信失敗です。
6. `encoder.audio_silence_sec>=5` は無音、`encoder.audio_clipping_total>=10` は音割れ候補です。
7. `recorder.remux_duration_ms` が異常に長い場合は remux 負荷、disk I/O、source file 破損を疑います。
8. Google Drive upload 失敗は配信完了後でも incident として扱います。
9. recovery signal が確認できた場合、incident を `mitigated` または `resolved` に更新します。

## Alert threshold と一次対応

alert は「配信継続」「archive 保全」「secret 境界」の 3 種類に分けて扱います。live stream への影響があるものは critical、完了後 upload や notification の遅延は high/medium、operator の確認待ちは warning にします。threshold を変更した場合は、Observability rule、Control Panel 表示、runbook の期待値を同じ PR で更新します。

| 条件 | severity | 一次対応 |
| --- | --- | --- |
| `encoder.process_alive=0` during `live` | critical | stream status、FFmpeg log、output relay、recorder file size を確認し、stop/failover 判断へ進む |
| `discord.audio_receiving=0` が 30 秒以上 | high | Discord Bot VC、guild/channel permission、reconnect count、audio packet delta を確認する |
| `worker.event_send_failures_total>0` が継続 | high | Worker assignment、Encoder/Recorder URL、stream ingest token、sidecar 保存を確認する |
| `archive.final_mkv_exists=0` after stop | critical | recover-failed-stream runbook に進み、削除や再 package を急がない |
| `gdrive.upload_status=0` with packaged archive | high | Drive destination、OAuth account、shared-drive folder permission を確認し retry upload を使う |
| notification delivery retry exhaustion | medium | channel encryption state、masked target、rate limit、provider response code を確認する |

false positive と判断した場合も incident を削除せず、ignored/resolved の理由と evidence 欠落箇所を残します。metric が欠けて rule が誤発火した場合は、送信元 service の heartbeat schema と Observability ingest schema の同期を優先して直します。

## Worker Event Path の確認

`discord.worker_event_publish_failures_total>0` は Discord Bot から Worker への participant / active-speaker event 送信失敗です。Worker URL、token、Worker service assignment、Control Panel runtime config を確認します。

Streams 画面では次の 2 つを分けて確認します。

- `Worker event path`: Worker heartbeat metrics、event 生成数と送信失敗数を確認します。
- `Worker event sidecar`: Encoder/Recorder が実際に保存した event、caption や overlay が archive sidecar に残っているかを確認します。

`worker.scene_updates_total` が増えているのに `Worker event sidecar` が空の場合は、Worker から Encoder/Recorder への publish が失敗しています。`ENCODER_RECORDER_URL`、`ENCODER_RECORDER_TOKEN`、Encoder/Recorder の `SERVICE_CONTROL_TOKEN_SHA256`、stream assignment を確認します。

## Archive / Upload の切り分け

Encoder/Recorder は package 失敗時に `failure_phase` と `error_class` を Observability evidence と retry-upload dispatch result に残します。raw error、credential、token、URL、local full path は evidence や API response に入れません。

| phase | 代表的な原因 | 主な incident |
| --- | --- | --- |
| `input` | `final.mkv` 欠落、archive path 不正 | `archive_package_failed` |
| `remux` | FFmpeg remux 失敗、`final.mp4` 未作成 | `archive_package_failed` |
| `package` | sidecar copy、logs、metadata 作成失敗 | `archive_package_failed` |
| `upload` | Google Drive upload / metadata upload 失敗 | `gdrive_upload_failed` |
| `unknown` | 予期しない処理失敗 | `archive_package_failed` |

`archive.package_status=1` かつ `gdrive.upload_status=0` の場合、remux と local package は完了しており、Google Drive upload 側の問題として調査します。

## ログの扱い

ログは structured JSONL を優先します。出力時には次を必ず mask します。

- service token
- stream key
- webhook URL
- Google credentials
- database password
- 認証情報付き input URL

`request_id`、`stream_id`、service ID、incident ID は調査に必要なため残します。

## Incident から Metrics へ辿る

Control Panel の Incidents 画面では、rule ごとに関連 metrics と確認項目を表示します。

| Rule | まず見る metrics |
| --- | --- |
| `archive_remux_slow` | `recorder.remux_duration_ms`, `archive.final_mkv_exists`, `archive.final_mp4_exists`, `recorder.disk_free_bytes` |
| `archive_package_failed` | `archive.package_status`, `archive.final_mkv_exists`, `archive.final_mp4_exists`, `failure_phase`, `error_class` |
| `gdrive_upload_failed` | `gdrive.upload_status`, `gdrive.upload_retry_count`, `gdrive.upload_duration_sec`, `gdrive.upload_file_count`, `gdrive.upload_folder_fingerprint_present`, `gdrive.upload_final_mp4_fingerprint_present`, `gdrive.upload_metadata_fingerprint_present`, `failure_phase`, `error_class` |
| `discord_audio_not_receiving` | `discord.audio_receiving`, `discord.audio_packets_total`, `media.input_timeout_sec` |
| `discord_audio_forward_inactive` | `discord.audio_forward_enabled`, `discord.audio_forward_active`, Encoder/Recorder public URL |
| `discord_audio_forward_failed` | `discord.audio_forward_errors_total`, `discord.audio_forwarded_total`, `discord.audio_last_forward_age_sec` |
| `discord_audio_forward_recovered` | `discord.audio_forward_errors_total`, `discord.audio_forwarded_total`, `discord.audio_last_forward_age_sec` |
| `discord_audio_forward_stale` | `discord.audio_last_forward_age_sec`, `discord.audio_forwarded_total`, Encoder/Recorder audio status |
| `discord_reconnect_loop` | `discord.reconnect_count`, Discord Bot gateway log, service heartbeat |
| `discord_voice_disconnected` | `discord.voice_disconnect_count`, `discord.voice_connected`, Encoder/Recorder audio status |
| `worker_event_send_failed` | `worker.event_send_failures_total`, `discord.worker_event_publish_failures_total`, `worker.scene_updates_total`, Worker event sidecar |

異常が出た場合は [Troubleshooting](../troubleshooting/) と [失敗した配信の復旧](../runbooks/recover-failed-stream.md) に進みます。

## Dashboard review

本番運用では、配信開始前、live 中、停止後の 3 回で dashboard を確認します。開始前は stale heartbeat と readiness blocker、live 中は packet delta / bitrate / reconnect、停止後は remux / upload / notification delivery を見ます。Control Panel と Observability の表示が食い違う場合は、Control Panel の cached status ではなく Observability の latest signal timestamp と service heartbeat を優先して原因を切り分けます。

## Alert の判断境界

monitoring alert は、即時に remediation を実行する命令ではありません。alert が開いたら、まず同じ stream ID の service heartbeat、runtime config version、assignment role、provider verification record freshness を確認します。live stream 中の alert では、packet delta と reconnect count を見て media 影響を判断し、archive / upload の alert は stop 後の artifact 状態を確認してから retry します。

Alert の owner は metric の発生元で分けます。Discord の VC / audio packet は Discord Bot、RTP/SDP bridge と FFmpeg は Encoder/Recorder、Worker event は Worker、notification delivery と incident dedupe は Observability、assignment と runtime config は Control Panel が所有します。dashboard に複数の alert が同時に出た場合でも、最初に赤くなった owner と下流影響を分けて記録します。

復旧後は alert が消えたことだけで完了にしません。recovery signal、service heartbeat、artifact fingerprint、delivery history、readiness check を同じ stream ID で確認します。alert が自動 resolve しても、external provider verification record が古い場合や別 stream の proof を見ている場合は、verification verification record には使いません。
