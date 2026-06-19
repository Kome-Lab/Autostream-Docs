# Secrets

AutoStream は Discord Bot、Encoder/Recorder、Worker、Observability を分散配置できるため、secret の保管場所と配送経路を明確に分けます。標準運用では、配信・通知・外部連携に使う secret は Control Panel の encrypted secret store と Integration Registry で管理します。

## 原則

- raw secret は frontend、API response、audit log、diagnostic report、notification history、docs、screenshots に出しません。
- UI/API では `configured`、`missing`、`masked`、`fingerprint`、`*_secret_name` のような非生値だけを返します。
- service が Control Panel に接続するための bootstrap env と、配信運用 secret を混同しません。
- stream key、OAuth refresh token、Drive folder ID、webhook URL、SMTP password、Discord Bot token は Control Panel で暗号化保存します。
- service token は発行時に一度だけ表示し、Control Panel 側では hash または暗号化済み secret として扱います。

## Control Panel で管理する secret

| 種別 | 管理場所 | 返却形式 |
| --- | --- | --- |
| Discord Bot token | Discord Bot Config | `bot_token_configured`、fingerprint |
| YouTube stream key | YouTube Output | `stream_key_configured`、fingerprint |
| Google OAuth refresh token | OAuth Connected Account | `token_configured`、fingerprint |
| OAuth client secret | OAuth Provider | `client_secret_configured` |
| Google Drive folder ID | Drive Destination | `masked_folder_id`、fingerprint |
| Discord / Slack / Generic webhook URL | Notification Channel | `masked_webhook_url` |
| SMTP password | Email Notification Channel | `smtp_password_configured` |
| STT API key | Caption/STT Settings | configured status |

Discord guild ID、voice channel ID、text channel ID は secret ではありませんが、stream 操作に直結する operational config なので Control Panel の Discord config と stream override で管理します。

## Bootstrap env に残すもの

各 service が起動して Control Panel と通信するため、次の値は env または OS secret manager で渡します。

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
TZ=Asia/Tokyo
```

Control Panel では DB と暗号化鍵が bootstrap 値です。

```text
DATABASE_URL=<MARIADB_DSN>
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
```

## Runtime secret 配送

Control Panel は stream start、retry upload、service runtime config 取得時に、対象 service がその secret を読む権限を持つか確認します。

- Discord Bot token は、その `service_id` に紐づく Discord Bot service だけが取得できます。
- Drive folder ID、OAuth refresh token、YouTube stream key は、対象 stream の primary assignment service だけが取得できます。
- standby service は通常 dispatch と runtime secret 解決の対象ではありません。
- runtime secret response は `Cache-Control: no-store` で返します。
- 同じ context で短時間に再取得された場合は、raw value の再送ではなく `409 runtime_secret_lease_active` を返します。

## 禁止事項

次の値を Git、docs、issue、chat、screenshot、logs に残してはいけません。

```text
DISCORD_BOT_TOKEN=<DISCORD_BOT_TOKEN>
YOUTUBE_STREAM_KEY=<YOUTUBE_STREAM_KEY>
GOOGLE_OAUTH_REFRESH_TOKEN=<OAUTH_REFRESH_TOKEN>
GOOGLE_DRIVE_FOLDER_ID=<GOOGLE_DRIVE_FOLDER_ID>
SMTP_PASSWORD=<SMTP_PASSWORD>
WEBHOOK_URL=<WEBHOOK_URL>
```

互換 fallback が残る service でも、新規運用では Control Panel-managed config を優先します。本番では `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` などの fail-closed 設定を使い、不完全な env fallback に戻らないようにします。
