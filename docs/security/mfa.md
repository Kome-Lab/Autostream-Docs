# MFA

MFA は Control Panel の operator account を保護する境界であり、provider credential や service token の代替ではありません。Security Settings、session、audit log、OAuth login provider、passkey registration は同じ identity boundary に属しますが、Discord Bot token、YouTube stream key、Drive destination、webhook URL のような integration secret は Integration Registry / encrypted store で別に管理します。

運用 evidence では、MFA が有効であること、recovery code が再生成されたこと、passkey が登録済みであること、失敗した login が audit log に残ったことを configured / masked / timestamp で確認します。TOTP secret、recovery code、challenge token、session cookie、OAuth token、WebAuthn raw credential は docs、screenshot、browser storage state に残しません。

Control Panel は TOTP と Passkey / WebAuthn を扱います。MFA policy は Security Settings で管理し、`mfa_mode` と `mfa_required_roles` で対象ユーザーを決めます。

## モード

| 値 | 動作 |
| --- | --- |
| `disabled` | MFA を要求しません。production では保存できません。 |
| `totp` | password / OAuth login の後に TOTP または recovery code を要求します。 |
| `passkey` | 対象ユーザーは登録済み Passkey / WebAuthn credential でログインする必要があります。password / OAuth login は session を発行せず、`passkey_required` または `passkey_enrollment_required` を返します。 |

`mfa_required_roles` が空の場合、有効な `mfa_mode` は全ユーザーに適用されます。`["super_admin", "admin"]` のように指定すると、その role を持つユーザーだけが MFA policy の対象になります。

production では `mfa_mode=disabled` を保存できません。`AUTOSTREAM_ENV=production`、`APP_ENV=production`、または `GO_ENV=production` のいずれかが設定されている場合、Control Panel は Security Settings 更新時に `production_mfa_required` を返します。scoped policy を使う場合も、少なくとも `super_admin` と `admin` を含めてください。

## TOTP Enrollment

1. 管理者が Security Settings で `mfa_mode=totp` を保存します。
2. 対象ユーザーでログインし、Security Settings の Current User MFA を開きます。
3. `Start TOTP Enrollment` を実行します。
4. 表示された TOTP secret または provisioning URI を authenticator app に登録します。
5. authenticator app の 6 桁 code を `Enrollment verification code` に入力し、`Verify Enrollment` を実行します。
6. 成功すると、そのユーザーの MFA が enabled になります。

TOTP secret と recovery code は一度だけ表示されます。画面を閉じた後に再表示できません。recovery code は hash のみ保存します。

## Login Flow

### Password Login

`mfa_mode=totp` の対象ユーザーでは、`POST /auth/login` は session cookie を発行せず、`202 Accepted` と `challenge_token` を返します。`POST /auth/mfa/verify` に `challenge_token` と TOTP code または recovery code を送り、成功時に session cookie と CSRF token を発行します。

`mfa_mode=passkey` の対象ユーザーでは、password login は session を発行しません。登録済み credential がある場合は `passkey_required`、credential がない場合は `passkey_enrollment_required` を返します。

### OAuth Login

OAuth login でも、最終的に紐づいた user が MFA policy の対象であれば password login と同じ policy を適用します。OAuth `code`、`state`、`nonce`、access token、refresh token は audit metadata に残しません。

GET callback の response は `Cache-Control: no-store` と `Referrer-Policy: no-referrer` を返します。ブラウザ履歴や proxy に authorization code が残るリスクを下げるため、OAuth provider の redirect URI は HTTPS の Control Panel public URL に固定してください。

### Passkey Login

Passkey login は次の API を使います。

```text
POST /auth/passkeys/login/start
POST /auth/passkeys/login/finish
```

`login/start` は browser の `navigator.credentials.get()` に渡す challenge と ceremony token を返します。ceremony token は session ではなく、短命の WebAuthn ceremony 専用 token です。`login/finish` は browser credential response を検証し、User Verification required で assertion response を確認します。

`mfa_mode=passkey` の対象ユーザーでは、この成功が login 要件を満たし、session cookie と CSRF token を発行します。

`mfa_mode=totp` の対象ユーザーが Passkey login を使う場合は、Passkey assertion の後に TOTP challenge を返します。これは TOTP policy を Passkey login でも fail closed にするためです。

## Passkey Registration

Passkey 登録はログイン済みユーザーだけが実行できます。

```text
POST /auth/passkeys/register/start
POST /auth/passkeys/register/finish
GET /auth/passkeys
DELETE /auth/passkeys/{id}
```

登録済み credential の raw public key、raw credential ID、sign count の内部値は UI に出しません。削除は本人の credential だけを許可します。

## WebAuthn RP

production では Control Panel の public URL と WebAuthn RP origin を一致させます。

```text
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_WEBAUTHN_RP_ID=control.example.com
AUTOSTREAM_WEBAUTHN_RP_NAME=AutoStream Control Panel
AUTOSTREAM_WEBAUTHN_RP_ORIGINS=https://control.example.com
```

`AUTOSTREAM_WEBAUTHN_RP_ORIGINS` は comma-separated で複数指定できます。local 開発では request Host から fallback origin を作れますが、production では request Host / proxy header fallback を使いません。`AUTOSTREAM_PUBLIC_URL`、または `AUTOSTREAM_WEBAUTHN_RP_ID` と `AUTOSTREAM_WEBAUTHN_RP_ORIGINS` が未設定の場合、Passkey challenge 作成は `passkey_runtime_unavailable` で fail closed します。

## Audit

次の操作は audit log に残します。

- TOTP enrollment start / verify
- MFA challenge verify
- recovery code regeneration
- MFA disable
- Passkey registration start / finish
- Passkey login start / finish
- Passkey delete
- Security Settings update

Audit metadata には TOTP secret、recovery code、challenge token、ceremony token、credential raw data、OAuth token を含めません。
