# Stream Jobs

Stream job は Control Panel が管理する配信単位です。各 stream には Discord Bot config、encoder profile、caption profile、overlay profile、archive profile、YouTube output、service assignment を紐付けます。

## Create

```http
POST /streams
Content-Type: application/json
```

```json
{
  "name": "Weekly Live",
  "discord_config_id": "discord-config-01",
  "discord_guild_id": "<DISCORD_GUILD_ID>",
  "discord_voice_channel_id": "<VOICE_CHANNEL_ID>",
  "discord_text_channel_id": "<TEXT_CHANNEL_ID>",
  "encoder_profile_id": "encoder-profile-01",
  "caption_profile_id": "caption-profile-01",
  "overlay_profile_id": "overlay-profile-01",
  "archive_profile_id": "archive-profile-01",
  "youtube_output_id": "youtube-output-01"
}
```

`discord_guild_id`、`discord_voice_channel_id`、`discord_text_channel_id` は stream 別 override です。override は `discord_config_id` と組み合わせて保存します。

## Assignment

```http
POST /services/{id}/assign
Content-Type: application/json
X-CSRF-Token: <CSRF_TOKEN>
```

```json
{
  "stream_id": "stream-01",
  "assignment_role": "primary"
}
```

同じ stream と service type では `primary` は1台だけです。`standby` は複数登録できますが、MVPでは start / stop / retry-upload のdispatch対象にしません。runtime secret resolve も primary service だけに許可します。

## Readiness

```http
POST /streams/{id}/start-readiness
Content-Type: application/json
```

Control Panel は readiness で副作用のある外部APIを呼びません。YouTube output readiness は raw stream key を読みません。Archive readiness も raw Drive folder ID、OAuth refresh token、OAuth client secret を読みません。configured status、fingerprint、runtime secret reference、OAuth account の public status だけで判定します。

主な確認項目:

- primary Discord Bot、Worker、Encoder/Recorder が割当済みである。
- 割当済み service の heartbeat が stale ではない。
- service `public_url` が dispatch policy に合う HTTP(S) URL である。
- Discord Config の `service_id` が primary Discord Bot と一致する。
- stream 別 Discord override または Discord Config から guild ID と voice channel ID を解決できる。
- YouTube output を副作用なしで検証できる。
- Archive profile / Drive destination を副作用なしで検証できる。
- Discord audio bridge mode では Discord Bot が audio capture / forward capability を持つ。

主な issue code:

| code | 意味 |
| --- | --- |
| `missing_stream_assignments` | 必須 service type の primary assignment が不足 |
| `service_heartbeat_stale` | 割当済み service の heartbeat が古い |
| `service_public_url_invalid` | service `public_url` が dispatch policy に合わない |
| `discord_config_required` | Discord Config が未選択 |
| `discord_config_service_mismatch` | Discord Config の service と primary Discord Bot が一致しない |
| `youtube_output_not_found` | 選択された YouTube output が存在しない |
| `youtube_output_invalid_config` | YouTube output の mode / RTMPS URL / secret name が不正 |
| `youtube_stream_key_unavailable` | stream key secret が未設定 |
| `youtube_live_api_unavailable` | Control Panel で YouTube Live API client を利用できない |
| `youtube_oauth_account_unavailable` | YouTube 用 OAuth connected account が利用できない |
| `archive_profile_not_found` | 選択された Archive profile が存在しない |
| `archive_profile_invalid_config` | Archive profile または Drive destination 設定が不正 |
| `drive_destination_not_found` | 選択された Drive destination が存在しない |
| `drive_destination_unavailable` | Drive destination の folder ID が未設定 |
| `drive_oauth_account_unavailable` | Drive 用 OAuth connected account が利用できない |

## External verification Config

```http
GET /streams/{id}/external-e2e-config
```

This endpoint exports the non-secret Control Panel confirmation file for the external verification scripts. Use it through:

```bash
GET /streams/{id}/external-e2e-config
```

この API は authenticated Control Panel session と `streams.read` を要求し、`Cache-Control: no-store` を返します。response に含めるのは `youtube_output_id`、`drive_destination_id`、`discord_config_id`、`encoder_profile_id`、`archive_profile_id`、割り当て済み primary / standby service ID、`runtime_config_distribution_enabled`、`readiness` など、Control Panel 管理の内部 ID、boolean、secret-safe missing list だけです。Discord guild/channel ID、Drive folder ID、OAuth refresh token、client secret、RTMPS URL、stream key、service token、session cookie などの raw provider value はこの file の外に残します。

## Start

```http
POST /streams/{id}/start
Content-Type: application/json
```

```json
{
  "discord_config_id": "discord-config-01",
  "discord_guild_id": "<DISCORD_GUILD_ID>",
  "discord_voice_channel_id": "<VOICE_CHANNEL_ID>",
  "discord_text_channel_id": "<TEXT_CHANNEL_ID>",
  "youtube_output_id": "youtube-output-01",
  "encoder_profile_id": "encoder-profile-01",
  "caption_profile_id": "caption-profile-01",
  "overlay_profile_id": "overlay-profile-01",
  "archive_profile_id": "archive-profile-01"
}
```

YouTube output を指定すると、Control Panel は stream_key mode または YouTube Live API mode の runtime情報を primary Encoder/Recorder へ dispatch します。raw stream key は UI/API/audit/log に返しません。

本番の Encoder/Recorder は `AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true` と `AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}` を使い、FFmpeg argv には loopback relay URL だけを渡します。YouTube RTMPS URL と stream key は relay または runtime secret boundary の内側に閉じます。

`live_api` mode では、Control Panel が Google OAuth connected account を使って YouTube broadcast / live stream を作成し、RTMPS ingest 情報を短命 runtime secret として扱います。作成した `broadcast_id`、`live_stream_id`、`rtmp_url`、`complete_on_stop` は `stream_youtube_runtimes` に保存します。stream key は raw 値ではなく `stream_key_secret_name` として保存し、runtime config 再取得時も raw key は返しません。

start dispatch が失敗した場合、Control Panel は作成済み YouTube runtime の complete を試みます。complete も失敗した場合は runtime を保持し、手動 retry できるようにします。

## Stop

```http
POST /streams/{id}/stop
```

Control Panel は primary Discord Bot、Worker、Encoder/Recorder へ stop を dispatch します。dispatch 成功後、YouTube output が `live_api` mode かつ runtime の `complete_on_stop=true` の場合、YouTube broadcast を complete します。

YouTube complete が失敗した場合、stream は `failed` になり、runtime は削除されません。Control Panel は `complete_retry_count`、`complete_next_retry_at`、`complete_last_error` を保存し、background retry loop で due runtime を自動再試行します。原因を修正した後、次の API で complete だけを手動再実行できます。

```http
POST /streams/{id}/youtube/complete
```

この API は manual retry のため、`complete_on_stop=false` の runtime でも YouTube complete を強制実行します。成功すると runtime と短命 stream key secret を削除し、audit log に `youtube.complete` を記録します。background retry も同じ成功/失敗 audit を `trigger=auto_retry` で記録します。raw OAuth token や stream key は返しません。

## Retry Upload

```http
POST /streams/{id}/retry-upload
```

Control Panel は primary Encoder/Recorder へ archive retry を dispatchします。Encoder/Recorder は archive profile と Drive destination を解決し、必要な runtime secret reference だけを Control Panel に問い合わせます。

## Security Notes

- stream settings は raw secret を持ちません。
- Discord guild / channel ID は secret ではありませんが、必要最小限の場所にだけ表示します。
- Discord Bot token、YouTube stream key、Drive folder ID、OAuth refresh token、Service Account credential JSON は encrypted secret / Integration Registry に保存します。
- start dispatch と runtime secret resolve は assigned service と stream/profile context を検証します。
- standby service は通常 dispatch されません。
- standby service は Drive folder ID、OAuth refresh token、YouTube stream key などの stream-scoped secret を解決できません。
- service assignment、stream start/stop/retry、secret更新は audit log に残します。
