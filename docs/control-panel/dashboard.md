# ダッシュボード

Dashboard は、AutoStream を開いたときに最初に見る運用サマリーです。設定や本番前チェックを行う画面ではなく、配信枠とNodeの接続状態から「今見るべきもの」を判断します。

## 表示されるカード

| カード | 見る内容 | 正常の目安 | 次に見る画面 |
| --- | --- | --- | --- |
| 配信中 | `live` または `starting` の配信数 | 想定した本番配信だけが入っている | [配信画面](/control-panel/streams) |
| 待機中 | `created`、`draft`、`scheduled`、`ready` の配信枠数 | 開始待ちの配信枠が見える | [配信画面](/control-panel/streams) |
| 要確認 | `failed` または `error` の配信数 | 0 | [インシデント](/control-panel/observability) |
| オンラインNode | online の Node 数 / 登録Node数 | 必要な Node が online | [Node登録](/control-panel/node-agent-registration) |

## 配信状態

配信状態グラフは、進行中、待機中、要確認の配信枠があるときだけ表示します。配信枠がまだない、または完了済みの履歴だけの場合はグラフではなく空状態を表示します。

| 状態 | 含まれる status |
| --- | --- |
| 配信中 | `live`、`starting` |
| 待機中 | `created`、`draft`、`scheduled`、`ready` |
| 要確認 | `failed`、`error` |
| 停止・完了 | `stopped`、`completed` など |

## Metricsへの切り分け

Dashboard では Node の raw metric グラフを表示しません。CPU、memory、fps、bitrate、disk、network、Observability runtime などの詳細値は Metrics 画面で確認します。

配信開始の判断は、Dashboard だけでは行いません。実際の開始、停止、割り当て変更は Streams 画面で行い、異常があれば Service Health、Incidents、Metrics を確認します。予定確認は Streams、操作履歴の確認は Audit Logs で行います。
