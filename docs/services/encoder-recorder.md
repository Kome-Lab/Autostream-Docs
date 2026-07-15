# Encoder Recorder

Encoder Recorder は AutoStream の media 処理を担当します。Discord 音声、Worker のイベント、外部映像入力を受け取り、FFmpeg で配信と録画を行います。

Linuxサーバーへの導入、FFmpeg、録画ディレクトリ、output relay、Google Drive保存の実運用手順は [Encoder Recorderを導入する](/services/encoder-recorder-install) にまとめています。

## 役割

- stream job の start / stop / retry-upload
- Discord 音声の ingest
- Worker event の保存
- FFmpeg による live output
- Control PanelとVLC向けのHLS Encoderプレビュー
- MKV 録画と MP4 化
- Google Drive など保存先への upload
- Control Panel からの local archive download / rename / delete
- metric と failure signal の送信

## host側で必要なもの

- `ffmpeg`
- 録画保存用ディレクトリ
- 一時ファイル用ディレクトリ
- 十分なディスク容量
- output relay を使う場合の nginx-rtmp、SRS など

## envで設定するもの

stream ingest signing key は env ではなく、Control Panel の Node登録で生成される `config.yml` の `stream_ingest.signing_key` から読み込みます。

| 項目 | 目的 |
| --- | --- |
| `AUTOSTREAM_NODE_CONFIG` | Panel が生成した Encoder Recorder 用 `config.yml` |
| `AUTOSTREAM_DATA_DIR` | 作業データ保存先 |
| `AUTOSTREAM_ARCHIVE_DIR` | 録画保存先 |
| `FFMPEG_BIN` | FFmpeg 実行ファイル |
| `AUTOSTREAM_OUTPUT_RELAY_URL` | 本番用 output relay |

## Control Panelで管理するもの

| 画面 | 管理するもの |
| --- | --- |
| Node登録 | Encoder Recorder Node を作成し、Host、Port、SSL、説明を設定します |
| Service Health | heartbeat、自動報告された version / capability / OS / arch |
| Encoder Profiles | 解像度、fps、bitrate、FFmpeg profile |
| YouTube Outputs | RTMPS URL、stream key、Live API 設定 |
| Integrations | Google OAuth connected account、生成済みDrive destinationの確認 |
| Archive Settings | 互換用のupload、dry-run、retention、Drive destination |
| Streams | Encoder Profile、Archive OAuth account、Drive Folder ID、YouTube Output、input URL、preflight、Encoderプレビュー |
| Archive | local artifact の download、rename、delete、Drive upload 結果の確認 |
| Metrics / Incidents | FFmpeg、録画、upload、audio bridge の状態 |

## 本番での注意

本番では FFmpeg のコマンドラインに YouTube stream key を直接出さない構成にします。FFmpeg は local relay にだけ出力し、relay 側で外部配信先へ送ります。

Encoderプレビューは本配信、録画と同じencodeを3-way teeし、約2秒のHLS segmentを6個だけrolling保持します。preview出力は有限FIFOと`onfail=ignore`で分離され、previewの遅延やplayer切断で本配信と録画を停止しません。playlistはControl Panelが検証してproxyし、ブラウザへEncoderのNode tokenを渡しません。

preview fileは`AUTOSTREAM_ARCHIVE_DIR/tmp/<stream_id>/preview/`に置かれます。active stream内ではsegment数が制限されますが、現時点のfinal artifact retentionは終了済みstreamの`tmp` directoryを削除する保証を持ちません。disk監視では`final`だけでなく`tmp`も確認し、手動整理は対象streamが停止済みでEncoder Recorderが使用していないことを確認してから行います。

## 確認手順

1. `ffmpeg -version` が通ることを確認します。
2. `AUTOSTREAM_ARCHIVE_DIR` に書き込めることを確認します。
3. Encoder Recorder を起動します。
4. Control Panel で online を確認します。
5. 短いテスト配信を行います。
6. StreamsのEncoderプレビューとVLC用ネットワーク再生URLで映像を確認します。
7. `final.mkv` と `final.mp4` が作られるか確認します。
8. Control Panel の Archive で local artifact を download できるか確認します。
9. 保存先への upload 結果を確認します。

## Streamsで見る項目

| 項目 | 意味 |
| --- | --- |
| Encoder Profile | FFmpeg の出力設定 |
| Encoder Input URL | 外部映像入力。空欄なら既定入力 |
| RTMP URL | 直接出力先を指定したい時の補助項目 |
| Encoder host preflight | ffmpeg、archive dir、output 設定の準備状態 |
| Audio Bridge | Discord Bot から音声 packet が届いているか |
| Archive / upload | final MKV / MP4、local artifact、upload status、retry 状態 |
| Encoderプレビュー | YouTube送信前の最終映像。starting / live / stoppingだけ利用可能 |

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
