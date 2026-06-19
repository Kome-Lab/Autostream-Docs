# Service Registration

AutoStream の Discord Bot、Encoder/Recorder、Worker、Observability は Control Panel の service registry に登録してから運用します。各 service は別サーバー、別 VM、別 container host で動く前提です。

Control Panel は service ID、service type、service name、public URL、service token、scope、heartbeat、health status、stream assignment、runtime config、runtime secret の短命解決を管理します。

raw service token、Discord Bot token、YouTube stream key、Google OAuth refresh token、Drive folder ID、webhook URL、SMTP password は API、UI、audit log、diagnostic report、docs に表示しません。

## Source / ownership

`<CSRF_TOKEN>` は operator の Control Panel session から発行される browser/API 用 token で、docs や evidence に保存しません。`<SERVICE_TOKEN>` は Control Panel の API Tokens で generated される one-time secret です。service repo は raw token を所有せず、各 service の bootstrap env に置いた後は Control Panel の service registry と token binding が source of truth になります。runtime config、assignment、runtime secret lease は Control Panel が所有し、service は自分の `SERVICE_ID` に一致する configured state だけを取得します。

## 事前登録

管理者は Control Panel UI または API Tokens / Service Management API から service token を作成します。`service_id` を指定した場合、registry entry は `pending` 状態で作成されます。

```http
POST /api-tokens
X-CSRF-Token: <CSRF_TOKEN>
Content-Type: application/json
```

```json
{
  "service_type": "encoder_recorder",
  "scopes": [
    "service.register",
    "service.heartbeat",
    "service.config.read",
    "service.secret.resolve",
    "service.status.write",
    "encoder.status.write"
  ],
  "service_id": "encoder-recorder-01",
  "service_name": "Encoder Recorder 01",
  "public_url": "https://encoder.example.com",
  "version": "0.1.0",
  "capabilities": {
    "rtmps_output": true,
    "archive_package": true,
    "gdrive_upload": true,
    "discord_opus_ingest": true
  }
}
```

同じ `service_id` を別 token で奪うことはできません。Control Panel は token ID と service ID の対応を検証し、service takeover を拒否します。

## Register Service

service 起動後、自分用の service token で Control Panel に登録します。

```http
POST /services/register
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "service_id": "discord-bot-01",
  "service_type": "discord_bot",
  "service_name": "Discord Bot 01",
  "public_url": "https://discord-bot.example.com",
  "version": "0.1.0",
  "capabilities": {
    "discord_voice": true,
    "audio_forward": true,
    "runtime_config": true
  }
}
```

`public_url` は Control Panel から到達できる HTTP(S) URL に限定します。credential 付き URL、`file://`、`ftp://`、link-local / metadata address は使いません。

## Runtime Config

service は `service.config.read` scope 付き token で、自分用の runtime config を取得します。

```http
GET /services/runtime-config?service_id=discord-bot-01
Authorization: Bearer <SERVICE_TOKEN>
```

response は認証済み service 自身の registry entry、stream assignment、service に紐づく profile/config だけを含みます。別 service の config は返しません。runtime config は raw secret を返さず、Discord Bot token、Google OAuth refresh token、Drive folder ID、YouTube stream key は `*_secret_name` 参照として扱います。

この境界を cross-service runtime config rejection として扱います。request の `service_id`、token ID、service type が一致しない場合は `403` で拒否します。

## Runtime Secret Resolve

runtime secret の解決には `service.secret.resolve` scope が必要です。`service.config.read` だけでは raw secret を取得できません。

```http
POST /services/runtime-secrets/resolve
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "service_id": "encoder-recorder-01",
  "stream_id": "stream-01",
  "archive_profile_id": "archive-profile-01",
  "secret_name": "drive_destination_<ID>_folder_id"
}
```

Control Panel は次を検証します。

- token が request の `service_id` を所有していること。
- token の service type が registry entry と一致すること。
- secret name が対象 runtime config / stream profile に参照されていること。
- stream-scoped secret の場合、service が対象 stream の `primary` assignment であること。
- 本番環境では TLS 直結、または trusted proxy からの `X-Forwarded-Proto: https` 経路であること。

standby service は primary に昇格するまで stream-scoped secret を解決できません。

成功 response は `Cache-Control: no-store` 付きです。短時間 lease があり、同じ service/context/secret の連続解決は `409 runtime_secret_lease_active` になります。本番でHTTP経路から解決しようとした場合は `403 runtime_secret_transport_insecure` になります。

## Heartbeat

```http
POST /services/heartbeat
Authorization: Bearer <SERVICE_TOKEN>
```

heartbeat には `service.heartbeat` scope が必要です。Control Panel は `last_heartbeat_at`、`status`、`current_stream_id`、metrics を更新します。

## Artifact Report

Encoder/Recorder は archive package / upload 後に、公開可能な artifact 情報を Control Panel へ報告します。

```http
POST /services/stream-artifacts
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

この endpoint には `encoder.status.write` scope が必要です。Control Panel は service が対象 stream に割り当てられていることを検証し、assignment 外 service からの report を拒否します。

artifact path は archive directory 内の相対パスだけを扱います。raw local path、Google Drive folder ID、Google Drive file ID、OAuth token は response や audit metadata に残しません。

## Stream Assignment

stream ごとに Discord Bot、Encoder/Recorder、Worker を割り当てます。通常は `primary` を1台、必要に応じて `standby` を複数登録します。

stream start / stop / retry-upload は primary service のみへ dispatch します。必要 service が不足している場合は `409 missing_stream_assignments` を返し、dispatch しません。
