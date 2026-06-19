# Error Format

AutoStream の API error は、利用者が原因を判断できる情報を返しつつ、secret や内部 token を漏らさない形式にします。

## Standard Response

新規 API は次の形式を基準にします。

```json
{
  "request_id": "req-01",
  "code": "permission_denied",
  "message": "Permission is required."
}
```

既存 endpoint には互換性維持のため `code` だけ、または追加 field を返すものがあります。Frontend と外部 client は `code` を最優先で判定し、`message` は表示補助として扱います。

## Common Codes

```text
unauthorized
csrf_failed
permission_denied
invalid_request
validation_failed
not_found
invalid_service_registration
missing_stream_assignments
stream_start_not_ready
service_dispatch_failed
observability_not_configured
invalid_service_token
missing_service_scope
service_not_assigned_to_stream
secret_encryption_key_required
```

## Stream Readiness

stream start 前の readiness は、失敗時に service へ dispatch せず原因を返します。

```json
{
  "stream_id": "stream-01",
  "ready": false,
  "missing_service_types": ["discord_bot"],
  "issues": [
    {
      "service_type": "encoder_recorder",
      "code": "encoder_public_url_invalid",
      "message": "service public_url must be absolute HTTP(S) URL"
    }
  ]
}
```

`ready=false` の場合は、missing service、public URL、stale heartbeat、offline service、`SERVICE_CALL_TOKEN`、Encoder/Recorder preflight を確認します。

## Service Registration

service 登録 payload が不正な場合は `400 invalid_service_registration` を返します。

```json
{
  "code": "invalid_service_registration"
}
```

`public_url` は Control Panel から到達できる absolute HTTP(S) URL だけを受け付けます。`ftp://`、`file://`、相対 path、host のない URL は拒否されます。response には raw token や登録しようとした URL の詳細を含めません。

## Dispatch Failure

Control Panel から service へ command を送った結果は、service 単位の sanitized result として返します。

```json
{
  "code": "service_dispatch_failed",
  "dispatch": [
    {
      "service_id": "encoder-recorder-01",
      "service_type": "encoder_recorder",
      "endpoint": "/streams/package",
      "status_code": 400,
      "success": false,
      "code": "package_failed",
      "failure_phase": "upload",
      "error_class": "archive_upload_failed"
    }
  ]
}
```

`failure_phase` は次のいずれかです。

```text
input
remux
package
upload
unknown
```

`error_class` は運用者向けの分類です。例:

```text
archive_input_unavailable
ffmpeg_remux_failed
archive_package_failed
archive_upload_failed
service_unreachable
service_auth_failed
```

raw stack trace、credential path、access token、stream key は返しません。

## Service Token Error

service registration、heartbeat、stream event、remediation execute では bearer token を検証します。

```json
{
  "code": "missing_service_scope",
  "message": "Required service scope is missing."
}
```

service type と token scope が一致しない場合は拒否します。未割り当て stream への event は `service_not_assigned_to_stream` として扱います。

## Secret Handling

error response、audit metadata、dispatch result、diagnostic evidence には raw secret を含めません。次の値は必ず mask、または configured / missing の状態だけにします。

```text
DISCORD_BOT_TOKEN
DEEPGRAM_API_KEY
YOUTUBE_STREAM_KEY
GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_OAUTH_REFRESH_TOKEN
SERVICE_TOKEN
SERVICE_CALL_TOKEN
webhook URL
stream URL with credentials
```

## Frontend Handling

Frontend は raw upstream error をそのまま描画せず、HTTP status、`code`、`failure_phase`、`error_class`、対象 service ID を使って operator の次の確認先を示します。secret、provider URL、credential path、token は表示せず、configured / missing / masked の状態だけを扱います。

## Operational Notes

運用画面では `code` と `details` を、operator が次の確認先を選ぶための routing 情報として扱います。Control Panel UI は raw upstream response をそのまま表示せず、stream ID、service ID、failure phase、retryable flag、masked destination だけを表示します。実装 repository 側で新しい error code を追加した場合は、同じ変更で frontend 表示、audit log、runbook の triage 表を更新してください。

外部確認の記録 では、error response が出た事実を失敗証跡として残せますが、provider URL、Discord ID、Drive ID、token、password、credential path は記録しません。readiness check は error code が解消され、同一 `stream_id` の media / archive / upload proof が揃った場合だけ pass にします。

Frontend は HTTP status と `code` の両方を見ます。

- `401`: login 画面へ誘導します。
- `403`: 権限不足として表示します。
- `409 stream_start_not_ready`: readiness issue をそのまま表示し、service へ dispatch されていないことを明示します。
- `502 service_dispatch_failed`: 対象 service、endpoint、`failure_phase`、`error_class` を表示します。

message は将来変わる可能性があるため、分岐条件には使わないでください。

## 変更時の同期

新しい error code を追加したら、Control Panel UI、service response、contracts schema、runbook、evidence checker を同じ変更単位で確認します。operator が見る画面には、どの repo が次の修正先か分かる `service_type`、`failure_phase`、`error_class`、request ID を残します。外部 provider から返された本文をそのまま message に入れず、secret-safe な category と retryability に変換してから返します。
