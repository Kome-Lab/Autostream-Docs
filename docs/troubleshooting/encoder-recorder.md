# Encoder/Recorder のトラブルシュート

Encoder/Recorder は、入力の受信、FFmpeg による H.264/AAC 出力、YouTube RTMPS、`final.mkv` 録画、`final.mp4` package、Google Drive upload を担当します。ここでの障害は live stream と archive の両方に影響します。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| service health | Control Panel の `Service Health` で Encoder/Recorder が online |
| assignment | 対象 stream に正しい Encoder/Recorder が割り当てられている |
| token | Control Panel の `SERVICE_CALL_TOKEN` と service 側 `SERVICE_CONTROL_TOKEN_SHA256` が対応している |
| FFmpeg | `FFMPEG_BIN` が実行可能 |
| archive path | `/var/lib/autostream/archives` に `autostream` user が書き込める |
| Observability | `encoder.process_alive`、`recorder.file_size_bytes`、`recorder.disk_free_bytes` が届いている |

## start が失敗する

主な原因は dispatch token、入力 URL、YouTube 設定、FFmpeg 実行権限です。

1. Control Panel の stream log で dispatch error を確認します。
2. Encoder/Recorder の `GET /health` と `GET /status` を確認します。
3. `SERVICE_CONTROL_TOKEN_SHA256` を再計算し、Control Panel の `SERVICE_CALL_TOKEN` と対応しているか確認します。
4. `FFMPEG_BIN` が PATH 上にあるか、絶対パスで設定されているか確認します。
5. YouTube RTMPS URL と stream key が設定済みか確認します。raw stream key はログに出さないでください。

FFmpeg は shell 文字列ではなく argument array で起動する必要があります。任意の shell command を設定値として受け付けないでください。

## live 中に止まる

次の metrics と incident を確認します。

- `encoder.process_alive`
- `encoder.output_fps`
- `encoder.output_bitrate_kbps`
- `encoder.dropped_frames_total`
- `encoder.rtmp_reconnect_count`
- `recorder.write_bitrate_kbps`
- `recorder.disk_free_bytes`
- `media.input_timeout_sec`

`encoder.rtmp_reconnect_count` が増え続ける場合は、YouTube 側、ネットワーク、bitrate 過大を優先して確認します。`recorder.write_bitrate_kbps` が 0 に近い場合は、archive directory の権限、disk full、FFmpeg 出力を確認します。

## 音声が無音または途切れる

Control Panel の Streams 画面にある `Discord audio bridge` と、Observability の `Audio / Input Health` を確認します。

- `bridge_active`: Encoder/Recorder の local RTP/SDP bridge が起動しているか
- `packets_total`: Encoder/Recorder が受け取った Discord Opus packet 数
- `rtp_forwarded`: FFmpeg へ local RTP として渡した packet 数
- `last_packet_age_sec`: 最後に到着した packet からの経過秒数
- `discord.audio_receiving`: Discord Bot から Opus packet が届いているか
- `discord.audio_packets_total`: packet が増えているか
- `encoder.audio_level_db`: FFmpeg 出力側の音声レベル
- `encoder.audio_silence_sec`: 無音が継続している秒数
- `encoder.audio_clipping_total`: クリッピング検知回数
- `media.input_timeout_sec`: FFmpeg progress または audio ingest の更新停止秒数

`discord.audio_receiving=0` の場合は Discord Bot、token、`encoder_audio_url` を確認します。`discord.audio_receiving=1` でも `encoder.audio_silence_sec` が増える場合は、音声 routing、mute、FFmpeg audio mapping を確認します。

`bridge_active=true` でも `packets_total=0` の場合は、bridge は起動していますが Discord Bot から packet が到着していません。Discord Bot の VC 参加、`ENCODER_AUDIO_TOKEN`、Encoder/Recorder の `SERVICE_PUBLIC_URL`、Control Panel の service assignment を確認してください。

## `final.mkv` が作成されない

1. `AUTOSTREAM_DATA_DIR` と archive path が期待通りか確認します。
2. service user が `/var/lib/autostream/archives/tmp/{stream_id}` を作成できるか確認します。
3. FFmpeg stderr に muxer / output path error が出ていないか確認します。
4. Observability の `recorder_not_writing` incident を確認します。

live 中は MP4 のみへ直接録画しないでください。安全な既定フローは `final.mkv` への録画です。

## stop 後に `final.mp4` が作成されない

`stopping` のまま止まる、または `failed` になる場合は remux / package の失敗を疑います。

1. `tmp/{stream_id}/final.mkv` が残っているか確認します。
2. `logs.jsonl` で remux の exit code を確認します。
3. `final/{stream_id}/final.mp4` の作成権限を確認します。
4. source file が intact なら Control Panel から `retry-upload` を実行します。

`retry-upload` は、必要に応じて package と upload を再実行します。source file を削除してから再実行しないでください。

## metadata / logs の確認

`metadata.json` には少なくとも次が残っている必要があります。

- stream ID
- stream name
- JST started / completed timestamp
- local archive paths
- Google Drive folder / file IDs
- package / upload status

`logs.jsonl` は structured log として扱い、secret を含めないでください。YouTube stream key、Google access token、service token、webhook URL は出力禁止です。

## 復旧後の確認

Encoder/Recorder の復旧後は、process が再起動したことだけでなく、同じ stream ID の media / archive / upload evidence が揃ったかを確認します。raw FFmpeg argv、RTMPS URL、Drive file ID、local absolute path は共有せず、logical path、byte count、duration、fingerprint、failure class を使って復旧を記録します。

- Control Panel の stream status が期待する状態に戻っている
- `final.mp4` が `final/{stream_id}` に存在する
- Google Drive upload が完了している
- Observability incident が `resolved` または `mitigated` になっている
- Audit Logs に stop / retry / remediation 操作が残っている
