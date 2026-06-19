# セキュリティ

`autostream-observability` は health signal、metric、incident、diagnostic report、remediation action、notification channel、notification delivery history を扱います。raw secret、raw token、credential 付き URL、webhook URL、SMTP password、YouTube stream key、Google credential を API response、log、delivery history、diagnostic report に出さないことを前提にします。

## Token 境界

Signal ingest と管理 API は別 token に分けます。

```text
OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_SERVICE_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_OBSERVABILITY_TOKEN>
```

### Ingest token binding

Ingest token は service identity に binding します。

```text
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_ENCODER_TOKEN>:encoder_recorder:encoder-recorder-01,<SHA256_OF_WORKER_TOKEN>:worker:worker-01
OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true
```

`OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS` の既定値は `true` です。許可 token hash に正しい binding がない場合、ingest 認証は fail closed します。認証後も token と signal body の `service_type` / `service_id` が一致しない signal は `403 service_identity_mismatch` で拒否します。

### Admin token scope

Admin token は token hash ごとに scope を割り当てます。

```text
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_ADMIN_TOKEN>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
```

scope が不足する場合は `403 missing_admin_scope` を返します。token 不正は `401 invalid_service_token` です。

## Signal payload

Signal payload に secret を含めません。保存可能な evidence は signal name、service id/type、stream id、数値 metric、安全な status、failure phase、error class、retry count、duration などに限定します。

Top-level field と attributes に secret-like な key/value が含まれる場合、保存前に拒否または redaction します。

## Notification channel

Notification channel は Control Panel または Observability API で管理します。

- Discord webhook
- Slack webhook
- generic webhook
- Email / SMTP

Webhook URL と SMTP password は secret です。DB には `AUTOSTREAM_SECRET_ENCRYPTION_KEY` で暗号化して保存し、API response では raw 値を返しません。response と delivery history では次だけを扱います。

- `masked_webhook_url`
- `masked_email_target`
- `smtp_password_configured`

`NOTIFICATION_WEBHOOK_URL` は互換 fallback 用です。新規運用では使わず、Control Panel / API の複数 channel 管理へ移行してください。

## Webhook security

- remote webhook は HTTPS 必須。
- URL userinfo は拒否。
- private、loopback、link-local destination は既定で拒否。
- redirect 後の destination も検証。
- local 開発で必要な場合だけ `OBSERVABILITY_ALLOW_PRIVATE_WEBHOOKS=true`。
- retry は `NOTIFICATION_WEBHOOK_RETRY_MAX` と `NOTIFICATION_WEBHOOK_RETRY_BASE_DELAY_SEC` で制御。

## Email / SMTP security

- SMTP host は hostname または IP address のみ。
- private、loopback、link-local destination は既定で拒否。
- local 開発で必要な場合だけ `OBSERVABILITY_ALLOW_PRIVATE_SMTP=true`。
- `OBSERVABILITY_ENV=production`、`AUTOSTREAM_ENV=production`、`APP_ENV=production`、`GO_ENV=production` のいずれかが設定されている場合、`OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` は無視します。
- SMTP 認証を使う場合は `smtp_tls=true` 必須。
- SMTP password は API response、delivery history、log に出しません。
- test notification の error response に host 内部情報や password を含めません。

## Rate limit

```text
OBSERVABILITY_RATE_LIMIT_BACKEND=store
OBSERVABILITY_RATE_LIMIT_BURST=120
OBSERVABILITY_RATE_LIMIT_WINDOW_SEC=60
OBSERVABILITY_TRUSTED_PROXIES=127.0.0.1
```

本番では MariaDB-backed shared limiter を使います。`memory` backend は unit test または単一 process の local 開発用途です。trusted proxy 以外からの `X-Forwarded-For` は client IP として信用しません。

## Remediation

既定値は `REMEDIATION_MODE=suggest_only` です。

Safe action:

- `retry_gdrive_upload`
- `refresh_service_status`
- `rerun_diagnostics`
- `clear_stale_warning`
- `retry_package_remux`

自動実行しない action:

- archive 削除
- credential rotate
- role 変更
- live stream 停止
- YouTube broadcast 再作成
- service token revoke

## Hardening checklist

- ingest token と admin token を分離する。
- `OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true` のまま、全 ingest token を service identity に binding する。
- admin token scope binding を必須にする。
- notification channel は Control Panel/API で管理し、fallback env webhook は互換用途に限定する。
- webhook は remote HTTPS を使う。
- SMTP 認証を使う場合は TLS を必須にする。
- private webhook / SMTP host は本番で許可しない。
- `OBSERVABILITY_RATE_LIMIT_BACKEND=store` を使う。
- `REMEDIATION_MODE=suggest_only` から開始する。
- raw secret を docs、log、diagnostic report、delivery history に含めない。
