# Control API

Generic profile API は raw secret-like config を受け付けません。`password`、`token`、`api_key`、`stream_key`、`folder_id`、`refresh_token` などの raw 値や raw key を含む場合は `400 profile_secret_reference_required` を返し、profile kind ごとの `allowed_secret_references` を返します。`*_secret_name`、`*_secret_ref`、`*_secret_id` が kind allowlist 外を指す場合は `400 profile_secret_reference_not_allowed` を返し、`invalid_secret_references` と `allowed_secret_references` を返します。

Control API は AutoStream の central control plane です。Control Panel UI、分散 service、Observability proxy はこの API を通じて stream、profile、service registry、Integration Registry、secret status、audit log を扱います。

raw secret は API response に返しません。Discord Bot token、YouTube stream key、Google OAuth refresh token、Drive folder ID、webhook URL、SMTP password は encrypted secret / Integration Registry に保存し、UI/API では `configured`、`masked`、`fingerprint`、または runtime secret reference だけを返します。

## Stream

```text
GET    /streams
POST   /streams
GET    /streams/{id}
PUT    /streams/{id}/settings
POST   /streams/{id}/start-readiness
GET    /streams/{id}/external-e2e-config
POST   /streams/{id}/start
POST   /streams/{id}/stop
POST   /streams/{id}/retry-upload
GET    /streams/{id}/logs
GET    /streams/{id}/artifacts
```

`start-readiness` は Discord Bot、Worker、Encoder/Recorder の primary assignment、heartbeat、public URL、Encoder preflight、YouTube output、archive destination を確認します。Readiness が失敗した場合、start dispatch は実行しません。

Stream ごとに `discord_config_id`、`discord_guild_id`、`discord_voice_channel_id`、`discord_text_channel_id`、`youtube_output_id`、`archive_profile_id` を指定できます。Discord server / channel override は Discord Config と組み合わせて保存し、Discord Bot start job へ解決済み routing として渡します。

`GET /streams/{id}/external-e2e-config` は、外部確認 handoff で使う非 secret の Control Panel confirmation file を export します。権限は `streams.read` を要求し、response は `Cache-Control: no-store` を付けます。payload に含めるのは Control Panel 管理の `youtube_output_id`、`drive_destination_id`、`discord_config_id`、`encoder_profile_id`、`archive_profile_id`、primary / standby service ID、`runtime_config_distribution_enabled`、`readiness` などの内部 ID、boolean confirmation、secret-safe missing list だけです。raw Discord guild/channel ID、Drive folder ID、OAuth token、client secret、RTMPS URL、stream key、service token、session cookie は返しません。

## Profiles And Integrations

```text
GET    /profiles/encoder
POST   /profiles/encoder
GET    /profiles/archive
POST   /profiles/archive
GET    /profiles/caption
POST   /profiles/caption
GET    /profiles/overlay
POST   /profiles/overlay

GET    /discord/configs
POST   /discord/configs
GET    /youtube/outputs
POST   /youtube/outputs
GET    /integrations/oauth-providers
POST   /integrations/oauth-providers
GET    /integrations/oauth-accounts
POST   /integrations/oauth-accounts        # 403 manual_oauth_account_create_disabled
POST   /integrations/oauth-accounts/start
POST   /integrations/oauth-accounts/callback
GET    /archive/destinations
POST   /archive/destinations
GET    /observability/notification-channels
POST   /observability/notification-channels
```

OAuth provider、OAuth connected account、YouTube output、Drive destination、Discord Bot config、notification channel は Control Panel から管理します。通常運用では Discord token、YouTube stream key、Drive folder ID、OAuth refresh token、webhook URL、SMTP password を service env に置きません。

OAuth connected account は `/integrations/oauth-accounts/start` と `/integrations/oauth-accounts/callback` の OAuth ceremony で作成します。通常 API から refresh token を直接投入する `POST /integrations/oauth-accounts` は `403 manual_oauth_account_create_disabled` を返します。既存 connected account の refresh token 更新も禁止し、変更できるのは operator-facing label だけです。

OAuth provider は connected account または OAuth login user link から参照されている間は削除できず、`409 oauth_provider_in_use` を返します。OAuth connected account も Drive destination、YouTube output、または保存済み YouTube runtime metadata から参照されている間は削除できず、`409 oauth_account_in_use` を返します。

Drive destination の `oauth2` mode は Google connected account と Drive scope を要求します。YouTube output の `live_api` / `live_api_dry_run` mode は Google connected account と YouTube scope を要求します。

YouTube output は `stream_key` と `live_api` / `live_api_dry_run` を持ちます。`stream_key` は既存 stream key を write-only secret として保存します。`live_api` は Google OAuth connected account を使って YouTube broadcast / live stream を準備し、start 時に Encoder/Recorder へ短命 runtime secret として RTMPS URL / stream key を渡します。stop 時は保存済み runtime metadata から broadcast を complete します。

Drive destination は `oauth2` と `service_account` を持ちます。`shared_drive=true` の destination では、Encoder/Recorder 側の Drive API upload は `supportsAllDrives=true` を使います。

## Service Registry

```text
POST /services/register
GET  /services/runtime-config
POST /services/runtime-secrets/resolve
POST /services/heartbeat
POST /services/stream-events
POST /services/stream-artifacts

GET    /service-health
POST   /services/{id}/assign
DELETE /services/{id}/assignment
DELETE /services/{id}
POST   /workers/{id}/restart
```

Encoder/Recorder、Worker、Discord Bot は複数登録できます。Control Panel で service token を作成し、token は作成時に一度だけ表示します。起動後の service は register / heartbeat を行い、自分の `service_id` に紐づく runtime config だけを取得できます。

Stream assignment は `primary` と `standby` を持ちます。Start 時に dispatch されるのは各 service type の primary だけです。Standby は failover 候補として表示し、将来の切替対象として扱います。

`/services/runtime-config` は `service.config.read` scope 付き service token で使います。Control Panel は token の service ID / service type と request の `service_id` を照合し、別 service の config 取得を `403` で拒否します。

`/services/runtime-secrets/resolve` は `service.secret.resolve` scope 付き service token で使う service 専用 endpoint です。`service.config.read` だけでは raw runtime secret を解決できません。Response は `Cache-Control: no-store` で返し、raw value を UI、audit metadata、diagnostic report、logs に残しません。同じ service/context/secret を TTL 中に再解決すると `409 runtime_secret_lease_active` を返します。

## Security And Audit

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password
POST   /auth/mfa/enroll
POST   /auth/mfa/verify
POST   /auth/mfa/disable
POST   /auth/recovery-codes/regenerate
POST   /auth/passkeys/register/start
POST   /auth/passkeys/register/finish
POST   /auth/passkeys/login/start
POST   /auth/passkeys/login/finish
GET    /auth/passkeys
DELETE /auth/passkeys/{id}
GET    /auth/oauth/providers
POST   /auth/oauth/{id}/start
GET    /auth/oauth/callback
POST   /auth/oauth/callback

GET    /users
POST   /users
GET    /roles
POST   /roles
GET    /permissions
GET    /audit-logs
GET    /audit-logs/export
GET    /security/settings
PUT    /security/settings
GET    /secrets/status
PUT    /secrets/{name}
GET    /api-tokens
POST   /api-tokens
```

Cookie session API は CSRF token を要求します。Service token API は Bearer token と scope を要求します。権限は server-side RBAC で fail closed します。

OAuth login callback は state / nonce を検証し、GET callback でも `Cache-Control: no-store` と `Referrer-Policy: no-referrer` を返します。Passkey / WebAuthn は production で configured RP がない場合、request Host fallback を使わず `passkey_runtime_unavailable` で fail closed します。

Audit log は login、logout、MFA、passkey、OAuth link、user/role/profile/secret/service/stream/notification/remediation 操作を記録します。Audit metadata に raw secret、OAuth code、refresh token、stream key、webhook URL、SMTP password、credential 付き URL は含めません。
