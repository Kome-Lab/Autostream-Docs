# Google Drive Upload

AutoStream は配信停止後に `final.mkv` を `final.mp4` へ remux し、archive directory 一式を Google Drive API でアップロードします。通常運用では Drive folder ID、OAuth refresh token、Service Account JSON を Encoder/Recorder の env に置かず、Control Panel の Integration / Archive Profile で管理します。

## Upload Modes

推奨 mode:

- `auth_mode=oauth2`
- Control Panel managed Google OAuth connected account
- Control Panel managed Drive destination
- 共有ドライブを使う場合は `shared_drive=true`

互換 mode:

- `auth_mode=service_account`
- Control Panel secret に保存した Service Account credential JSON
- または direct host 互換用の `GOOGLE_APPLICATION_CREDENTIALS`
- 対象 Drive folder を Service Account の `client_email` に共有

どちらの mode でも、raw access token、refresh token、client secret、Drive folder ID、credential JSON、private key は public API response、audit metadata、logs、docs、screenshots に出しません。

## Runtime Config

Control Panel は stream start と retry-upload の dispatch payload に `archive_config` を入れます。Secret は raw 値ではなく runtime secret reference として渡され、primary assigned Encoder/Recorder だけが Control Panel へ解決要求できます。

OAuth2 の例:

```json
{
  "archive_profile_id": "archive-profile-01",
  "drive_destination_id": "drive-destination-01",
  "auth_mode": "oauth2",
  "base_path": "AutoStream",
  "shared_drive": true,
  "folder_id_secret_name": "drive_destination:drive-destination-01:folder_id",
  "client_id": "<GOOGLE_OAUTH_CLIENT_ID>",
  "client_secret_secret_name": "oauth_provider:google-drive:client_secret",
  "refresh_token_secret_name": "oauth_account:google-drive-account-01:refresh_token"
}
```

Service Account の例:

```json
{
  "archive_profile_id": "archive-profile-01",
  "drive_destination_id": "drive-destination-01",
  "auth_mode": "service_account",
  "base_path": "AutoStream",
  "shared_drive": true,
  "folder_id_secret_name": "drive_destination:drive-destination-01:folder_id",
  "service_account_credentials_secret_name": "google_drive_credentials"
}
```

`service_account_credentials_secret_name` は Service Account credential JSON を指す secret 名です。後方互換として `service_account_json_secret_name` も受け付けますが、新規設定では `service_account_credentials_secret_name` を使います。

## Shared Drive

共有ドライブの folder ID を使う Drive Destination では `shared_drive=true` を設定します。Encoder/Recorder の Google Drive uploader は list/create/upload で `supportsAllDrives=true` を使い、folder list では `includeItemsFromAllDrives=true` も使います。

Service Account mode で共有ドライブへ upload する場合、対象 folder を Service Account の `client_email` に共有してください。Domain-wide delegation を使わない限り、共有されていない folder へは upload できません。

## Metadata

`metadata.json` には upload の結果と安全な summary だけを残します。Drive folder ID や file ID の raw 値は metadata summary に保存しません。Archive paths are stored as logical artifact names and relative archive paths.

保存する情報:

- `upload.dry_run`
- `upload.attempts`
- `upload.file_count`
- `upload.folder_id_configured`
- `upload.folder_id_fingerprint`
- `upload.file_fingerprints`
- `archive_config.auth_mode`
- `archive_config.shared_drive`
- `archive_config.folder_id_configured`
- `archive_config.service_account_json_configured`
- `archive_config.client_secret_configured`
- `archive_config.refresh_token_configured`

保存しない情報:

- raw Drive folder ID
- raw Drive file ID
- access token
- refresh token
- client secret
- private key
- credential JSON
- host の absolute archive path

## Retry

stream に Archive Profile が設定されている場合、Control Panel は retry-upload 時も同じ Drive Destination を解決し、start と同じ `archive_config` を `/streams/package` へ渡します。これにより Encoder/Recorder の env fallback ではなく、stream ごとの OAuth destination / Service Account destination / 共有ドライブ設定で再 upload できます。

retry が成功した場合、Control Panel の artifact report は同じ stream、kind、name の情報を更新します。metadata は raw ID ではなく configured status と upload count を更新します。

## Failure Checks

- OAuth connected account が configured になっているか。
- Drive destination の folder ID が configured になっているか。
- 共有ドライブでは `shared_drive=true` になっているか。
- Service Account mode では credential JSON secret が設定されているか。
- Service Account email が対象 folder に共有されているか。
- `final/{stream_id}/final.mp4` が存在するか。
- Observability の `gdrive.upload_status`、`gdrive.upload_retry_count`、`gdrive.upload_file_count`、`gdrive.upload_folder_fingerprint_present`、`gdrive.upload_final_mp4_fingerprint_present`、`gdrive.upload_metadata_fingerprint_present`、`archive.package.failed` incident を確認したか。

## Security

Drive upload の security 境界は、Control Panel の destination / connected account、Encoder/Recorder の archive artifact、Google provider 側の folder permission に分かれます。復旧や verification record では、raw Drive ID ではなく destination configured state、upload attempt、file count、fingerprint を使って同じ stream ID の upload を証明します。

- Drive folder ID は secret として扱い、repository に実値を書かないでください。
- OAuth refresh token と client secret は Control Panel の encrypted secret として保存してください。
- Service Account JSON は Git 管理外に置き、Control Panel secret または host local credential file として管理してください。
- verification record では folder ID や file ID ではなく、masked value または fingerprint を記録してください。
