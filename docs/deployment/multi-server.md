# マルチサーバー構成

AutoStream は Control Panel、Discord Bot、Encoder/Recorder、Worker、Observability を別々の VPS、VM、物理サーバー、container host に配置できます。同一 Docker network 上にいることを前提にしません。

## Source / ownership

各 host の `SERVICE_PUBLIC_URL` は operator が DNS / reverse proxy / firewall と合わせて決めます。`CONTROL_PANEL_TOKEN` と `OBSERVABILITY_TOKEN` は Control Panel または Observability の token management で generated し、raw value は bootstrap env / secret manager だけに置きます。Discord token、YouTube output、Drive destination、notification channel は Control Panel の Integration Registry / runtime config が source of truth で、個別 host の env file へ戻しません。

## 基本方針

- 各 service の `SERVICE_PUBLIC_URL` または `AUTOSTREAM_PUBLIC_URL` は、他 service から到達できる URL にします。
- Control Panel は service registry に保存された `public_url` へ start / stop / retry-upload などを dispatch します。
- `CONTROL_PANEL_URL`、`OBSERVABILITY_URL`、`ENCODER_RECORDER_URL` などの service URL は `http` または `https` の absolute URL のみ有効です。
- public internet に出す endpoint は、reverse proxy と TLS 終端を使って HTTPS 化してください。
- firewall は必要な inbound endpoint のみ許可します。MariaDB や内部管理 port は public に開けません。

## 共通環境変数

```text
SERVICE_ID=<SERVICE_ID>
SERVICE_NAME=<SERVICE_NAME>
SERVICE_PUBLIC_URL=https://service.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
TZ=Asia/Tokyo
```

Observability を使う service では次も設定します。

```text
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
```

Worker から Encoder/Recorder に event を送る場合は次を設定します。

```text
ENCODER_RECORDER_URL=https://encoder.example.com
ENCODER_RECORDER_TOKEN=<WORKER_TO_ENCODER_EVENTS_TOKEN>
```

## URL 検証

AutoStream の service client は、外向き接続先 URL を `http` / `https` に制限します。`ftp://`、`file://`、host のない URL、相対 path は拒否されます。

Control Panel から各 service への dispatch は、localhost、loopback、link-local、private IP、metadata endpoint を既定で拒否します。private network を使う場合は次を Control Panel に設定します。

```text
AUTOSTREAM_SERVICE_ALLOWED_HOSTS=encoder.internal.example,worker.internal.example
AUTOSTREAM_SERVICE_ALLOWED_CIDRS=10.40.0.0/16
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=encoder.example.com,worker.example.com,*.services.example.com
```

DNS 解決後のIPとredirect先も検証されます。Docker Desktopのlocal構成では `host.docker.internal` だけを明示許可します。

この制限は次の誤設定とリスクを減らします。

- Control Panel dispatch が意図しない scheme を使う。
- Observability proxy / signal 送信が非 HTTP endpoint を踏む。
- Worker event 転送が不正な Encoder/Recorder URL へ送信される。

## Secret

multi-server 構成では、bootstrap env、Control Panel encrypted secret、runtime lease、provider verification record の置き場所を分けます。service host には接続に必要な最小 token だけを置き、Discord / YouTube / Drive / notification の provider secret は Control Panel 管理へ寄せ、証跡では masked value と fingerprint だけを共有します。

## Operator Notes

マルチサーバー構成では、同じ token を複数 service に配る運用を避けます。Control Panel outbound token、service inbound dispatch hash、Worker event token、Encoder audio token、Observability ingest/admin token は用途ごとに分け、heartbeat と assignment で service identity を確認します。public URL は allowlist に入り、private network や loopback のまま provider-facing flow に使わないでください。

外部確認の準備では、各 host の env が a local ignored runtime directory と Control Panel export の状態に一致しているかを確認します。provider 実値は docs に貼らず、service URL reachability、fresh heartbeat、runtime config version、primary/standby assignment、archive directory permission、upload proof の fingerprint を evidence に残します。

service token、YouTube stream key、Google credential、webhook URL、DB password は raw 値で log、API response、docs、スクリーンショットに出しません。`.env.example` と docs は placeholder のみを使います。
