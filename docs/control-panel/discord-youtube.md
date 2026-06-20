# DiscordとYouTube

このページでは、Discord Settings と YouTube Outputs の使い方を説明します。どちらも配信開始に直結するため、保存後は Streams の Check Readiness で確認します。

## Discord Settings

Discord Settings は、Discord Bot がどの server / channel に入るか、どの token を使うかを登録する画面です。

### 入力項目

| 項目 | 説明 | 空欄にした場合 |
| --- | --- | --- |
| Existing config | 編集対象 | 新規作成 |
| Name | 設定名 | 保存できません |
| Bot service ID | この設定を読む Discord Bot の service ID | Bot 側で一致しないと runtime config を受けられません |
| Guild ID | Discord server の ID | Streams 側で override しない限り不足 |
| Voice channel ID | Bot が参加する voice channel の ID | Streams 側で override しない限り不足 |
| Text channel ID | 通知や補助投稿に使う channel ID | 任意 |
| Bot token | Discord Bot token | 既存編集時は空欄なら保持 |
| STT profile ID | 字幕/STT 用 profile ID | 任意 |
| Enable audio forward | Discord 音声を Encoder Recorder へ送る | off だと音声配信に使えません |
| Reconnect voice automatically | voice 切断時に再接続する | off だと手動対応が増えます |
| Reconnect attempts | 再接続試行回数 | 1 以上が必要 |
| Reconnect base delay | 最初の再接続待ち | 例: `2s` |
| Reconnect max delay | 最大待ち時間 | 例: `30s` |
| Enable captions/STT forwarding | 字幕/STT 連携を有効化 | 字幕を使わない場合は off |

### 作成手順

1. Discord Developer Portal で Bot を作ります。
2. Bot を対象 server に招待します。
3. Bot に voice channel への接続権限と発話権限を付けます。
4. Control Panel の API Tokens で Discord Bot 用 token を作り、Discord Bot service を起動します。
5. Service Health で Discord Bot が online になったことを確認します。
6. Discord Settings を開きます。
7. `Bot service ID` に online になっている Discord Bot の `SERVICE_ID` を入れます。
8. guild、voice channel、必要なら text channel を入れます。
9. Bot token を保存します。
10. Streams でこの Discord Config を選び、Check Readiness を実行します。

### よくある確認ポイント

| 状況 | 見るところ |
| --- | --- |
| Bot が voice channel に入らない | Bot の招待、Discord 権限、Guild ID、Voice channel ID |
| Bot は入るが音声が流れない | Enable audio forward、Encoder Recorder 割り当て、Audio Bridge |
| 接続が何度も切れる | Reconnect attempts、Reconnect delay、Discord 側の network 状態 |
| 字幕が出ない | Enable captions/STT forwarding、Caption Profile、Worker events |
| Streams 側で別 channel を使いたい | Streams の Discord override |

## YouTube Outputs

YouTube Outputs は、配信先を登録する画面です。既存 stream key を使う方式と、YouTube Live API を使う方式があります。

### mode の違い

| Mode | 使い方 | 必要なもの |
| --- | --- | --- |
| Existing stream key | YouTube Studio で作成した配信キーへ送る | RTMPS URL、stream key |
| Live API dry-run | Live API の設定を確認するが本番作成は抑える | Google OAuth connected account |
| Live API | Control Panel から broadcast / stream 作成を行う | Google OAuth connected account、YouTube scope |

初回は `Existing stream key` または `Live API dry-run` で始めると切り分けやすくなります。

### 入力項目

| 項目 | 説明 | 注意 |
| --- | --- | --- |
| Existing output | 編集対象 | 空欄なら新規作成 |
| Name | 出力名 | Streams で選ぶ名前になります |
| Mode | stream key / Live API dry-run / Live API | mode により必須項目が変わります |
| RTMPS URL | 配信先 ingest URL | stream key 方式では必須 |
| Stream key | YouTube の stream key | 保存後は表示されません |
| OAuth connected account | Live API 用の接続アカウント | Integrations で先に作ります |
| Privacy | `private`、`unlisted`、`public` | 初回は private 推奨 |
| Latency | `normal`、`low`、`ultra_low` | 安定重視なら normal |
| Broadcast title template | Live API で作る broadcast title | `{{stream_name}}` のように配信名を使えます |
| Broadcast description | Live API で作る説明文 | 公開される可能性がある内容だけ書きます |
| Enable auto start | 配信開始時に YouTube 側も開始する | Live API mode で使います |
| Enable auto stop | 配信停止時に YouTube 側も停止する | Live API mode で使います |
| Complete broadcast on stream stop | Stop 後に broadcast 完了処理をする | 失敗時は Retry YouTube Complete |

### Existing stream key の手順

1. YouTube Studio で配信枠または再利用する stream key を用意します。
2. YouTube Outputs を開きます。
3. Mode を `Existing stream key` にします。
4. RTMPS URL と stream key を入れます。
5. Privacy と Latency を選びます。
6. 保存します。
7. Streams で YouTube Output を選び、Check Readiness を実行します。

### Live API の手順

1. Integrations で Google OAuth provider を作ります。
2. YouTube scope を含む OAuth connected account を作ります。
3. YouTube Outputs で Mode を `Live API dry-run` にします。
4. OAuth connected account を選びます。
5. title template、description、privacy、latency を設定します。
6. dry-run 配信で readiness と dispatch を確認します。
7. 問題がなければ Mode を `Live API` に切り替えます。

## Streamsとの関係

YouTube Outputs と Discord Settings は、作成しただけでは使われません。Streams で対象配信に選ぶ必要があります。

1. Streams を開きます。
2. 対象 stream を選びます。
3. `Discord Config` を選びます。
4. `YouTube Output` を選びます。
5. `Save Settings` を押します。
6. `Check Readiness` を押します。

## よくあるトラブル

| 表示または状況 | 対応 |
| --- | --- |
| stream key is not configured | YouTube Outputs で stream key を再保存します |
| OAuth connected account is not ready | Integrations で Google account を接続し直します |
| Bot token missing | Discord Settings で Bot token を保存します |
| Discord audio not receiving | Bot が voice channel にいるか、権限があるか確認します |
| YouTube complete が失敗 | Stop 後に Retry YouTube Complete を実行します |
