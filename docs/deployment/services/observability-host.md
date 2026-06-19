# Host Deployment

この手順は `autostream-observability` を Linux host に直接インストールし、systemd で常駐させるためのものです。

## 前提

- Linux host
- Go build 済み binary
- MariaDB
- `autostream` user
- reverse proxy 経由の HTTPS

推奨パス:

```text
config: /etc/autostream/observability.env
data:   /var/lib/autostream/observability
binary: /opt/autostream/observability/autostream-observability
```

## 設定ファイル

`/etc/autostream/observability.env` を作成します。実 token は docs、chat、screenshot に貼らないでください。

```env
SERVICE_ID=observability-01
SERVICE_NAME=AutoStream Observability
SERVICE_PUBLIC_URL=https://observability.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>

OBSERVABILITY_BIND_ADDR=127.0.0.1:8090
OBSERVABILITY_PUBLIC_URL=https://observability.example.com
OBSERVABILITY_DATA_DIR=/var/lib/autostream/observability
DATABASE_URL=autostream:<DB_PASSWORD>@tcp(127.0.0.1:3306)/autostream_observability?parseTime=true
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<BASE64_32_BYTES>

OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_INGEST_TOKEN>
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_ENCODER_TOKEN>:encoder_recorder:encoder-recorder-01
OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true

OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_ADMIN_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_ADMIN_TOKEN>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true

OBSERVABILITY_ALLOW_PRIVATE_WEBHOOKS=false
OBSERVABILITY_ALLOW_PRIVATE_SMTP=false
OBSERVABILITY_RATE_LIMIT_BACKEND=store
OBSERVABILITY_TRUSTED_PROXIES=127.0.0.1
OBSERVABILITY_ENV=production
REMEDIATION_MODE=suggest_only
TZ=Asia/Tokyo
```

Email / SMTP と Webhook は Control Panel または Observability API の notification channel で管理します。Webhook URL と SMTP password は encrypted secret として保存され、response には `masked_webhook_url`、`smtp_password_configured`、`masked_email_target` だけが返ります。

`NOTIFICATION_WEBHOOK_URL` は互換 fallback です。新規本番運用では設定しないでください。

private webhook / SMTP host は既定で拒否します。local 開発でのみ `OBSERVABILITY_ALLOW_PRIVATE_WEBHOOKS=true` または `OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` を使えます。`OBSERVABILITY_ENV=production` の場合、`OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` は無視されます。

## Install

```bash
sudo install -d -o autostream -g autostream /var/lib/autostream/observability
sudo install -d -o root -g root /opt/autostream/observability
sudo install -o root -g root -m 0755 autostream-observability /opt/autostream/observability/autostream-observability
sudo install -o root -g autostream -m 0640 observability.env /etc/autostream/observability.env
sudo install -o root -g root -m 0644 systemd/autostream-observability.service.example /etc/systemd/system/autostream-observability.service
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-observability
```

## systemd hardening

unit では次の制限を使います。

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/autostream/observability
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
```

## Health check

```bash
curl -fsS http://127.0.0.1:8090/health
```

reverse proxy 経由で公開する場合は、proxy 側で HTTPS を終端し、`OBSERVABILITY_TRUSTED_PROXIES` に proxy の IP/CIDR を指定します。trusted proxy 以外からの `X-Forwarded-For` は信用しません。

## Rate limit

本番では `OBSERVABILITY_RATE_LIMIT_BACKEND=store` を使います。MariaDB の `rate_limit_buckets` table を使うため、複数 replica でも同じ rate-limit bucket を共有できます。store limiter が利用できない場合は fail closed し、`503 rate_limit_unavailable` を返します。

`OBSERVABILITY_RATE_LIMIT_BACKEND=memory` は unit test または単一 process の local 開発用途です。

## Notification channel setup

Control Panel の Notification Channels 画面、または Observability API で作成します。

- Discord / Slack / generic webhook: `webhook_url` は write-only。
- Email / SMTP: `smtp_host`、`smtp_port`、`smtp_tls`、`smtp_from`、`smtp_username`、`smtp_password`、`email_recipients` を登録。
- `smtp_password` は write-only。更新時に空欄なら既存値を保持。
- delivery history には masked target と配送結果だけを保存。

## Troubleshooting

- `401 invalid_service_token`: admin token または ingest token hash を確認します。
- `403 missing_admin_scope`: `OBSERVABILITY_ADMIN_TOKEN_BINDINGS` に必要 scope がありません。
- `403 service_identity_mismatch`: ingest token binding と signal の `service_type` / `service_id` が一致していません。
- `notification webhook URL must not target a private network`: private destination が拒否されています。本番では許可しません。
- `notification SMTP requires TLS for remote targets`: SMTP channel の `smtp_tls` を有効にしてください。
