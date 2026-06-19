# Observability

Observability は AutoStream の監視、異常検知、診断、通知、remediation action 管理を担当する独立 service です。Control Panel は incident と diagnostics を表示・操作しますが、検知ロジックは Observability repository に置きます。

## 責務

- 各 service から heartbeat、metric、event、warning、error signal を受信する
- rule-based detection で incident を作成し、active incident を dedupe する
- 日本語 diagnostic report を生成する
- safe/manual remediation action を作成する
- Discord、Slack、Generic Webhook、Email へ通知する
- delivery history を保存する
- Control Panel 向け API を提供する

## API

```text
GET    /health
GET    /status
POST   /heartbeat
POST   /signals
GET    /signals
GET    /metrics
GET    /diagnostics
GET    /incidents
GET    /incidents/{id}
POST   /incidents/{id}/acknowledge
POST   /incidents/{id}/resolve
GET    /notification-deliveries
GET    /notification-channels
POST   /notification-channels
GET    /notification-channels/{id}
PUT    /notification-channels/{id}
DELETE /notification-channels/{id}
POST   /notification-channels/{id}/test
GET    /remediation-actions
POST   /remediation-actions/{id}/approve
POST   /remediation-actions/{id}/execute
```

`/health` と `/status` 以外は Bearer token が必要です。

- `/signals` と `/heartbeat`: ingest token
- 参照・操作 API: scope-bound admin token

## Admin scope

```text
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_OBSERVABILITY_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_CONTROL_PANEL_OBSERVABILITY_TOKEN>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
```

Control Panel から使う token には必要 scope だけを付与します。read-only integration には `observability.read`、`notifications.read`、`remediation.read` だけを付与できます。

## Deployment

```text
SERVICE_ID=observability-01
SERVICE_NAME=Observability
SERVICE_PUBLIC_URL=https://observability.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<OBSERVABILITY_SERVICE_TOKEN_WITH_REMEDIATION_EXECUTE>
OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_SERVICE_TOKEN>
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_observability?parseTime=true
REMEDIATION_MODE=suggest_only
TZ=Asia/Tokyo
```

notification channel は Control Panel または Observability API で登録します。`NOTIFICATION_WEBHOOK_URL` は fallback 互換用です。通常運用では webhook URL、SMTP password、OAuth token を env に置きません。

## Notification

Notification channel は複数登録できます。

- `discord`
- `slack`
- `generic`
- `email`

Webhook URL と SMTP password は encrypted secret として保存され、API response では raw 値を返しません。Email channel は作成・更新 request で `email_recipients`、`smtp_host`、`smtp_port`、`smtp_tls`、`smtp_from`、`smtp_username`、`smtp_password` を登録できますが、response では `smtp_password_configured` と `masked_email_target` だけを返します。SMTP 認証を使う場合は TLS が必要です。

## Security

Observability の security 境界は、ingest token、admin token、notification secret、remediation approval を分けて扱います。signal payload と diagnostic report は secret-like value を拒否し、notification channel は ciphertext/nonce と masked response だけを evidence に残します。

## Operational Notes

Observability の本番 readiness は、incident が作れることだけではなく、通知 secret が encrypted storage に入り、delivery history が masked target だけを返し、remediation が approval boundary を越えないことまで確認します。Control Panel は表示と承認を担当し、検知 rule、notification delivery、retry、ciphertext/nonce の永続化は Observability repository の責務として扱います。

外部 provider 値が必要な通知先は a local ignored runtime directory か Control Panel UI/API で投入し、この docs repository には configured/missing、masked target、delivery status、ciphertext/nonce regression test 名だけを残します。障害時は webhook/SMTP の raw 値を貼らず、対象 channel ID、incident ID、delivery attempt count、failure class を証跡にします。

- raw webhook URL、SMTP password、service token、credential path、stream key を API response や diagnostic report に含めません。
- delivery history の `target` には masked webhook URL または masked email target だけを保存します。
- remote webhook は HTTPS を使います。
- private network 宛て webhook/SMTP は既定で拒否します。
- dangerous remediation action は自動実行しません。
- admin token は scope binding を必須にできます。
