# Host Deployment

このページは Encoder/Recorder を Linux host に直接配置する手順です。Docker でも同じ責務分離を維持します。

## ユーザーとディレクトリ

```bash
sudo useradd --system --home /var/lib/autostream/encoder-recorder --shell /usr/sbin/nologin autostream
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/encoder-recorder
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/archives
sudo install -d -o root -g root -m 0750 /etc/autostream
```

## 設定ファイル

`/etc/autostream/encoder-recorder.env` には bootstrap 設定だけを置きます。本番では YouTube stream key、Drive folder ID、OAuth refresh token、Google credential、webhook URL を env に置きません。Control Panel の YouTube Output、Drive Destination、OAuth Connected Account、Archive Profile から runtime config として渡します。

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_ENCODER_TOKEN>
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_encoder_recorder?parseTime=true
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_DATA_DIR=/var/lib/autostream/encoder-recorder
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
AUDIO_INGEST_MAX_PACKETS=150
AUDIO_INGEST_MAX_OPUS_BYTES=4096
AUDIO_INGEST_MAX_BODY_BYTES=1048576
FFMPEG_BIN=ffmpeg
TZ=Asia/Tokyo
```

## Output Relay

本番では FFmpeg に YouTube RTMPS URL と stream key を直接渡しません。FFmpeg は loopback relay へだけ出力します。

```text
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
```

relay は同一 host または同一 network namespace 内で待ち受け、Control Panel から渡される upstream YouTube RTMPS 情報を relay 側で保持します。Encoder/Recorder の `/preflight` は production で relay 未設定の場合に `output_relay=missing` を返し、stream start も fail closed します。

互換モードでは direct RTMPS target を FFmpeg argv に渡せますが、これは local/dev 用です。本番では使わないでください。

## systemd

`systemd/autostream-encoder-recorder.service.example` を `/etc/systemd/system/autostream-encoder-recorder.service` にコピーして調整します。

重要な hardening:

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/autostream
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
ProtectProc=invisible
ProcSubset=pid
```

`ProtectProc=invisible` と `ProcSubset=pid` は、同一 host 上の別 user から process details を見えにくくするための短期対策です。kernel / systemd の対応状況により使えない場合は、専用 container または `/proc hidepid=2` を検討してください。

## FFmpeg 停止と Package

`FFMPEG_STOP_GRACE_SEC` は stream stop 時に FFmpeg へ `q` を送り、`final.mkv` を壊さず正常終了を待つ秒数です。停止後は `final.mkv -> final.mp4 -> Google Drive upload` の順で package します。同一 stream の package は lock され、自動 retry と手動 retry が同時に処理されないようにします。

## Verification

```bash
systemctl daemon-reload
systemctl enable --now autostream-encoder-recorder
systemctl status autostream-encoder-recorder
curl -fsS http://127.0.0.1:8080/health
```

`/preflight` には bearer token が必要です。response には YouTube stream key、Google credential path、Drive folder ID、service token、access token を返しません。
