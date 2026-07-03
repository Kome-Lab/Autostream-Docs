# Observability

Observability は AutoStream の監視、通知、診断を担当します。配信そのものを処理するサービスではなく、異常に気づいて対応しやすくするためのサービスです。

Linuxサーバーへの導入、database、Node Agent config、通知先登録、閾値調整は [Observabilityを導入する](/services/observability-install) にまとめています。

## 役割

- 各サービスの heartbeat を受け取る
- metric、warning、error を集約する
- incident を作成、重複排除する
- 通知先へ送る
- 診断レポートや対応メモを管理する
- Control Panel に状態を返す

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `AUTOSTREAM_NODE_CONFIG` | Panel が生成した Observability 用 `config.yml` |
| `DATABASE_URL` | Observability 用 database |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | 通知 secret の暗号化 |
| `OBSERVABILITY_INGEST_TOKEN_SHA256` | signal ingest token |
| `OBSERVABILITY_ADMIN_TOKEN_SHA256` | 管理 API token |
| `REMEDIATION_MODE` | 自動対応の扱い |

## 通知先

通知先は Control Panel または Observability API で管理します。Webhook URL や SMTP password は raw のままログや API response に出さないでください。

## Control Panelで使う画面

| 画面 | 使い方 |
| --- | --- |
| Monitoring Dashboard | incident、remediation、delivery、metric の概要を見る |
| Incidents | 発生中の異常を確認し、acknowledge / resolve する |
| Diagnostics | 原因候補、影響、確認項目を読む |
| Remediation Actions | 承認が必要な対応を確認、承認、実行する |
| Notification Channels | Discord / Slack / generic / email 通知先を登録、test する |
| Metrics | Encoder、Audio、Worker、Archive の metric を見る |
| Service Health | Observability service の heartbeat を確認する |

## 閾値の例

- heartbeat が古い
- ディスク空き容量が少ない
- Google Drive upload の retry が多い
- packet loss が高い
- audio silence が続く
- encoder FPS や bitrate が低い

## 確認手順

1. Observability を起動します。
2. Control Panel で online を確認します。
3. Worker や Encoder Recorder から signal が届いているか確認します。
4. テスト通知を送ります。
5. incident が作成、解決できるか確認します。

通知が来ない場合は、通知先の登録、token binding、ネットワークを順番に確認してください。

## Notification Channelsの項目

| 項目 | 説明 |
| --- | --- |
| Name | 通知先名 |
| Type | discord、slack、generic、email |
| Webhook URL | webhook 系通知先。保存後は masked 表示 |
| Recipients | email 宛先 |
| SMTP Host / Port / TLS | email 送信設定 |
| Severity filter | 通知する severity |
| Event type filter | 通知する event type |
| Test Channel | 実際に届くか確認 |

## incident対応の流れ

1. Dashboard で Open Incidents を確認します。
2. Incidents で severity、service、stream、summary を確認します。
3. Diagnostics で likely cause と recommended actions を確認します。
4. Metrics で関連 metric が回復しているか確認します。
5. 必要なら Remediation Actions で承認、実行します。
6. 対応後、incident を resolve します。

## 次に読むページ

- [Observabilityを導入する](/services/observability-install)
- [監視と通知](/control-panel/observability)
- [インシデントと通知](/operations/incidents-notifications)
