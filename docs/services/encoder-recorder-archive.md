# Archive Flow

Encoder/Recorder は配信中に `final.mkv` を安全に記録し、停止後または retry 時に `final.mp4` へ remux して Google Drive へ upload します。通常運用では Drive 設定を Encoder/Recorder の env に置かず、Control Panel の Archive Profile、Drive Destination、OAuth Connected Account から stream ごとの `archive_config` として受け取ります。

## Local Layout

```text
AUTOSTREAM_ARCHIVE_DIR/
  tmp/
    {stream_id}/
      final.mkv
      captions.vtt
      transcript.json
      metadata.json
      logs.jsonl
  final/
    {stream_id}/
      final.mp4
      captions.vtt
      transcript.json
      metadata.json
      logs.jsonl
```

`stream_id` は path traversal を避けるため、`..`、`/`、`\` を含められません。生成物は `AUTOSTREAM_ARCHIVE_DIR` 配下に限定されます。

## Start Payload

Control Panel から `/streams/start` を受けたとき、stream に Archive Profile が設定されていれば `archive_config` が含まれます。

```json
{
  "stream_id": "stream-01",
  "name": "Morning Stream",
  "rtmp_url": "rtmps://example.youtube.com/live2",
  "stream_key_secret_name": "youtube_stream_key_runtime_stream-01",
  "archive_config": {
    "drive_destination_id": "drive-destination-01",
    "archive_profile_id": "archive-profile-01",
    "auth_mode": "oauth2",
    "oauth_account_id": "oauth-account-01",
    "oauth_provider_id": "provider-01",
    "folder_id_secret_name": "drive_destination:drive-destination-01:folder_id",
    "base_path": "AutoStream",
    "shared_drive": true,
    "client_id": "<GOOGLE_OAUTH_CLIENT_ID>",
    "client_secret_secret_name": "oauth_provider:provider-01:client_secret",
    "refresh_token_secret_name": "oauth_account:oauth-account-01:refresh_token"
  }
}
```

YouTube stream key、Drive folder ID、OAuth client secret、refresh token は raw 値として response、metadata、logs、Observability signal に出しません。Encoder/Recorder は start/package の直前に Control Panel の runtime secret API で必要な値だけを解決します。

`archive_config.auth_mode` が指定された場合、Encoder/Recorder は Google Drive / OAuth の不足値を `GOOGLE_DRIVE_*` や `GOOGLE_OAUTH_*` env から補完しません。不足している runtime secret は upload validation failure として扱います。env fallback は `archive_config` がない古い local 検証用途だけに残します。

## Package API

```http
POST /streams/package
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "stream_id": "stream-01",
  "name": "Morning Stream",
  "started_at": "2026-05-29T01:02:03Z",
  "dry_run": false,
  "archive_config": {
    "drive_destination_id": "drive-destination-01",
    "archive_profile_id": "archive-profile-01",
    "auth_mode": "oauth2",
    "oauth_account_id": "oauth-account-01",
    "oauth_provider_id": "provider-01",
    "folder_id_secret_name": "drive_destination:drive-destination-01:folder_id",
    "base_path": "AutoStream",
    "shared_drive": true,
    "client_id": "<GOOGLE_OAUTH_CLIENT_ID>",
    "client_secret_secret_name": "oauth_provider:provider-01:client_secret",
    "refresh_token_secret_name": "oauth_account:oauth-account-01:refresh_token"
  }
}
```

`/streams/package` は Control Panel の `retry-upload` または Observability remediation 経由で呼び出されます。Control Panel は対象 stream の Archive Profile と Drive Destination を解決し、start と同じ `archive_config` を Encoder/Recorder へ渡します。

## Observability Signals

package 成功時は次の metrics / event を Observability に送ります。

- `archive.package_status=1`
- `archive.final_mp4_exists=1`
- `recorder.remux_duration_ms`
- `gdrive.upload_status=1`
- `gdrive.upload_retry_count`
- `gdrive.upload_duration_sec`
- `gdrive.upload_file_count`
- `gdrive.upload_folder_fingerprint_present`
- `gdrive.upload_final_mp4_fingerprint_present`
- `gdrive.upload_metadata_fingerprint_present`
- `archive.package.completed`

失敗時は `archive.package_status=0` または `gdrive.upload_status=0` と、`failure_phase` / `error_class` を送ります。raw error、credential、token、URL、host 絶対 path は送信しません。

## Failure Classification

| phase | 主な意味 | 主な signal |
| --- | --- | --- |
| `input` | `final.mkv` がない、または source file を安全に読めない | `archive.package_status=0` |
| `remux` | FFmpeg remux 失敗、`final.mp4` 未作成 | `archive.package_status=0` |
| `package` | sidecar copy、logs、metadata 準備失敗 | `archive.package_status=0` |
| `upload` | Google Drive upload または metadata upload 失敗 | `archive.package_status=1`, `gdrive.upload_status=0` |

Control Panel の `retry-upload` は、対象 stream に primary `encoder_recorder` assignment がある場合だけ `/streams/package` を dispatch します。Archive Profile が stream に設定されていれば、retry でも同じ Drive Destination と shared drive / OAuth 設定が使われます。
