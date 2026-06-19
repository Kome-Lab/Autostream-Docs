# Google Drive API

AutoStream の archive upload は Google Drive API を直接使います。通常経路では `rclone` に依存しません。

## 推奨構成

MVP 標準は、Control Panel 管理の Google OAuth connected account と Drive destination です。

1. Control Panel で Google OAuth provider を登録します。
2. `Connect with OAuth` で Google account を connected account として登録します。
3. Drive destination を作成し、folder ID、base path、共有ドライブ利用有無を設定します。
4. archive profile で Drive destination を参照します。
5. stream start 時に Control Panel が Drive destination と OAuth account を解決し、Encoder/Recorder に runtime archive config を渡します。
6. Encoder/Recorder は env の folder ID ではなく、stream job の archive config で upload します。

refresh token、OAuth client secret、folder ID は暗号化して保存します。UI/API/audit/log では `configured`、`masked_folder_id`、`fingerprint`、runtime secret reference などの非生値だけを扱います。

## OAuth Destination

OAuth destination では、Control Panel が次の情報を stream start / retry-upload の内部 dispatch payload として Encoder/Recorder に渡します。

- `auth_mode=oauth2`
- `client_id`
- `client_secret_secret_name`
- `refresh_token_secret_name`
- `folder_id_secret_name`
- `base_path`
- `shared_drive`

raw `client_secret`、`refresh_token`、`folder_id` は frontend、public API response、audit metadata、docs、logs、Observability signal に出しません。

## 共有ドライブ

共有ドライブの folder ID を指定する場合、Drive destination で `shared_drive=true` を設定します。Uploader は Drive API の list/create/upload 呼び出しで `supportsAllDrives=true` を使います。

folder ID は secret として扱います。runbook や evidence に記録する必要がある場合は、先頭と末尾だけを残す masked value か fingerprint にしてください。

## Drive Destination の更新

Drive destination 作成時は `folder_id` が必須です。既存 destination の更新時は `folder_id` を省略すると既存の暗号化済み folder ID を保持します。folder ID を変更したい場合だけ、新しい `folder_id` を write-only 値として送信します。

## Service Account 互換 Mode

Service Account mode は互換として残します。Google Workspace 管理下で Service Account を使う場合は、対象 folder を Service Account の `client_email` に共有してください。

```text
GOOGLE_DRIVE_AUTH_MODE=service_account
GOOGLE_APPLICATION_CREDENTIALS=/etc/autostream/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=<DRIVE_FOLDER_ID>
GOOGLE_DRIVE_SHARED_DRIVE=false
GDRIVE_BASE_PATH=AutoStream
```

Service Account JSON の中身は Git、docs、logs、metadata、Control Panel UI、verification record に出しません。

## Archive Layout

Drive destination の base path が `AutoStream` の場合、upload 先は次の形です。

```text
AutoStream/
  {stream_name}/
    {started_at_jst}_{stream_id}/
      final.mp4
      captions.vtt
      transcript.json
      metadata.json
      logs.jsonl
```

`metadata.json` には upload attempts、retry count、remux duration、upload timestamps、Drive folder/file ID の fingerprint と file count を残します。raw Drive folder ID、raw Drive file ID、access token、refresh token、client secret、private key、credential JSON は保存しません。

## Readiness

外部確認では、まず dry-run upload で archive layout と metadata を確認します。その後、Google OAuth destination または Service Account destination を使って実 upload を確認します。

確認項目:

- Drive destination が `configured` になっている。
- OAuth destination では connected account と provider secret が configured になっている。
- `shared_drive=true` の場合、共有ドライブ folder ID を指定している。
- `final.mp4`、`metadata.json`、`logs.jsonl` が upload 対象に含まれる。
- logs と metadata に raw credential、raw folder ID、raw file ID が入っていない。
- metadata の `upload.folder_id_fingerprint`、`upload.file_count`、`upload.file_fingerprints` を verification record として確認できる。

## Troubleshooting

`permission` 系エラーが出る場合は、folder ID、共有ドライブ設定、OAuth account の権限、Service Account mode なら folder 共有設定を確認します。

共有ドライブ folder では必ず `shared_drive=true` にしてください。通常 Drive 呼び出しだけでは、folder が存在しないように見える場合があります。
