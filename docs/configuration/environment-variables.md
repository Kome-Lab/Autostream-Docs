# Environment Variables

AutoStream は分散 service 構成ですが、運用に関わる secret と destination はできるだけ Control Panel で管理します。env は service が起動し、Control Panel と安全に通信するための bootstrap 値に限定します。

## env に残すもの

| 種別 | 例 | 用途 |
| --- | --- | --- |
| Control Panel 接続 | `CONTROL_PANEL_URL` | service が Control Panel へ登録、heartbeat、runtime config 取得、必要に応じて runtime secret 解決を行う |
| service identity | `SERVICE_ID`, `SERVICE_NAME`, `CONTROL_PANEL_TOKEN` | service 自身の識別と認証 |
| bind / public URL | `AUTOSTREAM_BIND_ADDR`, `SERVICE_PUBLIC_URL` | HTTP endpoint と Control Panel からの dispatch 先 |
| data path | `AUTOSTREAM_DATA_DIR` | local state、archive、logs |
| DB / encryption | `DATABASE_URL`, `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Control Panel の永続化と secret 暗号化 |
| timezone | `TZ=Asia/Tokyo` | timestamp と metadata |

## Control Panel で管理するもの

| 項目 | 管理場所 | API/UI の返し方 |
| --- | --- | --- |
| Discord Bot token | Discord Bot config / secret | configured / fingerprint のみ |
| Discord guild / voice channel | Discord config / stream settings | ID として表示可能。secret ではない |
| YouTube stream key | YouTube output / secret | configured / masked / fingerprint のみ |
| YouTube OAuth refresh token | OAuth connected account | configured / fingerprint のみ |
| Google Drive folder ID | Drive destination / secret | masked folder ID / fingerprint のみ |
| Google OAuth refresh token | OAuth connected account | configured / fingerprint のみ |
| webhook URL | notification channel / secret | masked URL のみ |
| SMTP password | email notification channel / secret | configured のみ |
| STT API key | caption/STT settings / secret | configured のみ |

raw secret は API response、frontend、audit metadata、docs、logs に出しません。

## Service 共通 env

```text
SERVICE_ID=encoder-tokyo-01
SERVICE_NAME=Encoder Tokyo 01
SERVICE_PUBLIC_URL=https://encoder-tokyo-01.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
AUTOSTREAM_DATA_DIR=/var/lib/autostream/encoder-recorder
TZ=Asia/Tokyo
```

`CONTROL_PANEL_TOKEN` は Control Panel で service token を作成した直後に一度だけ表示されます。password manager または secret manager に保存し、docs や `.env.example` には実値を書かないでください。runtime config 取得には `service.config.read`、raw runtime secret 解決には `service.secret.resolve` が必要です。

service token は service type と service ID に束縛します。Discord Bot、Worker、Encoder/Recorder、Observability で同じ raw token を共有しません。Control Panel から service endpoint を呼ぶ outbound dispatch token は別系統で、service env には raw 値ではなく対応する hash だけを置きます。

## Control Panel env

```text
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
DATABASE_URL=<MARIADB_DSN>
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
TZ=Asia/Tokyo
```

`AUTOSTREAM_SECRET_ENCRYPTION_KEY` は OAuth refresh token、stream key、webhook URL、SMTP password、Drive folder ID などの暗号化に使います。rotation 手順を決めるまで変更しないでください。

DB URL, public URL, Control Panel service token, Discord Bot token, guild/channel ID, and provider verification record values are owned by the operator, provider, or Control Panel. Do not store real values in docs or examples.

## env に戻してはいけないもの

次の値は Control Panel の encrypted secret として扱います。

- `DISCORD_BOT_TOKEN`
- `YOUTUBE_STREAM_KEY`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`
- `DEEPGRAM_API_KEY`
- webhook URL
- SMTP password
- credential 付き stream URL

互換性のため既存 service に env fallback が残る場合でも、新規運用では Control Panel-managed config を優先します。stream job に runtime config が含まれる場合、不足している secret を env から暗黙補完しない方針です。

env fallback を一時的に使う場合は、対象 service、理由、削除条件、期限を maintenance note に残します。fallback が残ったまま external verification を pass にしないでください。completion record では Control Panel config confirmation と provider verification record が source of truth であり、`.env` の値が埋まっているだけでは本番運用完了の証跡になりません。
