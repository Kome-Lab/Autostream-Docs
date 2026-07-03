# Control Panel画面別操作ガイド

このページは、Control Panel を開いたあとに「どの画面で、何を押し、保存後に何を確認するか」を調べるための操作ガイドです。項目名の意味だけを確認したい場合は、[項目リファレンス](/control-panel/field-reference)を使ってください。

Control Panel は設定を保存するだけでなく、各サービスへ配信開始や停止を指示します。初めて使う場合は、画面を上から順に埋めるより、次の順番で進めると安全です。

1. Node登録でサービス用 Node を作り、`config.yml` を保存する。
2. 各サービスを起動し、Service Health で online を確認する。
3. Integrations、Discord Settings、YouTube Outputs、Archive Settings を作る。
4. Streams で配信を作成し、必要な設定とサービスを割り当てる。
5. Check Readiness を実行してから Start する。
6. Dashboard、Monitoring、Incidents、Audit Logs で状態を見る。

## Dashboard

Dashboard は、配信前と配信中に最初に見る画面です。ここでは設定を変更せず、「今すぐ見るべき異常があるか」を判断します。

| 操作 | 見る場所 | 判断 |
| --- | --- | --- |
| 配信前の確認 | Active Stream、Services、Open Incidents | active stream が想定通りで、必要サービスが online、open incident がないこと |
| 配信中の監視 | Metric summary、Notification Deliveries | FPS、音声、Worker event、upload が止まっていないこと |
| 異常時の入口 | Open Incidents、Pending Remediation | incident がある場合は Incidents / Diagnostics へ進む |
| 直近操作の確認 | Recent Audit Logs | 誰が Start / Stop / 設定変更をしたか確認する |

Dashboard の数字だけで原因を決めないでください。原因確認は、Streams、Service Health、Incidents、Metrics の専用画面で行います。

## Streams

Streams は、配信を作り、設定を選び、サービスを割り当て、開始・停止する画面です。日常運用で一番よく触ります。

### 新しい配信を作る

1. `New Stream Name` に運用で識別しやすい名前を入れます。
2. 既に作成済みの `Discord Config`、`YouTube Output`、`Encoder Profile`、`Archive Profile` を選びます。
3. 必要なら `Caption Profile` と `Overlay Profile` を選びます。
4. `Create Stream With Current Settings` を押します。
5. `Stream` の選択が新しい配信に切り替わったことを確認します。
6. `Save Settings` を押し、選択した設定を保存します。

配信名は通知や監査ログにも出ます。`本番配信` だけではなく、日付、番組名、用途が分かる名前にしておくと後から追いやすくなります。

### 既存配信を編集する

1. `Stream` で対象配信を選びます。
2. 画面上部の選択名を見て、間違った配信を触っていないか確認します。
3. 変更したい profile、Discord、YouTube、Archive を選び直します。
4. 変更理由が分かる状態で `Save Settings` を押します。
5. `View Stream Audit` または Audit Logs で保存操作が残っているか確認します。
6. 配信開始前なら `Check Readiness` を実行します。

### Discord override の使い方

`Discord Guild ID Override`、`Discord Voice Channel ID Override`、`Discord Text Channel ID Override` は、配信ごとに Discord の接続先だけ変えたい時に使います。

| 状況 | 入力するもの | 空欄にするもの |
| --- | --- | --- |
| 通常運用 | Discord Settings 側に標準 guild / channel を保存 | Streams の override は空欄 |
| テスト配信だけ別 voice channel | テスト用 voice channel ID | guild が同じなら guild override は空欄 |
| 告知先だけ変える | text channel ID | voice channel override は空欄 |
| 別 guild で検証する | guild ID、voice channel ID、必要なら text channel ID | なし |

空欄は「未設定」ではなく「Discord Settings の値を使う」という意味です。

### Check Readiness の見方

`Check Readiness` は、Start 前に不足している設定やサービスをまとめて確認するボタンです。Start の前に毎回実行してください。

| 表示 | 意味 | 対応 |
| --- | --- | --- |
| ready | Start できる状態 | Start 前に配信先と保存先を再確認する |
| warning | 開始は可能でも確認が必要 | 表示された項目を読んで、意図した warning か判断する |
| critical | Start すべきではない不足 | 該当画面で設定またはサービスを直す |
| missing assignment | 必要サービスが primary ではない | Service Health または assignment planner で割り当てる |
| warning / offline service | heartbeat が古い | 対象サービスの systemd / Docker / network を確認する |

### Start / Stop / Retry

| ボタン | 使うタイミング | 押した後に見る場所 |
| --- | --- | --- |
| Start | readiness が通り、配信先と録画設定が確定した後 | Stream operation overview、Last dispatch、Metrics |
| Stop | 配信を終了する時 | Archive / upload、YouTube complete、Audit Logs |
| Retry Upload | 録画は完了したが保存先 upload だけ失敗した時 | Archive / upload、Notification Deliveries |
| Retry YouTube Complete | YouTube Live API の終了処理だけ失敗した時 | YouTube Output、Last dispatch |
| View Stream Audit | 操作履歴を追いたい時 | Audit Logs |

Stop 後も録画の remux、MP4 化、upload が続く場合があります。画面上で stopped に見えても、Archive / upload が完了するまで結果確認を続けます。

## Encoder Profiles

Encoder Profiles は、配信品質をまとめて保存する画面です。Encoder Recorder が FFmpeg へ渡す設定の元になります。

### 作成手順

1. `Name` に用途が分かる名前を入れます。
2. `Config JSON` に解像度、fps、bitrate、preset などを入れます。
3. 低負荷テスト用と本番用を分けて作ります。
4. 保存後、Streams の `Encoder Profile` で選びます。
5. Start 前に Encoder host preflight を確認します。
6. 配信中は Metrics の `Output FPS`、`Output Bitrate`、`Dropped Frames` を見ます。

### 使い分け

| 用途 | 目安 |
| --- | --- |
| 初回検証 | 720p、30fps、低めの bitrate |
| 通常配信 | 1080p、30fps または 60fps |
| 高画質配信 | CPU/GPU と回線に余裕がある場合だけ bitrate を上げる |
| 障害切り分け | preset を軽くし、Dropped Frames が減るか確認する |

高画質にするほど host 負荷、回線、YouTube 側の安定性に影響します。最初から高い値にせず、Metrics を見ながら上げてください。

## Discord Settings

Discord Settings は、Bot が入る Discord server / channel と token を保存する画面です。

### 作成手順

1. Discord Developer Portal で Bot を作成し、必要な権限で server に招待します。
2. Discord の開発者モードを有効にし、guild ID、voice channel ID、必要なら text channel ID をコピーします。
3. Control Panel の Node登録で Discord Bot 用 Node を作り、`config.yml` を保存します。
4. Discord Bot service を起動し、Service Health で online を確認します。
5. Discord Settings を開きます。
6. `Bot service ID` に online の Discord Bot の Node ID を入れます。
7. `Guild ID`、`Voice channel ID`、`Text channel ID` を入れます。
8. `Bot token` を保存します。保存後は raw value は表示されません。
9. `Enable audio forward` を有効にします。
10. Streams でこの Discord Config を選び、Check Readiness を実行します。

### 確認ポイント

| 見る場所 | 正常の目安 |
| --- | --- |
| Service Health | `discord_bot` が online / healthy |
| Streams の Discord audio | receiving、packet age が短い |
| Encoder audio bridge | forwarded が増え、forward errors が増えない |
| Incidents | Discord audio 系の open incident がない |

Bot が voice channel に入らない場合は、まず Discord 側の招待範囲、Connect / Speak 権限、channel ID のコピー間違いを確認します。

## YouTube Outputs

YouTube Outputs は、外部配信先を登録する画面です。

### stream key 方式

1. YouTube Studio で配信枠または再利用する stream key を用意します。
2. YouTube Outputs を開きます。
3. `Mode` を stream key 方式にします。
4. `RTMPS URL` と `Stream key` を保存します。
5. 保存後に `configured` や fingerprint が表示されることを確認します。
6. Streams で対象配信に YouTube Output を選びます。
7. Check Readiness を実行します。

### Live API 方式

1. Integrations で Google OAuth Provider を作ります。
2. YouTube scope を含む OAuth connected account を作ります。
3. YouTube Outputs で `Mode` を dry-run にして保存します。
4. Streams で YouTube Output を選び、Check Readiness を確認します。
5. dry-run で問題がなければ本番 mode へ切り替えます。
6. Stop 後に complete だけ失敗した場合は `Retry YouTube Complete` を使います。

初回は private または unlisted で検証してください。public にする前に、音声、録画、通知、Stop 後処理が想定通りか確認します。

## Caption/STT Settings

Caption/STT Settings は、字幕や文字起こしを使う場合に作成します。

1. 字幕を使う配信だけ profile を作ります。
2. language、最大文字数、表示モードを決めます。
3. Streams の `Caption Profile` に紐づけます。
4. Worker event test で caption event が通るか確認します。
5. テスト配信で文字量、改行、表示位置を確認します。

字幕は視聴者に直接見えるため、いきなり本番配信で有効にせず、短いテスト配信で見え方を確認してください。

## Overlay Settings

Overlay Settings は、配信画面に重ねる情報や Worker から送るイベントの見た目を決めます。

1. overlay の用途を決めます。参加者表示、時刻表示、テロップ、イベント通知などです。
2. profile 名を付けて保存します。
3. Streams の `Overlay Profile` に紐づけます。
4. Worker event test を使い、Encoder Recorder 側に event が届くか確認します。
5. テスト配信で文字が切れないか、背景と重なって読みにくくないか確認します。

暗い背景、明るい背景の両方で読めることを確認してください。

## Archive Settings

Archive Settings は、録画、変換、upload、保持期間を管理します。

### 作成手順

1. Integrations で Drive destination を先に作ります。
2. Archive Settings を開きます。
3. `Name`、Drive destination、保存 path、保持日数を入れます。
4. 初回は `Dry-run upload` を有効にします。
5. Streams の `Archive Profile` に紐づけます。
6. テスト配信で final MKV / MP4 が作られることを確認します。
7. 保存先の権限を確認した後、dry-run を解除します。

### 確認ポイント

| 見る場所 | 正常の目安 |
| --- | --- |
| Encoder host preflight | archive directory が writable |
| Archive / upload | final MKV、final MP4 が exists |
| Google Drive Upload | completed または dry-run として記録 |
| Metrics | disk free が十分、retry が増え続けない |

upload が失敗した場合は、録画ファイルがあるか、Drive destination の folder ID、OAuth account、folder 権限の順に確認します。

## Integrations

Integrations は、OAuth Provider、OAuth Connected Account、Google Drive Destination を管理します。

### OAuth Provider

1. provider 側で OAuth application を作ります。
2. callback URL に Control Panel の公開 URL を使った redirect URI を登録します。
3. Control Panel に client ID、client secret、scopes を保存します。
4. 保存後は secret が raw 表示されないことを確認します。

### OAuth Connected Account

1. 作成済み Provider から OAuth 接続を開始します。
2. provider 側で権限を承認します。
3. Control Panel に戻ったら connected account が増えているか確認します。
4. YouTube Outputs や Drive destination でその account を選びます。

### Google Drive Destination

1. 保存先 folder を作ります。
2. OAuth account または service account が書き込める権限を付けます。
3. `Folder ID` を保存します。
4. Archive Settings で destination を選びます。
5. dry-run またはテスト upload で保存先を確認します。

## Worker Management

Worker Management は、Worker だけを素早く stream へ割り当てる画面です。すべてのサービス種別を見ながら調整する場合は Service Health を使います。

| 操作 | 使う場面 | 注意 |
| --- | --- | --- |
| Assign Worker | overlay / caption を担当する Worker を決める | primary と standby を間違えない |
| Unassign Worker | Worker を外す | 配信中は event が止まる可能性がある |
| Restart Worker | Worker だけ不調な時 | restart 後に heartbeat と event test を確認する |

Worker を入れ替えたら、Streams で Check Readiness と Worker event test を実行します。

## Service Health

Service Health は、各サービスが登録され、online で、必要な機能を持っているかを見る画面です。

| 項目 | 見る内容 | 異常時の対応 |
| --- | --- | --- |
| Status | registered / online / offline | service process、systemd、Docker を確認 |
| Health status | healthy / warning / offline / unconfigured | network、Control Panel URL、Node Runtime Token を確認 |
| Public URL | Control Panel から到達できるURL | reverse proxy、firewall、service bind を確認 |
| Capabilities | runtime config や event などの対応機能 | service version と設定を確認 |
| Assignment | stream への primary / standby | Start 前に missing を解消 |
| Runtime config preview | 対象 service に渡る設定の概要 | secret raw value は出ないことを確認 |

Service Health で service が見えない場合は、Node登録、Node ID、`AUTOSTREAM_NODE_CONFIG`、Control Panel URL、Node Runtime Token を確認します。

## Users

Users は、Control Panel にログインする人を管理する画面です。

1. `Username` を決めます。
2. 初回または reset 用の一時 password を発行します。
3. 必要な role だけを付けます。
4. 本番運用では MFA を登録してもらいます。
5. 退職や担当解除では disable します。

日常配信担当には、配信開始・停止・閲覧に必要な権限だけを付けます。secret 更新、role 変更、token rotate は管理者に限定します。

## Roles

Roles は、操作権限をまとめる画面です。

| ロール例 | 想定用途 |
| --- | --- |
| viewer | 状態確認だけ |
| operator | 配信開始、停止、日常確認 |
| maintainer | service assignment、profile編集、通知設定 |
| admin | user、role、secret、token 管理 |

権限は少なめから始め、足りない操作だけ追加します。画面上でボタンが見えても、API 側で権限が不足すると操作は失敗します。

## Security Settings

Security Settings は、password、MFA、session、secret 更新などの安全設定を扱います。

| 項目 | 推奨の考え方 |
| --- | --- |
| Password min length | 本番では短すぎない値にする |
| Login lockout threshold | 総当たりを抑えつつ、運用者が復旧できる値にする |
| Session idle timeout | 共有PCや長時間放置を考慮する |
| MFA mode | 本番は TOTP または passkey を推奨 |
| Secret rotation | token や外部 secret の入れ替え時に使う |

変更後は、自分自身がログアウトしても再ログインできる状態か確認してから、他のユーザーに展開します。

## Node登録とAPI Tokens

新規構成では、サービス登録は Node登録から始めます。Node登録の Configuration で `config.yml` を取得し、各 service の `AUTOSTREAM_NODE_CONFIG` で読ませます。

1. Node type を選びます。
2. Node ID、Node名、Host、Port、SSL、説明を入力します。
3. 作成後の Configuration で `config.yml` または Auto Configure command を取得します。
4. `config.yml` を service host に保存し、env の `AUTOSTREAM_NODE_CONFIG` で参照します。
5. service を起動します。
6. Service Health で online になったことを確認します。

API Tokens は旧構成や移行時の token 確認、rotate、revoke に使います。Node Runtime Token や Configure Token は画面やドキュメント、チャット、GitHub に残さないでください。漏えいの疑いがある場合は Node登録の Configuration で再生成します。

## Audit Logs

Audit Logs は、誰が何を変更したかを確認する画面です。

| 見たいこと | 絞り込み |
| --- | --- |
| 配信開始・停止 | stream、start、stop |
| service assignment | service assignment または対象 service ID |
| secret 更新 | security、secret、対象名 |
| token rotate / revoke | api token、service type |
| 失敗操作 | result を failed にする |

問題発生時は、Incident の発生時刻の前後で Audit Logs を確認します。

## Monitoring / Incidents / Diagnostics

Monitoring は全体の監視、Incidents は発生中の異常、Diagnostics は原因候補を見る画面です。

1. Dashboard で open incident を見つけます。
2. Incidents で severity、対象 service、stream を確認します。
3. Diagnostics で原因候補と確認項目を読みます。
4. Metrics で関連 metric が増え続けているか、止まっているか確認します。
5. 必要なら Streams や Service Health へ戻って設定・割り当てを直します。
6. 対応後、incident が resolved になるか確認します。

Diagnostics は補助情報です。最終判断は、実際の service 状態、配信状態、保存結果、通知結果を合わせて行います。

## Remediation Actions

Remediation Actions は、restart や reconnect などの対応候補を扱う画面です。

| 表示 | 判断 |
| --- | --- |
| approval required | 人が内容を確認してから実行する |
| safe candidate | 自動化しやすいが、配信中は影響を確認する |
| result success | 実行自体は成功。復旧したかは Metrics / Incidents で確認する |
| result failed | service 到達性、権限、token、対象 ID を確認する |

配信中の restart は影響が出る場合があります。standby があるか、今止めてよいサービスかを確認してから実行します。

## Notification Channels

Notification Channels は、異常や重要イベントの通知先を管理します。

1. 通知先の type を選びます。
2. webhook、email、SMTP など必要項目を保存します。
3. severity filter と event type filter を絞ります。
4. `Test Channel` を押して届くことを確認します。
5. Notification Deliveries で delivered / failed を確認します。

通知が多すぎる場合は、severity filter を上げます。通知が来ない場合は、Test Channel、delivery result、通知先側の権限やURLを確認します。

## Metrics

Metrics は、配信中や配信後の数値を詳しく見る画面です。

| 見るもの | 判断 |
| --- | --- |
| Encoder FPS / Bitrate | profile 通りに安定しているか |
| Dropped Frames | 増え続けていないか |
| Discord Audio / Packets | 音声が届いているか |
| Worker Events | overlay / caption event が流れているか |
| Archive / Upload | 録画、変換、upload が完了しているか |
| Notification Deliveries | 通知が届いているか |

Metrics は原因を探すための画面です。値が悪い時は、対象 service の設定、host 負荷、network、保存先権限を順に確認します。

## 迷った時の短い導線

| やりたいこと | 最初に開く画面 | 次に見る画面 |
| --- | --- | --- |
| 配信を始めたい | Streams | Service Health、Dashboard |
| Bot が入らない | Discord Settings | Service Health、Incidents |
| YouTube に送れない | YouTube Outputs | Streams、Metrics |
| 録画が残らない | Archive Settings | Encoder Recorder、Metrics |
| 保存先 upload が失敗 | Archive Settings / Drive Destination | Incidents、Retry Upload |
| 通知が来ない | Notification Channels | Notification Deliveries |
| サービスが見えない | Service Health | Node登録、`AUTOSTREAM_NODE_CONFIG`、service env |
| 誰が変更したか知りたい | Audit Logs | Users、Roles |
