# 初回 admin 作成

Control Panel の初回 admin は setup token で一度だけ作成します。setup token は bootstrap 用の一時 secret であり、通常運用の login password、service token、OAuth token とは分けます。

## 事前条件

- Control Panel の MariaDB migration が適用済み。
- `AUTOSTREAM_SETUP_TOKEN` が十分な乱数で生成され、Control Panel process の環境変数にだけ設定されている。
- `AUTOSTREAM_SESSION_SECRET` と secret encryption key が production value になっている。
- reverse proxy の TLS と public origin が確定している。

## 手順

1. Control Panel を setup token 付きで起動します。
2. operator の端末で admin username と 12 文字以上の password を用意します。
3. `POST /setup/first-admin` に setup token、username、password を送ります。
4. 成功 response で作成された user ID と role を確認します。
5. Control Panel process から `AUTOSTREAM_SETUP_TOKEN` を削除し、service を再起動します。
6. `/setup/first-admin` が二度目の作成を拒否することを確認します。

PowerShell では secret を command-line argument に置かず、環境変数から request body を組み立てます。`AUTOSTREAM_SETUP_TOKEN` と `AUTOSTREAM_FIRST_ADMIN_PASSWORD` は local shell/session だけに設定し、transcript、history、screenshot に残さないでください。

```powershell
$controlPanelUrl = "https://control.example.com"
$body = @{
  setup_token = $env:AUTOSTREAM_SETUP_TOKEN
  username = "admin"
  password = $env:AUTOSTREAM_FIRST_ADMIN_PASSWORD
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "$controlPanelUrl/setup/first-admin" `
  -ContentType "application/json" `
  -Body $body

$response.user | Select-Object id, username, status, roles
```

成功時は HTTP 201 で `user.id`、`user.username`、`user.status`、`user.roles` が返ります。`user.roles` に `super_admin` が含まれ、`status` が `active` であることを確認します。失敗時の主要 code は `setup_disabled`、`invalid_setup_token`、`users_already_exist`、`create_first_admin_failed` です。code だけを記録し、送信した token/password は記録しません。

setup token を削除して Control Panel を再起動した後、同じ endpoint が `setup_disabled` または `users_already_exist` で拒否されることを確認します。この再確認 request でも実 password を再送する必要はありません。疎通確認だけなら dummy 値を使い、実 setup token を再表示しないでください。

## 作成後の確認

初回 admin は `super_admin` role と全 permission を持ちます。production ではすぐに MFA を登録し、通常作業用の admin account を別途作って、初回 account の利用頻度を下げます。setup token、password、session cookie は docs、issue、terminal transcript、screenshot に残しません。

## 失敗時の扱い

first admin 作成が失敗した場合は、setup token、database migration、existing admin count、CSRF/session state を分けて確認します。password や setup token を logs / docs / screenshot に残さず、request ID、safe error code、operator action、再実行可否だけを記録します。

## Operator Notes

初回 admin 作成は bootstrap から通常運用へ移る境界です。setup token は一度だけ使う temporary secret として扱い、作成後は Control Panel の session secret、MFA、RBAC、audit log が通常の管理経路になります。docs や evidence には setup token、password、session cookie、CSRF token を残しません。

作成後の確認では、admin login が成功することだけでなく、MFA registration、break-glass account の扱い、service token 作成権限、Integration Registry の secret write 権限が適切に分かれていることを見ます。外部確認の前に local smoke credential と provider credential を混ぜないよう、operator-managed 値は a local ignored runtime directory か Control Panel UI に閉じます。

setup token mismatch、既存 admin あり、session secret 未設定、WebAuthn origin 不一致は別々に扱います。token mismatch では token 値を貼り付けず、hash 世代と process reload の有無だけを確認します。既存 admin がある場合は setup endpoint を再利用せず、通常の admin 管理画面または DB backup restore 手順で復旧します。password を再設定する場合も、terminal history と screenshot に raw 値が残らない手順を選びます。
