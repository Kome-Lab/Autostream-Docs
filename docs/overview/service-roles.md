# サービス構成

AutoStream は 1 つの大きなアプリではなく、役割ごとに分かれた複数のサービスで動きます。どの設定をどこに入れるか迷ったときは、まずこの役割分担を確認してください。

## 全体の流れ

1. Control Panel で配信、保存先、通知先、サービス割り当てを管理します。
2. Discord Bot が Discord の音声チャンネルへ参加します。
3. Worker が配信ジョブの進行、表示イベント、状態イベントを扱います。
4. Encoder Recorder が音声、イベント、外部映像入力を受け取り、FFmpeg で配信と録画を行います。
5. Observability が heartbeat、metric、エラー、通知を集約します。
6. 物理ホストごとの非root Host AgentがControl Panelへoutbound HTTPSで接続し、root Local Executorへ固定Unix socketで依頼して更新policyとhost状態を同期します。本番移行gateの完了まではlegacy `ssh_v1`を維持します。

## サービスごとの役割

| サービス | 主な役割 | 重い処理 |
| --- | --- | --- |
| Control Panel | 管理画面、認証、設定、配信ジョブ管理 | しない |
| Discord Bot | Discord 接続、音声取得、参加者状態 | しない |
| Worker | ジョブ制御、字幕/chat/参加者event 生成 | 基本しない |
| Encoder Recorder | FFmpeg、配信、録画、保存処理 | する |
| Observability | 監視、通知、診断、インシデント | しない |
| Host Agent Bridge | host別policy、heartbeat、endpoint観測、Local Executor経由のservice更新、health確認、rollback | `pull_v2` Host Agentは物理ホストごとに非rootで1つ。epoch `0`ではobserver、明示的切替後だけmutation |

## 設定の考え方

- 起動に必要な Node ID、Control Panel URL、Node Runtime Token は Panel が生成する Node Agent config に置きます。database を直接使うのは Control Panel と Observability だけです。
- 運用中に変える provider 値は Control Panel で管理します。
- Discord token、YouTube stream key、Google Drive 認証、Webhook URL は raw のまま公開しません。
- サービス間 token は、送信用と受信用を混同しないでください。
- Update Agentは配信処理のNodeではありません。新規ホストはendpointlessな`pull_v2`として登録し、物理ホストごとに非rootの`autostream-host-agent`を1つだけ置きます。Host Agentは受信TCPや`8090`を開かず、Control Panelへoutbound HTTPSで接続します。root operationは別processのLocal Executorが固定Unix socket、root所有policy、1回限りのgrantで実行します。systemd/Docker software updateとsystemd/Docker port変更のsource実装はありますが、公開releaseと実host canaryが未検証の間は既存`ssh_v1`を互換経路として維持します。Control Panel、Host Agent、各serviceへDocker socketやroot権限を渡しません。

## 次に読むページ

各サービスの詳しい設定は、[Control Panel](/services/control-panel)、[Discord Bot](/services/discord-bot)、[Worker](/services/worker)、[Encoder Recorder](/services/encoder-recorder)、[Observability](/services/observability) を確認してください。更新の構成は[Control Panelからサービスを更新する](/operations/system-updates)にまとめています。
