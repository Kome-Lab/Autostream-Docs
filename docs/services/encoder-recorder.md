# Encoder Recorder

Encoder Recorder は AutoStream の media 処理を担当します。Discord 音声、Worker のイベント、外部映像入力を受け取り、FFmpeg で配信と録画を行います。

## 役割

- stream job の start / stop / retry-upload
- Discord 音声の ingest
- Worker event の保存
- FFmpeg による live output
- MKV 録画と MP4 化
- Google Drive など保存先への upload
- metric と failure signal の送信

## host側で必要なもの

- `ffmpeg`
- 録画保存用ディレクトリ
- 一時ファイル用ディレクトリ
- 十分なディスク容量
- output relay を使う場合の nginx-rtmp、SRS など

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `SERVICE_ID` | Encoder Recorder を識別する ID |
| `CONTROL_PANEL_URL` | Control Panel の URL |
| `CONTROL_PANEL_TOKEN` | service registration 用 token |
| `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | stream scoped token の署名 |
| `AUTOSTREAM_DATA_DIR` | 作業データ保存先 |
| `AUTOSTREAM_ARCHIVE_DIR` | 録画保存先 |
| `FFMPEG_BIN` | FFmpeg 実行ファイル |
| `AUTOSTREAM_OUTPUT_RELAY_URL` | 本番用 output relay |

## Control Panelで管理するもの

- YouTube stream key
- RTMPS URL
- Google Drive destination
- archive profile
- OAuth connected account
- stream ごとの保存先

## 本番での注意

本番では FFmpeg のコマンドラインに YouTube stream key を直接出さない構成にします。FFmpeg は local relay にだけ出力し、relay 側で外部配信先へ送ります。

## 確認手順

1. `ffmpeg -version` が通ることを確認します。
2. `AUTOSTREAM_ARCHIVE_DIR` に書き込めることを確認します。
3. Encoder Recorder を起動します。
4. Control Panel で online を確認します。
5. 短いテスト配信を行います。
6. `final.mkv` と `final.mp4` が作られるか確認します。
7. 保存先への upload 結果を確認します。
