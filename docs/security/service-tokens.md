# Service Tokens

Service token は Discord Bot、Encoder/Recorder、Worker、Observability が Control Panel と通信するための認証情報です。raw token は作成時または rotate 時に一度だけ表示し、保存時は hash 化します。

## 基本方針

- token は service type に紐づけます。
- token は scope で許可操作を分けます。
- raw token は log、audit log、API response、frontend、docs に残しません。
- service token はユーザー session とは別物です。
- 不要になった token は revoke します。

## Scope

| Scope | 用途 |
| --- | --- |
| `service.register` | service 起動時の登録、事前登録 service への token 紐付け |
| `service.heartbeat` | heartbeat 送信 |
| `service.logs.write` | service log / diagnostic log 送信 |
| `service.config.read` | 自 service 用 runtime config 取得 |
| `service.secret.resolve` | 許可済み runtime secret の短命解決 |
| `service.status.write` | service status / metrics update |
| `worker.events.write` | Worker から Control Panel への stream event |
| `encoder.status.write` | Encoder/Recorder から Control Panel への stream event / status |
| `discord.status.write` | Discord Bot から Control Panel への stream event / status |
| `observability.ingest` | Observability signal ingest / stream event |
| `remediation.execute` | Observability から Control Panel への safe remediation 実行依頼 |

`service.status.write` だけでは stream event を書き込めません。Worker event には `worker.events.write`、Encoder/Recorder event には `encoder.status.write`、Discord Bot event には `discord.status.write`、Observability event には `observability.ingest` が必要です。

## Runtime Config Boundary

`service.config.read` は runtime config の取得だけに使います。runtime config には stream assignment、profile の非 secret 設定、secret reference name が含まれますが、raw secret value は含まれません。

別 service の runtime config 取得は `403` です。Control Panel は token ID、service type、request の `service_id` を照合します。

## Runtime Secret Boundary

`service.secret.resolve` は runtime secret の短命解決にだけ使います。`service.config.read` だけの token では raw secret を取得できません。

raw secret を取得できる範囲は secret の種類で分けます。

- service-scoped secret: Discord Bot token のように特定 service の config に紐づく secret。対象 config の `service_id` と一致する service だけが解決できます。
- stream-scoped secret: Drive folder ID、OAuth provider client secret、OAuth refresh token、YouTube stream key、`encoder_runtime_secret_` prefix の Encoder/Recorder runtime secret のように stream job / selected profile に紐づく secret。対象 stream の primary assignment service だけが解決できます。
- standby service: failover により primary へ昇格するまで stream-scoped secret を解決できません。

runtime secret response は `Cache-Control: no-store` で返します。raw value を audit metadata、diagnostic report、logs、Control Panel UI、docs に残してはいけません。

本番環境では runtime secret resolve に HTTPS 経路が必要です。TLS 直結、または `AUTOSTREAM_TRUSTED_PROXIES` に含まれる reverse proxy からの `X-Forwarded-Proto: https` だけを許可します。HTTP 経路では `403 runtime_secret_transport_insecure` を返します。

Control Panel は server-side runtime secret lease を持ちます。同じ `service_id`、`stream_id`、`archive_profile_id`、`secret_name` の組み合わせを TTL 中に再解決すると、raw value ではなく `409 runtime_secret_lease_active` を返します。

token を rotate / reissue しても、同じ runtime secret context の active lease は回避できません。これは token 再発行によって短時間に raw secret を何度も取得することを防ぐためです。

## 運用ルール

1. Control Panel で service token を作成します。
2. raw token は service の bootstrap secret として一度だけ渡します。
3. service は token を使って register / heartbeat / runtime config を行います。
4. runtime secret が必要な service には `service.secret.resolve` scope を付けます。
5. 権限を縮めたい場合は token を rotate し、古い token を revoke します。

rotation 中も raw token を PowerShell output、Docker log、docs に出さないでください。
