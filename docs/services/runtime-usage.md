# 各サービスの使い方

AutoStream は、Control Panel だけで配信しているわけではありません。Control Panel が設定と指示を持ち、Discord Bot、Worker、Encoder Recorder、Observability が実際の処理を担当します。

このページでは、各サービスを「何のために使うか」「Control Panel で何を見るか」「うまく動かない時にどこを見るか」に絞って説明します。導入手順は各 install ページを見てください。

## 全体の流れ

| 順番 | サービス | 何をするか |
| --- | --- | --- |
| 1 | Control Panel | 配信、設定、ユーザー、サービス登録、開始停止を管理 |
| 2 | Discord Bot | Discord の voice channel に入り、音声や参加状態を扱う |
| 3 | Worker | overlay、caption、参加者状態、イベントを作る |
| 4 | Encoder Recorder | FFmpeg で配信、録画、remux、upload を行う |
| 5 | Observability | metric、incident、diagnostic、通知を扱う |

本番運用では、各サービスが Control Panel に登録され、Service Health で `online` になっていることが前提です。

## Control Panel

Control Panel は運用者が触る中心画面です。

| 操作 | 使う画面 | 補足 |
| --- | --- | --- |
| 配信を作る | Streams | 名前、Discord、YouTube、Archive、profileを選ぶ |
| サービスを登録する | Node登録 | `config.yml` と Node Runtime Token は一度だけ表示される |
| サービス状態を見る | Service Health | online、heartbeat、capabilityを確認 |
| 外部連携を設定する | Integrations、Discord Settings、YouTube Outputs | secretは保存後に再表示されない |
| 配信を開始/停止する | Streams | Check Readiness後にStartする |
| 異常を見る | Monitoring、Incidents、Diagnostics | Observabilityの情報を表示 |
| 権限を管理する | Users、Roles、Security Settings | 本番はMFAを推奨 |

### 日常で見るところ

1. Dashboard で Open Incidents と Services を見ます。
2. Streams で対象配信を選びます。
3. Check Readiness を押します。
4. Streams の配信枠で Primary Encoder Node と Primary Worker Node を選び、Service Health で必要サービスが primary になっているか見ます。
5. Start / Stop 後は Audit Logs と Metrics を確認します。

### 初回に最低限やること

1. Control Panel を起動し、管理者でログインします。
2. Node登録で Discord Bot、Worker、Encoder Recorder、Observability 用 Node を作り、各 `config.yml` を保存します。
3. 各サービスを起動し、Service Health で online になるまで待ちます。
4. Integrations で Google OAuth や Drive destination を作ります。
5. Discord Settings と YouTube Outputs を作ります。
6. Encoder Profiles と Archive Settings を作ります。
7. Streams で配信を作り、各設定を選びます。
8. Check Readiness を実行します。
9. warning / critical が残っていないことを確認して Start します。

### 運用中に見る順番

| 状況 | 最初に見る画面 | 次に見る画面 | 判断 |
| --- | --- | --- | --- |
| 配信前 | Dashboard | Streams、Service Health | open incident がなく、必要サービスが online か |
| 配信開始直後 | Streams | Metrics | dispatch が成功し、FPS / 音声 / event が動き始めたか |
| 配信中 | Monitoring | Incidents、Metrics | incident が増えていないか、通知が届いているか |
| 配信終了後 | Streams | Archive / upload、Audit Logs | Stop 後処理、録画、upload、complete が終わったか |
| 設定変更後 | Audit Logs | 対象設定画面 | 誰が何を変更したか、意図した値か |

## Discord Bot

Discord Bot は、Discord の voice channel に入り、音声を受け取り、必要に応じて Encoder Recorder へ転送します。

| Control Panelで設定するもの | 用途 |
| --- | --- |
| Discord Settings | Bot token、Discord BOT Node、audio forward、reconnect |
| Streams の Discord Config | どの配信でどのDiscord設定を使うか |
| Streams の Discord channel | 配信ごとの guild、voice channel、chat channel |
| Service Health | Botがonlineか、audio forward capabilityがあるか |
| Metrics | audio receiving、packets、forward errors |

### 正常の目安

| 表示 | 正常の例 |
| --- | --- |
| Service Health | `discord_bot` が online / healthy |
| Discord audio | receiving、last packet age が短い |
| Encoder audio bridge | forwarded total が増える |
| Incident | Discord audio系の open incident がない |

### 使い方の流れ

1. Control Panel の Node登録で `discord_bot` Node を作ります。
2. Discord Bot の env に `AUTOSTREAM_NODE_CONFIG` を入れ、Panel が生成した `config.yml` を読ませます。
3. Discord Bot を起動します。
4. Service Health で `discord_bot` が online になることを確認します。
5. Discord Settings で Bot token を保存し、登録済み Discord Bot Node を選びます。
6. Streams で Discord Config、Discord Guild ID、VC Channel ID、必要なら Chat Channel ID を保存します。VC参加で開始する待機枠は `Discord VC参加で自動開始` をONにし、Primary Encoder Node と Primary Worker Node も選びます。
7. Check Readiness で Discord 関連の不足がないことを確認します。
8. Start 後、Streams の Discord audio と Encoder audio bridge を見ます。

Discord VC へのユーザー参加でも stream auto-start が動きます。Bot は runtime config にある stream / guild / voice channel / auto-start trigger 対応を使い、`Discord VC参加で自動開始` がONの待機streamだけを Control Panel に開始要求します。runtime config には、Streamsで選んだDiscord Configの `service_id` がそのBot Node IDと一致する待機枠が入ります。Control Panel は Node Runtime Token、`streams.start` scope、保存済みtrigger、待機状態を確認し、開始直前に対象streamへ primary Discord Bot assignment を作ります。明示的に別Botが primary assigned されているstreamは上書きしません。Bot は runtime config を定期的に再読込するため、起動後に追加した待機枠も次回 refresh 後に候補になります。

Stream settings に text channel ID がある場合、配信開始後にその channel へ投稿された新規messageは Worker event の `overlay.discord_chat` として送られます。Discord 側では Bot の channel閲覧権限と Message Content Intent が必要です。

### 配信中に見る項目

| 項目 | 見方 |
| --- | --- |
| voice connected | Bot が voice channel に入っているか |
| audio receiving | Discord から音声 packet を受け取っているか |
| last packet age | 最後の音声から時間が空きすぎていないか |
| forwarded total | Encoder Recorder へ音声を送れているか |
| forward errors | 転送失敗が増えていないか |
| reconnect count | 切断と再接続を繰り返していないか |

音声が入らない場合は、Discord Bot の権限、対象 voice channel、参加者の発話、audio forward、Encoder Recorder への到達性の順に確認します。

### よくある問題

| 状況 | 確認すること |
| --- | --- |
| BotがVCに入らない | Bot招待、guild ID、voice channel ID、Connect権限 |
| 音声が届かない | Speak権限、voice channel内の音声、audio forward設定 |
| Encoderへ転送されない | Encoder RecorderのURL、service assignment、audio token |
| 何度も切断される | reconnect設定、Discord側の接続状態、host network |

## Worker

Worker は、配信中に発生するイベントを処理します。caption、chat、参加者状態、scene更新などを担当します。

| Control Panelで設定するもの | 用途 |
| --- | --- |
| Worker Management | Workerをstreamへprimary/standbyで割り当てる |
| Watermark Settings | 配信映像へ載せる1920x1080固定のウォーターマーク画像 |
| Caption/STT Settings | 字幕や文字起こし |
| Streams の Worker event test | eventが流れるか確認 |
| Metrics | 映像生成events、caption events、send failures |

### 正常の目安

| 表示 | 正常の例 |
| --- | --- |
| Service Health | `worker` が online / healthy |
| Stream assignment planner | worker が ready |
| Worker events | test event が accepted |
| Metrics | send failures が増えない |

### 使い方の流れ

1. Node登録で `worker` Node を作ります。
2. Worker の env に `AUTOSTREAM_NODE_CONFIG` を入れ、Panel が生成した `config.yml` を読ませます。
3. Worker を起動します。
4. Service Health で online / healthy を確認します。
5. Streams の配信枠作成時に Primary Worker Node として選びます。あとから変更する場合は Worker Management または Service Health で対象 stream に primary として割り当てます。
6. Streams で必要な場合だけ Watermark Profile または Caption Profile を選びます。
7. Worker event test を実行します。
8. 配信中は Worker events、Event Send Failures、Scene Updates を確認します。

### 使う場面

| 目的 | 使う設定 | 確認先 |
| --- | --- | --- |
| watermark を出す | Watermark Settings、配信枠のウォーターマークON | Streams / 出力映像 |
| caption を出す | Caption/STT Settings、Worker assignment | Caption event test |
| 参加者状態を表示 | Worker event、Discord Bot 状態 | Worker events、Metrics |
| Discord chatを表示 | Streams の text channel ID、Bot 権限 | Worker events、Discord Bot logs |
| standby を用意 | Worker Management | Service Health の assignment |

Worker が online でも、stream に primary として割り当てられていなければ Start の dispatch 対象になりません。

### よくある問題

| 状況 | 確認すること |
| --- | --- |
| watermarkが出ない | Watermark Profile選択、1920x1080画像、配信枠のウォーターマークON、Encoder側の映像合成 |
| captionが出ない | Caption Profile、STT設定、音声入力、Worker events |
| event送信失敗 | Encoder Recorder URL、firewall、Node Runtime Token |
| Workerが表示されない | Node ID、`AUTOSTREAM_NODE_CONFIG`、Control Panel URL |

## Encoder Recorder

Encoder Recorder は、映像と音声を受け取り、FFmpegで配信、録画、remux、uploadを行います。Linux host上での依存として FFmpeg が必要です。

| Control Panelで設定するもの | 用途 |
| --- | --- |
| Encoder Profiles | 解像度、fps、bitrate、preset |
| Archive Settings | 録画、保存、upload、保持期間 |
| YouTube Outputs | RTMPS URL、stream key、Live API設定 |
| Streams の Encoder Input URL | SRT、RTSP、relayなどの入力 |
| Service Health | Encoder Recorderがonlineか確認 |
| Metrics | fps、bitrate、dropped frames、archive、upload |

### 正常の目安

| 表示 | 正常の例 |
| --- | --- |
| Encoder host preflight | ffmpeg、archive dir、outputがready |
| Output FPS | profileのfpsに近い |
| Output Bitrate | profileのbitrate付近で安定 |
| Dropped Frames | 増え続けない |
| Archive / upload | final MKV / MP4が作成され、uploadが完了 |

### 使い方の流れ

1. Linux host に FFmpeg を入れます。
2. Node登録で `encoder_recorder` Node を作ります。
3. Encoder Recorder の env に `AUTOSTREAM_NODE_CONFIG`、archive directory などを入れます。
4. Encoder Recorder を起動します。
5. Service Health で online / healthy を確認します。
6. Encoder Profiles、Archive Settings、YouTube Outputs を Control Panel で作ります。
7. Streams の配信枠作成時に Primary Encoder Node として選び、profile と配信先を選びます。あとから変更する場合は Service Health で primary assignment を更新します。
8. Check Readiness と Encoder host preflight を確認します。
9. Start 後は FPS、bitrate、dropped frames、archive、upload を見ます。

YouTube を自動で配信開始したい場合は、YouTube Output を `Live API` mode にし、OAuth connected account と `Enable auto start` を設定します。`Existing stream key` mode は RTMPS 送信のみで、YouTube Studio 側の設定によっては手動開始が必要です。

### 配信品質の見方

| 項目 | 良い状態 | 悪い時の見方 |
| --- | --- | --- |
| Output FPS | profile の fps に近い | host 負荷、preset、入力URLを確認 |
| Output Bitrate | 設定値付近で安定 | 配信先、回線、FFmpeg logを確認 |
| Dropped Frames | 増え続けない | CPU/GPU、入力遅延、bitrateを確認 |
| Recorder Write | 書き込みが続く | disk free、directory権限を確認 |
| Final MKV / MP4 | Stop 後に exists | remux log、FFmpeg終了状態を確認 |
| Google Drive Upload | completed | Drive destination、OAuth account、folder権限を確認 |

### Retry の使い分け

| 操作 | 使う場面 | 先に確認すること |
| --- | --- | --- |
| Retry Upload | final file はあるが upload だけ失敗 | 保存先権限、folder ID、OAuth account |
| Retry YouTube Complete | YouTube Live API の終了処理だけ失敗 | YouTube Output、connected account |
| service restart | Encoder Recorder 自体が止まった | 配信中でないか、standbyがあるか |

### よくある問題

| 状況 | 確認すること |
| --- | --- |
| FFmpegが起動しない | ffmpeg install、PATH、systemd権限 |
| 配信先へ送れない | YouTube Output、RTMPS URL、stream key |
| 録画が残らない | archive directory、disk free、権限 |
| uploadに失敗 | Drive destination、OAuth account、folder権限 |
| fpsが低い | host CPU/GPU、preset、入力URL、bitrate |

## Observability

Observability は、metricを集め、incidentを作り、diagnosticと通知を提供します。

| Control Panelで使う画面 | 用途 |
| --- | --- |
| Monitoring Dashboard | incident、remediation、delivery、metricのまとめ |
| Incidents | 未解決の異常を見る |
| Diagnostics | 原因候補と確認項目を見る |
| Remediation Actions | 承認が必要な対応を実行する |
| Notification Channels | 通知先を登録してtestする |
| Metrics | metricの生データに近い一覧を見る |

### 正常の目安

| 表示 | 正常の例 |
| --- | --- |
| Service Health | `observability` が online / healthy |
| Metrics | 各サービスのmetricが更新される |
| Incidents | 配信前はopen incidentがない |
| Notification Deliveries | test通知がdelivered |

### 使い方の流れ

1. Node登録で `observability` Node を作ります。
2. Observability の env に `AUTOSTREAM_NODE_CONFIG` と database を入れます。
3. Observability を起動します。
4. Service Health で online / healthy を確認します。
5. Notification Channels で通知先を作ります。
6. Test Channel を実行し、Notification Deliveries で delivered を確認します。
7. 配信中は Monitoring Dashboard、Incidents、Metrics を確認します。
8. incident が出たら Diagnostics を見て、Streams / Service Health / 対象サービスに戻って対応します。

### incident を見つけた時の流れ

1. Dashboard で open incident を確認します。
2. Incidents で severity、stream、service、rule を確認します。
3. Diagnostics で原因候補と確認項目を読みます。
4. Metrics で直近値が悪化しているか確認します。
5. 対象サービスの画面で設定、assignment、heartbeat を確認します。
6. 対応後、incident が resolved になるか見ます。
7. 必要なら Audit Logs で直前の設定変更を確認します。

### 通知を調整する

| 目的 | 設定 |
| --- | --- |
| 通知を減らす | severity filter を warning / critical に寄せる |
| 重要な失敗だけ通知 | event type filter を incident や upload failure に絞る |
| Discord に通知 | webhook type を作成し Test Channel を実行 |
| email に通知 | SMTP 設定と recipients を保存し Test Channel を実行 |

### よくある問題

| 状況 | 確認すること |
| --- | --- |
| incidentが出ない | Observability service、metric受信、rule設定 |
| 通知が来ない | Notification Channel、Test Channel、delivery result |
| 対応候補が実行できない | approval required、service reachability、権限 |
| metricが古い | 各サービスheartbeat、network、Control Panel連携 |

## サービスを増やす時の手順

1. Control Panel の Node登録で対象 service type の Node を作ります。
2. 対象サービスの env に `AUTOSTREAM_NODE_CONFIG` を入れ、Panel が生成した `config.yml` を読ませます。
3. サービスを起動します。
4. Service Health で online になったことを確認します。
5. 必要なら stream に primary または standby として割り当てます。
6. Streams で Check Readiness を実行します。
7. Metrics と Audit Logs に登録・heartbeat・assignment が出ることを確認します。

## サービスを止める時の注意

| 止めるサービス | 影響 |
| --- | --- |
| Discord Bot | Discord音声、VC参加、audio forwardが止まる |
| Worker | overlay、caption、participant eventが止まる |
| Encoder Recorder | 配信、録画、uploadが止まる |
| Observability | incident、metric、通知が更新されない |
| Control Panel | 全体の管理画面とAPIが止まる |

配信中に止める場合は、先に Streams で Stop するか、standbyへ切り替えられる状態か確認します。
