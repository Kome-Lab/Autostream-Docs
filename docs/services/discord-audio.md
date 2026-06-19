# Discord 音声連携

Discord Bot は Discord gateway / voice channel 接続を担当し、voice channel で受信した Opus packet を Encoder/Recorder へ forward します。

## できること

- Control Panel 管理の Discord Bot token で Discord gateway へ接続する。
- stream job で指定された guild / voice channel へ参加する。
- VC 音声を受信するため、self-deaf ではない状態で参加する。
- voice state update から参加者の入退室をローカル状態へ反映する。
- Discord voice speaking update から active speaker 状態を保持し、Worker へ転送する。
- Discord voice の `OpusRecv` packet を batch 化し、Encoder/Recorder の `/streams/{id}/audio/opus` へ送る。
- token が未設定の場合は dry-run mode で起動する。

## Control Panel 管理 token

Bot token は通常 env ではなく Control Panel の Discord Bot Config に保存します。Bot service は起動後に runtime config を取得し、`bot_token_secret_name` を使って service 専用 endpoint から raw token を解決します。

```http
POST /services/runtime-secrets/resolve
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "service_id": "discord-bot-01",
  "secret_name": "discord_bot_token_discord-config-01"
}
```

この値は Discord client 初期化にだけ使い、status response や logs には出しません。

## 音声 forward

Control Panel は stream start 時に、割り当て済み Encoder/Recorder の `public_url` を `encoder_audio_url` として Discord Bot へ渡します。Discord Bot はその URL を基点に次の endpoint へ送信します。

```text
POST {encoder_audio_url}/streams/{stream_id}/audio/opus
Authorization: Bearer <STREAM_INGEST_TOKEN>
```

payload は `discord-opus-ingest.schema.json` に従います。`opus_base64` には Discord から受け取った Opus packet を Base64 化して入れます。

`encoder_audio_url` は内部転送先として使いますが、`GET /status` の `current_job` には返しません。公開 URL に認証情報を含めないことが前提ですが、誤設定時にも status response から credential を漏らさないためです。

## retry / backoff

Encoder/Recorder への Opus packet forward は transient failure に対して retry します。

| 条件 | 挙動 |
| --- | --- |
| HTTP `408` | retry |
| HTTP `429` | retry |
| HTTP `5xx` | retry |
| network error | retry |
| HTTP `401` / `403` | retry しない |
| その他 HTTP `4xx` | retry しない |

retry 回数と backoff は env で調整できます。

```text
ENCODER_AUDIO_RETRY_MAX=3
ENCODER_AUDIO_RETRY_BASE_DELAY_SEC=1
ENCODER_AUDIO_TIMEOUT_SEC=5
```

失敗時の error message には token、raw response body、credential 付き URL を含めません。

Discord voice connection が Bot 自身の VC 離脱や `OpusRecv` close で切断された場合、active stream job が残っていれば同じ job で voice channel へ再参加します。Gateway disconnect は discordgo の resume に任せ、強制再参加は行いません。再参加 policy は env を bootstrap 既定値にし、Control Panel の Discord Bot Config に `reconnect_enabled`、`reconnect_max_attempts`、`reconnect_base_delay`、`reconnect_max_delay` がある場合はそちらを優先します。

```text
DISCORD_RECONNECT_ENABLED=true
DISCORD_RECONNECT_MAX_ATTEMPTS=5
DISCORD_RECONNECT_BASE_DELAY=2s
DISCORD_RECONNECT_MAX_DELAY=30s
```

## Status / metrics

`GET /status` と Control Panel heartbeat で次を確認できます。

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
discord.reconnect_count
discord.voice_disconnect_count
discord.voice_rejoin_attempts_total
discord.voice_rejoin_failures_total
```

`discord.audio_receiving=0` の場合は Discord voice connection または Discord 側権限を確認します。

`discord.audio_receiving=1` かつ `discord.audio_forward_errors_total` が増える場合は、Encoder/Recorder URL、短命 stream ingest token、network 到達性を確認します。

`discord.audio_forward_active=0` の場合は、Control Panel から渡された `encoder_audio_url`、stream ingest token、または voice connection 状態を確認します。

`discord.reconnect_count` と `discord.voice_disconnect_count` が増える場合は、Discord Gateway / Voice の切断や Bot の権限、ネットワーク、VC 側の移動・切断操作を確認します。Bot 自身が VC から外れた場合は `voice_connected=0`、`audio_forward_active=0` として heartbeat に反映されます。

## 後続実装

- 複数話者ごとの PCM mix / resampling
- STT / caption generator への音声分岐
- standby Bot への自動切替制御

## セキュリティ方針

音声送信先 URL に credential が含まれる場合があります。UI、ログ、エラー、診断用データには raw URL を出さず、必ず mask してください。

送信処理を追加する場合も shell command 文字列連結は使わず、ライブラリ API または argument array で安全に扱います。
