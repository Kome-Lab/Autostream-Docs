# アカウント

Control Panel のアカウントは、パスワードログイン、OAuth ログイン、TOTP MFA、Passkey / WebAuthn、RBAC を組み合わせて管理します。サービス用 token、Google Drive / YouTube の connected account、Discord Bot token は、ユーザーアカウントとは分離して扱います。

## ローカルユーザー

- ユーザーは `active`、`disabled`、`locked`、`pending_password_change` の状態を持ちます。
- パスワードは Argon2id で hash 化して保存し、平文パスワードは保存しません。
- 管理者が一時パスワードを発行した場合は、初回変更を強制できます。
- パスワード変更またはリセット後は、既存 session を無効化します。
- 失敗ログインは rate limit と account lockout の対象です。

## OAuth Login

Control Panel は Google、GitHub、Discord の OAuth provider を Integration Registry で管理します。

OAuth provider には次の情報を保存します。

- provider type
- client ID
- client secret
- redirect URI
- scopes
- allowed domains
- auto-provision policy
- default role IDs

client secret は encrypted secret として保存します。API response、audit log、frontend には raw 値を返しません。

## Redirect URI

production では、OAuth provider の redirect URI を `AUTOSTREAM_PUBLIC_URL` の scheme / host と一致させます。

```text
AUTOSTREAM_PUBLIC_URL=https://control.example.com
redirect_uri=https://control.example.com/auth/oauth/callback
```

`AUTOSTREAM_PUBLIC_URL` が未設定の場合、開発用途として `localhost`、`*.localhost`、loopback IP の redirect だけを許可します。外部 host の redirect URI は未設定状態では拒否します。

OAuth login 用 provider は `/auth/oauth/callback` を使います。Google Drive / YouTube の connected account 用 provider は `/integrations/oauth-accounts/callback` を使います。

connected account 用 provider の制約:

- `provider_type` は `google` のみ。
- `scopes` には Google Drive または YouTube API scope を 1 つ以上含めます。
- `auto_provision` と `default_role_ids` は使いません。
- GitHub / Discord provider を connected account 用 callback に設定した場合は拒否します。

## Account Link

既定では、OAuth identity は事前にローカル user へ link されている必要があります。未リンク identity は `oauth_account_not_linked` で拒否します。

管理者は Users 画面または API で、provider ID、provider subject、email を user に紐付けます。

Google OAuth login では、token endpoint から返る ID token を Google の署名検証付き validator で検証します。Audience、issuer、expiry、nonce を確認し、payload だけを decode した未署名 token は受け入れません。

## 初回ログインの自動作成

OAuth provider で `auto_provision=true` を設定し、`default_role_ids` を 1 つ以上指定した場合だけ、allowed domain を通過した未リンク identity からローカル user を自動作成できます。

安全上の制約:

- `default_role_ids` を設定する provider 作成 / 更新には `roles.assign` が必要です。
- `auto_provision=true` で `default_role_ids` が空の場合は拒否します。
- `allowed_domains` に一致しない email は自動作成されません。
- 自動作成される user は `active` になりますが、付与される role は provider に指定された既存 role のみに限定します。
- auto-provision で作成された user も通常の user と同じ MFA policy を即時に受けます。
- OAuth code と client secret は logs、audit、docs、issue、screenshots に残しません。

たとえば `default_role_ids` で `admin` role を付与し、Security Settings で `mfa_mode=totp` と `mfa_required_roles=["admin"]` を設定している場合、初回 OAuth login でも session は発行されず、`mfa_enrollment_required` で停止します。

## MFA

`mfa_mode=totp` では TOTP MFA を有効化できます。MFA 未登録ユーザーは password または OAuth identity が正しくても通常 session を発行されず、`mfa_enrollment_required` で拒否されます。

Passkey / WebAuthn は登録、削除、passwordless login、`mfa_mode=passkey` の強制 policy を実装済みです。Passkey policy の対象ユーザーは password / OAuth login では session を受け取れず、登録済み credential でログインする必要があります。

## 運用メモ

- OAuth login 用 Google account と、YouTube / Google Drive upload 用 connected account は分けて管理します。
- provider の allowed domain は空にせず、必要なドメインだけを登録してください。
- `super_admin` を auto-provision の default role に指定する運用は避けてください。
- OAuth code、refresh token、client secret は logs、audit、docs、issue、screenshots に残さないでください。
