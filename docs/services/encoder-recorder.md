# Encoder/Recorder

Encoder/Recorder は AutoStream の media plane を担当します。Discord Bot と Worker から届く入力を受け、FFmpeg で YouTube RTMPS 出力、MKV 録画、MP4 package、Google Drive upload を実行します。

## 役割

- Discord Bot から Opus audio packet を受け取る。
- Worker から overlay / caption / participant / current-time event を受け取り、sidecar に保存する。
- FFmpeg で H.264 + AAC を生成し、YouTube RTMPS へ送信する。
- live 中は `final.mkv` に録画し、停止後に `final.mp4` へ remux する。
- archive directory を Google Drive API で upload する。
- progress、audio stats、archive metrics を Observability へ送る。

## Input Mode

`input_url` が空の stream start では Discord audio bridge mode になります。Encoder/Recorder は `tmp/{stream_id}/discord-opus.sdp` を作成し、Discord Bot から届く Opus packet を local RTP として FFmpeg に渡します。映像は黒背景の生成映像です。

外部入力を使う場合、Encoder/Recorder は FFmpeg 起動前に URL と host を検証します。literal IP と DNS 解決先が loopback、private、link-local、metadata host の場合は拒否します。

```text
AUTOSTREAM_REQUIRE_INPUT_ALLOWED_HOSTS=true
AUTOSTREAM_INPUT_ALLOWED_HOSTS=media.example.com,*.trusted-video.example.com
AUTOSTREAM_ALLOW_DIRECT_HLS_INPUT=false
```

HLS direct input は既定で無効です。FFmpeg が playlist、redirect、segment host を後から取得できるため、必要な場合だけ明示 opt-in してください。

DNS rebinding を完全に防ぐには、host allowlist に加えて container / OS firewall、egress deny、専用 media proxy、または network namespace で private / metadata / control-plane への egress を遮断してください。

## YouTube Output

標準運用では、YouTube output と stream key は Control Panel で管理します。Control Panel は stream start 時に `rtmp_url` と短命 runtime `stream_key` を Encoder/Recorder へ渡します。

本番では `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` を設定してください。この mode では `rtmp_url` / `stream_key` が payload にない start / dry-run を `youtube_runtime_config_required` として拒否し、`YOUTUBE_RTMP_URL` / `YOUTUBE_STREAM_KEY` env fallback を使いません。

互換用に既存 stream key mode は残します。YouTube Live API mode では Control Panel が broadcast / live stream を準備し、停止時に broadcast completion まで lifecycle に含めます。

## Audio Ingest

```text
POST /streams/{stream_id}/audio/opus
Authorization: Bearer <STREAM_INGEST_TOKEN_OR_ENCODER_AUDIO_TOKEN>
```

短命 `stream_ingest_token` を優先します。移行期間中に static token を使う場合は `ENCODER_DISCORD_AUDIO_TOKEN_SHA256` を設定し、Control Panel command token から分離してください。

状態確認:

```text
GET /streams/{stream_id}/audio-status
```

`bridge_active=true` かつ `packets_total=0` の場合、bridge は起動していますが Discord audio packet はまだ到着していません。

## Archive Layout

```text
/var/lib/autostream/archives/
  tmp/{stream_id}/
    final.mkv
    ffmpeg-progress.txt
    ffmpeg-audio-stats.txt
    discord-opus.jsonl
    discord-opus.sdp
    captions.vtt
    transcript.json
    metadata.json
    logs.jsonl
  final/{stream_id}/
    final.mp4
    captions.vtt
    transcript.json
    metadata.json
    logs.jsonl
```

live start 前に `final.mkv` は no-symlink regular file として予約されます。Package / upload / artifact report は symlink を追いません。

## Google Drive

標準運用では、Drive 設定は Control Panel の Drive destination、OAuth connected account、archive profile で管理します。Encoder/Recorder は stream job の `archive_config` を受け取り、folder ID、base path、`shared_drive`、OAuth credential を runtime config として使います。

Service Account mode も互換として残します。

```text
GOOGLE_DRIVE_AUTH_MODE=service_account
GOOGLE_APPLICATION_CREDENTIALS=/etc/autostream/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=<DRIVE_FOLDER_ID>
GOOGLE_DRIVE_SHARED_DRIVE=false
GDRIVE_BASE_PATH=AutoStream
```

共有ドライブの folder ID を使う場合は、Control Panel の Drive destination で `shared_drive=true` を指定します。Uploader は Drive API の list/create/upload に `supportsAllDrives=true` を指定します。

OAuth2 upload は env fallback ではなく Control Panel runtime config 経由で使います。refresh token は Control Panel で暗号化保存され、Encoder/Recorder へは stream job 実行時だけ渡されます。

`archive_config.auth_mode` がある場合、Encoder/Recorder は不足した Drive / OAuth secret を env から補完しません。不完全な Control Panel 設定は upload validation failure として扱います。
