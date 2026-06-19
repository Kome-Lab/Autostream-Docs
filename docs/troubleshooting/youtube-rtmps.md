# YouTube RTMPS のトラブルシュート

YouTube への最終出力は RTMPS、H.264、AAC、RTMP/FLV-compatible stream です。stream key は secret として扱い、ログや診断レポートに含めません。

本番経路では、YouTube output は Control Panel の Integration Registry が所有します。Encoder/Recorder は stream start 時に runtime config と runtime secret reference を受け取り、production では output relay を通して YouTube へ送ります。`YOUTUBE_RTMP_URL` や stream key を固定 env に戻すのは互換・切り分け用であり、外部確認のpass 条件にはしません。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| YouTube output | Control Panel の YouTube output が対象 stream に割り当てられているか |
| runtime config | Encoder/Recorder が `rtmp_url` と secret reference を runtime config として受け取っているか |
| relay | production で `AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true` と relay URL が有効か |
| codec | H.264 + AAC で出力しているか |
| bitrate | video bitrate が回線と YouTube 推奨値に対して過大でないか |
| keyframe | keyframe interval が 2 秒か |
| reconnect | `encoder.rtmp_reconnect_count` が増え続けていないか |

## 接続できない

1. YouTube Live 側で broadcast / stream が有効か確認します。
2. Control Panel の YouTube output が `live_api` / `rtmps` の期待 mode で、OAuth connected account または stream key secret reference が ready か確認します。
3. Encoder/Recorder host から outbound TCP 443 が許可されているか確認します。
4. output relay が起動しており、Encoder/Recorder の FFmpeg argv に upstream RTMPS URL や stream key が直接入っていないことを確認します。
5. firewall が relay から YouTube RTMPS への outbound を遮断していないか確認します。
6. FFmpeg log に authentication / handshake / TLS error がないか確認します。

stream key を含む完全な RTMPS URL をログに貼らないでください。

Control Panel start-readiness が YouTube output issue を返す場合は、Encoder/Recorder を再起動する前に Integration Registry の output record、OAuth account status、runtime `rtmp_url` の生成状態を確認します。service 側の env fallback で無理に上書きすると、証跡が Control Panel config confirmation と一致しなくなります。

## live 中に reconnect が続く

`encoder.rtmp_reconnect_count` が増え続ける場合は、ネットワーク品質、bitrate、encoder load を切り分けます。

確認する metrics:

- `encoder.output_bitrate_kbps`
- `encoder.output_fps`
- `encoder.dropped_frames_total`
- `encoder.encode_lag_ms`
- `host.cpu_percent`
- `host.network_tx_bps`
- `rtp.packet_loss_percent` または `srt.packet_loss_percent` がある場合は packet loss

bitrate が高すぎる場合は、Control Panel の Encoder Profile で video bitrate を下げます。既定目標は 1080p60 で 6-9Mbps ですが、実回線に合わせて調整します。

reconnect が 1 回だけで収束する場合と、一定間隔で増え続ける場合は扱いを分けます。継続する reconnect は YouTube 側 ingest、relay、host network、encoder load のいずれかで、`encoder.output_fps` と `host.network_tx_bps` が安定しているかを先に見ます。音声 packet が届いていない場合は RTMPS ではなく Discord Bot / audio ingest の問題として扱います。

## 映像または音声が YouTube 側で不正になる

出力は次を満たす必要があります。

```text
Video codec: H.264
Audio codec: AAC
Audio sample rate: 48kHz
Keyframe interval: 2 seconds
Container: RTMP/FLV-compatible
```

音声が出ない場合は、Discord Bot から Encoder/Recorder への音声入力、FFmpeg audio mapping、AAC encode 設定を確認します。

## stream key を交換した後に失敗する

1. Control Panel の YouTube output secret reference が新 key を指しているか確認します。
2. runtime config distribution が対象 stream と Encoder/Recorder primary assignment に反映されているか確認します。
3. output relay の設定を更新した場合は、relay process を reload/restart して古い upstream が残っていないか確認します。
4. dry-run / preflight で FFmpeg args の構造を確認します。ただし stream key は masked 表示で確認します。
5. 短時間の private/test 配信で YouTube 側の受信状態を確認します。

## 復旧後の確認

- YouTube Live Control Room で stream が正常受信されている。
- Control Panel の stream status が `live` または期待状態になっている。
- Observability に reconnect loop incident が残っていない。
- `encoder.output_fps` と `encoder.output_bitrate_kbps` が安定している。
- recorder 側の `final.mkv` も書き込まれている。

外部 verification record では、YouTube 側の `received_video=true` / `received_audio=true` 相当の provider verification record、Encoder/Recorder の reconnect count、`final.mkv` byte delta、`final.mp4` remux、Drive upload proof を同じ stream ID で残します。YouTube の画面 screenshot だけでは pass にせず、provider verification record と readiness check を通します。
