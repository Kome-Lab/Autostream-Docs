# Docker Deployment

この手順は `autostream-observability` を Docker / Docker Compose で起動するためのものです。Control Panel、Encoder/Recorder、Worker、Discord Bot とは別 host で動かせる前提です。

## Build

```bash
docker build -t autostream-observability:local .
```

## Compose

```bash
docker compose up -d
docker compose logs -f observability
```

production compose を使う場合:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment

`.env` または compose の secret 管理に次の bootstrap 値を置きます。

```env
SERVICE_ID=observability-01
SERVICE_NAME=AutoStream Observability
SERVICE_PUBLIC_URL=https://observability.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>

OBSERVABILITY_BIND_ADDR=0.0.0.0:8090
DATABASE_URL=autostream:<DB_PASSWORD>@tcp(mariadb:3306)/autostream_observability?parseTime=true
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<BASE64_32_BYTES>
OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_INGEST_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_ADMIN_TOKEN>
OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
OBSERVABILITY_ENV=production
```

Webhook URL、SMTP password、OAuth token は compose env に置かず、Control Panel または Observability API の notification channel として登録します。

## Private destination policy

Webhook は既定で private network 宛てを拒否します。Email/SMTP も private network 宛て host を既定で拒否します。

local 開発でローカル relay を使う場合だけ、次を明示できます。

```env
OBSERVABILITY_ALLOW_PRIVATE_WEBHOOKS=true
OBSERVABILITY_ALLOW_PRIVATE_SMTP=true
```

本番では `OBSERVABILITY_ALLOW_PRIVATE_WEBHOOKS=false` と `OBSERVABILITY_ALLOW_PRIVATE_SMTP=false` のまま運用してください。`OBSERVABILITY_ENV=production` の場合、`OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` は無視されます。

## Health check

```bash
curl -fsS http://127.0.0.1:8090/health
```

## Logs

```bash
docker compose logs --tail=200 observability
```

raw webhook URL、SMTP password、service token は log に出さない方針です。障害報告や evidence 収集時も raw secret を貼らないでください。

## Notification secret storage

notification channel を Docker env に戻す運用は本番完成形ではありません。Discord / Slack / generic webhook URL、SMTP username/password、recipient list は Observability API または Control Panel 経由で登録し、store には ciphertext と nonce のみを保存します。MariaDB integration test では webhook URL と SMTP password が plaintext column に残らず、`ciphertext` / `nonce` が存在することを確認します。

operator は channel 作成後、UI/API で `configured`、masked target、delivery policy、last test delivery result だけを確認します。raw webhook URL や SMTP password を evidence に貼る必要がある場合は設計誤りです。delivery 失敗時も log に出すのは provider type、masked host、status class、retry count、incident ID までにします。

## Rollback / rotation

image rollback、database rollback、secret rotation は分けて扱います。image を戻しても ciphertext を復号できない場合は、`AUTOSTREAM_SECRET_ENCRYPTION_KEY` の世代違いを疑い、安易に旧 webhook URL を再登録しないでください。secret を rotate した場合は、raw 値ではなく channel ID、rotation audit ID、fingerprint、test delivery result を残します。

本番復旧後は `notification.delivery_failed` が止まり、対象 channel の delivery history が新しい masked result を記録していることを確認します。private destination policy を一時的に緩めた場合は、期限と削除条件を incident に記録し、`OBSERVABILITY_ENV=production` では private SMTP bypass が効かないことを確認します。
