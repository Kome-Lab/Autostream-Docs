# DiscordとYouTube

このページでは、Discord Settings と YouTube Outputs の使い方を説明します。どちらも配信開始に直結するため、保存後は Streams の Check Readiness で確認します。

## Discord Settings

Discord Settings は、登録済み Discord Bot Node と Bot token、音声転送、再接続ポリシーを登録する画面です。Bot が入る guild / voice channel と chat 表示用 text channel は Streams の配信枠で指定します。

Discord Bot の登録は OAuth ログインではありません。Discord developer portal で発行した Bot token を Control Panel に保存し、Discord Bot service は runtime config と runtime secret resolve でその token を受け取ります。Integrations の OAuth Provider は管理画面ログイン用で、YouTube / Drive の権限は OAuth Connected Account として接続します。

### 入力項目

| 項目 | 説明 | 空欄にした場合 |
| --- | --- | --- |
| Existing config | 編集対象 | 新規作成 |
| Name | 設定名 | 保存できません |
| Discord BOT Node | この設定を読む登録済み Discord Bot Node | Bot 側で一致しないと runtime config を受けられません |
| Bot token | Discord Bot token | 既存編集時は空欄なら保持 |
| Enable audio forward | Discord 音声を Encoder Recorder へ送る | off だと音声配信に使えません |
| Reconnect voice automatically | voice 切断時に再接続する | off だと手動対応が増えます |
| Reconnect attempts | 再接続試行回数 | 1 以上が必要 |
| Reconnect base delay | 最初の再接続待ち | 例: `2s` |
| Reconnect max delay | 最大待ち時間 | 例: `30s` |

### 作成手順

1. Discord Developer Portal で Bot を作ります。
2. Bot を対象 server に招待します。
3. Bot に voice channel への接続権限と発話権限を付けます。
4. Control Panel の Node登録で Discord Bot 用 Node を作り、`config.yml` を保存して Discord Bot service を起動します。
5. Service Health で Discord Bot が online になったことを確認します。
6. Discord Settings を開きます。
7. `Discord BOT Node` で online になっている Discord Bot Node を選びます。
8. Bot token を保存します。
9. Streams でこの Discord Config を選び、配信枠ごとの Discord Guild ID、VC Channel ID、必要なら Chat Channel ID を保存します。VC参加で開始する待機枠は `Discord VC参加で自動開始` をONにします。
10. Check Readiness を実行します。

### VC参加で自動開始されるか

Discord Bot が primary assignment になっていて、Node Runtime Token に `streams.start` scope があり、runtime config に対象 stream の Discord Config と `auto_start_trigger: discord_voice_join` が配布されている場合、対象 VC にユーザーが参加すると Control Panel に auto-start を要求します。

1. ユーザーが Streams の配信枠に保存した voice channel に参加します。
2. Discord Bot が VoiceStateUpdate を受け取り、guild / voice channel から対象 stream を特定します。
3. Discord Bot が `POST /services/streams/{id}/start` を Node Runtime Token で呼びます。
4. Control Panel は、その token が対象 stream の primary Discord Bot に紐づき、配信枠が `Discord VC参加で自動開始` ONの待機状態である場合だけ開始を許可します。
5. Control Panel が Discord Bot、Worker、Encoder Recorder へ通常の start job を送ります。
6. Bot が voice channel に参加し、stream が active になった後は参加/退出を参加者状態として記録します。
7. Stream settings の Text channel ID がある場合、開始後にその channel へ投稿された新規messageを Worker へ `overlay.discord_chat` として送ります。

auto-start は保存済みの Stream settings だけを使います。Discord Bot からの要求 body で YouTube Output、Discord Config、入力URLを上書きすることはできません。同じ guild / voice channel に複数の auto-start 有効streamが紐づく場合は、誤配信を避けるため自動開始しません。

Discord Bot は runtime config を定期的に再読込するため、Bot起動後に追加した待機中の配信枠も、次回 refresh 後に VC参加auto-startの候補になります。refresh間隔は Discord Bot の `CONTROL_PANEL_RUNTIME_CONFIG_REFRESH_INTERVAL` で調整できます。

### VC空室時の自動停止と既存Botの移行

`Discord VC参加で自動開始` が有効な配信枠は、primary assignment の Discord Bot が対象VCのユーザー不在を検知すると、同じ配信枠の停止を Control Panel に要求できます。この要求には、開始用の `streams.start` と対になる `streams.stop` scope が必要です。開始・停止の対象や配信設定は Control Panel に保存された値だけで判定され、Botから任意の配信枠を停止することはできません。

既に稼働している Discord Bot の Node Runtime Token へ `streams.stop` は自動追加されません。Control Panel 更新後に次の操作を一度行ってください。

1. Node登録で対象の Discord Bot Node を開き、Configure Token を再生成します。
2. 一度だけ表示される設定を Bot ホストへ適用します。
3. Discord Bot service を再起動します。
4. Service Health で Bot が online に戻り、runtime config の取得に成功していることを確認します。

この明示的な Configure 完了時だけ、既存の `streams.start` を持つ Discord Bot の後継トークンに `streams.stop` が追加され、対象Botの Node Runtime Token が切り替わります。この権限追加の対象になる、更新前に発行した未使用の Configure Token は安全のため無効になり、再発行が必要です。Configure Token を発行しただけでは切り替わりません。Node登録を実行する管理者にも `streams.stop` の実行権限が必要で、権限が不足する場合は発行を拒否します。

### よくある確認ポイント

| 状況 | 見るところ |
| --- | --- |
| Bot が voice channel に入らない | Bot の招待、Discord 権限、Guild ID、Voice channel ID |
| VCが空になっても配信が止まらない | Discord Bot を再Configureして再起動済みか、Bot Node Runtime Token に `streams.stop` があるか、対象枠が `Discord VC参加で自動開始` か |
| Bot は入るが音声が流れない | Enable audio forward、Encoder Recorder 割り当て、Audio Bridge |
| 接続が何度も切れる | Reconnect attempts、Reconnect delay、Discord 側の network 状態 |
| Chat 表示が出ない | Streams の Text channel ID、Discord Bot の Message Content Intent、Worker event 到達性 |
| 字幕が出ない | Caption Profile、Worker events |
| Streams 側で別 channel を使いたい | Streams の Discord Guild ID / VC Channel ID / Chat Channel ID |

## YouTube Outputs

YouTube Outputs は、配信先を登録する画面です。既存 stream key を使う方式と、YouTube Live API を使う方式があります。

### mode の違い

| Mode | 使い方 | 必要なもの |
| --- | --- | --- |
| Existing stream key | YouTube Studio で作成した配信キーへ送る | RTMPS URL、stream key |
| Live API dry-run | Live API の設定を確認するが本番作成は抑える | Google OAuth connected account |
| Live API | Control Panel から broadcast / stream 作成を行う | Google OAuth connected account、YouTube scope |
| 固定Relay（YouTube Live API） | root管理の固定Relayと再利用するYouTube Live Streamを使ってbroadcastを作成する | Google OAuth connected account、固定RelayバインディングID、再利用するYouTube Live Stream ID |

初回は `Existing stream key` または `Live API dry-run` で始めると切り分けやすくなります。

### 入力項目

| 項目 | 説明 | 注意 |
| --- | --- | --- |
| Existing output | 編集対象 | 空欄なら新規作成 |
| Name | 出力名 | Streams で選ぶ名前になります |
| Mode | stream key / Live API dry-run / Live API / 固定Relay（YouTube Live API） | mode により必須項目が変わります |
| RTMPS URL | 配信先 ingest URL | stream key 方式では必須 |
| Stream key | YouTube の stream key | 保存後は表示されません |
| YouTube視聴URL | 視聴者が開く `https://www.youtube.com/watch?v=...` | `stream_key`方式の新規設定ではprofileへ入力し、Discord開始通知に使います。`Live API`と固定Relay（YouTube Live API）は開始後にControl Panelがpublic URLを生成し、固定Relay profileの`watch_url`入力は受け付けません |
| OAuth connected account | Live API系の接続アカウント | Integrations で先に作ります |
| 固定RelayバインディングID | `relay-` + 小文字UUID形式の非secret ID（例: `relay-123e4567-e89b-42d3-a456-426614174000`） | 固定Relay（YouTube Live API）では必須。Encoderの`live_api_static`設定とRelay側の設定に一致させます |
| 再利用するYouTube Live Stream ID | 事前に作成した再利用可能なYouTube Live Streamの非secret ID | 固定Relay（YouTube Live API）では必須。stream keyや視聴URLではありません |
| Privacy | `private`、`unlisted`、`public` | 初回は private 推奨 |
| Latency | `normal`、`low`、`ultra_low` | 安定重視なら normal |
| Broadcast title template | Live API で作る broadcast title | `{{stream_name}}` のように配信名を使えます |
| Broadcast description | Live API で作る説明文 | 公開される可能性がある内容だけ書きます |
| Enable auto start | 配信開始時に YouTube 側も開始する | Live API mode で使います |
| Enable auto stop | 配信停止時に YouTube 側も停止する | Live API mode で使います |
| Complete broadcast on stream stop | Stop 後に broadcast 完了処理をする | 失敗時は Retry YouTube Complete |

### YouTube自動開始の成立条件

YouTube 側まで自動で開始したい場合は、YouTube Output を `Live API` mode にし、OAuth connected account と `Enable auto start` を設定します。Control Panel は start 時に YouTube broadcast / live stream を作成して bind し、YouTube API の `enableAutoStart` / `enableAutoStop` 設定を渡します。その後、Encoder Recorder が RTMPS ingest を開始すると YouTube 側の条件に従って配信が開始されます。

### 固定Relayの互換経路と新方式

固定relayには、既存の`stream_key`を継続する互換経路と、新しい`live_api_relay_static`を明示的に使う経路があります。Control PanelのYouTube Output modeだけを変更して、relayの配信先や既存keyを自動変換することはありません。

| 用途 | Encoderの実効relay mode | YouTube Output mode | 条件 |
| --- | --- | --- | --- |
| 既存の固定key relayを継続 | `legacy_stream_key` | `stream_key` | relay URLを設定し、modeは未設定または明示的に`legacy_stream_key`。既存relayの固定keyをそのまま使います |
| 固定relayでYouTube Live APIを使う | `live_api_static` | `live_api_relay_static` | relay URL、同じ非secret binding ID、再利用するYouTube Live Streamがreadyです |
| relayを使わない構成 | `direct` | `stream_key`、`live_api`、`live_api_dry_run`（`live_api_relay_static`は不可） | relay URLを設定しません。productionのrelay必須policyは別途満たす必要があります |

通常の`Live API`と`Live API dry-run`は`direct` Encoderでだけ使えます。`legacy_stream_key`、`live_api_static`、またはrelay capabilityを報告していないEncoderへは開始前に拒否されます。relay capabilityが未報告または未知のEncoderは、移行互換として`stream_key`だけを使えます。既存の固定relayへ動的なbroadcast用keyを推測して流すfallbackはありません。

段階的な更新では、旧Encoderが報告するhistorical capability `static`をControl Panelが`legacy_stream_key`として扱います。これは既存の`stream_key` relayを継続する互換だけで、`live_api_relay_static`を有効にするものではありません。新しいEncoderでは`direct`、`legacy_stream_key`、`live_api_static`だけを使い、envや画面で`static`を新しいmodeとして選びません。

### 固定Relay（YouTube Live API）の運用条件

`固定Relay（YouTube Live API）`（`live_api_relay_static`）は、root管理の固定Relayとその接続キーが、事前に作成した再利用可能なYouTube Live Streamへ固定で対応付けられている場合だけ使います。Encoder側も`AUTOSTREAM_OUTPUT_RELAY_MODE=live_api_static`である必要があります。通常の `Live API`（`live_api`）をこの固定Relayへ向けることはできず、Control Panel は開始前にfail closedで拒否します。

- 固定Relayホストの非秘密 `AUTOSTREAM_OUTPUT_RELAY_BINDING_ID` と、YouTube Outputの非secret `relay_binding_id` を一致させます。値は`relay-` + 小文字UUID形式（例: `relay-123e4567-e89b-42d3-a456-426614174000`）だけを使います。あわせて `reusable_live_stream_id` を必ず入力します。固定RelayのRTMPS URL、stream key、profileの`watch_url`はこのmodeの入力ではありません。
- 開始で作成したbroadcast IDからControl Panelが生成するpublic YouTube視聴URLは、profileの`watch_url`入力とは別のruntime値です。このURLはsecretではなく、Chat Channelがある本番配信のDiscord開始通知に使えます。固定Relay profileへ同じURLを手入力・保存しません。
- 生のstream keyは、Control Panelの画面、運用メモ、このドキュメント、ログへ入力・貼り付け・コピーしません。固定Relay側のroot管理された設定だけで扱います。
- `Complete broadcast on stream stop` は常に有効です。固定Relay modeでは無効化できません。
- 1つの `relay_binding_id` は同時に1つの配信枠だけで使えます。開始中・停止完了待ち・復旧判断中の枠がある間は、同じbindingで別の枠を開始しません。

### 既存固定Relayからの移行とロールバック

既存の固定Relayで`stream_key` Outputを使っている場合は、既存profileとrelayのroot管理設定を変更しないまま、Encoderのrelay modeを未設定（URLあり）または明示的な`legacy_stream_key`として継続できます。既存のstream keyをControl Panelへ再入力したり、relay設定からコピーしたりしません。

新方式へ移るときは、停止済みの時間帯に別の`live_api_relay_static` Outputを作ります。Google OAuth account、`relay-` + 小文字UUID形式の`relay_binding_id`、再利用Live Stream IDを登録し、relay側がその再利用Live Streamへ固定対応していることをkeyを表示せずに確認します。形式不正・不一致のrelay設定は`unavailable`であり`direct`へのfallbackではありません。修正後にEncoderを`live_api_static`と同じbinding IDへ変更し、Check Readiness、Service Health、短い開始・停止を順に確認します。既存`stream_key` Outputの自動変換や、同一profileへの秘密値の複製は行いません。

戻す場合は、新方式の配信枠を停止してinactiveになったことを確認します。開始結果が不明な場合は、先に下の固定Relay復旧を完了します。配信枠のOutput選択を既存の`stream_key` profileへ戻してから、Encoderのrelay modeを`legacy_stream_key`（または既存URLのmode未設定）へ戻します。復旧が未完了のbindingを別の配信枠へ使い回しません。

### 固定Relayの復旧

Streamsでは`failed`または`completed`の固定Relay配信枠に確認付き復旧アクションが表示されることがあります。開始結果で固定Relayの復旧が必要と表示された場合、または前回の固定Relay開始結果が不明な場合だけ使います。回復claimがない状態で実行しても、Control Panelは`回復が必要な状態ではありません`として拒否し、relayやYouTube側を変更しません。対象の配信枠がinactiveであることを確認してから実行します。通常の開始を再試行したり、同じbindingを別の配信枠へ再利用したりする前に、復旧が必要な場合だけこの操作を完了させてください。

- `Prepare`済みで、まだdispatchしていないことが記録された既知のBroadcastは、確認付き復旧アクションがYouTube providerへ`Delete`を試行します。providerが`404`を返した場合も、すでに削除済みとして成功扱いです。
- dispatchされた可能性がある既知のBroadcastは、割り当て済みEncoderの停止証跡を確認してから、YouTube providerへ`Complete`を実行します。停止証跡を取得できない場合は復旧を完了させず、通常の開始も再試行しません。
- provider上のBroadcastが不明な場合だけ、YouTube Studioで孤立したBroadcastの外部cleanupが完了したことを運用者が明示確認（attestation）してから、確認付き復旧アクションを実行します。Broadcastが不明なままproviderの`Delete`や`Complete`を推測して実行しません。
- この操作はStreamsで明示確認して実行する復旧専用の操作です。stream keyは表示も入力もされません。

`Existing stream key` mode は、AutoStream から RTMPS へ送信するための方式です。YouTube Studio 側の設定によっては、Live Control Room で手動開始が必要です。`Live API dry-run` は設定確認用で、本番 broadcast を作成しません。

`Existing stream key` modeの既存profileは、API互換性のためYouTube視聴URLが空でも読込と更新ができます。ただしChat Channel IDを設定してDiscord開始通知を使う配信では、有効な視聴URLがreadinessの必須項目です。新規profileは画面で視聴URLを入力してください。`Live API` modeと固定Relay（YouTube Live API）は作成したbroadcast IDからControl Panelがpublic YouTube視聴URLをruntimeで生成します。固定Relay profileへ`watch_url`は入力できません。この生成URLはDiscord通知に使えます。

Stop 時は `Complete broadcast on stream stop` が有効な場合に YouTube broadcast の完了処理を行います。完了に失敗した場合は、Retry YouTube Complete で再実行します。

### Existing stream key の手順

1. YouTube Studio で配信枠または再利用する stream key を用意します。
2. YouTube Outputs を開きます。
3. Mode を `Existing stream key` にします。
4. RTMPS URL、stream key、YouTube視聴URLを入れます。
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

## DiscordへのYouTube開始通知

StreamsでChat Channel IDを明示した本番配信、またはStream側を空欄にして選択済みDiscord Configの既定Chat Channelを使う本番配信は、すべてのprimary serviceのstart成功後、streamが`live`になってからDiscord Botへ通知を依頼します。Streamに明示したChat Channel IDがある場合はそちらが優先されます。Discord Botは通知直前にruntime configを再取得し、自身がprimaryであること、active jobのstream ID、保存済みtext channel IDが一致することを確認します。request bodyからchannel IDを指定または上書きすることはできません。

投稿内容は固定文とcanonicalなYouTube視聴URLだけで、user mention、role mention、everyone mentionは無効です。`stream_key`では保存済みprofile URL、`Live API`と固定Relay（YouTube Live API）では開始後に生成したpublic runtime URLを使います。`Live API dry-run`、Chat Channel IDなし、視聴URLなしの構成では投稿しません。通知が失敗してもstreamは`live`のままで、本配信と録画をrollbackしません。Control Panelは429と5xxを短時間再試行し、結果を開始responseと監査ログへ残します。監査metadataには視聴URLそのものではなくfingerprintだけを保存します。

同じ開始処理の再送は`event_id`で重複を抑止します。ただしDiscord Botのreceiptはprocess内だけに保持されるため、Bot再起動やDiscord応答が不明な境界では重複投稿が起こる可能性があります。重要な配信では開始後に対象channelを一度確認してください。

## よくあるトラブル

| 表示または状況 | 対応 |
| --- | --- |
| stream key is not configured | YouTube Outputs で stream key を再保存します |
| OAuth connected account is not ready | Integrations で Google account を接続し直します |
| Bot token missing | Discord Settings で Bot token を保存します |
| Discord audio not receiving | Bot が voice channel にいるか、権限があるか確認します |
| YouTube視聴URLの通知が出ない | StreamsのChat Channel ID、BotのSend Messages権限、開始結果を確認します。`stream_key`はprofileの視聴URL、`Live API`/固定Relayは生成されたpublic runtime URLとOutput readinessを確認します |
| 配信はliveだが通知だけ失敗 | 配信は止めず、Discord Bot logと開始responseの`discord_notification`を確認します |
| YouTube complete が失敗 | Stop 後に Retry YouTube Complete を実行します |
