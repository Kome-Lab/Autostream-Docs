# Security

Encoder/Recorder は media process、archive file、Google Drive upload、runtime secret を扱うため、最小権限と secret redaction を前提に運用します。

## Secret Boundary

- YouTube stream key、OAuth refresh token、Google credential、Drive folder ID、service token は logs、metadata、API response、Observability signal に出しません。
- Control Panel から受け取る runtime secret は stream/profile/service assignment を検証した後だけ使います。
- raw secret を返す endpoint は作りません。status は configured/missing/fingerprint のみです。

## FFmpeg Process

FFmpeg は shell 文字列ではなく argument array で起動します。外部入力 URL、archive path、filter args は検証し、archive root 外への書き込みや symlink を拒否します。

本番では `AUTOSTREAM_ENV=production` と `AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true` を設定し、FFmpeg argv には loopback relay URL だけを渡します。YouTube stream key と upstream RTMPS URL は relay 側だけが保持し、FFmpeg argv には出しません。

```text
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
```

relay 未設定の本番環境では `/preflight` と stream start が fail closed になります。互換モードでは direct RTMPS target を FFmpeg に渡せますが、これは local/dev 用です。

## Process Visibility

HTTP API と Observability event には FFmpeg PID を返しません。systemd では可能な範囲で次を使います。

```ini
ProtectProc=invisible
ProcSubset=pid
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/autostream
```

共有 shell access を禁止し、Encoder/Recorder は専用 user/container で実行してください。

実行中 process の内部管理には tracked process state を使います。外部へ返す status では PID や raw command を公開せず、operator が必要な状態だけを表示します。

## Archive Safety

- `final.mkv` は live 中の安全な録画形式として使います。
- `final.mp4` への remux は一時ファイルへ出力してから置換します。
- archive directory と archive files の symlink を拒否します。
- artifact report には relative path、size、fingerprint だけを送り、host 絶対 path や Drive raw ID を送りません。

## Google Drive Upload

Google Drive upload は Service Account mode と Control Panel managed OAuth destination を扱います。共有ドライブでは `supportsAllDrives=true` を使います。refresh token、client secret、credential JSON は logs や audit metadata に含めません。

stream job に `archive_config.auth_mode` が含まれる場合、Encoder/Recorder はその設定を優先し、不足している Drive / OAuth secret を env から補完しません。Control Panel から渡された `archive_config` が不完全なら upload validation failure として扱います。

## Network Policy

- service endpoint は Control Panel、Discord Bot、Worker からの必要通信だけを許可します。
- production output relay は loopback に閉じます。
- external media input を許可する場合は `AUTOSTREAM_INPUT_ALLOWED_HOSTS` を設定します。

## Verification

変更後は少なくとも次を実行します。

```powershell
go test ./...
go build ./...
```

関連 docs を更新した場合は `autostream-docs` で次も実行します。

```powershell
npm run docs:check
npm run docs:check
npm run docs:build
```
