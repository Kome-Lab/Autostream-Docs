# 監視と通知

Monitoring、Incidents、Diagnostics、Remediation Actions、Notification Channels、Metrics は、AutoStream の異常に気づき、対応するための画面です。Observability service からの情報を Control Panel に表示します。

## Monitoring

Monitoring は、監視系のまとめ画面です。

| 表示 | 意味 |
| --- | --- |
| Incidents | 発生した異常 |
| Remediation Actions | 提案または承認待ちの対応 |
| Notification Deliveries | 通知配信結果 |
| Metric Snapshots | 収集された metric |

Dashboard より詳しく見たいときに使います。

## Metrics

Metrics は、サービスが送った metric を一覧で見る画面です。

Control Panel の `/observability/metrics` は、登録済みの Observability Node Agent へプロキシした metric と、Control Panel が各 Node heartbeat で受け取った metric を結合して返します。各サービスの heartbeat には、Node exporter に近い `node.cpu.used_percent`、`node.cpu_count`、`node.load1`、`node.memory.used_percent`、`node.filesystem.root.used_percent` と、`process.heap_alloc_bytes`、`process.goroutines`、`process.uptime_seconds` などの process metric が含まれます。CPU使用率は累積CPU時間の差分から算出するため、Node起動後2回目以降の heartbeat で報告されます。Observability 自身の `/metrics` には `observability.goroutines`、heap、uptime などの互換用自己監視 metric も含まれます。Node登録画面では、各Nodeの heartbeat metrics を要約表示します。

Observability Node の公開URLをブラウザで開いた場合、root `/` は安全な状態JSONだけを返します。Metrics の実データは `/metrics` ですが、ここは Node Runtime Token で保護されているため、通常はブラウザから直接開かず Control Panel の Metrics 画面で確認します。

Metrics が出ない場合は、次を確認します。

| 確認 | 見る内容 |
| --- | --- |
| Node登録 | Observability Node が Configure済みで、`status` が pending のまま残っていないか |
| Heartbeat | Service Health で Observability Node の heartbeat が届いているか |
| 報告情報 | Node登録画面で `reported_version`、OS、Arch が空の場合、Node Agent の configure が古いbinaryで実行されていないか |
| Node metric | Service Health に heartbeat metrics が出ているか。出ていれば Metrics 画面にも表示されます |
| 到達性 | Control Panel から Observability Node Agent API の host/port へ到達できるか |
| 権限 | 画面を開く user に `metrics.read` があるか |
| 暗号鍵 | Control Panel の `AUTOSTREAM_SECRET_ENCRYPTION_KEY` が Node Runtime Token を復号できる値か |

| 領域 | 代表 metric | 見るポイント |
| --- | --- | --- |
| Encoder / Recorder | encoder process、fps、bitrate、dropped frames | 映像出力が安定しているか |
| Archive / Google Drive | package status、final MKV / MP4、upload status | 録画と upload が完了しているか |
| Audio / Input | Discord audio、input timeout、audio silence、clipping | 音声が届き、無音や音割れがないか |
| Worker Event | scene updates、overlay events、caption events、send failures | Worker event が流れているか |
| Observability | `observability.goroutines`、heap、uptime | 監視サービス自体が生きているか |

## Incidents

Incidents は、Observability が異常として扱ったものです。

| 列 | 意味 |
| --- | --- |
| Severity | info、warning、error、critical |
| Status | open、acknowledged、resolved、ignored など |
| Rule | どの検知ルールで出たか |
| Service | 関係する service |
| Stream | 関係する stream |
| Summary | 人が読むための概要 |
| Checks | 次に見る metric や確認ポイント |
| Actions | acknowledge / resolve など |

まず severity と service を見て、配信継続に影響があるか判断します。

## Diagnostics

Diagnostics は、incident の原因候補と確認項目を読む画面です。

| 項目 | 意味 |
| --- | --- |
| Summary | 何が起きているか |
| Likely cause | 原因候補 |
| Impact | 放置した場合の影響 |
| Confidence | 診断の確からしさ |
| Evidence | 判断に使った signal |
| Recommended actions | 人が確認する手順 |
| Safe auto candidates | 自動化しやすい軽い対応候補 |
| Actions requiring approval | 実行前に承認したい対応 |

Diagnostics は、配信中の判断に使う説明です。表示される evidence は運用判断用に要約されたもので、secret は出しません。

## Remediation Actions

Remediation Actions は、対応候補を承認または実行する画面です。

| 列 | 意味 |
| --- | --- |
| Action | 対応名 |
| Status | suggested、pending_approval、executed、blocked など |
| Mode | 自動、手動承認など |
| Incident | 対応元 incident |
| Safety | 承認が必要か |
| Result | 実行結果 |
| Command | approve / execute |

配信中の restart 系操作は影響が大きいため、内容を確認してから承認します。

## Notification Channels

Notification Channels は、異常や配信イベントを外部へ通知する画面です。

### channel type

| type | 用途 |
| --- | --- |
| discord | Discord webhook へ通知 |
| slack | Slack webhook へ通知 |
| generic | 任意の webhook endpoint へ通知 |
| email | Settings の共通SMTPを使って email 通知 |

Slack は Slack App の Incoming Webhooks で発行した `https://hooks.slack.com/services/...` 形式の URL を登録します。Discord は Discord channel の連携設定で発行した webhook URL をそのまま登録できます。Discord client からコピーされる `discord.com`（`www` を含む）、`ptb.discord.com`、`canary.discord.com` の URL は、保存時に標準の `https://discord.com/...` へ正規化されます。旧 `discordapp.com` とその `www` / `ptb` / `canary` alias も互換入力として受理し、同じ標準 URL へ正規化します。これら以外の Discord subdomain は受理しません。

保存後に raw Webhook URL は再表示されず、一覧と API response には masked target だけが表示されます。

### 共通項目

| 項目 | 説明 |
| --- | --- |
| Name | 通知先名 |
| Type | channel type |
| Enabled | 通知を有効にするか |
| Severity filter | incident、診断、remediationで通知する severity |
| Event type filter | incident、診断、remediationで通知する event type |

filter を空にすると、incident、診断、remediationのすべてを対象として扱います。重要な通知先には warning 以上、軽い通知先には incident だけ、のように分けると運用しやすくなります。

Control Panelの監査ログへ保存された認証済みユーザー操作とsystem操作は、`admin.audit` として有効なすべての通知先へ送ります。作成、更新、削除、開始、停止、承認、テスト、login成功、security変更と、その成功・失敗が対象です。`admin.audit` はSeverity filterとEvent type filterを通さないため、既定のfilter設定でも管理操作だけが欠落することはありません。通知先を無効にすると、`admin.audit` を含むすべての送信を停止します。

未認証のlogin失敗と、`service:*` actorによるheartbeat、runtime report、内部relayなどは、外部入力による通知floodや通知の自己ループを避けるため `admin.audit` の対象外です。監査ログへの記録は従来どおり残ります。

### webhook系項目

| 項目 | 説明 |
| --- | --- |
| Webhook URL | 通知先 URL。保存後は表示されません |

作成済みの通知先は、一覧の編集操作から name、enabled、filter、Webhook URL を更新できます。通知方式は編集時に変更できません。編集フォームにも raw Webhook URL は読み込まれません。Webhook URL を空欄のまま更新すると既存の URL を保持し、新しい URL を入力した場合だけ置き換えます。

### email項目

| 項目 | 説明 |
| --- | --- |
| Recipients | 宛先。作成時は必須。改行またはカンマで複数指定 |
| SMTP | この画面では入力しません。`設定` -> `メールサーバー` の共通設定を使います |

作成済みの email 通知先を編集するとき、Recipients を空欄のまま更新すると現在の宛先を保持し、入力した場合だけ置き換えます。保存済みの宛先は masked target だけを表示します。新規作成したemail通知先は共通SMTPを使います。旧版で作成した個別SMTP方式の通知先は、通常の編集では既存方式を保持します。共通SMTPへ移す場合は、先にSettingsのSMTPテストを通し、通知先の編集画面で共有SMTPへの移行を明示的に選んで保存します。移行すると旧個別SMTP資格情報は削除され、元の方式には戻せません。

共通SMTPの host、port、TLS、From、username、password は Control Panel の Settings で管理します。SMTP password は Control Panel の secret store に残り、ブラウザや Observability へ渡しません。email は Observability から Control Panel の relay を経由して送るため、送信時に Observability から Control Panel へ到達でき、Control Panel からSMTPサーバーへ到達できる必要があります。Webhook通知は従来どおり Observability から通知先へ直接送ります。

relayにはObservability Node Runtime Tokenの専用scope `notifications.email.send` が必要です。新規Node登録ではscopeが自動付与されます。この更新より前に発行したObservability Nodeは、対応するControl Panelをdeployしたあと、Node登録のConfigurationでRuntime Tokenを再生成します。再生成すると既存scopeを保持したまま`notifications.email.send`が追加されます。表示された新しい`config.yml`を実行環境へ反映し、Observabilityを再起動してください。再生成だけでは実行中processのtokenは切り替わりません。

SMTPが無効または未設定でも email 通知先の作成と編集はできます。ただし、テスト送信と実送信は `smtp_not_configured` で安全に失敗します。本番環境では共通SMTPにTLSを使い、Settingsのテスト送信を通してからemail通知先を有効にします。

### 通知先の保存・送信でエラーになる場合

Control Panel は Observability の入力エラーを一律502にせず、安全なエラーコードだけを表示します。raw Webhook URL、SMTP password、Node Runtime Token は応答や監査ログへ出しません。

| 表示コード | 確認内容 |
| --- | --- |
| `invalid_webhook_url` | Discord / Slack の正規HTTPS Webhook URLか、public DNSへ解決できるか |
| `invalid_smtp_channel` | emailのrecipientが正しいか、Settingsの共通SMTPを利用する構成か |
| `smtp_not_configured` | Settingsでメールサーバーを有効化し、必須項目とpasswordを保存してテスト送信できるか |
| `smtp_requires_tls` | remote SMTPでSTARTTLSが有効か |
| `rate_limited` | email送信が集中しています。少し待ってから再試行する |
| `secret_encryption_key_required` | Observability env に固定の `AUTOSTREAM_SECRET_ENCRYPTION_KEY` があり、再起動後も同じ値か |
| `observability_auth_failed` | Control Panelで再発行したObservability Nodeの `config.yml` が実行中コンテナへread-only mountされ、Node Runtime Tokenが一致しているか |
| `observability_unavailable` | Observability process、MariaDB、rate limit backend、Service Healthを確認 |
| `observability_request_failed` | Control Panelから登録済みObservability公開URLのhost/portへ到達できるか |

DockerではObservabilityをコンテナ内の `0.0.0.0:8080` で待ち受けさせ、`/etc/autostream-observability/config.yml` をread-only mountします。host側へ公開するportはreverse proxyからだけ到達できる範囲に制限します。

## 通知のテスト送信

1. Notification Channels で channel を保存します。
2. 保存済み channel の行から `テスト送信` を押します。
3. 返された delivery result の `status` が `success` か `failure` か確認します。request が受け付けられただけでは送信成功とは判断しません。
4. Notification Deliveries に同じ結果が出るか確認します。
5. 外部の通知先に実際に届いたか確認します。

email の場合は、先にSettingsのメールサーバーでテスト送信し、実際に受信できることを確認してからchannelの`テスト送信`を実行します。続けてdelivery result、Notification Deliveries、実際の受信メールを確認してください。channel のテストが `failure` の場合、画面には masked target と安全化された error だけが表示されます。Control Panel、共通SMTP設定、SMTPサーバーへの到達性を順番に確認してください。

`テスト送信` 自体も監査対象です。テスト対象へのテスト通知に加えて、操作監査の `admin.audit` が有効な全通知先へ届くのが正常です。

## 通知が多すぎるとき

| 調整 | 効果 |
| --- | --- |
| Severity filter を warning 以上にする | info 通知を減らせます |
| Event type filter を incident.opened だけにする | 更新通知を減らせます |
| channel を用途別に分ける | 緊急通知と記録用通知を分けられます |
| resolved / ignored の扱いを見直す | 同じ incident の繰り返し対応を減らせます |

## よくある確認順

| 状況 | 確認順 |
| --- | --- |
| 通知が来ない | Notification Channels -> テスト送信 -> Notification Deliveries |
| incident が多い | Incidents -> Diagnostics -> Metrics |
| 対応候補が実行できない | Remediation Actions -> status / safety / result |
| metric が古い | Service Health -> Observability service -> 各 service heartbeat |
