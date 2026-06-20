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

| 領域 | 代表 metric | 見るポイント |
| --- | --- | --- |
| Encoder / Recorder | encoder process、fps、bitrate、dropped frames | 映像出力が安定しているか |
| Archive / Google Drive | package status、final MKV / MP4、upload status | 録画と upload が完了しているか |
| Audio / Input | Discord audio、input timeout、audio silence、clipping | 音声が届き、無音や音割れがないか |
| Worker Event | scene updates、overlay events、caption events、send failures | Worker event が流れているか |

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
| email | SMTP で email 通知 |

### 共通項目

| 項目 | 説明 |
| --- | --- |
| Existing channel | 編集対象。空欄なら新規 |
| Name | 通知先名 |
| Type | channel type |
| Enabled | 通知を有効にするか |
| Severity filter | 通知する severity |
| Event type filter | 通知する event type |

filter を空にすると、すべて対象として扱われます。重要な通知先には warning 以上、軽い通知先には incident だけ、のように分けると運用しやすくなります。

### webhook系項目

| 項目 | 説明 |
| --- | --- |
| Webhook URL | 通知先 URL。保存後は表示されません |

編集時に空欄にすると、既存の URL を保持します。

### email項目

| 項目 | 説明 |
| --- | --- |
| Recipients | 宛先。改行またはカンマで複数指定 |
| SMTP Host | SMTP server |
| SMTP Port | SMTP port |
| From | 送信元 address |
| SMTP Username | SMTP 認証 user |
| SMTP Password | SMTP password。保存後は表示されません |
| Use TLS | TLS を使うか |

## 通知のtest

1. Notification Channels で channel を作成または選択します。
2. `Test Channel` を押します。
3. Notification Deliveries に結果が出るか確認します。
4. 外部の通知先に実際に届いたか確認します。

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
| 通知が来ない | Notification Channels -> Test Channel -> Notification Deliveries |
| incident が多い | Incidents -> Diagnostics -> Metrics |
| 対応候補が実行できない | Remediation Actions -> status / safety / result |
| metric が古い | Service Health -> Observability service -> 各 service heartbeat |
