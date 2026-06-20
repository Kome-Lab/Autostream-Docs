# Encoder Recorder

Encoder Recorder は AutoStream の media 処理を担当します。Discord 音声、Worker のイベント、外部映像入力を受け取り、FFmpeg で配信と録画を行います。

Linuxサーバーへの導入、FFmpeg、録画ディレクトリ、output relay、Google Drive保存の実運用手順は [Encoder Recorderを導入する](/services/encoder-recorder-install) にまとめています。

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

| 画面 | 管理するもの |
| --- | --- |
| API Tokens | Encoder Recorder 用 token と scope |
| Service Health | heartbeat、capability、runtime config preview |
| Encoder Profiles | 解像度、fps、bitrate、FFmpeg profile |
| YouTube Outputs | RTMPS URL、stream key、Live API 設定 |
| Integrations | Google OAuth connected account、Drive destination |
| Archive Settings | upload、dry-run、retention、Drive destination |
| Streams | Encoder Profile、Archive Profile、YouTube Output、input URL、preflight |
| Metrics / Incidents | FFmpeg、録画、upload、audio bridge の状態 |

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

## Streamsで見る項目

| 項目 | 意味 |
| --- | --- |
| Encoder Profile | FFmpeg の出力設定 |
| Encoder Input URL | 外部映像入力。空欄なら既定入力 |
| RTMP URL | 直接出力先を指定したい時の補助項目 |
| Encoder host preflight | ffmpeg、archive dir、output 設定の準備状態 |
| Audio Bridge | Discord Bot から音声 packet が届いているか |
| Archive / upload | final MKV / MP4、upload status、retry 状態 |

## metricの見方

| metric | 正常の目安 | 異常時 |
| --- | --- | --- |
| `encoder.process_alive` | 1 | FFmpeg process が落ちています |
| `encoder.output_fps` | profile に近い値 | CPU/GPU 負荷、入力、encoder preset を確認 |
| `encoder.output_bitrate_kbps` | 設定 bitrate に近い値 | network や preset を確認 |
| `encoder.dropped_frames_total` | 急増しない | host 負荷や入力 jitter を確認 |
| `recorder.write_bitrate_kbps` | 0 より大きい | 録画ファイルに書けていません |
| `recorder.disk_free_bytes` | 十分な空き容量 | archive dir の容量を確保 |
| `archive.package_status` | ok / completed | remux や package log を確認 |
| `gdrive.upload_status` | ok / completed | Drive destination と OAuth account を確認 |

## upload失敗時の対応

1. Streams の Archive / upload を確認します。
2. Incidents に upload 失敗が出ていないか確認します。
3. Archive Settings の Drive destination を確認します。
4. Drive folder の権限と共有ドライブ設定を確認します。
5. 録画ファイルが残っている場合は `Retry Upload` を実行します。

## 次に読むページ

- [Encoder Recorderを導入する](/services/encoder-recorder-install)
- [プロファイル設定](/control-panel/profiles)
- [録画と保存](/operations/archive-flow)
