# Google Drive upload のトラブルシュート

AutoStream は Google Drive API で archive を upload します。通常運用では Drive 設定を env に置かず、Control Panel の OAuth connected account、Drive destination、archive profile で管理します。`rclone` は通常経路では使いません。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| archive profile | stream に archive profile が設定されている |
| Drive destination | `auth_mode`、folder ID、base path、`shared_drive` が Control Panel で設定されている |
| OAuth account | `oauth2` mode では Google connected account が Drive scope を持つ |
| Service Account | `service_account` mode では credential secret が設定され、対象 folder が service account email に共有されている |
| runtime config | dispatch payload に `archive_config` が含まれ、raw folder ID / refresh token / credential JSON は含まれていない |
| source file | `final/{stream_id}/final.mp4` または `tmp/{stream_id}/final.mkv` が存在する |
| retry | Control Panel の `retry-upload`、Observability incident、Encoder/Recorder の `logs.jsonl` を確認する |

`archive_config.auth_mode` が stream job に含まれる場合、Encoder/Recorder は Google Drive / OAuth の不足値を `GOOGLE_DRIVE_*` や `GOOGLE_OAUTH_*` env から補完しません。不完全な Control Panel 設定は upload validation failure として扱います。

## OAuth destination で失敗する

1. Control Panel の OAuth provider が Google 用で、Drive scope を含むことを確認します。
2. OAuth connected account の refresh token が configured になっていることを確認します。
3. Drive destination の `oauth_account_id` が正しい account を指していることを確認します。
4. folder ID が対象 account からアクセスできる folder か確認します。
5. 共有ドライブの folder ID を使う場合は `shared_drive=true` を設定します。

OAuth refresh token、client secret、folder ID は API response、UI、audit metadata、logs に raw 値として出しません。Control Panel では configured、masked、fingerprint だけを確認してください。

## Service Account destination で permission error になる

1. Service Account JSON の `client_email` を確認します。
2. Google Drive の対象 folder に、その email が共有されていることを確認します。
3. Drive destination の folder ID が共有済み folder の ID か確認します。
4. 共有ドライブを使う場合は、対象 folder への権限と `shared_drive=true` を両方確認します。

Service Account JSON の中身をログ、チャット、スクリーンショットに貼らないでください。Control Panel には secret として保存し、Encoder/Recorder には runtime secret API 経由で短時間だけ渡します。

## 共有ドライブ folder ID で失敗する

共有ドライブの folder ID を使う Drive destination では `shared_drive=true` が必要です。Encoder/Recorder の Google Drive uploader は Drive API の list/create/upload で `supportsAllDrives=true` を使い、folder list では `includeItemsFromAllDrives=true` も使います。

確認する項目:

- Drive destination の `shared_drive=true`
- 対象 OAuth account または Service Account の共有ドライブ権限
- folder ID が共有ドライブ内の folder を指していること
- `archive_config.shared_drive=true` が Encoder/Recorder に渡っていること

## upload が途中で失敗する

大きい `final.mp4` では transient failure が起きることがあります。

1. Encoder/Recorder の `logs.jsonl` で retry 回数と error class を確認します。
2. Observability の `gdrive.upload_status`、`gdrive.upload_retry_count`、`gdrive.upload_progress_percent`、`gdrive.upload_file_count`、`gdrive.upload_folder_fingerprint_present`、`gdrive.upload_final_mp4_fingerprint_present`、`gdrive.upload_metadata_fingerprint_present` を確認します。
3. Control Panel から `retry-upload` を実行します。
4. `archive_config` が retry 時にも再生成され、start 時と同じ Drive destination を指していることを確認します。

retry でも同じ folder に再 upload します。raw token や raw folder ID を手動で渡す運用にはしないでください。

## `final.mp4` が存在しない

Google Drive upload ではなく package / remux の失敗です。

1. `tmp/{stream_id}/final.mkv` が残っているか確認します。
2. Encoder/Recorder の remux log と `metadata.json` の package phase を確認します。
3. source file が intact なら `retry-upload` を実行し、package から再試行します。

`captions.vtt` と `transcript.json` は optional です。存在しない場合でも `final.mp4`、`metadata.json`、`logs.jsonl` の upload は継続できる設計です。

## metadata を確認する

upload 成功後、`metadata.json` では raw secret ではなく安全な summary を確認します。

- `archive_config.auth_mode`
- `archive_config.shared_drive`
- `archive_config.folder_id_configured`
- `archive_config.client_secret_configured`
- `archive_config.refresh_token_configured`
- upload result の folder / file ID

raw access token、refresh token、Service Account JSON、stream key、credential 付き URL は metadata に含めません。

## 復旧後の確認

Google Drive upload の復旧後は、Drive 側の画面で見えたことだけではなく、Control Panel artifact、Encoder/Recorder metadata、Observability upload signal が同じ stream ID と fingerprint を指していることを確認します。folder/file ID は raw で残さず、upload attempt と per-file fingerprint を evidence にします。

- Drive 上に `AutoStream/{stream_name}/{started_at_jst}_{stream_id}/` が作成されている
- expected files が upload 済み
- Control Panel の stream artifacts が更新されている
- Observability incident が mitigated / resolved になっている
- Audit Logs に `retry-upload` 操作が記録されている
