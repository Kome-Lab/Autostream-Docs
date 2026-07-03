# ダッシュボード

Dashboard は、AutoStream を開いたときに最初に見る運用サマリーです。細かい設定をする場所ではなく、「今すぐ注意が必要か」を判断する画面です。

## 表示されるカード

| カード | 見る内容 | 正常の目安 | 異常時に見る画面 |
| --- | --- | --- | --- |
| Active Stream | 配信中または開始中の stream | `No active stream` または想定した stream 名 | [配信画面](/control-panel/streams) |
| Services | online のサービス数 | 必要サービスがすべて online | [サービス割り当て](/control-panel/services-workers) |
| Workers | 登録済み Worker 数 | 1 台以上。冗長化するなら standby も登録 | [サービス割り当て](/control-panel/services-workers) |
| Current User | ログイン中ユーザー | 自分の管理者アカウント | [ユーザーとセキュリティ](/control-panel/users-roles-security) |
| Open Incidents | 未解決の異常数 | 0 | [監視と通知](/control-panel/observability) |
| Pending Remediation | 承認待ち・提案中の対応数 | 0 | [監視と通知](/control-panel/observability) |

## Metric summary の見方

Dashboard には Encoder、Audio、Worker、Archive の代表 metric が出ます。

| 領域 | 代表項目 | 何を見るか |
| --- | --- | --- |
| Encoder / Recorder | Encoder Process、Output FPS、Output Bitrate、Dropped Frames | FFmpeg が動いているか、出力品質が落ちていないか |
| Audio / Input Health | Discord Audio、Discord Packets、Input Timeout、Audio Silence | Discord 音声が届いているか、無音や入力 timeout がないか |
| Worker Event Metrics | Scene Updates、Overlay Events、Caption Events、Event Send Failures | Worker から Encoder Recorder へイベントが流れているか |
| Archive / Google Drive Metrics | Package Status、Final MKV、Final MP4、Google Drive Upload | 録画と upload が最後まで終わっているか |

## 毎回見るポイント

配信前は、次の 4 つだけでも確認してください。

1. Active Stream が意図しない配信中状態になっていない。
2. Services が必要台数 online になっている。
3. Open Incidents が 0、または既知の軽微なものだけである。
4. Archive / Google Drive Metrics に前回配信の未完了が残っていない。

## ここで異常を見つけたら

| 見つけた状態 | 対応 |
| --- | --- |
| Services が少ない | Service Health で warning / offline / unconfigured のサービスを確認します |
| Open Incidents がある | Incidents で severity、service、stream、summary を確認します |
| Pending Remediation がある | Remediation Actions で承認が必要か確認します |
| Output FPS が低い | Encoder Recorder の host 負荷、入力 URL、FFmpeg log を確認します |
| Discord Audio が not receiving | Discord Bot の接続、voice channel 権限、音声転送状態を確認します |
| Google Drive Upload が failed | Archive Settings と Drive destination を確認し、必要なら Retry Upload を使います |

## Dashboardだけで判断しないもの

Dashboard は概要です。次の作業は、必ず専用画面で確認してください。

- 配信開始前の最終確認: [配信画面](/control-panel/streams)
- サービスの割り当て変更: [サービス割り当て](/control-panel/services-workers)
- 通知先の追加や test: [監視と通知](/control-panel/observability)
- ユーザー追加や権限変更: [ユーザーとセキュリティ](/control-panel/users-roles-security)
