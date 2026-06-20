# Observability

Observability は AutoStream の監視、通知、診断を担当します。配信そのものを処理するサービスではなく、異常に気づいて対応しやすくするためのサービスです。

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
| `SERVICE_ID` | Observability を識別する ID |
| `CONTROL_PANEL_URL` | Control Panel の URL |
| `CONTROL_PANEL_TOKEN` | service registration 用 token |
| `DATABASE_URL` | Observability 用 database |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | 通知 secret の暗号化 |
| `OBSERVABILITY_INGEST_TOKEN_SHA256` | signal ingest token |
| `OBSERVABILITY_ADMIN_TOKEN_SHA256` | 管理 API token |
| `REMEDIATION_MODE` | 自動対応の扱い |

## 通知先

通知先は Control Panel または Observability API で管理します。Webhook URL や SMTP password は raw のままログや API response に出さないでください。

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
