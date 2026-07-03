# 配信画面

Streams は、配信を作成し、設定を選び、サービスを割り当て、開始・停止する画面です。AutoStream の日常運用で一番よく使います。

## 画面の役割

Streams では、次の作業を行います。

- 新しい配信を作る
- 既存配信を選ぶ
- Discord、YouTube、Encoder、Archive などの設定を配信に紐づける
- Discord channel を配信ごとに override する
- Encoder input URL を指定する
- 必要サービスを primary / standby として割り当てる
- 開始前チェックを実行する
- Start、Stop、Retry Upload、Retry YouTube Complete を実行する
- 音声、Worker event、録画、upload の状態を見る

## 配信を新規作成する

1. `New Stream Name` に配信名を入れます。
2. 先に使う予定の `Discord Config`、`YouTube Output`、`Archive Profile` などを選びます。
3. `Create Stream With Current Settings` を押します。
4. 作成後、`Stream` の選択が新しい配信に切り替わったことを確認します。

配信名は、あとから監査ログや通知にも出ます。日付だけではなく、用途が分かる名前にしておくと後で探しやすくなります。

## 配信設定の項目

| 項目 | 入れるもの | 空欄にした場合 | よくある使い方 |
| --- | --- | --- | --- |
| Stream | 操作対象の配信 | 既存一覧から最初の配信が使われることがあります | 配信開始前に必ず対象を確認します |
| Discord Config | Discord Bot 設定 | Discord 連携なし、または開始前チェックで不足になります | 通常は必須です |
| Discord Guild ID Override | この配信だけ別 guild を使う場合の ID | Discord Config の値を使います | ほとんどの場合は空欄です |
| Discord Voice Channel ID Override | この配信だけ別 voice channel を使う場合の ID | Discord Config の値を使います | テスト用 channel に切り替える時に使います |
| Discord Text Channel ID Override | 通知や補助表示に使う text channel ID | Discord Config の値を使います | 配信ごとに告知先を変える場合に使います |
| Encoder Profile | 解像度、fps、bitrate などの profile | 既定または未指定扱い | 配信品質を変える時に使います |
| Caption Profile | 字幕/STT の profile | 字幕なし | 字幕を使う配信だけ選びます |
| Overlay Profile | overlay 表示の profile | overlay なし、または既定 | 参加者表示や時刻表示などを使う時に選びます |
| Archive Profile | 録画と upload の profile | 録画保存や upload が限定されます | 本番では通常選びます |
| YouTube Output | 配信先 | 外部配信なし、または開始前チェックで不足 | 本番配信では通常選びます |
| Encoder Input URL | Discord 以外の映像入力 URL | Discord 音声と生成映像を使う | 外部映像や中継 input を使う時だけ入れます |
| RTMP URL | start 時に直接渡す RTMP/RTMPS URL | YouTube Output の設定を使います | 通常は YouTube Output 側で管理します |

## Discord override の使い分け

Discord Settings で標準 channel を作っておき、Streams では必要な時だけ override します。

| 運用 | Discord Settings | Streams override |
| --- | --- | --- |
| いつも同じ voice channel | 標準の guild / voice / text を入れる | 空欄 |
| テスト配信だけ別 channel | 本番 channel を入れる | テスト用 channel ID を入れる |
| 配信ごとに告知先だけ変える | 標準 text channel を入れる | text channel ID だけ入れる |
| Bot は同じで guild だけ変える | よく使う guild を入れる | guild / voice / text を入れる |

空欄は「未設定」ではなく、「元の config を使う」という意味です。

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
| `worker` | overlay、caption、参加者状態などの event 生成 | 表示イベントや字幕が流れません |
| `encoder_recorder` | FFmpeg、配信、録画、upload | 配信と録画ができません |

`Stream assignment planner` で `missing` が出ている場合は、候補サービスの `assign` を押します。`primary` は実際の dispatch 対象、`standby` は予備です。

## Start前チェック

`Check Readiness` は、Start 前に不足を集めて表示するためのボタンです。Start の前に毎回実行してください。

| チェック | 見る内容 | 対応 |
| --- | --- | --- |
| Service assignment | 必要な service type が primary に割り当て済みか | Service Health または planner で割り当てます |
| Service heartbeat | 割り当て済みサービスが warning / offline ではないか | 対象サービスを起動または再起動します |
| Encoder input URL | URL 形式が妥当か | 空欄でよいか、外部入力が必要か確認します |
| YouTube Output | stream key または OAuth account が ready か | YouTube Outputs と Integrations を見直します |
| Archive Profile | Drive destination や folder ID が ready か | Archive Settings と Drive destination を見直します |
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

## Stream Operations の見方

| 行 | 正常の目安 | 問題がある時 |
| --- | --- | --- |
| Stream operation overview | stream が expected status で進んでいる | starting / stopping が長く残る場合は dispatch と各サービス log を確認 |
| Start preflight | ready | warning / critical の項目を先に解消 |
| Encoder host preflight | ffmpeg、archive dir、output が ready | Encoder Recorder host の dependency、権限、設定を確認 |
| Discord audio | receiving / forwarded が増える | Bot の voice 接続、権限、音声転送先を確認 |
| Encoder audio bridge | packets が届き、last packet age が短い | Bot から Encoder Recorder への到達性を確認 |
| Worker events | event が流れている | Worker assignment と Worker event sidecar を確認 |
| Archive / upload | final MKV / MP4 と upload status が ok | archive profile、Drive destination、disk を確認 |
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
| selected Drive destination folder ID is not configured | 保存先 folder ID が未保存 | Drive destination に folder ID を保存します |
| assigned service is warning/offline | heartbeat が古い | 対象サービスの systemd/Docker 状態と network を確認します |
