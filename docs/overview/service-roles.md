# サービス構成

AutoStream は 1 つの大きなアプリではなく、役割ごとに分かれた複数のサービスで動きます。どの設定をどこに入れるか迷ったときは、まずこの役割分担を確認してください。

## 全体の流れ

1. Control Panel で配信、保存先、通知先、サービス割り当てを管理します。
2. Discord Bot が Discord の音声チャンネルへ参加します。
3. Worker が配信ジョブの進行、表示イベント、状態イベントを扱います。
4. Encoder Recorder が音声、イベント、外部映像入力を受け取り、FFmpeg で配信と録画を行います。
5. Observability が heartbeat、metric、エラー、通知を集約します。

## サービスごとの役割

| サービス | 主な役割 | 重い処理 |
| --- | --- | --- |
| Control Panel | 管理画面、認証、設定、配信ジョブ管理 | しない |
| Discord Bot | Discord 接続、音声取得、参加者状態 | しない |
| Worker | ジョブ制御、overlay/caption/event 生成 | 基本しない |
| Encoder Recorder | FFmpeg、配信、録画、保存処理 | する |
| Observability | 監視、通知、診断、インシデント | しない |

## 設定の考え方

- 起動に必要な URL、database、service token は env に置きます。
- 運用中に変える provider 値は Control Panel で管理します。
- Discord token、YouTube stream key、Google Drive 認証、Webhook URL は raw のまま公開しません。
- サービス間 token は、送信用と受信用を混同しないでください。

## 次に読むページ

各サービスの詳しい設定は、[Control Panel](/services/control-panel)、[Discord Bot](/services/discord-bot)、[Worker](/services/worker)、[Encoder Recorder](/services/encoder-recorder)、[Observability](/services/observability) を確認してください。
