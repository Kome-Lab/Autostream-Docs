# Sessions

Control Panel は配信開始、secret 管理、service assignment、remediation を操作できるため、session は fail closed で扱います。password login、OAuth login、Passkey login のいずれでも、最終的な session 発行前に account status、RBAC、MFA policy を確認します。

## Cookie 方針

- session cookie は HttpOnly です。
- production では Secure cookie を必須にします。
- SameSite は `Lax` または `Strict` を使います。
- cookie-based session の state-changing request は CSRF token を要求します。
- token を `localStorage` に保存しません。

## Login flow

1. local password、OAuth provider、Passkey のいずれかで identity を確認します。
2. user が `disabled` または `locked` の場合は session を発行しません。
3. password change required の user は通常操作 session ではなく password change flow へ誘導します。
4. Security Settings の `mfa_mode` と `mfa_required_roles` を確認します。
5. MFA 必須 user が TOTP / Passkey / recovery code を満たしていない場合は challenge state のみを返し、session cookie は発行しません。
6. 成功時に audit log を作成します。

OAuth auto-provision で作成された user も同じ MFA policy の対象です。OAuth login に成功しても、対象 role に MFA が必要な場合は MFA enrollment / challenge が完了するまで session は発行しません。

## Session invalidation

次の操作では既存 session を無効化します。

- password change
- admin password reset
- user disable / lock
- role change により MFA policy が変わる場合
- MFA method の削除
- recovery code regenerate

invalidation は admin UI の表示だけでなく、server-side session store で即時反映します。role を下げた user が既存 tab から stream start、secret update、remediation approval を続けられないことを確認します。OAuth provider 側の account disable だけでは Control Panel session は自動失効しないため、connected account の unlink と user disable を Control Panel 側でも実行します。

## Timeout

推奨値:

| 項目 | 推奨 |
| --- | --- |
| idle timeout | 30 分 |
| absolute lifetime | 12 時間 |
| remember me | disabled by default |

運用値は Control Panel の Security Settings で管理します。短すぎる timeout は運用中の stream 操作を妨げるため、audit log と session revoke を組み合わせて管理します。

## Audit

次の event は audit 対象です。

- login success / failure
- OAuth callback failure
- MFA challenge success / failure
- logout
- password change / reset
- account lock / unlock
- session invalidation

audit metadata には OAuth token、refresh token、session cookie、CSRF token、Passkey credential private material を含めません。

## CSRF / OAuth callback

cookie-based session の state-changing request は、OAuth connected-account callback も含めて CSRF 検証を先に通します。CSRF 失敗時は provider code を消費せず、no-store header を返し、audit には provider name、reason、request ID だけを残します。operator は callback 失敗を再試行するとき、provider UI で新しい authorization flow を開始し、古い callback URL や code を共有しません。

## Production smoke

session policy を変更したら、少なくとも login、logout、MFA challenge、role downgrade、session revoke、connected-account callback CSRF failure を確認します。Browser smoke では cookie value を記録せず、Network log に session cookie、CSRF token、OAuth code が残っていないことだけを確認します。
