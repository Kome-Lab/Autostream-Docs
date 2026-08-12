# Encoder Recorder

Encoder Recorder は AutoStream の最終media処理を担当します。Discord音声、Workerが生成したMJPEG scene画像列、外部映像入力を受け取り、Workerの最新画像を設定FPSの映像へ展開し、ウォーターマークと音声を重ねてFFmpegで配信と録画を行います。

Linuxサーバーへの導入、FFmpeg、録画ディレクトリ、output relay、Google Drive保存の実運用手順は [Encoder Recorderを導入する](/services/encoder-recorder-install) にまとめています。

## 役割

- stream job の start / stop / retry-upload
- Discord 音声の ingest
- Worker scene JPEG frameのSRT ingestと最新画像保持
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
| `AUTOSTREAM_ARCHIVE_DIR` | 録画保存先 |
| `FFMPEG_BIN` | FFmpeg 実行ファイル |
| `AUTOSTREAM_WORKER_VIDEO_BIND_ADDR` | Worker scene video用SRT/UDP listenerのbind。productionでは必須。例: `0.0.0.0:10080` |
| `AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST` | primary Workerから到達できるSRT host名またはIP。scheme、port、pathは含めない |
| `AUTOSTREAM_OUTPUT_RELAY_URL` | 本番用 output relay |
| `AUTOSTREAM_OUTPUT_RELAY_MODE` | `direct`、`legacy_stream_key`、`live_api_static`の配送方式。URLありで未設定の場合だけ既存host互換の`legacy_stream_key` |
| `AUTOSTREAM_OUTPUT_RELAY_BINDING_ID` | `live_api_static`だけで使う、`relay-` + 小文字UUID形式の非secret固定relay識別子。stream keyや外部RTMPS URLは入れない |

`AUTOSTREAM_ARCHIVE_DIR`は未指定なら`/var/lib/autostream/archives`、`FFMPEG_BIN`は未指定なら`ffmpeg`です。`AUTOSTREAM_ENV=production`ではWorker映像用のbindとadvertise hostを明示しない限りSRT ingest capabilityを報告せず、Worker映像経路は開始しません。`AUTOSTREAM_DATA_DIR`はEncoder Recorderでは使用しません。

## Control Panelで管理するもの

| 画面 | 管理するもの |
| --- | --- |
| Node登録 | Encoder Recorder Node を作成し、Host、Port、SSL、説明を設定します |
| Service Health | heartbeat、自動報告された version / capability / OS / arch |
| Encoder Profiles | 解像度、fps、bitrate、FFmpeg profile |
| YouTube Outputs | RTMPS URL、stream key、Live API 設定 |
| Integrations | Google OAuth connected account、生成済みDrive destinationの確認 |
| Archive Settings | 互換用のupload、dry-run、retention、Drive destination |
| Streams | Encoder Profile、録画プロファイル、YouTube Output、preflight、Encoderプレビュー |
| Archive | local artifact の download、rename、delete、Drive upload 結果の確認 |
| Metrics / Incidents | FFmpeg、録画、upload、audio bridge の状態 |

## 本番での注意

本番では FFmpeg のコマンドラインに YouTube stream key を直接出さない固定relay構成を推奨します。FFmpeg は local relay にだけ出力し、relay 側で外部配信先へ送ります。固定relayの既存`stream_key` profileは`legacy_stream_key`だけで継続し、`live_api_relay_static`はEncoderの`live_api_static`と一致するbinding IDがある場合だけ使えます。通常の`live_api`や`live_api_dry_run`を既存の固定relayへ送ることはできません。

relay URLを設定しない`direct`、URLありでmode未設定の旧`legacy_stream_key`互換、明示的な`live_api_static`の切替条件と安全な戻し方は、[Encoder Recorderを導入する](/services/encoder-recorder-install#output-relay-の考え方)を参照してください。profileや固定relayのkeyを自動変換・複製しないでください。

Discord参加者、発言中の緑枠、現在時刻、字幕、チャットはWorkerがscene画像として生成し、低頻度のMJPEG画像列をjob-scopedに暗号化したSRT over UDPで選択されたEncoder Recorderへ送ります。Encoder Recorderは最新画像を保持し、Encoder ProfileのFPS/CBRで一度だけ動画encodeしてDiscord音声をMUXし、ウォーターマークを重ね、YouTube、本配信と同じ録画、Encoderプレビューへ同じ最終encodeを分岐します。Worker側では動画encodeしません。playlistはControl Panelが検証してproxyし、ブラウザへEncoderのNode tokenを渡しません。

SRT listen/advertise UDP endpointはNode APIのHTTPS URLやCloudflare Tunnelとは別に設定し、primary Workerからadvertise先へUDP到達できる必要があります。SRT token/passphraseはjob-scopedで、FFmpeg argv、URL、log、audit、env、永続fileへ出しません。

preview fileは`AUTOSTREAM_ARCHIVE_DIR/tmp/<stream_id>/preview/`に置かれます。active stream内ではsegment数が制限されますが、現時点のfinal artifact retentionは終了済みstreamの`tmp` directoryを削除する保証を持ちません。disk監視では`final`だけでなく`tmp`も確認し、手動整理は対象streamが停止済みでEncoder Recorderが使用していないことを確認してから行います。

## 確認手順

1. `ffmpeg -version` が通ることを確認します。
2. `AUTOSTREAM_ARCHIVE_DIR` に書き込めることを確認します。
3. Encoder Recorder を起動します。
4. Control Panel で online を確認します。
5. 短い非公開テスト配信を行い、Worker映像、Discord音声、ウォーターマークが揃うことを確認します。
6. YouTube、StreamsのEncoderプレビュー、VLC用ネットワーク再生URLで同じ表示を確認します。
7. `final.mkv` と `final.mp4` が作られるか確認します。
8. Control Panel の Archive で local artifact を download できるか確認します。
9. 保存先への upload 結果を確認します。

## Streamsで見る項目

| 項目 | 意味 |
| --- | --- |
| Encoder Profile | FFmpeg の出力設定 |
| Encoder Input URL | 互換用の外部映像入力。Worker映像契約が有効な配信ではjob-scoped SRT入力を使用 |
| RTMP URL | 直接出力先を指定したい時の補助項目 |
| Encoder host preflight | ffmpeg、archive dir、output 設定の準備状態 |
| Audio Bridge | Discord Bot から音声 packet が届いているか |
| Worker Video Ingest | primary WorkerのSRT接続、初期frame到達、UDP listener readiness |
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
