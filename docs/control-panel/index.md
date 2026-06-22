# Control Panel画面の全体像

Control Panel は、AutoStream の運用で一番よく触る画面です。配信を作る、Discord や YouTube を設定する、サービスを割り当てる、通知を確認する、ユーザーや権限を管理する、という作業をここに集めています。

このページでは、左メニューのどこで何をするかを先に整理します。細かい入力項目は、各ページで説明します。

画面を実際に操作する順番を知りたい場合は、[Control Panel画面別操作ガイド](/control-panel/page-usage)を見てください。入力欄の意味をまとめて確認したい場合は、[Control Panel項目リファレンス](/control-panel/field-reference)を見てください。各画面の項目ごとに、何を入れるか、いつ使うか、保存後にどこで確認するかをまとめています。

## 最初に見る順番

初回構築では、次の順で進めると迷いにくくなります。

| 順番 | 画面 | ここでやること |
| --- | --- | --- |
| 1 | API Tokens | 各サービスが Control Panel に登録するための token を作る |
| 2 | Service Health | 起動した Discord Bot、Worker、Encoder Recorder が online か確認する |
| 3 | Integrations | OAuth provider、接続アカウント、Google Drive 保存先を登録する |
| 4 | Discord Settings | Discord Bot token とチャンネル ID を登録する |
| 5 | YouTube Outputs | 配信先を登録する |
| 6 | Encoder Profiles / Archive Settings | エンコード、録画、保存の設定を作る |
| 7 | Streams | 配信を作り、サービスを割り当て、開始前チェックを実行する |
| 8 | Monitoring / Incidents | 配信中の状態、通知、異常を確認する |

<div class="tip-box">
実際の token、配信キー、OAuth secret、通知先 URL は、画面では保存できますが表示はされません。保存後は「configured」「fingerprint」「masked target」などの状態表示だけを見て確認します。
</div>

## 左メニューでできること

| メニュー | 使う場面 | 次に読むページ |
| --- | --- | --- |
| Dashboard | いま配信中か、サービスが online か、異常があるかをざっと見る | [ダッシュボード](/control-panel/dashboard) |
| Streams | 配信を作成、設定、開始、停止、再試行する | [配信画面](/control-panel/streams) |
| Encoder Profiles | 画質、fps、bitrate などのエンコード設定を作る | [プロファイル設定](/control-panel/profiles) |
| Discord Settings | Discord Bot token、guild、voice channel を登録する | [DiscordとYouTube](/control-panel/discord-youtube) |
| YouTube Outputs | stream key または Live API の配信先を登録する | [DiscordとYouTube](/control-panel/discord-youtube) |
| Caption/STT Settings | 字幕や文字起こしを使う場合の設定を作る | [プロファイル設定](/control-panel/profiles) |
| Overlay Settings | 表示イベントや overlay に渡す設定を作る | [プロファイル設定](/control-panel/profiles) |
| Archive Settings | 録画、保存、Google Drive upload の設定を作る | [プロファイル設定](/control-panel/profiles) |
| Integrations | OAuth provider、OAuth connected account、Drive destination を管理する | [OAuthとDrive保存先](/control-panel/integrations-drive) |
| Worker Management | Worker を配信へ割り当てる | [サービス割り当て](/control-panel/services-workers) |
| Service Health | 登録済みサービス、heartbeat、capability、runtime config を確認する | [サービス割り当て](/control-panel/services-workers) |
| Users | 管理者や運用者を作る、lock、disable、password reset をする | [ユーザーとセキュリティ](/control-panel/users-roles-security) |
| Roles | ロール名と権限を管理する | [ユーザーとセキュリティ](/control-panel/users-roles-security) |
| Security Settings | password policy、MFA、Passkey、secret 更新を管理する | [ユーザーとセキュリティ](/control-panel/users-roles-security) |
| API Tokens | サービス bootstrap token を作成、rotate、revoke する | [監査ログとAPIトークン](/control-panel/audit-tokens) |
| Audit Logs | 操作履歴を検索、CSV export する | [監査ログとAPIトークン](/control-panel/audit-tokens) |
| Monitoring / Metrics | metric snapshot、配信状態、通知配信を確認する | [監視と通知](/control-panel/observability) |
| Incidents / Diagnostics / Remediation | 異常、原因候補、推奨対応、承認が必要な対応を確認する | [監視と通知](/control-panel/observability) |
| Notification Channels | Discord、Slack、generic webhook、email 通知先を登録する | [監視と通知](/control-panel/observability) |

## どの値をどこに入れるか

AutoStream では、値の置き場所を分けると運用しやすくなります。

| 値の種類 | 置き場所 | 理由 |
| --- | --- | --- |
| Control Panel の公開 URL、database URL、session secret | サーバー env | 起動前に必要 |
| サービスの `SERVICE_ID`、`SERVICE_PUBLIC_URL`、`CONTROL_PANEL_URL` | 各サービスの env | サービス登録前に必要 |
| サービス登録用の one-time token | API Tokens で作成し、各サービス env に一度だけ投入 | 登録後は rotate / revoke しやすくする |
| Discord Bot token | Discord Settings | Discord Bot だけが runtime config として読む |
| YouTube stream key | YouTube Outputs | Encoder Recorder へ配信開始時だけ渡す |
| Google Drive folder ID、OAuth refresh token | Integrations / Drive destination | 保存先変更を Control Panel から管理する |
| 通知先 webhook、SMTP password | Notification Channels | 通知設定の追加、停止、test を画面で行う |
| 配信ごとの Discord channel override、profile 選択 | Streams | 配信単位で変える値として扱う |

## 日常運用でよく使う流れ

### 配信前

1. Dashboard で Open Incidents がないか確認します。
2. Service Health で Discord Bot、Worker、Encoder Recorder が online か確認します。
3. Streams で対象配信を選びます。
4. Discord Config、YouTube Output、Archive Profile、Encoder Profile を確認します。
5. Stream assignment planner で必須サービスがそろっているか確認します。
6. Check Readiness を実行します。
7. Encoder host preflight、Discord audio、Worker events、Archive / upload の警告を確認します。
8. 問題がなければ Start を押します。

### 配信中

1. Dashboard で Active Stream と Open Incidents を確認します。
2. Monitoring で Encoder、Audio、Worker、Archive の metric を確認します。
3. Streams の Stream Operations で starting / live / stopping の状態を確認します。
4. 音声が怪しい場合は Discord Audio と Encoder audio bridge を確認します。
5. overlay や caption が怪しい場合は Worker events を確認します。

### 配信後

1. Streams で Stop を押します。
2. Archive / upload の status を確認します。
3. final MKV、final MP4、upload result を確認します。
4. YouTube Live API を使っている場合は Retry YouTube Complete が必要ないか確認します。
5. 失敗がある場合は Retry Upload、Incidents、Diagnostics の順に確認します。

## 操作ボタンの考え方

| ボタン | 使うタイミング | 注意 |
| --- | --- | --- |
| Save Settings | 配信の設定だけ保存したいとき | 保存だけでは配信は始まりません |
| Check Readiness | Start 前の不足確認 | Start の前に毎回使うのが安全です |
| Start | 配信を開始する | readiness warning がある場合は先に解消します |
| Stop | 配信を止める | 停止後に録画処理と upload が続く場合があります |
| Retry Upload | 録画はできたが保存先 upload に失敗したとき | Encoder Recorder が対象です |
| Retry YouTube Complete | YouTube Live API の配信終了処理だけ再試行したいとき | stream key mode では通常使いません |
| Test Channel | 通知先へ test 通知を送る | 通知先の secret は表示されません |
| Rotate / Revoke | サービス token を入れ替える、無効化する | rotate 後はサービス側 env 更新が必要です |

## 困ったときの見方

| 状況 | まず見る画面 | 次に見る画面 |
| --- | --- | --- |
| Start できない | Streams の Check Readiness | Service Health、Audit Logs |
| Bot が voice channel に入らない | Discord Settings | Service Health、Incidents |
| 音声が出ない | Streams の Discord Audio / Audio Bridge | Metrics、Diagnostics |
| 映像や録画が止まる | Encoder host preflight | Metrics、Incidents |
| Google Drive に保存されない | Archive Settings / Drive destination | Incidents、Retry Upload |
| 通知が来ない | Notification Channels の Test | Notification Deliveries |
| 誰が設定を変えたか知りたい | Audit Logs | Users / Roles |

Control Panel の各画面は、次のページから順番に確認してください。

- [Control Panel画面別操作ガイド](/control-panel/page-usage)
- [ダッシュボード](/control-panel/dashboard)
- [Control Panel項目リファレンス](/control-panel/field-reference)
- [配信画面](/control-panel/streams)
- [プロファイル設定](/control-panel/profiles)
- [DiscordとYouTube](/control-panel/discord-youtube)
- [OAuthとDrive保存先](/control-panel/integrations-drive)
- [サービス割り当て](/control-panel/services-workers)
- [ユーザーとセキュリティ](/control-panel/users-roles-security)
- [監視と通知](/control-panel/observability)
- [監査ログとAPIトークン](/control-panel/audit-tokens)
