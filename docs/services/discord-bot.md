# Discord Bot

Discord Bot は Discord の voice channel に参加し、音声と参加者状態を AutoStream へ渡します。配信の音声入口になるサービスです。

## 役割

- Control Panel に service registration と heartbeat を送る
- 配信ジョブの開始、停止を受ける
- Discord の guild と voice channel に参加する
- Discord 音声を Encoder Recorder へ送る
- 参加者や active speaker の状態を Worker へ渡す

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `SERVICE_ID` | この Bot を識別する ID |
| `SERVICE_PUBLIC_URL` | Control Panel から到達できる URL |
| `CONTROL_PANEL_URL` | Control Panel の URL |
| `CONTROL_PANEL_TOKEN` | Control Panel へ登録するための token |
| `SERVICE_CONTROL_TOKEN_SHA256` | Control Panel からの inbound request 検証 |
| `WORKER_URL` | Worker へイベントを送る URL |
| `DISCORD_RECONNECT_*` | voice reconnect の基本設定 |

## Control Panelで設定するもの

- Discord Bot token
- guild ID
- voice channel ID
- text channel ID
- caption や STT を使う場合の設定
- primary / standby の割り当て

## 設定手順

1. Discord 側で Bot を作成します。
2. Bot token を取得します。
3. 必要な権限で Bot を Discord server に招待します。
4. Control Panel に Bot token と対象 channel を登録します。
5. Discord Bot service を起動します。
6. Control Panel で online になっているか確認します。
7. テスト配信で Bot が voice channel に参加するか確認します。

## うまく接続できないとき

- Bot が server に招待されているか確認します。
- voice channel への参加権限があるか確認します。
- Control Panel の runtime config が Bot の `SERVICE_ID` と一致しているか確認します。
- token を再発行した場合は Control Panel 側も更新します。
