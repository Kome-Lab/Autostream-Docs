# ユーザーとセキュリティ

Users、Roles、Security Settings は、Control Panel の利用者と認証を管理する画面です。配信担当者を増やす前に、ロールと MFA の方針を決めてください。

## Users

Users では、ユーザー作成、ロール付与、lock、disable、password reset、削除を行います。

### 入力項目

| 項目 | 説明 |
| --- | --- |
| 編集対象 | 一覧右端の鉛筆ボタンから対象ユーザーを開く |
| Username | login に使う名前 |
| Email | 登録完了メールと本人連絡先に使うメールアドレス。新規作成時は必須 |
| Temporary password | 新規作成時、または password reset 時に使う一時 password |
| Send welcome email | SMTP 設定済みのとき、新規作成後に登録完了メールを送る |
| Role checkboxes | 付与する role |

### 操作

| ボタン | 使う場面 |
| --- | --- |
| Create User | 新しいユーザーを作る |
| Update User | username、email、role を更新する |
| Force Password Change | 次回 login 時に password 変更を求める |
| Reset Password | 一時 password を設定し、変更を強制する |
| Unlock | lockout されたユーザーを解除する |
| Lock | 一時的に login できない状態にする |
| Disable | ユーザーを無効化する |
| Delete | 退職や担当変更で不要になったユーザーを削除する |

新しいユーザーには email と temporary password を設定し、初回 login 後に本人が password を変更する運用にします。登録完了メールには一時 password を入れません。メール送信を使う場合は、先に Settings のメールサーバーを設定してテスト送信で疎通を確認し、password は別経路で渡してください。

編集画面は現在の username、email、role を初期表示します。role を変更しない更新では既存割り当てを保持します。role の変更には `roles.assign` が必要で、ログイン中の自分自身の role は変更できません。自分自身でも username と email は更新できます。

Delete は不可逆操作です。ログイン中の自分自身は削除できません。super_admin ユーザーを削除できるのは super_admin だけで、最後の有効な super_admin は削除できません。削除すると対象ユーザーの session、MFA、Passkey、OAuth login link などの認証関連データも無効化されます。

## Account

Account はログイン中ユーザー本人の設定画面です。`users.read` や `users.update` がなくても、自分のアカウントアイコン、メールアドレス、password、MFA、Passkey、OAuth login link を管理できます。`プロフィール` タブはアイコン、メール、OAuth連携、`セキュリティ` タブは password、MFA、Passkey を扱います。

| 項目 | できること |
| --- | --- |
| アカウントアイコン | JPEG / PNG をプレビューして保存または削除する。768 KB 以下、縦横 32〜2048 px |
| アカウントメール | 通知や本人連絡先に使うメールを変更する。新しい宛先へ確認メールが送られ、ワンタイムURLで確定 |
| Password | 現在の password を確認して変更する。変更後は再ログイン |
| MFA | TOTP 登録、無効化、recovery code 再発行 |
| Passkey | 端末の passkey 登録と削除 |
| OAuth連携 | Google / Discord などの login provider との紐づけと解除 |

## OAuth Login Links

OAuth login link は、OAuth callback で作成されます。provider subject を手入力して紐づけることはできません。

Login page には enabled な OAuth Provider が選択肢として表示されます。Provider は login 用 scope 固定で、Drive / YouTube scope は OAuth connected account 側で扱います。

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
| Password min length | password の最低文字数 | 最低8、運用推奨12以上 |
| Login lockout threshold | 何回失敗で lockout するか | 5 前後 |
| Session idle timeout minutes | 操作なし session の timeout | 30 分前後 |
| Session absolute lifetime hours | session の最大寿命 | 12 時間前後 |
| Password hash | password hash 方式 | `argon2id` 固定表示 |

Control Panelを操作している間は、browserが明示的なsession refreshを最大1分に1回送ってidle期限を延長します。定期的な`/auth/me`確認や画面の再描画だけではidle期限を延長しません。操作がないままidle timeoutを過ぎた場合、または操作中でもabsolute lifetimeを過ぎた場合は、自動的にlogin画面へ移動します。タブをバックグラウンドにしていた場合も、画面へ戻った時点で再確認します。

### MFA mode

| mode | 動き |
| --- | --- |
| disabled | policy としては MFA を要求しません。ただし本人がTOTPを登録済みなら login 時に2FAを要求します |
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

TOTP は Account 画面から本人が登録できます。MFA mode が `disabled` の場合でも任意登録は可能で、登録後の password login、OAuth login、passkey login ではTOTP確認が必要になります。MFA mode が `passkey` の場合、TOTP 登録は使わず Current User Passkeys で端末やセキュリティキーを登録します。

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
- 退職、担当変更、端末紛失があったら user disable、user delete、token rotate を検討します。
- password reset 後は Force Password Change を使います。
- OAuth auto-provision を有効にする場合は、allowed domains と default roles を必ず確認します。
