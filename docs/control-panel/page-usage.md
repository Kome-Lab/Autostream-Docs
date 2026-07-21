# Control Panel画面別操作ガイド

このページは、Control Panel を開いたあとに「どの画面で、何を押し、保存後に何を確認するか」を調べるための操作ガイドです。項目名の意味だけを確認したい場合は、[項目リファレンス](/control-panel/field-reference)を使ってください。

Control Panel は設定を保存するだけでなく、各サービスへ配信開始や停止を指示します。初めて使う場合は、画面を上から順に埋めるより、次の順番で進めると安全です。

1. Node登録でサービス用 Node を作り、`config.yml` を保存する。
2. 各サービスを起動し、Service Health で online を確認する。
3. Integrations、Discord Settings、YouTube Outputs、Archive Settings を作る。
4. Streams で配信を作成し、必要な設定とサービスを割り当てる。
5. Check Readiness を実行してから Start する。
6. Dashboard、Monitoring、Incidents、Audit Logs で状態を見る。

## 共通操作

作成済み設定の一覧には、APIで削除できる項目だけ `削除` ボタンが表示されます。対象はエンコーダープロファイル、字幕プロファイル、ウォーターマーク設定、録画プロファイル、Discord BOT設定、YouTube出力、OAuthログインプロバイダ、OAuth接続アカウント、Drive保存先、ユーザー、ロール、通知先です。

削除前に確認すること:

| 確認 | 理由 |
| --- | --- |
| Streams で選択中ではない | 配信枠が参照中の profile や出力先は削除できない場合があります |
| OAuth account / provider が保存先やYouTube Outputに使われていない | 参照中の連携情報は削除できません |
| user が自分自身や最後の有効な super_admin ではない | ログイン不能や管理者不在を防ぐため、保護された user は削除できません |
| role を自分や最後の管理者から外していない | 権限喪失を防ぐため、保護されたroleは削除できません |
| Notification Channel が不要である | 削除後は通知先として使えません |

削除が失敗した場合は、表示された項目を使っているStreams、YouTube Outputs、Drive Destinations、OAuth Connected Accountsを先に外してから再実行します。秘密情報のraw valueは削除エラーや監査ログに出しません。

## Dashboard

Dashboard は、配信枠とNode接続状態を最初に見る画面です。ここでは設定変更は行わず、「今動いている配信」「開始待ちの配信枠」「録画状態」「今すぐ見るべき異常」を判断します。

| 操作 | 見る場所 | 判断 |
| --- | --- | --- |
| 配信枠の確認 | 配信枠の稼働状況 | 状態、開始条件、配信先、録画、担当Nodeが想定どおりであること |
| 異常の確認 | 要対応 | failedの配信枠、警告中のNodeが表示されていないか |
| Nodeの接続確認 | 配信基盤 | 必要な Node が正常で、対象配信へ割り当てられていること |
| 操作履歴の確認 | 運用証跡 | 監査ログ、録画・アーカイブ、セキュリティへ移動できること |

Dashboard の数字だけで原因を決めないでください。原因確認は、Streams、Service Health、Incidents、Metrics の専用画面で行います。

## Streams

Streams は、VC参加を待つ配信枠を作成し、開始条件、配信経路、録画、担当Nodeを確認して開始・停止する画面です。日常運用で一番よく触ります。

### 新しい配信を作る

1. `配信枠を作成` を押し、右側の作成画面を開きます。
2. `配信枠名` を入力します。配信枠には開始日時や終了日時を設定しません。
3. Discord VC参加で自動開始する場合は、Discord BOT設定、サーバーID、ボイスチャンネルID、担当Worker Node、担当Encoder Nodeを選びます。
4. YouTube出力と録画用Googleアカウントを選びます。録画用にはDrive保存を利用できる接続だけが表示されます。Driveへ保存する場合はFolder ID、必要なら共有ドライブID、録画ファイル名、Encoder内の保持日数を入力します。
5. 必要ならエンコード設定と字幕設定を選び、ロゴを載せる配信だけ `ウォーターマークを使用` をONにして設定を選びます。
6. 画面下部に不足項目が表示されていないことを確認し、`配信枠を作成` を押します。一覧で待機状態、開始条件、配信経路、録画、担当Nodeが意図どおりか確認します。

自動開始を有効にした配信枠では、対象VCへのユーザー参加をDiscord Botが検知します。BotがVCへ参加して音声取得を開始し、Control Panelの通常の開始処理からWorker、Encoder Recorder、録画、配信出力が起動します。

配信名は通知や監査ログにも出ます。`本番配信` だけではなく、日付、番組名、用途が分かる名前にしておくと後から追いやすくなります。

### 既存配信を確認する

1. 一覧で名称、状態、開始条件を確認し、対象を間違えていないか確認します。
2. 目のアイコンの `詳細` を開き、配信経路、録画保存、自動開始、担当Node、映像設定を確認します。
3. `この配信枠の操作履歴を確認` から、その配信枠IDで絞り込まれた監査ログを開けます。
4. 配信開始前は `開始準備を再確認` を実行します。

### Discord channel 指定の使い方

`Discord Guild ID`、`VC Channel ID`、`Chat Channel ID` は、配信枠ごとに Discord の接続先を指定するために使います。Chat Channel IDは配信開始後のchat描画とYouTube開始通知の送信先を兼ねます。

| 状況 | 入力するもの | 空欄にするもの |
| --- | --- | --- |
| 通常運用 | 配信枠ごとに guild / voice / chat channel を保存 | なし |
| テスト配信だけ別 voice channel | テスト用 voice channel ID | guild が同じなら同じ guild ID |
| 告知先だけ変える | text channel ID | voice channel ID は通常の接続先を指定 |
| 別 guild で検証する | guild ID、voice channel ID、必要なら text channel ID | なし |

Guild / VC / Chat を指定する場合は、同じ配信枠で Discord BOT設定も選択してください。

### Check Readiness の見方

`開始準備を再確認` は、開始前に不足している設定やサービスをまとめて確認する操作です。開始の前に毎回実行してください。

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
| 開始 | 開始準備が通り、配信先と録画設定が確定した後。確認画面で対象名と影響を再確認する | Streams、Monitoring、Metrics |
| 停止 | 配信を終了する時。確認画面で視聴者と録画への影響を再確認する | 録画・アーカイブ、Audit Logs |
| Retry Upload | 録画は完了したが保存先 upload だけ失敗した時 | Archive / upload、Notification Deliveries |
| Retry YouTube Complete | YouTube Live API の終了処理だけ失敗した時 | YouTube Output、Last dispatch |
| View Stream Audit | 操作履歴を追いたい時 | Audit Logs |

Stop 後も録画の remux、MP4 化、upload が続く場合があります。画面上で stopped に見えても、Archive / upload が完了するまで結果確認を続けます。

### EncoderプレビューとVLC

`starting`、`live`、`stopping` の配信枠を開くと、詳細画面の `Encoderプレビュー` でEncoder Recorderの最終出力を確認できます。これはYouTube playerの映像ではなく、YouTubeへ送る前のEncoder出力です。字幕、Discord chat、ウォーターマークを含む最終映像の確認に使います。

VLCなど別のplayerで確認する場合は、`ネットワーク再生URLを発行` を押し、コピーしたURLをVLCの `メディア` -> `ネットワークストリームを開く` に入力します。URLの有効期限は最大12時間ですが、配信枠がactiveでなくなった時点で期限前でも無効になります。再開した配信では新しいURLを発行してください。

このURLは認証情報を含む署名付きURLです。チケット、Discord、メール、監査ログ、スクリーンショットへ貼らず、reverse proxyやCDNのaccess logにもpathを残さないでください。VLCからのplaylistとsegmentもControl Panel proxyを通るため、同時視聴数に応じてControl Panelの転送帯域が増えます。

## Encoder Profiles

Encoder Profiles は、配信品質をまとめて保存する画面です。Encoder Recorder が FFmpeg へ渡す設定の元になります。

### 作成手順

1. `Name` に用途が分かる名前を入れます。
2. 解像度、fps、映像ビットレート、音声ビットレートを入力します。
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

Discord Settings は、Discord BOT Node と Bot token、音声転送、再接続ポリシーを保存する画面です。Guild、VC、Chat Channel は Streams の配信枠で指定します。

### 作成手順

1. Discord Developer Portal で Bot を作成し、必要な権限で server に招待します。
2. Control Panel の Node登録で Discord Bot 用 Node を作り、`config.yml` を保存します。
3. Discord Bot service を起動し、Service Health で online を確認します。
4. Discord Settings を開きます。
5. `Discord BOT Node` で online の Discord Bot Node を選びます。
6. `Bot token` を保存します。保存後は raw value は表示されません。
7. `Enable audio forward` と自動再接続を運用方針に合わせます。
8. Streams でこの Discord Config を選び、配信枠ごとに Guild ID、VC Channel ID、Chat Channel ID を指定します。
9. Check Readiness を実行します。

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
2. `YouTube Liveのみ` または `YouTube Live・Drive保存` でOAuth connected accountを作ります。
3. YouTube Outputsで利用可能な接続だけが表示されることを確認し、`Mode` をdry-runにして保存します。
4. Streams で YouTube Output を選び、Check Readiness を確認します。
5. dry-run で問題がなければ本番 mode へ切り替えます。
6. Stop 後に complete だけ失敗した場合は `Retry YouTube Complete` を使います。

初回は private または unlisted で検証してください。public にする前に、音声、録画、通知、Stop 後処理が想定通りか確認します。

## Caption/STT Settings

Caption/STT Settings は、字幕や文字起こしを使う場合に作成します。

1. 字幕を使う配信だけ profile を作ります。
2. Deepgram APIキーを入力します。キーはControl Panelのsecretとして保存され、profile JSONには残りません。
3. 日本語または英語、発話区切り、中間結果、Smart Format、遅延補正を決めます。providerはDeepgram、modelはNova-3固定です。
4. Streams の `Caption Profile` に紐づけ、primary WorkerとDiscord Botを割り当てます。
5. Start Readinessで`caption_audio_forward`と`deepgram_transcription`に不足がないことを確認します。
6. テスト配信で途中字幕、確定字幕、話者、遅延、表示位置を確認します。

字幕は視聴者に直接見えるため、いきなり本番配信で有効にせず、短いテスト配信で見え方を確認してください。

## Watermark Settings

Watermark Settings は、配信映像に合成する1920x1080固定のロゴ画像を決めます。字幕やDiscord chatの描画はこの画面ではなく映像生成側で扱います。

1. ウォーターマークの用途を決めます。番組ロゴ、局名、自治体名などです。
2. 1920x1080のPNG / JPEG / WebP画像を用意します。表示位置や余白は画像側で調整します。
3. profile 名を付け、画像を選んでpreviewを確認します。
4. Streams で `ウォーターマークを使う` をONにした配信だけ `Watermark Profile` に紐づけます。
5. テスト配信でウォーターマークが切れないか、1080未満の出力へ自動フィットしているか確認します。

暗い背景、明るい背景の両方で読めることを確認してください。

## Archive Settings

Archive Settings は、録画形式、保持期間、upload有無、Drive保存先をまとめた録画プロファイルを管理します。Streams の配信枠作成時は、ここで事前登録したプロファイルを選びます。

Archive画面は`録画プロファイル`、`Google Drive保存先`、`ローカル録画アーカイブ`の3タブに分かれます。ローカルファイルのdownload、rename、deleteは`ローカル録画アーカイブ`で行い、録画プロファイル一覧には混在させません。

### 作成手順

1. Driveへ保存する場合は、Integrations でDrive用のOAuth Connected Accountを作ります。
2. Archive画面でDrive保存先を作ります。
3. 録画形式、保持日数、upload有無、Drive保存先を設定した録画プロファイルを作ります。
4. Streamsで配信枠を作成し、録画プロファイルを選びます。
5. テスト配信で final MKV / MP4 が作られることを確認します。
6. Archive 画面で local artifact の download、rename、delete が必要な範囲でできることを確認します。
7. 保存先の権限とupload結果を確認します。

### 確認ポイント

| 見る場所 | 正常の目安 |
| --- | --- |
| Encoder host preflight | archive directory が writable |
| Archive / upload | final MKV、final MP4、local artifact が exists |
| Google Drive Upload | completed または dry-run として記録 |
| Metrics | disk free が十分、retry が増え続けない |

upload が失敗した場合は、録画ファイルがあるか、Drive destination の folder ID、OAuth account、folder 権限の順に確認します。download、rename、delete が失敗する場合は、primary encoder、service token、local artifact の残存、ファイル名の安全性を確認します。

## Integrations

Integrations はSettingsグループ内にあり、OAuth Provider、YouTube・Drive接続、Google Drive Destinationを管理します。

### OAuth Provider

1. provider 側で OAuth application を作ります。
2. provider 側の redirect URI に `https://<CONTROL_PANEL_HOST>/auth/oauth/callback` を登録します。
3. Control Panel に client ID、client secret、`/auth/oauth/callback` の redirect URI を保存します。
4. YouTube / Drive 用の connected account も同じ redirect URI を使います。
5. ログイン用 scope は provider 種別ごとに固定されます。手動入力は不要です。
6. 保存後は secret が raw 表示されないことを確認します。

### OAuth Connected Account

1. 作成済み Provider から OAuth 接続を開始します。
2. `アカウント表示名` に、用途や担当案件を識別できる名前を入力します。
3. 接続用途を `YouTube Live・Drive保存`、`YouTube Liveのみ`、`Drive保存のみ` から選びます。
4. provider 側で権限を承認します。
5. Control Panel に戻ったら、入力した表示名と `利用可能な用途` でconnected accountが増えているか確認します。
6. YouTube OutputsにはYouTube対応、Drive保存先にはDrive対応のaccountだけが表示されることを確認して選びます。両対応のaccountは両方に表示されます。

`利用可能な用途` は実際に許可されたOAuth scopeから判定します。用途を変更する場合は対象accountを削除し、必要な接続用途を選んで再接続します。旧バージョンで接続時の表示名が保存されずメールアドレスが残っているaccountは、一覧と選択欄で `OAuth Provider の設定名 + 短いアカウント識別子` を表示します。同じProviderに複数accountがあっても区別できます。個別の表示名へ変更する場合は、対象行の編集ボタンから `アカウント表示名` を更新します。

### Google Drive Destination

1. 保存先 folder を作ります。
2. OAuth connected account が書き込める権限を付けます。
3. `Folder ID` を保存します。
4. Archive画面でこのDrive保存先を使う録画プロファイルを作ります。
5. テスト upload で保存先を確認します。

## Worker Management

Worker Management は、Worker だけを素早く stream へ割り当てる画面です。すべてのサービス種別を見ながら調整する場合は Service Health を使います。

| 操作 | 使う場面 | 注意 |
| --- | --- | --- |
| Assign Worker | caption / chat / participant event を担当する Worker を決める | primary と standby を間違えない |
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
2. メールアドレスを入れます。新規ユーザー作成では必須です。
3. 初回または reset 用の一時 password を発行します。
4. 必要な role だけを付けます。
5. SMTP 設定済みの場合だけ `登録完了メールを送る` をONにします。
6. 本番運用では MFA を登録してもらいます。
7. 退職や担当解除では disable します。

登録完了メールには login URL とユーザー名だけを入れます。一時 password は電話、社内チャット、対面など別経路で渡してください。日常配信担当には、配信開始・停止・閲覧に必要な権限だけを付けます。secret 更新、role 変更、token rotate は管理者に限定します。

ユーザー削除は `users.delete` 権限が必要です。自分自身、最後の有効な super_admin、自分より強い権限を持つユーザーは削除できません。削除後は対象ユーザーの session、MFA、Passkey、OAuth login link も無効化されます。

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

## Settings

Settings は、Control Panel の表示名、時刻表示の基準、アカウント通知とNotification Channelsで共通利用するSMTP、Cloudflare Turnstile、Google Analyticsを管理する画面です。

| 項目 | 使う場所 | 確認すること |
| --- | --- | --- |
| App name | サイドバー、ログイン、初期作成画面 | 運用者がどの環境か識別できる名前にする |
| タイムゾーン | Streams、Audit Logs、Account | 更新日時や操作時刻の表示に使う地域の IANA timezone を選ぶ |
| メールサーバー | Users の登録完了メール、email通知先 | SMTP host、port、From、STARTTLS、認証情報を保存し、テスト送信で確認する |
| Cloudflare Turnstile | password、Passkey、OAuth login、メール変更承認 | Site key と Secret key を保存する。secret は再表示されない |
| Google Analytics | ログイン画面と管理画面の利用状況 | toggleをONにし、GA4の `G-` で始まるMeasurement IDを保存する |

SMTP password は保存後に再表示されません。テスト送信は保存済みのメールサーバー設定を使います。SMTPを無効化すると、登録完了メールは送信されず、email通知先のテスト送信と実送信は `smtp_not_configured` で失敗し、保存済み password も解除されます。email通知先そのものの作成・編集はSMTP未設定でもできます。
Turnstile を有効化すると、password、Passkey、OAuthのいずれでloginする場合も、認証処理を開始する前にTurnstile tokenが必要になります。メール変更承認でも同様です。Secret keyはbackendだけがCloudflare Siteverifyへ送信し、画面やAPI responseには出しません。

Google Analyticsは有効かつMeasurement IDが妥当な場合だけログイン画面と `/admin` 配下で読み込まれます。page viewにはoriginとpathnameだけを使い、query、hash、ログインユーザーID、選択stream IDを送信しません。セットアップ、メール確認、アーカイブ共有、tokenページは計測対象外です。Google signalsと広告パーソナライズも無効です。GA4データストリーム側の「拡張計測機能」はOFFにします。ONのままでは、browser historyによるpage viewとControl Panelの手動page viewが重複し、サイト内検索などの追加イベントからquery parameterが送信される可能性があります。外部計測を許可しない環境ではtoggleをOFFのままにします。

タイムゾーンは env ではなく Control Panel の設定として保存します。変更後は Streams の更新日時、Audit Logs の時刻表示が期待した基準になっているか確認します。

## Node登録とAPI Tokens

新規構成では、サービス登録は Node登録から始めます。通常serviceではNode登録のConfigurationで`config.yml`を取得し、各serviceの`AUTOSTREAM_NODE_CONFIG`で読ませます。Update AgentはこのYAML方式を使わず、中央管理ホストに1つだけ登録します。管理対象hostの非常駐helperはNode登録しません。

1. Node type を選びます。
2. Node ID、Node名、Host、Port、SSL、説明を入力します。
3. 作成後の Configuration で `config.yml` または Auto Configure command を取得します。
4. `config.yml` を service host に保存し、env の `AUTOSTREAM_NODE_CONFIG` で参照します。
5. service を起動します。
6. Service Health で online になったことを確認します。

`update_agent`ではControl Panel host releaseのsampleを中央管理ホストのroot所有`/etc/autostream/updater.json`へinstallし、GitHub token、API、host/target inventory、SSH pathなどのlocal設定を先に完成させます。その後、ConfigurationのAuto Configure commandを中央hostで実行し、Configure TokenはTTYまたは標準入力から渡します。commandやprocess argvにはTokenを含めません。このcommandが`panel_url`、`node_id`、`runtime_token`、`service_name`だけを更新し、local設定は保持します。stageしたRuntime Tokenはactivation成功まではinactiveで、旧Runtime Tokenがactiveのままです。ただしactivationの応答を受け取れず結果不確定になった場合は、CLIだけではどちらのRuntime Tokenがactiveか判断できません。local atomic commit後に失敗した場合、disk上の`updater.json`にはstage済みidentityが残ることがあります。CLIはactivation用のTokenやstateを永続化しないため、Updaterを再起動せず、Configurationで新しいConfigure Tokenを発行し、同じtoken-free command形へ新しいTokenを入力して再実行してください。activation成功を確認した後に`validate-config`を実行し、成功後にだけ中央Updaterを起動または再起動します。各hostへtokenをコピーしないでください。

登録後のNodeは、同じ画面の登録済みNode一覧から編集、削除、Configure Token再生成、Node Runtime Token再生成ができます。Runtime Tokenを再生成した場合、通常serviceは`config.yml`を更新します。Update AgentはConfigure Tokenも再生成して同じtoken-free Auto Configure command形へ新しいTokenを入力し、activation成功と`validate-config`を確認した後に中央Updaterを再起動してください。

API Tokens は旧構成や移行時の token 確認、rotate、revoke に使います。Node Runtime Token や Configure Token は画面やドキュメント、チャット、GitHub に残さないでください。漏えいの疑いがある場合は Node登録の Configuration で再生成します。

## Application Info

Application Info は、Control Panelと登録済みNodeのversion情報に加え、中央`autostream-updater`へ安全な更新jobを依頼する画面です。中央Updaterのonline状態と、中央Updaterから各hostへのSSH到達状態は別々に表示します。

1. **再取得**で更新対象、最新release、中央Updaterのonline状態、hostの到達状態、更新履歴を読み直します。
2. **システム更新**で、現在version、更新先version、systemd / Docker、host ID、担当する中央Updaterを確認します。
3. 配信中でない対象は **更新**、active streamがある対象は **空き次第更新** を押します。
4. Control Panel自身を更新する場合は、画面とAPIが一時切断される確認dialogを承認します。
5. **更新履歴**で、取得、検証、適用、health確認、rollbackの進捗と結果を確認します。
6. **更新可能なものを順次更新**は、対象を一つずつqueueします。同じtargetを同時に複数更新しません。

更新候補は、systemd配備ではNodeが報告したsource versionと同じserviceのhost releaseを比較します。Docker配備では`Autostream-Docker`のbundle versionを比較します。Docker bundle versionと各serviceのsource versionが異なるのは正常です。

実行buttonが有効になるには、担当する中央Updaterがonlineで、対象hostが`到達可`である必要があります。`接続不可`は直近probeが失敗、`未確認`は起動直後、情報期限切れ、または有効なprobe結果がない状態です。中央Updaterがofflineでも、hostが接続不可でも、最新versionの検出と比較は続きます。

Nodeが一覧に出ない場合はNode登録ID、service側のControl Panel URLとtoken、Service Healthのheartbeatを確認します。中央Updaterが出ない場合は1つの`update_agent`登録、中央`autostream-updater`のsystemd状態、Runtime Tokenを確認します。hostだけ接続不可の場合はaddress、firewall、source CIDR、host別SSH key、strict `known_hosts`、forced command、remote helper configを確認します。

必要権限、Update Agent登録、`when_idle` / `maintenance`、backup、checksum、health確認、rollback、Control Panel自己更新の詳細は[Control Panelからサービスを更新する](/operations/system-updates)を参照してください。

## 監査ログ

監査ログはサイドバーの `監視・対応` にあり、誰が何を変更したかを確認する画面です。通常の変更・操作は `操作履歴`、Nodeによる高頻度の `services.runtime_config.read` は `Node設定参照` で確認します。

| 見たいこと | 絞り込み |
| --- | --- |
| 配信開始・停止 | stream、start、stop |
| service assignment | service assignment または対象 service ID |
| secret 更新 | security、secret、対象名 |
| token rotate / revoke | api token、service type |
| 失敗操作 | 結果を `失敗` にする |

問題発生時は、Incident の発生時刻の前後で `操作履歴` を確認します。Nodeの設定取得状況を調べる場合だけ `Node設定参照` を開きます。

## Monitoring / Incidents / Diagnostics

Monitoring は現在の問題、Node稼働、診断を横断して対応対象を決める画面です。Metrics はCPU、メモリ、ディスク、ネットワークなどの時系列を分析する画面です。

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
2. webhook方式ではWebhook URL、email方式では宛先を保存します。emailのSMTP情報はここでは入力せず、Settingsの共通SMTPを使います。
3. 作成済みの通知先を変更するときは、一覧の編集操作を開きます。通知方式は固定です。Webhook URLまたはemailの宛先を空欄のまま更新すると保存済みの値を保持し、入力した場合だけ置き換えます。
4. incident、診断、remediation向けの severity filter と event type filter を絞ります。
5. 保存済み channel の行から `テスト送信` を押し、返された `status` が `success` か `failure` か確認します。
6. Notification Deliveries と実際の通知先でも送信結果を確認します。

raw Webhook URL とemailの宛先は一覧や編集フォームに再表示されず、masked targetだけを表示します。共通SMTPのpasswordはControl Panel内で管理し、ブラウザやObservabilityへ渡しません。email通知はControl Panelを経由するため、Control PanelとSMTPサーバーの両方が到達可能である必要があります。Webhook通知はObservabilityから直接送信します。

Control Panelの監査ログへ保存された認証済みユーザー操作とsystem操作は、`admin.audit` として有効な全通知先へ送られます。作成、更新、削除、開始、停止、承認、テスト、login成功、security変更と、その成功・失敗はseverity / event type filterの対象外です。未認証のlogin失敗と内部service actorのheartbeatやrelayは、通知floodや通知ループを避けるため送信せず、監査ログだけに残します。`テスト送信` 自体も操作監査になるため、テスト通知とは別に `admin.audit` が届きます。

Discord client からコピーした URL の対応 host と正規化仕様は [監視と通知](/control-panel/observability#notification-channels) を参照してください。incidentなどのシステム通知が多すぎる場合は severity filter を上げます。管理操作通知も止める場合はchannelを無効にします。通知が来ない場合はテスト送信、delivery result、共通SMTPまたは通知先側の権限・到達性を確認します。

## Metrics

Metrics は、選択したNodeの配信中・配信後の数値を時系列で詳しく見る画面です。表示Nodeと表示範囲を選び、上部の要約から異常候補を絞り込みます。

| 見るもの | 判断 |
| --- | --- |
| Encoder FPS / Bitrate | profile 通りに安定しているか |
| Dropped Frames | 増え続けていないか |
| Discord Audio / Packets | 音声が届いているか |
| Worker Events | caption / chat / participant event が流れているか |
| Node CPU / Memory / Disk | host負荷やdisk残量が悪化していないか |
| Process Heap / Uptime | サービス process のメモリや再起動傾向 |
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
| 自分の情報やログイン設定を変えたい | Account | アイコン、メール、MFA、Passkey、OAuth連携 |

## Account

Account は、ログイン中のユーザー自身がアカウントアイコン、メールアドレス、password、MFA、Passkey、OAuth連携を管理する画面です。画面上部で現在のロールと保護状態を確認し、`プロフィール` と `セキュリティ` のタブを切り替えて操作します。

アカウントメールは、通知やアカウント登録完了メールの本人連絡先として使います。変更時は新しい宛先に確認メールを送り、メール内のワンタイムURLを開くまで変更は完了しません。OAuth連携の一覧と解除は self 用 API だけを使います。`users.read` や `users.manage_mfa` を持たない運用者でも、自分の連携状態だけを確認できます。

| 操作 | 確認すること |
| --- | --- |
| アカウントアイコン | JPEG または PNG を選択し、プレビュー後に保存する。768 KB 以下、縦横 32〜2048 px。不要になった画像は削除可能 |
| メール変更 | 新しい宛先で確認メールを受け取り、ワンタイムURLで確定する |
| Password変更 | 成功後に全セッションが削除され、再ログインが必要になる |
| MFA | TOTP 登録、確認、recovery code 再発行を行う。登録済みユーザーはlogin時に2FAを要求される |
| Passkey | MFA mode が Passkey の場合に端末を登録し、不要なcredentialを削除する |
| OAuth連携 | ログイン連携から取得できるメールを確認し、不要な連携を解除する |
