# Control Panel項目リファレンス

このページは、Control Panel の画面で「この項目は何を入れるのか」「保存後にどこで確認するのか」を調べるための一覧です。初めて運用する人は、[画面の全体像](/control-panel/)と[画面別操作ガイド](/control-panel/page-usage)を読んだ後に、このページを手元に置いて作業してください。

実際の token、stream key、OAuth secret、webhook URL、SMTP password は保存できますが、保存後に raw value は表示されません。表示されるのは `設定済み`、`masked target`、`updated_at` のような確認用の状態だけです。

## 読み方

| 列 | 意味 |
| --- | --- |
| 項目 | 画面に出る入力欄または表示欄 |
| 入れるもの | 管理者が入れる値、または選ぶ値 |
| いつ使うか | その項目が必要になる作業 |
| 保存後の確認 | 入力後に見る画面や状態 |

## Dashboard

Dashboard は入力画面ではなく、最初に状況を判断する画面です。

| 項目 | 見るもの | いつ使うか | 次に見る場所 |
| --- | --- | --- | --- |
| 配信中 | live / starting の配信数 | 今どの配信が動いているかを見る | Streams |
| 待機中 | created / draft / ready の配信枠数 | VC参加または手動開始を待つ枠を確認する | Streams |
| 要確認 | failed / error の配信数 | 異常があるか見る | Incidents |
| オンラインNode | online の Node 数 | 必要サービスが起動しているか見る | Service Health |
| 配信枠の稼働状況 | 状態、配信経路、開始条件、録画、担当Node | 待機中・配信中の枠を確認する | Streams |

Dashboard だけで設定変更はしません。異常を見つけたら、必ず専用画面で原因を確認します。

## Settings

Settings は、Control Panel 全体の表示名、時刻表示、アカウント通知に使うメールサーバー、ログイン時のBOT確認、Google Analyticsを管理する画面です。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| App name | 運用者が識別できる管理画面名 | 複数環境や複数顧客を扱うとき | サイドバー、ログイン、初期作成画面 |
| タイムゾーン | `Asia/Tokyo` などの IANA timezone | 監査ログや更新日時を同じ基準で見るとき | Streams、Audit Logs、Account |
| SMTP enabled | 登録完了メールを送るか | Users で welcome email を使うとき | Settings response の `smtp_password_configured` |
| SMTP Host / Port | メールサーバーの host と port | アカウント作成通知 | テストユーザー作成 |
| SMTP From | 送信元メールアドレス | アカウント通知 | 受信メールのFrom |
| SMTP Username / Password | SMTP認証情報 | 認証が必要なSMTP | password は保存後に再表示されない |
| テスト送信先 | 受信確認できるメールアドレス | SMTP設定の疎通確認 | Settings のテスト送信結果 |
| Cloudflare Turnstile | Site key と Secret key | password、Passkey、OAuth login、メール変更承認のBOT確認 | secret は保存後に再表示されない |
| Google Analytics | 有効化toggleと `G-` で始まるGA4 Measurement ID | 管理画面のページ閲覧数を確認するとき | 有効化後にGA4のリアルタイム表示で確認 |

タイムゾーンを変えても service の起動時刻やログの保存時刻は変わりません。Control Panel の時刻表示に使います。
SMTP password は secret store に保存され、API response、Audit Logs、Docs には raw value を出しません。テスト送信の response と Audit Logs には送信先を masked target として残します。remote SMTP では STARTTLS を有効にします。
Turnstile secret も secret store に保存され、ブラウザへ返るのは site key と configured 状態だけです。Secret key は Cloudflare の Siteverify にControl Panel backendから送信します。

Google Analyticsは、有効化されてMeasurement IDが妥当な場合だけ管理画面内で読み込まれます。送信するページ情報はoriginとpathnameだけで、query、hash、ログインユーザーID、選択中のstream IDをcustom parameterとして送りません。Google signalsと広告パーソナライズも無効です。Measurement IDはtracking scriptを読み込むため公開設定に含まれますが、SMTP設定やsecretは公開設定に含まれません。

## Streams

Streams は、配信を作り、設定を紐づけ、開始・停止する画面です。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| 配信枠名 | 番組名、案件名、イベント名 | 新しい配信枠を作るとき | Stream 一覧に追加される |
| Discord Config | Discord Settings で作った設定 | Discord 音声を使う配信 | Check Readiness |
| Discord Guild ID | Bot が入る Discord server の ID | Discord 音声やVC参加auto-startを使う配信 | Runtime config preview |
| VC Channel ID | Bot が参加する voice channel の ID | 配信ごとに入るVCを指定するとき | Discord audio |
| Chat Channel ID | chat描画とYouTube開始通知に使うtext channelのID | chat表示または開始通知を使う配信 | Worker events、Discord通知 |
| Discord VC参加で自動開始 | 対象VCへの参加を開始条件にする | 自動運用する待機枠 | Runtime config preview |
| Encoder Profile | 画質、fps、bitrate の profile | 配信品質を選ぶとき | Encoder host preflight |
| Caption Profile | 字幕/STT profile | 字幕を使う配信 | Worker events |
| Watermark Profile | 配信映像へ載せるロゴ画像の profile | 配信枠ごとにウォーターマークをONにする時 | Streams / 出力映像 |
| Archive OAuth Account | Google Drive保存に使う接続アカウント | 録画をDriveへ保存する配信 | Archive / upload |
| Drive Folder ID | Google Drive保存先folder ID | Drive uploadを使う配信 | configured / masked |
| 共有ドライブID | 共有ドライブ保存時のdrive ID | 共有ドライブを使う配信 | Archive / upload |
| 保存ファイル名 | Drive上のMP4名 | 後から探しやすくする | 空欄なら配信枠名-年月日 |
| ローカル保持日数 | Encoder Recorder のlocal archive保持期間 | 配信枠ごとに保存期間を変える | 期限超過後のpackage時に整理 |
| YouTube Output | YouTube Outputs で作った配信先 | 外部配信するとき | YouTube readiness |
| 配信入力URL | SRT、RTMP、RTMPS、HTTP、HTTPSの公開URL | Discord以外の映像入力を使うとき | 入力時のURL検証 / Start preflight |

### Streamsの操作ボタン

| ボタン | 何をするか | 使うタイミング |
| --- | --- | --- |
| 配信枠を作成 | 開始条件、配信経路、録画設定を保存して待機を開始する | 初回作成時 |
| 詳細 | 対象配信の設定を読みやすい項目名で確認する | 開始前、引き継ぎ、障害調査 |
| 開始準備を再確認 | 不足設定、service、外部連携を確認 | 開始の直前 |
| 開始 | 必要サービスへ配信開始を指示 | 開始準備が通った後 |
| 停止 | 必要サービスへ配信停止を指示 | 配信終了時 |
| Retry Upload | 録画ファイルの upload を再試行 | Drive upload だけ失敗したとき |
| Retry YouTube Complete | YouTube Live API の終了処理を再試行 | Stop 後の complete だけ失敗したとき |
| View Stream Audit | 選択 stream の操作履歴を見る | 誰が変更したか確認するとき |
| ネットワーク再生URLを発行 | VLC等で開く署名付きHLS URLを作る | starting / live / stopping の配信を外部playerで確認するとき |

## Encoder Profiles

Encoder Profile は、Encoder Recorder が FFmpeg に渡す配信品質の設定です。

| 項目 | 入れるもの | 目安 |
| --- | --- | --- |
| Name | profile 名 | `1080p60 main`、`720p test` など |
| 横解像度 / 縦解像度 | 出力解像度 | 1920x1080、1280x720 |
| フレームレート | fps | 30 または 60 |
| 映像ビットレート | video bitrate | 1080p60 なら 6000 から 9000 程度 |
| 音声ビットレート | audio bitrate | 128 から 192 程度 |

設定後は Streams で選び、Encoder host preflight と Metrics の `Output FPS`、`Output Bitrate`、`Dropped Frames` を見ます。

## Caption/STT Settings

Caption/STT Settings は、字幕や文字起こしを使う場合だけ作ります。

| 項目 | 入れるもの | 確認先 |
| --- | --- | --- |
| Name | profile 名 | Streams |
| Deepgram APIキー | Deepgramで発行したAPIキー。保存後は再表示されない | Secret status |
| 言語 | 日本語または英語 | 字幕の内容 |
| モデル | Nova-3固定 | Worker status |
| 発話区切り | 10から5000 ms | 確定字幕のタイミング |
| 中間結果 | 途中字幕を表示するか | `caption.telop` |
| Smart Format | 数字や句読点を整形するか | 字幕の内容 |
| 遅延補正 | 音声と字幕のずれを調整する ms | 配信画面 |

providerはDeepgram、modelはNova-3に固定されます。手動字幕providerや任意の字幕送信先URLは設定しません。字幕は視聴者に見えるため、最初はtest streamで文字量、確定タイミング、表示位置を確認します。

## Watermark Settings

Watermark Settings は、配信映像に合成する1920x1080固定のロゴ画像を管理します。字幕やDiscord chatの描画は映像生成側の処理として扱います。

| 項目 | 入れるもの | 確認先 |
| --- | --- | --- |
| Name | profile 名 | Streams |
| 画像 | PNG / JPEG / WebP の1920x1080ウォーターマーク画像 | preview / 出力映像 |
| 合成サイズ | 1920x1080固定 | preview / 出力映像 |
| フィット | 出力解像度が1080未満の場合は自動縮小 | 出力映像 |

ウォーターマークは配信枠ごとにON/OFFします。画像内で余白や表示位置を作ってからアップロードしてください。

## Archive Settings

Archive Settings は、互換用の録画、保存先、upload、保持期間を管理します。標準運用ではStreamsの配信枠でArchive OAuth Account、Drive Folder ID、共有ドライブID、保存ファイル名、ローカル保持日数を指定します。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Name | archive profile 名 | 互換profileを使う場合 | Archive Settings一覧 |
| 録画形式 | MP4 / MKV | 互換profileを使う場合 | Archive / upload |
| Retention days | ローカル録画保持日数 | disk 容量管理 | disk free metric |
| Drive destination | Integrations で作った保存先 | 互換profileを使う場合 | Destination が selected |
| Upload final archive | upload 有効化 | Drive へ保存する場合 | Archive / upload |

標準運用では、配信枠ごとのDrive保存先は Streams で指定します。Archive Settings は互換profileが必要な場合だけ使います。

## Discord Settings

Discord Settings は、Discord BOT Node と Bot token、音声転送、再接続ポリシーを管理します。Guild、VC、Chat Channel は Streams の配信枠で指定します。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Name | 設定名 | Streams で選ぶ | Discord Config一覧 |
| Discord BOT Node | 登録済み Discord Bot Node | runtime config を対象Botへ渡す | Service Health |
| Bot token | Discord Bot token | Bot がDiscordに接続 | configured / fingerprint |
| Enable audio forward | 音声を Encoder Recorder へ送る | 配信音声を使う場合 | Encoder audio bridge |
| Reconnect voice automatically | 切断時の自動再接続 | 本番運用 | Incident / metrics |
| Reconnect attempts | 再接続回数 | Discord瞬断対策 | reconnect metric |
Guild ID や channel ID は、Discord の開発者モードを有効にして対象を右クリックし、IDをコピーし、Streams の配信枠に入力します。

## YouTube Outputs

YouTube Outputs は、配信先を管理します。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Name | 出力名 | Streams で選ぶ | YouTube Output一覧 |
| Mode | stream key / Live API dry-run / Live API | 配信方式を選ぶ | Check Readiness |
| RTMPS URL | YouTube ingest URL | stream key方式 | configured |
| Stream key | YouTube stream key | stream key方式 | 設定済み状態 |
| YouTube視聴URL | 視聴者が開く `https://www.youtube.com/watch?v=...` | stream key方式の新規設定、Discord開始通知 | canonical URL表示 |
| OAuth connected account | Google接続アカウント | Live API方式 | Integrations |
| Privacy | private / unlisted / public | Live API broadcast作成 | YouTube側 |
| Latency | normal / low / ultra_low | 安定性と遅延の調整 | YouTube側 |
| Broadcast title template | 配信タイトル雛形 | Live API方式 | 作成される配信枠 |
| Broadcast description | 配信説明文 | Live API方式 | 公開される可能性あり |
| Enable auto start | YouTube側も自動開始 | Live API方式 | Start結果 |
| Enable auto stop | YouTube側も自動停止 | Live API方式 | Stop結果 |
| Complete broadcast on stream stop | Stop後に完了処理 | Live API方式 | Retry YouTube Complete |

初回は `private` と `Live API dry-run`、または既存 stream key を使う方式で確認すると切り分けやすくなります。

## Integrations

Integrations は、OAuth provider、接続アカウント、Google Drive 保存先を管理します。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Provider type | google / github / discord など | Control Panel login | Provider一覧 |
| Client ID | provider発行の client ID | OAuth login開始 | OAuth URL生成 |
| Client secret | provider発行の secret | OAuth token交換 | configured |
| Redirect URI | `/auth/oauth/callback` の Control Panel callback URL | provider側にも同じ値を登録 | callback成功 |
| Login scopes | provider種別ごとの固定値 | 手動入力しません | 同意画面 |
| Allowed domains | login許可ドメイン | 組織内だけ許可したい場合 | login結果 |
| Auto-provision first login | 初回loginでuser作成 | OAuthログイン運用 | Users |
| Default roles | 自動作成userのrole | auto-provision時 | Roles |

OAuth Connected Accountでは接続用途を選びます。接続後の一覧に表示される `利用可能な用途` は実際に許可されたscopeから判定され、YouTube OutputsにはYouTube対応、Drive保存先とStreamsの録画設定にはDrive対応のaccountだけが表示されます。両対応のaccountはどちらでも選択できます。

Google Drive や YouTube Live API を使う場合は、配信用のOAuth Connected Accountを作成し、用途に対応したaccountをYouTube OutputsやStreamsのArchive保存先で選びます。login providerにDrive/YouTube scopeを混ぜません。Google OAuth application側には、Control Panelに保存するProviderのRedirect URIと同じ `/auth/oauth/callback` を登録します。ログイン、Connected Account、Drive/YouTube接続はいずれもこのRedirect URIを使います。

## Google Drive Destination

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Name | 保存先名 | Streamsが生成した保存先を確認する | Destination一覧 |
| OAuth account | 保存に使う接続アカウント | StreamsのArchive OAuth Account | Connected Account |
| Folder ID | Google Drive folder ID | 保存先folder | 設定済み / masked表示 |
| Base path | folder配下の基準パス | 配信ファイル整理 | upload result |
| Shared drive folder | 共有ドライブかどうか | 共有ドライブ保存 | Drive permission |

Drive Destination は OAuth connected account 固定です。Folder ID は Google Drive のURLから取得します。保存先folderの権限は、接続アカウントが書き込める状態にしておきます。

## Service Health

Service Health は、各サービスが Control Panel に登録できているか、配信へ割り当てられているかを見る画面です。

| 項目 | 見るもの | 正常の目安 | 異常時 |
| --- | --- | --- | --- |
| Service ID | サービスの識別子 | Node登録の Node ID と一致 | Node Agent configを確認 |
| Service Type | `discord_bot`、`worker`、`encoder_recorder` など | 想定type | token scopeを確認 |
| Status | registered / online / offline | online | systemd/Docker確認 |
| Health status | healthy / warning / offline / unconfigured | healthy | heartbeat確認 |
| Public URL | Control Panelから見えるURL | 到達できるURL | firewall / reverse proxy確認 |
| Capabilities | 対応機能 | runtime_configなど必要機能がtrue | service version確認 |
| Heartbeat Metrics | サービスが送る代表metric | 更新されている | service log確認 |
| Assignment role | primary / standby | 配信に必要なprimaryがある | assign操作 |

Start できない時は、Streams の readiness と Service Health を行き来して確認します。

## Worker Management

Worker Management は、Workerだけを素早く割り当てる画面です。

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Worker | 割り当てるWorker | caption / chat / participant event担当を決める | Service Health |
| Stream | 対象配信 | 配信ごとに担当を変える | Selected stream assignments |
| Assignment role | primary / standby | 本番担当か予備か決める | planner |
| Assign Worker | Workerを割り当て | 配信前 | Check Readiness |
| Unassign Worker | 割り当て解除 | 廃止・入替 | missing表示 |
| Restart Worker | restart要求 | Workerだけ不調な時 | heartbeat |

配信中に primary Worker を変える場合は、caption、chat、participant event が一時的に止まる可能性があります。

## Users

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Username | login名 | ユーザー作成 | Users一覧 |
| Email | 登録完了メールと本人連絡先。新規作成時は必須 | welcome email、アカウント確認 | Users一覧 |
| Temporary password | 初回またはreset用の一時password | Create / Reset | Force Password Change |
| Send welcome email | 作成後に登録完了メールを送る | SMTP設定済みのときだけON | Audit Logs |
| Role checkboxes | 付与するrole | 権限を決める | Roles |
| Lock / Unlock | login可否 | 一時停止、lockout解除 | status |
| Disable | ユーザー無効化 | 退職、担当解除 | login不可 |

日常配信担当には、配信操作に必要なroleだけを付けます。secret更新やrole変更は管理者だけにします。

## Roles

| 項目 | 入れるもの | 使い方 |
| --- | --- | --- |
| Name | role名 | `operator`、`viewer` など |
| Permissions | 許可する操作 | streams.start、streams.stop、service.assignment など |

権限はAPI側でも確認されます。画面で操作が見えても、権限が不足するとAPIで失敗します。

## Security Settings

| 項目 | 入れるもの | 推奨 |
| --- | --- | --- |
| Password min length | 最低文字数 | 12以上 |
| Login lockout threshold | 失敗回数 | 5前後 |
| Session idle timeout minutes | 無操作timeout | 30分前後 |
| Session absolute lifetime hours | 最大session時間 | 12時間前後 |
| MFA mode | disabled / totp / passkey | 本番はtotpまたはpasskey |
| MFA required roles | MFA必須role | admin以上など |

MFAを有効にした後は、管理者が自分のTOTPまたはPasskeyを登録できることを先に確認してください。

## API Tokens

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Service type | tokenを使うサービス種別 | 旧構成や移行用 token の確認 | token scope |
| Service ID | 登録予定の Node ID | pre-create fallback を使う場合 | Service Health |
| Scopes | 許可するAPI | 最小権限にする | token一覧 |
| Expiration | 有効期限 | 短めにする | revoked / expired |
| Rotate | token入替 | 漏えい疑い、定期更新 | 新token一度だけ表示 |
| Revoke | token無効化 | サービス廃止、漏えい疑い | token無効 |

新規構成のサービス登録は [Node Agent登録](/control-panel/node-agent-registration) を使います。API Tokens は旧構成や移行時の token 確認、rotate、revoke に限定します。tokenは作成時またはrotate時に一度だけ表示されます。表示後は必要な場合だけ secret store に入れ、画面やGitHubには残しません。

## Audit Logs

| 項目 | 入れるもの・見るもの | 使い方 |
| --- | --- | --- |
| Actor | 操作したユーザーまたはサービス | 誰が変更したか確認 |
| Action group | streams、service_assignment、securityなど | 種類で絞り込み |
| Resource | stream、service、userなど | 対象で絞り込み |
| Result | success / failed | 失敗操作の確認 |
| CSV export | 絞り込み結果 | 外部提出や内部確認 |

Audit Logs は原因確認の入口です。秘密情報のraw valueは出ません。

## Notification Channels

| 項目 | 入れるもの | いつ使うか | 保存後の確認 |
| --- | --- | --- | --- |
| Name | 通知先名 | 一覧で判断しやすくする | channel一覧 |
| Type | discord / slack / generic / email | 通知方式 | channel type |
| Enabled | 有効/無効 | 一時停止 | delivery結果 |
| Severity filter | 通知する重要度 | 通知量調整 | Test Channel |
| Event type filter | 通知するevent | incidentだけ通知など | Notification Deliveries |
| Webhook URL | Discord/Slack/generic URL | webhook方式 | masked target |
| Recipients | email宛先 | email方式 | delivery結果 |
| SMTP Host / Port | SMTP情報 | email方式 | Test Channel |
| SMTP Username / Password | SMTP認証 | email方式 | configured |

通知先を作ったら、必ず `Test Channel` で実際に届くことを確認します。

## どこから直すか迷った時

| 起きていること | 最初に見る画面 | 次に見る画面 |
| --- | --- | --- |
| Startできない | Streams -> Check Readiness | Service Health |
| 音声が出ない | Streams -> Discord audio | Discord Settings、Metrics |
| 映像が止まる | Streams -> Encoder host preflight | Encoder Recorder、Metrics |
| uploadできない | Archive / upload | Archive Settings、Drive Destination |
| 通知が来ない | Notification Channels -> Test Channel | Notification Deliveries |
| 誰が変えたか知りたい | Audit Logs | Users / Roles |
| serviceが見えない | Service Health | Node登録、`AUTOSTREAM_NODE_CONFIG`、service env |
