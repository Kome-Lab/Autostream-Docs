# ダッシュボード

Dashboard は、AutoStream を開いたときに最初に見る運用サマリーです。設定や本番前チェックを行う画面ではなく、配信枠とNodeの接続状態から「今見るべきもの」を判断します。

## 表示されるカード

| カード | 見る内容 | 正常の目安 | 次に見る画面 |
| --- | --- | --- | --- |
| 配信中 | `live` または `starting` の配信数 | 想定した本番配信だけが入っている | [配信画面](/control-panel/streams) |
| 待機中 | `created`、`draft`、`ready` の配信枠数 | VC参加または手動開始を待つ枠が見える | [配信画面](/control-panel/streams) |
| 要対応 | `failed` または `error` の配信数と警告中のNode数 | 0 | [インシデント](/control-panel/observability) |
| サービス稼働 | 正常な Node 数 / 登録Node数 | 必要な Node が online | [Node登録](/control-panel/node-agent-registration) |

## 配信枠の稼働状況

Dashboard には、終了していない配信枠を優先度順に表示します。日時順の番組表ではありません。状態、配信経路、開始条件、録画、担当Nodeを確認します。

| 状態 | 含まれる status |
| --- | --- |
| 配信中 | `live`、`starting` |
| 待機中 | `created`、`draft`、`ready` |
| 要確認 | `failed`、`error` |
| 停止・完了 | `stopped`、`completed` など |

## Metricsへの切り分け

Dashboard では Node の raw metric グラフを表示しません。CPU、memory、fps、bitrate、disk、network、Observability runtime などの詳細値は Metrics 画面で確認します。

配信開始の判断は、Dashboard だけでは行いません。実際の開始条件、停止、割り当て変更は Streams 画面で確認し、異常があれば Service Health、Incidents、Metrics を確認します。操作履歴の確認は Audit Logs で行います。
