# ダッシュボード

Dashboard は、AutoStream を開いたときに最初に見る運用サマリーです。設定や本番前チェックを行う画面ではなく、配信枠、Node、監視値、最近の操作から「今見るべきもの」を判断します。

## 表示されるカード

| カード | 見る内容 | 正常の目安 | 次に見る画面 |
| --- | --- | --- | --- |
| 配信中 | `live` または `starting` の配信数 | 想定した本番配信だけが入っている | [配信画面](/control-panel/streams) |
| 予約・準備 | `created`、`draft`、`scheduled`、`ready` の配信枠数 | 今日または次回の待機枠が見える | [配信画面](/control-panel/streams) |
| 要確認 | `failed` または `error` の配信数 | 0 | [インシデント](/control-panel/observability) |
| オンラインNode | online の Node 数 / 登録Node数 | 必要な Node が online | [Node登録](/control-panel/node-agent-registration) |

## 配信状態

配信状態グラフは、進行中、待機中、要確認の配信枠があるときだけ表示します。配信枠がまだない、または完了済みの履歴だけの場合はグラフではなく空状態を表示します。

| 状態 | 含まれる status |
| --- | --- |
| 配信中 | `live`、`starting` |
| 予約・準備 | `created`、`draft`、`scheduled`、`ready` |
| 要確認 | `failed`、`error` |
| 停止・完了 | `stopped`、`completed` など |

## Metrics

Metrics は Observability から届いた最新値と、Control Panel が Node heartbeat で受け取った最新値を表示します。まだ metric が届いていない場合は空状態になります。

| 代表 metric | 見るポイント |
| --- | --- |
| `worker.cpu_percent`、`worker.memory_percent` | Worker の負荷 |
| `encoder.process_alive`、fps、bitrate | Encoder / Recorder が動いているか |
| `discord.audio_forward_active` | Discord 音声転送が有効か |
| `observability.goroutines`、heap、uptime | Observability 自体が動いているか |

## 本日の配信予定

本日の配信予定には、Settings のタイムゾーンで当日の `scheduled_start_at` を持つ配信枠を表示します。当日予定がまだない場合でも、待機中の配信枠があれば最大 5 件まで表示します。

配信開始の判断は、Dashboard だけでは行いません。実際の開始、停止、割り当て変更は Streams 画面で行い、異常があれば Service Health、Incidents、Metrics を確認します。

## 最近の操作

最近の操作には Audit Log の直近イベントを表示します。意図しない Start、Stop、設定変更、通知設定変更があれば、Audit Logs で詳細を確認します。
