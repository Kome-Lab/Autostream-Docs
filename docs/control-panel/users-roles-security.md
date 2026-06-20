# ユーザーとセキュリティ

Users、Roles、Security Settings は、Control Panel の利用者と認証を管理する画面です。配信担当者を増やす前に、ロールと MFA の方針を決めてください。

## Users

Users では、ユーザー作成、ロール付与、lock、disable、password reset を行います。

### 入力項目

| 項目 | 説明 |
| --- | --- |
| Existing user | 編集対象。空欄なら新規作成 |
| Username | login に使う名前 |
| Temporary password | 新規作成時、または password reset 時に使う一時 password |
| Role checkboxes | 付与する role |

### 操作

| ボタン | 使う場面 |
| --- | --- |
| Create User | 新しいユーザーを作る |
| Update User | username と role を更新する |
| Force Password Change | 次回 login 時に password 変更を求める |
| Reset Password | 一時 password を設定し、変更を強制する |
| Unlock | lockout されたユーザーを解除する |
| Lock | 一時的に login できない状態にする |
| Disable | ユーザーを無効化する |

新しいユーザーには temporary password を渡し、初回 login 後に本人が変更する運用にします。

## OAuth Login Links

OAuth login link は、OAuth callback で作成されます。provider subject を手入力して紐づけることはできません。

削除すると、その OAuth provider での login ができなくなります。password login や別 provider が残っているか確認してから削除してください。

## Roles

Roles では、role 名と権限を管理します。

| 項目 | 説明 |
| --- | --- |
| Existing role | 編集対象。空欄なら新規作成 |
| Name | role 名 |
| Permissions | role に付ける権限 |

### ロール設計の目安

| role | 想定 |
| --- | --- |
| super_admin | 初期管理者。全設定、secret、role、user を扱う |
| admin | 配信設定、サービス割り当て、通知を扱う |
| operator | 配信開始、停止、状態確認を扱う |
| viewer | 状態確認だけを許可する |

権限は server-side で enforcement されます。画面でボタンが見えても、権限が足りなければ API 側で失敗します。

## Security Settings

Security Settings は、password、session、MFA、Passkey、secret 更新を扱います。

### password / session

| 項目 | 説明 | 推奨 |
| --- | --- | --- |
| Password min length | password の最低文字数 | 12 以上 |
| Login lockout threshold | 何回失敗で lockout するか | 5 前後 |
| Session idle timeout minutes | 操作なし session の timeout | 30 分前後 |
| Session absolute lifetime hours | session の最大寿命 | 12 時間前後 |
| Password hash | password hash 方式 | `argon2id` 固定表示 |

### MFA mode

| mode | 動き |
| --- | --- |
| disabled | MFA を要求しません |
| totp | password または OAuth login 後に TOTP を要求します |
| passkey | 対象ユーザーに Passkey / WebAuthn login を要求します |

`MFA required roles` に role 名を入れると、対象 role だけ MFA 必須にできます。空欄の場合は全ユーザー対象として扱います。

## Current User Passkeys

Passkey を登録する画面です。

1. `Register Passkey` を押します。
2. ブラウザまたは OS の passkey 登録画面に従います。
3. 登録後、Passkey credentials に表示されることを確認します。

credential ID や public key の raw value は表示されません。表示されるのは hash、sign count、transport、last used などです。

## Current User MFA

TOTP を使う場合は、Security Settings で TOTP mode を有効にしてから登録します。

| 操作 | 手順 |
| --- | --- |
| Start TOTP Enrollment | 現在の TOTP または recovery code が必要な場合は入力して開始 |
| Verify Enrollment | authenticator app の 6 桁 code を入れて有効化 |
| Regenerate Recovery Codes | 現在の TOTP または recovery code を入れて再発行 |
| Disable TOTP | 現在の TOTP または recovery code を入れて無効化 |

TOTP secret と recovery codes は一度だけ表示されます。表示後に再確認はできません。

## Update Secret

Update Secret は、Control Panel が管理する secret の値を更新する画面です。

| 項目 | 説明 |
| --- | --- |
| Secret name | 更新対象の secret |
| New value | 新しい値 |
| Update Secret | 値を保存 |
| Clear Secret | 値を消す |

保存後、raw value は返りません。`configured`、`fingerprint`、`updated_at` で更新を確認します。

## 運用ルールの目安

- super_admin は少人数にします。
- 日常配信担当には必要最小限の role を付けます。
- 退職、担当変更、端末紛失があったら user disable と token rotate を検討します。
- password reset 後は Force Password Change を使います。
- OAuth auto-provision を有効にする場合は、allowed domains と default roles を必ず確認します。
