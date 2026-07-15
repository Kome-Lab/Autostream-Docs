# 配信画面

Streams は、配信を作成し、設定を選び、サービスを割り当て、開始・停止する画面です。AutoStream の日常運用で一番よく使います。

## 画面の役割

Streams では、次の作業を行います。

- 新しい配信を作る
- 既存配信を選ぶ
- Discord、YouTube、Encoder、Archive 保存先などの設定を配信に紐づける
- Discord guild / voice channel / chat channel を配信ごとに指定する
- 配信枠を待機状態にし、Discord VC参加を開始条件にする
- Encoder input URL を指定する
- 必要サービスを primary / standby として割り当てる
- 開始前チェックを実行する
- Start、Stop、Retry Upload、Retry YouTube Complete を実行する
- 配信中のEncoder出力を画面内またはVLCなどで確認する
- 音声、Worker event、録画、upload の状態を見る

## 配信を新規作成する

1. `配信枠名` に番組名や案件名を入れます。
2. `Discord VC参加で自動開始` をONにし、`Discord BOT設定`、Guild ID、VC Channel ID、必要ならChat Channel IDを指定します。
3. `YouTube Output`、`Encoder Profile` などを選びます。
4. `Primary Encoder Node` と `Primary Worker Node` を選びます。Nodeが1つだけなら自動選択されます。
5. ローカル保持日数を決めます。Google Driveへ保存する場合は、Archive OAuth account、Drive Folder ID、必要に応じて共有ドライブIDと保存ファイル名も入れます。
6. `配信枠を作成` を押します。
7. 作成後、一覧に新しい配信枠が待機状態で追加されたことを確認します。

配信名は、あとから監査ログや通知にも出ます。日付だけではなく、用途が分かる名前にしておくと後で探しやすくなります。

## 配信設定の項目

| 項目 | 入れるもの | 空欄にした場合 | よくある使い方 |
| --- | --- | --- | --- |
| 配信枠名 | 番組名、案件名、イベント名 | 作成できません | Streams、通知、監査ログで探しやすい名前にします |
| Discord Config | Discord Bot 設定 | Discord 連携なし、または開始前チェックで不足になります | 通常は必須です |
| Discord Guild ID | Bot が入る Discord server の ID | Discord 音声なし、または readiness 不足 | 配信枠ごとに必ず指定します |
| VC Channel ID | Bot が参加する voice channel の ID | Discord 音声なし、または readiness 不足 | VC参加auto-startの判定にも使います |
| Chat Channel ID | chat描画とYouTube開始通知に使うtext channelのID | chat表示と開始通知なし | 配信開始後の新規messageをWorkerへ送り、配信開始時は視聴URLを通知します |
| Discord VC参加で自動開始 | 対象VCへの参加を開始条件にするか | 手動開始だけ | 待機枠として自動運用する配信だけONにします |
| Encoder Profile | 解像度、fps、bitrate などの profile | 既定または未指定扱い | 配信品質を変える時に使います |
| Caption Profile | 字幕/STT の profile | 字幕なし | 字幕を使う配信だけ選びます |
| Watermark Profile | 配信映像へ載せる画像の profile | ウォーターマークなし | ロゴ画像を配信枠ごとにON/OFFする時に選びます |
| Primary Encoder Node | 配信と録画を担当する Encoder Recorder | 自動開始枠では作成できません | `services.assign` 権限がある場合に表示されます |
| Primary Worker Node | caption、chat、参加者状態 event を担当する Worker | 自動開始枠では作成できません | `workers.assign` 権限がある場合に表示されます |
| Archive OAuth Account | Google Drive保存に使う接続アカウント | Drive uploadなし | 録画をGoogle Driveへ保存する配信で選びます |
| Drive Folder ID | 保存先folder ID | Drive uploadなし | 保存先folderを配信枠ごとに指定します |
| 共有ドライブID | 共有ドライブを使う場合のdrive ID | 通常Driveとして扱います | 共有ドライブ保存を有効にした時だけ入れます |
| 保存ファイル名 | Drive上のMP4名 | `配信枠名-年月日.mp4` | 顧客名や番組名で後から探しやすくします |
| ローカル保持日数 | Encoder Recorder に残す final artifact の日数 | 30日 | Drive uploadなしでもローカル管理したい配信で指定します |
| YouTube Output | 配信先 | 外部配信なし、または開始前チェックで不足 | 本番配信では通常選びます |
| Encoder Input URL | Discord 以外の映像入力 URL | Discord 音声と生成映像を使う | 外部映像や中継 input を使う時だけ入れます |
| RTMP URL | start 時に直接渡す RTMP/RTMPS URL | YouTube Output の設定を使います | 通常は YouTube Output 側で管理します |

## Discord channel 指定の考え方

Discord Settings は Bot token と登録済み Discord Bot Node だけを持ちます。実際に入る guild / voice / chat channel は Streams の配信枠へ保存します。

| 運用 | Streams に保存する値 | 補足 |
| --- | --- | --- |
| いつも同じ voice channel | すべての配信枠に同じ Guild ID / VC Channel ID | 誤配信を避けるため配信枠ごとに明示します |
| テスト配信だけ別 channel | テスト用 Guild ID / VC Channel ID | 本番枠とは別の配信枠にします |
| 配信ごとに告知先だけ変える | Chat Channel ID だけ配信枠ごとに変える | voice channel は通常の接続先を指定します |
| 別 guild で検証する | Guild ID、VC Channel ID、必要なら Chat Channel ID | Bot が招待済みか確認します |

空欄は「元の config を使う」ではありません。Discord 音声やVC参加auto-startを使う配信枠では、Guild ID と VC Channel ID を明示してください。VC参加で開始する枠は、配信枠の `Discord VC参加で自動開始` もONにします。

## Encoder input URL の考え方

`Encoder Input URL` は、外部映像や別プロセスからの入力を Encoder Recorder に渡す時に使います。

| 入力したいもの | 例 | 注意 |
| --- | --- | --- |
| Discord 音声だけで配信する | 空欄 | Worker や Encoder 側の既定映像を使います |
| SRT 入力 | `<SRT_INPUT_URL>` | firewall と ingest 側の待受を確認します |
| RTSP カメラ | `<RTSP_INPUT_URL>` | 認証情報を URL に直接含めない運用を推奨します |
| ローカル relay | `<LOCAL_RELAY_URL>` | Encoder Recorder から到達できる host を指定します |

## サービス割り当て

配信を開始するには、基本的に次の primary service が必要です。

| サービス種別 | 役割 | 不足時に起きること |
| --- | --- | --- |
| `discord_bot` | voice channel 参加、音声取得、音声転送 | Discord 音声が使えません |
| `worker` | caption、chat、参加者状態などの event 生成 | 映像生成イベントや字幕が流れません |
| `encoder_recorder` | FFmpeg、配信、録画、upload | 配信と録画ができません |

Streamsの作成画面で `Primary Encoder Node` と `Primary Worker Node` を選ぶと、配信枠の作成と同時に primary assignment が保存されます。Discord Bot は Streamsで選んだ `Discord BOT設定` の Node ID を使って待機枠を受け取り、VC参加による開始要求の直前に Control Panel が primary assignment を作ります。

`services.assign` や `workers.assign` 権限がない場合、Streams画面ではPrimary Nodeを保存できません。その場合は Service Health または Worker Management で割り当てます。`Stream assignment planner` で `missing` が出ている場合は、候補サービスの `assign` を押します。`primary` は実際の dispatch 対象、`standby` は予備です。

## Start前チェック

`Check Readiness` は、Start 前に不足を集めて表示するためのボタンです。Start の前に毎回実行してください。

| チェック | 見る内容 | 対応 |
| --- | --- | --- |
| Service assignment | 必要な service type が primary に割り当て済みか | Service Health または planner で割り当てます |
| Service heartbeat | 割り当て済みサービスが warning / offline ではないか | 対象サービスを起動または再起動します |
| Encoder input URL | URL 形式が妥当か | 空欄でよいか、外部入力が必要か確認します |
| YouTube Output | stream key または OAuth account が ready か | YouTube Outputs と Integrations を見直します |
| Archive 保存先 | OAuth account、folder ID、共有ドライブID が ready か | Streams のArchive保存先とIntegrationsの接続アカウントを見直します |
| Runtime config | 対象サービスが Control Panel 配布 config を読めるか | Node ID、capability、Node Runtime Token を確認します |

## Start / Stop / Retry の使い方

| ボタン | 何をするか | 使う場面 |
| --- | --- | --- |
| Save Settings | 選択中配信の設定を保存 | 設定だけ変えてまだ開始しない時 |
| Check Readiness | Start 前の不足確認 | 配信前の通常確認 |
| Start | Discord Bot、Worker、Encoder Recorder へ開始指示を送る | readiness が通った後 |
| Stop | 配信停止を各サービスへ送る | 配信終了時 |
| Retry Upload | 録画済みファイルの保存先 upload を再試行 | 配信は終わったが upload が失敗した時 |
| Retry YouTube Complete | YouTube Live API の終了処理を再試行 | Stop 後に complete 処理だけ失敗した時 |
| View Stream Audit | 対象 stream の操作履歴を開く | 誰が開始・停止・変更したか見たい時 |

自動運用では、対象 Discord VC へのユーザー参加が開始トリガーです。配信枠で `Discord VC参加で自動開始` をONにし、`created`、`draft`、`ready` の待機状態にしておきます。参加を検知したDiscord BotはVCへ参加して音声取得を開始し、Control Panel の service-auth endpoint に開始を要求します。Control Panel は primary assignment、`streams.start` scope、保存済みの auto-start trigger を確認してから、WorkerとEncoder Recorderを含む通常の start dispatch を行います。日時による予約実行は行いません。

YouTube 側の自動開始は YouTube Output の mode に依存します。`Live API` mode で `Enable auto start` を有効にした場合は、Control Panel が YouTube broadcast / live stream を作成し、YouTube API の auto-start 設定を渡します。`Existing stream key` mode は RTMPS 送信だけなので、YouTube Studio 側で手動開始が必要な構成があります。

Chat Channel IDが設定され、有効なYouTube視聴URLがある本番配信では、すべてのservice startが成功して状態が`live`になった後、Discord Botがそのchannelへ視聴URLを投稿します。`Live API dry-run`では投稿しません。投稿失敗は配信を停止またはrollbackしないため、Streamsの開始結果とDiscord Bot logで通知結果を別に確認してください。

## Encoderプレビュー

`starting`、`live`、`stopping` の配信枠では、詳細画面に `Encoderプレビュー` が表示されます。プレビューはEncoder RecorderがYouTube出力と録画と同じencodeから作るHLSで、約2秒segmentを6個保持します。preview側の遅延や切断は本配信と録画から分離されているため、previewだけが一時的に乱れても配信停止とは限りません。

画面内previewはログイン中の `streams.read` 権限でControl Panelがproxyします。VLCなどで見る場合は `ネットワーク再生URLを発行` を押し、VLCの `メディア` -> `ネットワークストリームを開く` へURLを入力します。

署名付きURLは最大12時間有効ですが、配信枠が`starting`、`live`、`stopping`以外になった時点で無効です。URLはbearer credentialとして扱い、チケット、Discord、メール、スクリーンショット、監査metadataへ貼らないでください。reverse proxy、CDN、WAFでも `/stream-previews/` のtoken付きpathをaccess logへ保存しない設定にします。Node tokenはブラウザやVLCへ渡りません。

playlistとsegmentはすべてControl Panel proxyを通るため、同時preview数と映像bitrateに比例してControl Panelの転送帯域が増えます。多数の常時監視用途では、Control Panelの帯域と接続数を監視してください。

## Stream Operations の見方

| 行 | 正常の目安 | 問題がある時 |
| --- | --- | --- |
| Stream operation overview | stream が expected status で進んでいる | starting / stopping が長く残る場合は dispatch と各サービス log を確認 |
| Start preflight | ready | warning / critical の項目を先に解消 |
| Encoder host preflight | ffmpeg、archive dir、output が ready | Encoder Recorder host の dependency、権限、設定を確認 |
| Discord audio | receiving / forwarded が増える | Bot の voice 接続、権限、音声転送先を確認 |
| Encoder audio bridge | packets が届き、last packet age が短い | Bot から Encoder Recorder への到達性を確認 |
| Worker events | event が流れている | Worker assignment と Worker event sidecar を確認 |
| Archive / upload | final MKV / MP4 と upload status が ok | 配信枠のArchive保存先、Drive権限、disk を確認 |
| Last dispatch | 各サービスへの start / stop が success | 失敗した service type と message を確認 |

## Worker event test

Streams には Worker event を試すための操作があります。

| 操作 | 目的 | 確認先 |
| --- | --- | --- |
| current_time event | Worker から Encoder Recorder へ軽い event が届くか確認する | Worker Event Sidecar |
| caption event | 字幕/テロップ系 event が届くか確認する | Worker Events、Encoder Recorder |

これは本番配信中にむやみに使うものではなく、配信前の接続確認やテスト stream で使います。

## よくあるエラー

| 表示 | 意味 | 対応 |
| --- | --- | --- |
| Missing stream assignments | 必須 service type が割り当てられていない | planner か Service Health で primary を割り当てます |
| Start readiness failed | 設定、service、外部連携のどれかが不足 | Readiness Issues の action hint を順番に解消します |
| selected YouTube output stream key is not configured | YouTube Output に stream key が保存されていない | YouTube Outputs で stream key を保存します |
| selected YouTube OAuth connected account is not ready | Live API 用の OAuth account が使えない | Integrations で接続し直します |
| YouTube watch URL is required for Discord notification | Chat Channel IDがあるstream key配信に視聴URLがない | YouTube Outputsで視聴URLを保存します |
| Encoderプレビューが準備中のまま | HLS segmentがまだ作られていない、またはEncoderへ到達できない | 配信状態、Encoder assignment、Encoder logを確認します |
| selected Drive destination folder ID is not configured | 保存先 folder ID が未保存 | Streams のDrive Folder IDを保存し直します |
| assigned service is warning/offline | heartbeat が古い | 対象サービスの systemd/Docker 状態と network を確認します |
