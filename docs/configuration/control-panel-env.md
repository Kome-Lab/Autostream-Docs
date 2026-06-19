# Control Panel 環境変数

Control Panel は AutoStream の中央制御面です。認証、RBAC、監査ログ、stream lifecycle、service registry、service assignment、Integration Registry、OAuth login、MFA、Observability 表示連携を担当します。重い media 処理は行いません。

## 最小 bootstrap env

```text
AUTOSTREAM_ENV=production
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_control_panel?parseTime=true
SERVICE_CALL_TOKEN=<CONTROL_PANEL_TO_SERVICE_TOKEN>
SERVICE_CALL_TIMEOUT_SEC=5
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
AUTOSTREAM_STREAM_INGEST_TOKEN_TTL_MIN=720
AUTOSTREAM_WEBAUTHN_RP_ID=control.example.com
AUTOSTREAM_WEBAUTHN_RP_NAME=AutoStream Control Panel
AUTOSTREAM_WEBAUTHN_RP_ORIGINS=https://control.example.com
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
TZ=Asia/Tokyo
```

## Env に残すもの

env は Control Panel 自身の起動と、外部 service へ接続するための最小 bootstrap に限定します。

| 変数 | 用途 |
| --- | --- |
| `AUTOSTREAM_ENV` | production guard の判定。`production` では MFA disabled を拒否します。 |
| `DATABASE_URL` | MariaDB 接続先。SQLite fallback はありません。 |
| `AUTOSTREAM_SESSION_SECRET` | session cookie 署名。 |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | DB に保存する secret の暗号化。 |
| `SERVICE_CALL_TOKEN` | Control Panel から service へ dispatch する outbound token。 |
| `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | stream ごとの短命 ingest token を発行する HMAC 鍵。 |
| `AUTOSTREAM_WEBAUTHN_*` | Passkey / WebAuthn の relying party 固定値。 |
| `OBSERVABILITY_URL` / `OBSERVABILITY_TOKEN` | Observability 表示連携。 |

`SERVICE_CALL_TOKEN` は service registry token とは別物です。登録・heartbeat 用 token と、Control Panel から service へ呼び出す token を混同しないでください。

## Control Panel で管理するもの

次の運用設定は env に置かず、Control Panel の UI/API と Integration Registry で管理します。

| 種別 | Control Panel 管理値 |
| --- | --- |
| Discord Bot | bot token、guild ID、voice channel ID、text channel ID、service 割当。 |
| YouTube | stream key、既存 RTMPS 出力、YouTube Live API OAuth connected account、自動作成 broadcast/stream 設定。 |
| Google Drive | OAuth connected account、Service Account destination、folder ID、base path、共有ドライブ対応フラグ。 |
| 通知 | Discord webhook、Slack webhook、generic webhook、SMTP host/port/TLS/from/user/password、宛先、filter。 |
| OAuth login | Google / GitHub / Discord provider の client ID、client secret、allowed domain、auto-provision 方針。 |
| MFA policy | `mfa_mode`、対象 role、TOTP / Passkey 登録状態。 |

raw secret、OAuth refresh token、stream key、webhook URL、SMTP password は暗号化して保存します。UI/API は `configured`、`masked`、`fingerprint` だけを返し、raw 値は返しません。

## Database

`DATABASE_URL` は MariaDB を指定します。Control Panel は起動時に埋め込み migration SQL を適用します。production では database password を docs、logs、audit metadata、frontend に出さないでください。

## Session と secret 暗号化

`AUTOSTREAM_SESSION_SECRET` は session 保護に使う secret です。十分に長いランダム値を使い、rotation 時は既存 session が無効化される前提で計画してください。

`AUTOSTREAM_SECRET_ENCRYPTION_KEY` は stored secrets、TOTP secret、OAuth provider client secret、OAuth refresh token、Drive folder ID、SMTP password などの暗号化に使います。この値を失うと保存済み secret を復号できません。backup / restore 手順では DB backup と同じ重要度で扱います。

## Service dispatch

`SERVICE_CALL_TOKEN` は Control Panel から Discord Bot、Encoder/Recorder、Worker へ start / stop / package / preflight を dispatch するための outbound token です。受信側 service には raw token ではなく、同じ token の SHA-256 を `SERVICE_CONTROL_TOKEN_SHA256` として設定します。

service が Control Panel に登録・heartbeat する token は、Control Panel の API Tokens / Service Tokens で発行します。token は一度だけ表示し、保存時は hash 化します。

`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` は Control Panel が stream 開始時に短命 `stream_ingest_token` を発行するための HMAC 鍵です。Encoder/Recorder 側にも同じ値を設定します。Worker と Discord Bot にはこの署名鍵を置かず、Control Panel から job payload として渡された短命 token だけを使います。

## MFA と Passkey

MFA は Security Settings UI/API で管理します。

| mode | 動作 |
| --- | --- |
| `disabled` | MFA を要求しません。production では保存できません。 |
| `totp` | TOTP enrollment と login challenge を有効化します。 |
| `passkey` | 対象ユーザーに Passkey / WebAuthn login を要求します。 |

production では `AUTOSTREAM_ENV=production`、`APP_ENV=production`、または `GO_ENV=production` のいずれかが設定されている場合、`mfa_mode=disabled` の保存を拒否し、`production_mfa_required` を返します。`mfa_required_roles` を指定する場合は、少なくとも `super_admin` と `admin` を含めてください。空配列は全ユーザー対象として扱われるため許可されます。

Passkey / WebAuthn の relying party は次の env で固定します。

```text
AUTOSTREAM_WEBAUTHN_RP_ID=control.example.com
AUTOSTREAM_WEBAUTHN_RP_NAME=AutoStream Control Panel
AUTOSTREAM_WEBAUTHN_RP_ORIGINS=https://control.example.com
```

`AUTOSTREAM_WEBAUTHN_RP_ORIGINS` は comma-separated で複数指定できます。production では `AUTOSTREAM_PUBLIC_URL` と RP origin を一致させ、request Host / proxy header fallback を使いません。`AUTOSTREAM_PUBLIC_URL`、または `AUTOSTREAM_WEBAUTHN_RP_ID` と `AUTOSTREAM_WEBAUTHN_RP_ORIGINS` が未設定の場合、Passkey challenge は `passkey_runtime_unavailable` で fail closed します。

## Secret 表示ポリシー

次の値は raw secret として扱います。

- `SERVICE_CALL_TOKEN`
- `OBSERVABILITY_TOKEN`
- `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY`
- `AUTOSTREAM_SECRET_ENCRYPTION_KEY`
- Discord Bot token
- YouTube stream key
- Google OAuth refresh token
- Drive folder ID
- webhook URL
- SMTP password

これらは logs、audit metadata、frontend、docs の実例に出しません。設定確認画面では configured / missing と fingerprint のみを表示します。
