# Docker デプロイ

`autostream-control-panel` は Docker / Docker Compose で起動できます。MariaDB も compose 内で起動できますが、本番では外部 MariaDB や managed DB を使っても構いません。

## 開発起動

```bash
docker compose up --build
```

MariaDB と Control Panel を起動します。本番では `.env.example` を `.env` にコピーし、placeholder を安全な値に置き換えてください。

## local compose

Makefile を使う場合:

```bash
make docker-local-up
make docker-local-logs
make docker-local-down
```

## 必須環境変数

```text
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(mariadb:3306)/autostream_control_panel?parseTime=true
AUTOSTREAM_BIND_ADDR=0.0.0.0:8080
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
SERVICE_CALL_TOKEN=<CONTROL_PANEL_TO_SERVICE_TOKEN>
SERVICE_CALL_TIMEOUT_SEC=5
AUTOSTREAM_SERVICE_ALLOWED_HOSTS=
AUTOSTREAM_SERVICE_ALLOWED_CIDRS=
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=
AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true
TZ=Asia/Tokyo
```

Observability 連携:

```text
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
OBSERVABILITY_TIMEOUT_SEC=5
```

`OBSERVABILITY_TOKEN` は secret です。log や API response に出しません。

## Service dispatch

Docker 環境でも、Control Panel から各 service へ到達できる absolute URL を service registry に登録してください。同一 compose network を前提にしない構成を標準にします。

`SERVICE_CALL_TOKEN` は Control Panel から service へ dispatch する token です。各 service 側では同じ raw token の SHA-256 を `SERVICE_CONTROL_TOKEN_SHA256` に設定します。

Docker Desktop の local override は `host.docker.internal` だけを信頼 host として許可します。本番で private Docker network や内部 DNS を使う場合は、必要な host / CIDR だけを `.env` に指定してください。`0.0.0.0/0` や全private rangeの一括許可は避けます。

## Secret

- `.env` は commit しません。
- `.env.example` は placeholder のみを置きます。
- session secret、setup token、service token、Observability token、DB password は raw 値を log / response / frontend に出しません。
