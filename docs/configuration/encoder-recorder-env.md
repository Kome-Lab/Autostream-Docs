# Encoder/Recorder 環境変数

Encoder/Recorder は Control Panel から stream job を受け取り、FFmpeg 配信、MKV 録画、MP4 package、archive upload を担当します。本番では YouTube output、Drive destination、Discord/Worker 連携先を Control Panel で管理し、env は bootstrap と local fallback に限定します。

## 基本設定

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com
SERVICE_VERSION=0.1.0
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
CONTROL_PANEL_HEARTBEAT_INTERVAL_SEC=30
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_ENCODER_TOKEN>
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_encoder_recorder?parseTime=true
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_DATA_DIR=/var/lib/autostream/encoder-recorder
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
TZ=Asia/Tokyo
```

`CONTROL_PANEL_TOKEN` は register、heartbeat、runtime config 取得、runtime secret 解決に使う service token です。YouTube stream key、Drive folder ID、OAuth refresh token などを Control Panel 管理にする場合は `service.secret.resolve` scope も必要です。

## Production Output Relay

本番では FFmpeg に YouTube RTMPS URL と stream key を直接渡しません。Encoder/Recorder は loopback relay URL だけを FFmpeg argv に渡し、relay 側が YouTube ingest へ転送します。

```text
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
```

`AUTOSTREAM_OUTPUT_RELAY_URL` は `rtmp://127.0.0.1/...` または `rtmp://localhost/...` のような loopback RTMP(S) URL にしてください。userinfo、query、fragment に credential を入れてはいけません。`{stream_id}` を含めると stream ごとの relay path に置換されます。

## Ingest Token

```text
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<SAME_VALUE_AS_CONTROL_PANEL>
AUTOSTREAM_REQUIRE_SIGNED_INGEST_TOKENS=true
ENCODER_WORKER_EVENTS_TOKEN_SHA256=<SHA256_OF_WORKER_TO_ENCODER_EVENTS_TOKEN>
ENCODER_DISCORD_AUDIO_TOKEN_SHA256=<SHA256_OF_DISCORD_BOT_TO_ENCODER_AUDIO_TOKEN>
```

`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` は Control Panel と Encoder/Recorder だけに設定します。Worker と Discord Bot には置きません。

## FFmpeg / Input Policy

```text
FFMPEG_BIN=ffmpeg
FFMPEG_STOP_GRACE_SEC=5
AUTOSTREAM_REQUIRE_INPUT_ALLOWED_HOSTS=true
AUTOSTREAM_INPUT_ALLOWED_HOSTS=media.example.com,*.trusted-video.example.com
AUTOSTREAM_ALLOW_DIRECT_HLS_INPUT=false
```

外部 `input_url` を使う場合は `AUTOSTREAM_INPUT_ALLOWED_HOSTS` を設定してください。HLS direct input はデフォルトで無効です。

## YouTube 互換 fallback

```text
YOUTUBE_RTMP_URL=rtmps://example.youtube.com/live2
YOUTUBE_STREAM_KEY=<YOUTUBE_STREAM_KEY>
```

これは local/dev 互換用です。本番では YouTube output と stream key を Control Panel で管理し、start 時の短命 runtime secret として扱います。`YOUTUBE_STREAM_KEY` env fallback は external verification readiness で拒否します。

## Google Drive 互換 fallback

```text
GOOGLE_DRIVE_AUTH_MODE=service_account
GOOGLE_APPLICATION_CREDENTIALS=/etc/autostream/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=<DRIVE_FOLDER_ID>
GOOGLE_DRIVE_SHARED_DRIVE=false
GDRIVE_BASE_PATH=AutoStream
GOOGLE_DRIVE_UPLOAD_RETRY_MAX=5
GOOGLE_DRIVE_UPLOAD_RETRY_BASE_DELAY_SEC=2
```

通常運用では Drive destination を Control Panel で管理します。Service Account mode を互換で使う場合は、対象 Drive folder を Service Account email に共有してください。共有ドライブ folder ID を使う場合は `GOOGLE_DRIVE_SHARED_DRIVE=true` を設定します。

## Observability

```text
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<OBSERVABILITY_INGEST_TOKEN>
OBSERVABILITY_TIMEOUT_SEC=5
ENCODER_METRICS_INTERVAL_SEC=10
ENCODER_AUDIO_SILENCE_THRESHOLD_DB=-50
ENCODER_AUDIO_CLIPPING_THRESHOLD_DB=-1
AUDIO_INGEST_TIMEOUT_SEC=5
AUDIO_INGEST_METRICS_INTERVAL_SEC=5
```

metrics と error detail に raw secret を含めてはいけません。

## 運用証跡

Encoder/Recorder の env 確認では、bootstrap env と Control Panel managed runtime config を分けて記録します。`SERVICE_ID`、`CONTROL_PANEL_URL`、token hash、archive directory、relay required flag は bootstrap readiness として扱い、YouTube output、Drive destination、Discord audio route、stream ingest token は runtime config と completion record 側で確認します。

本番で env を変更した場合は、service registration、runtime config fetch、output relay preflight、archive directory permission、Drive upload mode を順に確認します。raw stream key、Google credential JSON、Drive folder ID、runtime ingest token は docs や logs に残さず、configured 状態、masked value、fingerprint、probe summary だけを残します。

## 変更時の rollback

Encoder/Recorder の env 変更は media path に直接影響するため、rollback では古い env を戻すだけで完了にしません。Control Panel の assigned service、runtime config version、output relay readiness、`final.mkv` byte delta、`final.mp4` remux、Drive upload attempt を同じ stream ID で確認します。credential を local fallback へ戻した場合は一時対応として記録し、Control Panel managed destination へ戻す follow-up を残します。
