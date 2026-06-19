# Contracts

`autostream-contracts` は AutoStream 全体で使う API、event、schema、permission、service scope の wire format を固定する repository です。Control Panel、Discord Bot、Encoder/Recorder、Worker、Observability は、この contracts に合わせて request / response と status 名を扱います。

## 役割

- Control API と Observability API の OpenAPI を管理する。
- stream job、service registration、heartbeat、worker event、archive metadata、observability signal、notification channel などの JSON Schema を管理する。
- Go 実装で共有できる型と定数を `pkg/contracts` に置く。
- permission 名、service scope、error format を一元化する。
- raw secret や raw token を schema / example に含めない。

## 主な成果物

```text
openapi/
  control-api.yaml
  observability-api.yaml
schemas/
  archive-metadata.schema.json
  service-artifact-report.schema.json
  discord-audio-bridge-status.schema.json
  discord-opus-ingest.schema.json
  heartbeat.schema.json
  incident.schema.json
  notification-channel.schema.json
  notification-channel-write.schema.json
  registered-service.schema.json
  service-registration.schema.json
  service-runtime-config.schema.json
  service-runtime-secret-resolve-request.schema.json
  stream-job.schema.json
  worker-event.schema.json
pkg/contracts/
  types.go
  permissions.go
```

OpenAPI は外部連携とドキュメントの基準です。Go 型は各 service の実装で wire format を合わせるために使います。generated client は必要になった段階で追加します。

## URL Contract

分散構成では、各 service が同じ Docker network にいるとは限りません。URL field は実装と同じ制約で明示的に扱います。

- `public_url`: `http` または `https` の absolute URL のみ。
- `webhook_url`: write-only secret。response には raw URL を返さず、`masked_webhook_url` だけを返す。
- credential 付き URL は secret として扱い、schema example には載せない。

## 共通 Status

stream lifecycle:

```text
created
starting
live
stopping
completed
failed
```

service type:

```text
discord_bot
encoder_recorder
worker
observability
```

assignment role:

```text
primary
standby
```

## Service Token Scope

```text
service.register
service.heartbeat
service.logs.write
service.status.write
service.config.read
service.secret.resolve
worker.events.write
encoder.status.write
discord.status.write
observability.ingest
remediation.execute
```

`service.config.read` は自 service 用 runtime config の取得だけに使います。raw runtime secret の解決には `service.secret.resolve` が必要です。

`remediation.execute` は Observability が Control Panel 経由で安全な remediation を依頼するための scope です。通常の service registration token や user session では使いません。

## Worker Event

Worker から Encoder/Recorder へ送る標準 event type:

```text
overlay.current_time
overlay.participants
overlay.active_speaker
caption.telop
caption.final
```

event は Encoder/Recorder 側で archive sidecar に保存されます。caption event は `captions.vtt` と `transcript.json` に反映されます。

## Error Format

標準 error response:

```json
{
  "request_id": "req-01",
  "code": "permission_denied",
  "message": "Permission is required."
}
```

実装によっては互換維持のため `code` だけを返す endpoint があります。新規 API は `request_id`、`code`、`message` を返す形へ寄せます。

secret、credential path、stream key、access token、service token は error に含めません。

## Security

contracts の security section は、各 service が同じ wire format で secret を扱うための境界です。schema に raw provider 値を入れないだけでなく、write-only request field、masked response field、fingerprint field、configured status を分けることで、UI と evidence が同じ安全な表現を使えるようにします。

- schema、docs、example には placeholder だけを使います。
- Discord token、YouTube stream key、Google credential、webhook URL、service token は raw 値を返しません。
- `secrets.read_status` は configured / missing の状態確認だけを意味します。
- path、URL、subprocess argument に入る値は各 service 側でも validation します。

## Validation

contracts の validation は、schema と実装が同じ secret boundary を共有していることを確認するために実行します。Go test / build だけでなく、docs 側の `docs:check` と docs consistency checks で operator 向けの説明と evidence gate が古い schema 名を参照していないことも確認します。

contracts repo では次を実行します。

```powershell
go test ./...
go build ./...
```

docs 側は AutoStream docs repo で次を実行します。

```powershell
npm run docs:check
npm run docs:build
```

## 変更時の同期

contracts を変更した場合は、schema だけでなく、Control Panel handler、service producer/consumer、docs runbook、evidence checker を同じ意味に揃えます。新しい field が provider ID、URL、token、password、credential path を含む可能性がある場合は、write-only field、masked response field、fingerprint field を分け、example には placeholder だけを置きます。wire format が先に変わって docs が遅れると、外部確認の失敗時に operator が古い field 名を追うため、contracts change は docs/audit と一緒に検証します。
