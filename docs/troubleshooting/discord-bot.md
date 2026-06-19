# Discord Bot のトラブルシュート

Discord Bot は Discord gateway / voice channel に接続し、参加者、話者状態、音声 packet、heartbeat を Control Panel と Encoder/Recorder に連携します。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| service | Control Panel の Service Health で `discord_bot` が online |
| config | Discord Bot Config が対象 `service_id` に紐づいている |
| token | Bot token は Control Panel の runtime secret として configured |
| guild | Bot が対象 guild に招待されている |
| permissions | voice channel への Connect / Speak 権限がある |
| assignment | 対象 stream に Discord Bot が primary assigned |
| control URL | `CONTROL_PANEL_URL` に到達できる |
| service token | `CONTROL_PANEL_TOKEN` の scope と service type が正しい |
| health | `/health` と `/status` が応答する |

Bot token は raw log に出さないでください。漏えいした場合は Discord 側で token を再発行し、Control Panel の Discord Bot Config を更新します。

## Bot が online にならない

1. `CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN`、`SERVICE_ID` を確認します。
2. service token が `discord_bot` type と対象 `SERVICE_ID` に紐づいているか確認します。
3. `/services/runtime-config?service_id=<SERVICE_ID>` が 403 の場合、Control Panel の service registry と token scope を確認します。
4. Discord Bot Config が存在しない場合は dry-run で起動します。実 Discord 接続には Bot token と guild / voice channel が必要です。
5. firewall が Discord gateway への outbound を遮断していないか確認します。

production では dry-run fallback を成功扱いにしません。`AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` の service は、Control Panel の Discord Bot Config、runtime secret reference、primary assignment が揃うまで起動または start job を fail closed にします。Bot token を env に戻すのではなく、Control Panel の integration record を修正して新しい runtime config version を配ります。

## voice channel に参加できない

1. guild ID と voice channel ID が Control Panel の Discord Bot Config または stream 設定と一致しているか確認します。
2. Bot role に Connect / Speak 権限があるか確認します。
3. voice channel が満員、権限制限付き、または Bot から見えない状態でないか確認します。
4. Bot が対象 stream job に assigned されているか確認します。

## participant / speaker event が届かない

1. Bot が対象 stream に assigned されているか確認します。
2. Control Panel への event API が 401 / 403 を返していないか確認します。
3. Worker へ送る場合は Worker assignment と stream ID が一致しているか確認します。
4. Observability に `discord.gateway_connected`、`discord.voice_connected`、`discord.participant_count` が届いているか確認します。
5. `discord.worker_event_publish_failures_total` が増えている場合は Worker URL、token、Worker service assignment、Control Panel runtime config を確認します。

assignment 外の stream event は拒否される設計です。stream ID の取り違えに注意してください。

## 音声が Encoder/Recorder に届かない

1. Discord voice connection が維持されているか確認します。
2. Bot 側で `discord.audio_receiving=1` になっているか確認します。
3. `discord.audio_packets_total` が増えているか確認します。
4. `discord.audio_forward_enabled=1` と `discord.audio_forward_active=1` を確認します。
5. `discord.audio_forwarded_total` が増えているか確認します。
6. `discord.audio_forward_errors_total` が増えていないか確認します。
7. Encoder/Recorder の `POST /streams/{stream_id}/audio/opus` に到達できるか確認します。
8. Control Panel が発行した短命 ingest token が使われているか確認します。
9. Encoder/Recorder の `GET /streams/{stream_id}/audio-status` で `packets_total` を確認します。
10. Control Panel の Audio / Input Health で `media.input_timeout_sec`、`encoder.audio_silence_sec` を確認します。

`discord.audio_receiving=0` は Bot または Discord 側の問題が濃厚です。`discord.audio_receiving=1` で `discord.audio_forward_errors_total` が増える場合は Encoder/Recorder URL、token、network 到達性を確認します。

## reconnect loop / voice disconnect

`discord.reconnect_count`、`discord.voice_disconnect_count`、`discord.voice_rejoin_attempts_total` が増え続ける場合は、Discord gateway と voice connection を分けて見ます。gateway disconnect は Bot 全体の接続問題、voice disconnect は対象 VC または audio forward の問題です。Control Panel の remediation は reconnect を提案できますが、stream stop、token rotation、channel change は operator 承認後に実行します。

同じ stream で reconnect を繰り返す場合は、guild/channel permission、Bot role、network egress、runtime config の reconnect policy、Encoder/Recorder の audio ingest status を順に確認します。復旧後は packet delta が増えたことと `discord.audio_last_forward_age_sec` が freshness threshold 内に戻ったことを evidence に残します。

## 復旧後の確認

Discord Bot 復旧後は VC connected だけでなく、audio packet delta、forwarded counter、last packet age、last forward age、Encoder audio-status、Control Panel assignment を同じ stream ID で確認します。guild/channel の raw ID や participant 名は evidence に残さず、masked value と counter で共有します。

## Operator Notes

Discord Bot の復旧判定は、gateway online だけでは不十分です。Control Panel assignment、voice join、last packet age、forwarded packet counter、Encoder/Recorder audio receipt、incident recovery signal が同じ stream に紐づくことを確認します。gateway reconnect と voice reconnect は別の failure class として扱い、片方の成功をもう片方の復旧証跡に流用しません。

実 Discord guild/channel ID、bot token、voice session token は docs や screenshot に残しません。operator は Control Panel UI/API で masked config と runtime config version を確認し、外部 verification record には packet delta、forward count、last packet freshness、forward error count、service ID、stream ID だけを記録します。

- Control Panel の Service Health で Discord Bot が online
- `discord.gateway_connected` と `discord.voice_connected` が正常
- `discord.audio_receiving=1`
- `discord.audio_forward_active=1`
- `discord.audio_packets_total` が増えている
- `discord.audio_forwarded_total` が増えている
- `discord.audio_forward_errors_total` が増えていない
- `discord.worker_event_publish_failures_total=0`
- participant / speaker event が対象 stream に届く
- Audit Logs に再割当や restart 操作が残っている
- external verification record に Discord VC 接続、audio packet delta、forward freshness が同じ stream ID で残っている
