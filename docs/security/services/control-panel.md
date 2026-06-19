# セキュリティ

Control Panel は AutoStream の central control plane です。認証、RBAC、CSRF、service token、runtime config、runtime secret、audit log、stream dispatch の境界は server-side で強制します。frontend の表示切り替えだけに依存しません。

## Sessions

- HttpOnly cookie を使います。
- production では Secure cookie を有効にします。
- SameSite は既定で `Lax` です。
- unsafe method には CSRF token を要求します。
- password change、account disable、account lock では既存 session を無効化します。

## OAuth Login

Google、GitHub、Discord の OAuth provider は Control Panel の Integration Registry で管理します。client secret は encrypted secret として保存し、API response、audit log、frontend には raw 値を返しません。

production では OAuth provider の redirect URI を `AUTOSTREAM_PUBLIC_URL` の scheme / host と一致させてください。

- `/auth/oauth/callback`: Control Panel login 用。
- `/integrations/oauth-accounts/callback`: Google Drive / YouTube connected account 用。

OAuth code、state、nonce、client secret は log や audit metadata に残しません。

## MFA

`mfa_mode=totp` では TOTP MFA が有効です。対象ユーザーが TOTP 未登録の場合、password または OAuth identity が正しくても session を発行せず、`mfa_enrollment_required` として扱います。

`mfa_required_roles` が空の場合は全ユーザーが対象です。`super_admin` や `admin` などの role を指定すると、その role を持つユーザーだけを MFA 必須にできます。

TOTP secret は `AUTOSTREAM_SECRET_ENCRYPTION_KEY` で暗号化し、recovery code は hash のみ保存します。

## Passkey / WebAuthn

Passkey / WebAuthn は Control Panel の MFA / login policy として扱います。

- `webauthn_credentials` に credential metadata を保存します。
- `webauthn_ceremony_sessions` に registration / login ceremony session を server-side 保存します。
- `GET /auth/passkeys` は credential ID hash、name、sign count、transports などの非 secret metadata だけを返します。
- raw credential ID、public key CBOR、challenge、ceremony token は API response や audit metadata に含めません。
- User Verification は required です。
- ceremony token は `Cache-Control: no-store` で返し、finish 時に atomic consume します。

`mfa_mode=passkey` は強制 policy として扱います。対象ユーザーの password / OAuth login では通常 session を発行せず、登録済み Passkey / WebAuthn credential での login を要求します。

## RBAC

すべての管理 API は server-side の permission check を通します。権限がない場合は `403`、未認証の場合は `401` を返します。権限判定は fail closed です。

## Secrets

raw secret は frontend に返しません。`/secrets/status` は configured / missing / fingerprint だけを返します。secret 更新 API は write-only です。

secret として扱う値:

- Discord bot token
- Deepgram API key
- YouTube stream key
- Google credential
- Google Drive folder ID
- OAuth client secret
- OAuth refresh token
- service token
- webhook URL
- SMTP password
- session secret
- credential 付き stream URL
- MFA challenge token
- Passkey registration / login token

## Service Tokens

service token は作成時だけ raw 値を返し、保存時は hash 化します。作成 response には `Cache-Control: no-store` を付けます。

service token は `service_type` と scope に紐づきます。別 type の service registration、heartbeat、event write には使えません。

## Runtime Config And Secrets

service は起動後に Control Panel へ登録し、自分の `service_id` に紐づく runtime config だけを取得します。Discord Bot config は `service_id` が一致する service にだけ返します。

runtime secret は service-scoped と stream-scoped を分けます。

- Discord Bot token のように service runtime profile に紐付く secret は、所有 service token を持つ service だけが取得できます。
- Drive folder ID、OAuth refresh token、OAuth client secret、YouTube stream key などの stream-scoped secret は、対象 stream の primary assignment service だけが取得できます。
- standby service は failover 候補として runtime config に表示されますが、primary に昇格するまで stream-scoped secret を解決できません。
- runtime secret response には `Cache-Control: no-store` を付けます。
- runtime secret は短時間 lease を持ち、同じ secret の連続取得を拒否します。

## Service URL Policy

Control Panel は start / stop / retry-upload dispatch 時に service `public_url` へ `SERVICE_CALL_TOKEN` を送ります。そのため URL policy は重要です。

```text
AUTOSTREAM_SERVICE_ALLOWED_HOSTS=encoder.internal.example,worker.internal.example
AUTOSTREAM_SERVICE_ALLOWED_CIDRS=10.40.0.0/16
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=encoder.example.com,worker.example.com,*.services.example.com
AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true
```

- private / loopback / link-local / metadata endpoint は既定で拒否します。
- public HTTP は拒否します。
- public HTTPS は既定で許可します。
- production で token 送信先を固定する場合は `AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true` を設定し、明示された public host 以外への dispatch を拒否します。
- DNS 解決後の IP と redirect 先にも同じ policy を適用します。
- HTTP proxy は使いません。

## Service Assignment

stream start / stop / retry-upload は、対象 stream に割当済みの primary service だけへ dispatch します。必要 service が不足している場合は `409 missing_stream_assignments` を返し、dispatch しません。

assignment 外 service からの stream event、artifact report、current stream update は拒否します。standby service は通常 dispatch 対象ではありません。

## Observability Proxy

Control Panel は `OBSERVABILITY_TOKEN` を使って upstream Observability に接続します。upstream failure 時も upstream response body をそのまま返しません。

token、webhook URL、SMTP password、Google Drive folder ID など secret-like key は response redaction 対象です。notification channel では raw webhook URL、SMTP password、SMTP host、recipient list を frontend に返さず、masked target と configured status だけを返します。

## Audit Logs

login、logout、password change、user / role 変更、stream start / stop / retry-upload、service token 作成 / revoke、service assignment、secret update、security settings update、MFA、Passkey、Observability remediation 実行などを audit log に記録します。

audit metadata に raw secret、OAuth code、refresh token、stream key、webhook URL、SMTP password、service token、MFA challenge token、Passkey ceremony token、WebAuthn challenge は残しません。`value` や `webhook_url` のような secret-like key だけでなく、message などの自由文に `stream_key=...`、`refresh_token=...`、`smtp_password=...`、`folder_id=...` が混ざった場合も redaction 対象です。

## Login Failure Protection

password / passkey login の失敗は、client IP と正規化 username の組み合わせで rate limit します。reverse proxy 配下では `AUTOSTREAM_TRUSTED_PROXIES` に実際の proxy CIDR を設定してください。loopback を無条件には信用しません。
