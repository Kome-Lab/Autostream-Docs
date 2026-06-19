# Docker Deployment

Docker Compose で Encoder/Recorder を起動する手順です。Docker Desktop でも CLI と Compose が使える場合はローカル検証に利用できます。本番では Control Panel から到達できる `SERVICE_PUBLIC_URL` と、専用の archive volume を用意してください。

## 起動

```bash
cp .env.example .env
cp relay/nginx-rtmp.conf.example relay/nginx-rtmp.conf
# relay/nginx-rtmp.conf の <YOUTUBE_STREAM_KEY> を本番値に置換する
docker compose -f docker-compose.prod.yml up -d
```

`relay/nginx-rtmp.conf` は Git 管理外です。実 stream key を compose file、README、docs、スクリーンショットに入れないでください。

## env の役割

本番では env を bootstrap に限定します。YouTube stream key、Google Drive folder ID、OAuth refresh token、Drive credential は Control Panel の YouTube Output、Drive Destination、OAuth Connected Account、Archive Profile で管理し、stream job の runtime config として Encoder/Recorder に渡します。

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com

CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_ENCODER_TOKEN>

ENCODER_WORKER_EVENTS_TOKEN_SHA256=<SHA256_OF_WORKER_TO_ENCODER_EVENTS_TOKEN>
ENCODER_DISCORD_AUDIO_TOKEN_SHA256=<SHA256_OF_DISCORD_BOT_TO_ENCODER_AUDIO_TOKEN>
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<SAME_VALUE_AS_CONTROL_PANEL>
AUTOSTREAM_REQUIRE_SIGNED_INGEST_TOKENS=true

OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
ENCODER_METRICS_INTERVAL_SEC=10
AUDIO_INGEST_MAX_PACKETS=150
AUDIO_INGEST_MAX_OPUS_BYTES=4096
AUDIO_INGEST_MAX_BODY_BYTES=1048576
FFMPEG_STOP_GRACE_SEC=5
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
```

`AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` の場合、Control Panel から `rtmp_url` / `stream_key` / archive config が渡されていない stream start は失敗します。古い env fallback が誤って使われることを防ぎます。

この失敗は `youtube_runtime_config_required` として扱われます。本番ではこの fail-closed 動作を維持し、YouTube stream key や Drive destination を env fallback で補完しないでください。

## Output Relay

`docker-compose.prod.yml` は `output-relay` sidecar を起動します。sidecar は `network_mode: service:encoder-recorder` を使い、Encoder/Recorder container と同じ network namespace で `127.0.0.1:1935` を待ち受けます。

FFmpeg が見る出力先:

```text
rtmp://127.0.0.1/autostream/{stream_id}
```

relay が YouTube へ転送する出力先:

```text
rtmps://a.rtmps.youtube.com/live2/<YOUTUBE_STREAM_KEY>
```

この分離により、FFmpeg process list には YouTube stream key が入りません。

## Volumes

archive directory は永続化してください。

```text
/var/lib/autostream/archives
```

配信中は `tmp/{stream_id}/final.mkv` に録画し、停止後に `final/{stream_id}/final.mp4` へ remux します。package は stream ごとに lock され、同一 stream の並行 package を拒否します。

## 互換 fallback

local/dev だけで次を使えます。本番では使わないでください。

```text
YOUTUBE_RTMP_URL=rtmps://example.youtube.com/live2
YOUTUBE_STREAM_KEY=<YOUTUBE_STREAM_KEY>
GOOGLE_DRIVE_AUTH_MODE=service_account
GOOGLE_APPLICATION_CREDENTIALS=/etc/autostream/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=<DRIVE_FOLDER_ID>
GOOGLE_DRIVE_SHARED_DRIVE=false
GDRIVE_BASE_PATH=AutoStream
```

## Security

- YouTube stream key、Google credential、OAuth refresh token、Drive folder ID、service token は log や API response に raw で出しません。
- Compose file には placeholder だけを置き、実 secret は Control Panel または Git 管理外の relay config で管理します。
- archive volume は Encoder/Recorder 専用にし、他 container / user が書き込めないようにします。
- package / upload / artifact report は archive 配下だけを扱い、symlink traversal を拒否します。
- Docker Desktop で local validation する場合も、実 Discord / YouTube / Google Drive credential は使わず、local stack 用 placeholder token だけを使ってください。
