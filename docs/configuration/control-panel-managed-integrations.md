# Control Panel Managed Integrations

AutoStream の運用設定は、原則として service の env ではなく Control Panel の MariaDB と encrypted secret store で管理します。env に残すのは service が Control Panel へ接続し、registration、heartbeat、runtime config 取得を行うための bootstrap 値だけです。

## 管理対象

| integration | 主な保存値 | secret の扱い |
| --- | --- | --- |
| Discord Bot Config | service ID、guild ID、voice channel ID、text channel ID、caption/STT 設定 | bot token は write-only encrypted secret |
| YouTube Output | output mode、RTMPS URL、OAuth account、broadcast template | stream key / refresh token は write-only encrypted secret |
| Drive Destination | auth mode、folder ID、base path、shared drive flag | folder ID / refresh token / credential は runtime secret として扱う |
| OAuth Provider | provider type、client ID、redirect URI、scope、allowlist domain | client secret は encrypted secret |
| OAuth Connected Account | provider、subject、email、scope | refresh token は OAuth callback だけで保存 |
| Notification Channel | Discord/Slack webhook、Email SMTP、filter | webhook URL / SMTP password は encrypted secret |

## Discord Bot Config

Discord Bot は複数台登録できます。config は `service_id` に紐づき、Bot service は自分の `service_id` に一致する config だけを runtime config として取得できます。

```json
{
  "name": "Main Discord Bot",
  "service_id": "discord-bot-01",
  "guild_id": "<DISCORD_GUILD_ID>",
  "voice_channel_id": "<VOICE_CHANNEL_ID>",
  "text_channel_id": "<TEXT_CHANNEL_ID>",
  "bot_token": "<DISCORD_BOT_TOKEN>",
  "audio_forward_enabled": true,
  "reconnect_enabled": true,
  "caption_enabled": false
}
```

`bot_token` は write-only です。response には raw token を返さず、configured / fingerprint だけを返します。stream ごとに Discord Bot service と Discord Bot Config を選び、start 時は primary Discord Bot だけへ dispatch します。

## OAuth Provider

OAuth provider は用途ごとに redirect URI を分けます。

| 用途 | redirect URI |
| --- | --- |
| Control Panel login | `https://control.example.com/auth/oauth/callback` |
| Drive / YouTube connected account | `https://control.example.com/integrations/oauth-accounts/callback` |

Google / GitHub / Discord は login provider として使えます。Drive / YouTube の connected account は Google provider を使います。

Client secret は provider 作成・更新時の write-only 入力です。更新時に空欄にすると既存 secret を維持します。

## OAuth Connected Account

Connected account は Google Drive upload や YouTube Live API 制御に使う運用アカウントです。作成は OAuth callback ceremony に限定します。

1. Control Panel UI で provider と operator label を選ぶ。
2. `POST /integrations/oauth-accounts/start` で一回限りの authorization URL を作る。
3. Google 側で consent を完了する。
4. `/integrations/oauth-accounts/callback` が state、provider、scope、email allowlist を検証する。
5. refresh token を encrypted secret として保存する。

通常 API から `POST /integrations/oauth-accounts` で refresh token を直接投入することはできません。Control Panel は `403 manual_oauth_account_create_disabled` を返します。既存 account の refresh token 更新も禁止され、`403 manual_oauth_account_refresh_token_disabled` を返します。変更できるのは operator-facing label だけです。

OAuth provider は connected account または OAuth login user link から参照されている間は削除できません。OAuth connected account も Drive destination、YouTube output、または保存済み YouTube runtime metadata から参照されている間は削除できません。削除する場合は、先に参照元を別 account へ付け替えるか削除します。

## Google Drive Destination

Drive destination は archive profile から参照します。共有ドライブの folder ID を使う場合は `shared_drive=true` を設定します。Encoder/Recorder は stream job の `archive_config` に含まれる `folder_id_secret_name`、`client_secret_secret_name`、`refresh_token_secret_name` を Control Panel へ解決してから upload します。

Drive API 呼び出しでは共有ドライブ対応として `supportsAllDrives=true` を使います。

Service Account mode も互換として残します。この場合は対象 Drive folder を Service Account email に共有する必要があります。

## YouTube Output

YouTube output は複数登録できます。

| mode | 説明 |
| --- | --- |
| `stream_key` | 既存 stream key を write-only secret として保存し、start 時に短命 runtime secret として Encoder/Recorder へ渡します。 |
| `live_api` | Google OAuth connected account を使い、broadcast / live stream の作成、bind、開始、complete を行います。 |
| `live_api_dry_run` | 外部 YouTube API を呼ばず、Control Panel と dispatch 経路だけを検証します。 |

`live_api` では start 時に Control Panel が YouTube broadcast / live stream を準備し、Encoder/Recorder へ RTMPS URL と stream key を渡します。stop 時は Encoder/Recorder 停止、YouTube broadcast complete、archive package/upload を lifecycle として扱います。

## Notification Channel

通知先は複数登録できます。

- Discord Webhook
- Slack Webhook
- Generic Webhook
- Email SMTP

Webhook URL と SMTP password は write-only secret です。response、audit metadata、delivery history には raw 値を残さず、masked target、configured、fingerprint だけを表示します。

Email SMTP は本番では TLS を使います。private SMTP relay を許可する設定はローカル relay 用の escape hatch であり、本番環境では無効です。`OBSERVABILITY_ENV=production` などが設定されている場合、`OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` は無視されます。

## Bootstrap Env に残すもの

通常運用では次の値を env に置きません。

- `DISCORD_BOT_TOKEN`
- `YOUTUBE_STREAM_KEY`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`
- webhook URL
- SMTP password

Control Panel 側の bootstrap として残す値:

- `DATABASE_URL`
- `AUTOSTREAM_SESSION_SECRET`
- `AUTOSTREAM_SECRET_ENCRYPTION_KEY`
- `AUTOSTREAM_PUBLIC_URL`
- service から Control Panel へ接続するための token

Service 側に残す値:

- `SERVICE_ID`
- `SERVICE_NAME`
- `SERVICE_PUBLIC_URL`
- `CONTROL_PANEL_URL`
- `CONTROL_PANEL_TOKEN`
- `TZ`

これらは service が Control Panel に到達し、自分用 runtime config と必要な短命 runtime secret を取得するための最小値です。
