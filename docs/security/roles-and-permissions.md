# ロールと権限

AutoStream Control Panel は RBAC をサーバー側で強制します。フロントエンドの表示制御は補助であり、API handler 側の permission check が最終判断です。未定義 permission や不足 permission は fail closed として拒否します。

## 既定ロール

| ロール | 主な用途 |
| --- | --- |
| `super_admin` | 初期管理者。すべての permission を持ちます。 |
| `admin` | 通常管理者。user / role 操作は一部制限されます。 |
| `stream_operator` | stream 作成、start / stop、retry upload。 |
| `encoder_manager` | encoder profile と Encoder/Recorder 管理。 |
| `archive_manager` | archive profile、Drive destination、retry upload。 |
| `viewer` | 読み取り専用。 |
| `auditor` | audit log と diagnostics の確認。 |

## 権限付与の原則

- permission は明示的な文字列で管理します。
- `roles.assign` がない user は、user 作成 / 更新時に `role_ids` を指定できません。
- 非 `super_admin` は `super_admin` role を付与できません。
- 最後の active `super_admin` は disable、lock、role 剥奪できません。
- service token の scope と user permission は別管理です。service token で Control Panel の管理 API を操作できません。

権限変更は stream 運用中でも即時反映されます。`stream_operator` を外した user は既存 session から start / stop / retry upload を継続できません。`roles.assign`、`integrations.update`、`secrets.rotate`、`remediation.approve` は高リスク permission として扱い、通常運用では最小人数に限定します。

## OAuth Auto-Provision と Role

OAuth provider の `auto_provision=true` は、初回 OAuth login 時に user を自動作成する機能です。

`default_role_ids` は権限付与そのものなので、provider 作成 / 更新時に `roles.assign` を要求します。`integrations.create` / `integrations.update` だけでは default role を設定できません。

推奨:

- auto-provision の既定 role は `viewer` または専用の低権限 role にします。
- `stream_operator` 以上の role は、初回ログイン後に管理者が明示的に付与します。
- `super_admin` を自動付与しません。

## OAuth User Link

OAuth user link は、Google / GitHub / Discord の provider subject と Control Panel user を紐づける情報です。

リンク作成は OAuth callback ceremony に限定します。`POST /users/{id}/oauth-links` による手動 subject 登録は `403 manual_oauth_link_disabled` で拒否されます。これは、管理者が provider subject を誤入力したり、攻撃者が別 user に自分の provider subject を紐づけたりする事故を防ぐためです。

Control Panel UI では既存 link の一覧と削除だけを扱います。新しい link は、state cookie、nonce、provider identity、domain allowlist、auto-provision policy を通過した OAuth callback で作成されます。

## Role review

本番では定期的に role review を行います。見る項目は、active super_admin の人数、MFA 必須 role、auto-provision default role、高リスク permission の付与先、退職・委託終了 user の disabled 状態、service token と user token の混同有無です。review 結果は audit log と change record に残し、permission 名を追加した場合は contracts、Control Panel UI、docs、docs consistency check を同時に更新します。

## Break-glass role

break-glass は通常 role ではなく、一時的な操作手順として扱います。付与する場合は期限、対象 stream、許可する操作、承認者を audit metadata に残し、完了後に session invalidate と role revert を実行します。break-glass でも OAuth refresh token、SMTP password、webhook URL、Drive Service Account JSON の raw value 表示は許可しません。

## 監査ログ

次の操作は audit log に記録します。

- user 作成 / 更新 / disable / lock / unlock
- role 作成 / 更新 / 削除
- user role assignment
- OAuth login 成功 / 失敗
- OAuth auto-provision
- OAuth user link 削除
- 手動 OAuth link 作成の拒否
- password reset
- MFA enrollment / disable / recovery code regeneration

audit metadata には raw secret、password、OAuth code、client secret、refresh token を含めません。
