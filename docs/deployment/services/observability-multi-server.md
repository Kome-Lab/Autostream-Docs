# Multi Server Deployment

`autostream-observability` は Control Panel と別サーバーで動かせます。全 service URL は設定可能であり、同一 Docker network を前提にしません。

## 通信経路

```text
Encoder/Recorder / Worker / Discord Bot
  -> Observability ingest API
  -> incident / diagnostic / notification
  -> Control Panel observability proxy
```

Control Panel は Observability の管理 API を参照し、Dashboard、Incidents、Diagnostics、Remediation、Notification Channels を表示します。

## Bootstrap env

Observability service 側:

```env
SERVICE_ID=observability-01
SERVICE_NAME=AutoStream Observability
SERVICE_PUBLIC_URL=https://observability.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>

OBSERVABILITY_PUBLIC_URL=https://observability.example.com
OBSERVABILITY_BIND_ADDR=127.0.0.1:8090
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TOKEN>
OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_INGEST_TOKEN>
OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
OBSERVABILITY_ENV=production
```

Control Panel 側:

```env
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<CONTROL_PANEL_OBSERVABILITY_TOKEN>
```

`OBSERVABILITY_URL` は HTTPS を使い、userinfo、query、fragment を含めません。redirect 先へ bearer token は転送しません。

## Token binding

Ingest token は service identity に binding します。

```env
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_ENCODER_TOKEN>:encoder_recorder:encoder-recorder-01,<SHA256_OF_WORKER_TOKEN>:worker:worker-01
```

Admin token は scope 付き binding にします。

```env
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_CONTROL_PANEL_TOKEN>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
```

## Notification channels

Notification channel は複数登録できます。

- Discord Webhook
- Slack Webhook
- Generic Webhook
- Email SMTP

Webhook URL と SMTP password は encrypted secret として保存します。API response、delivery history、diagnostic report では raw 値を返しません。

Email channel の作成・更新 request では `smtp_host`、`smtp_port`、`smtp_tls`、`smtp_from`、`smtp_username`、`smtp_password`、`email_recipients` を送ります。response では `smtp_password_configured` と `masked_email_target` だけを返します。

SMTP 認証を使う場合は TLS が必要です。private SMTP host は既定で拒否し、本番環境では `OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` を設定しても許可されません。

## Firewall

最小構成:

- Control Panel -> Observability HTTPS
- Encoder/Recorder / Worker / Discord Bot -> Observability HTTPS
- Observability -> Control Panel HTTPS
- Observability -> Discord/Slack/SMTP provider outbound
- Observability -> MariaDB

private network 宛て webhook / SMTP を本番で使う場合は、設計レビューと明示的な許可方針を別途用意してください。既定では拒否します。

## Smoke

```bash
curl -fsS https://observability.example.com/health
```

Control Panel 側では Service Health と Monitoring Dashboard で Observability の heartbeat、incident、notification delivery を確認します。
