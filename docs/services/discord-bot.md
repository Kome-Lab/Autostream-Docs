# Discord Bot

Discord Bot は Discord の voice channel に参加し、音声と参加者状態を AutoStream へ渡します。配信の音声入口になるサービスです。

Linuxサーバーへの導入、Bot tokenをControl Panelへ登録する流れ、voice接続確認、Docker起動の考え方は [Discord Botを導入する](/services/discord-bot-install) にまとめています。

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

| 画面 | 設定するもの |
| --- | --- |
| API Tokens | Discord Bot 用 token、scope、pre-created service entry |
| Service Health | Bot の online / heartbeat、capability、assignment |
| Discord Settings | Bot token、guild ID、voice channel ID、text channel ID、reconnect、audio forward |
| Streams | 配信ごとの Discord Config 選択、channel override |
| Metrics / Incidents | audio receiving、voice disconnected、audio forward stale など |

## 設定手順

1. Discord 側で Bot を作成します。
2. Bot token を取得します。
3. 必要な権限で Bot を Discord server に招待します。
4. Control Panel の [API Tokens](/control-panel/audit-tokens) で `discord_bot` 用 token を作ります。
5. Discord Bot service の env に `SERVICE_ID`、`SERVICE_PUBLIC_URL`、`CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN` を入れます。
6. Discord Bot service を起動します。
7. [Service Health](/control-panel/services-workers) で online になっているか確認します。
8. [Discord Settings](/control-panel/discord-youtube) に Bot token と channel を登録します。
9. [Streams](/control-panel/streams) で Discord Config を選び、Bot を primary に割り当てます。
10. Check Readiness を実行し、テスト配信で Bot が voice channel に参加するか確認します。

## Discord Settingsで見る項目

| 項目 | Bot側への影響 |
| --- | --- |
| Bot service ID | この設定を読める Bot を固定します |
| Guild ID | Bot が入る Discord server |
| Voice channel ID | Bot が接続する voice channel |
| Text channel ID | 補助通知や表示に使う channel |
| Bot token | Discord API 接続に使う write-only 値 |
| Enable audio forward | 音声を Encoder Recorder へ送る |
| Reconnect voice automatically | 切断時に再接続する |
| Reconnect attempts / delay | 再接続の回数と間隔 |
| Enable captions/STT forwarding | 字幕や STT へ音声を渡す |

## 配信中に確認するmetric

| metric | 正常の目安 | 異常時 |
| --- | --- | --- |
| `discord.voice_connected` | 1 | Bot が voice channel から外れています |
| `discord.audio_receiving` | 1 | Bot が音声を受けていません |
| `discord.audio_packets_total` | 増え続ける | 音声 packet が来ていません |
| `discord.audio_forwarded_total` | 増え続ける | Encoder Recorder へ音声が送れていません |
| `discord.audio_forward_errors_total` | 0 付近 | network、token、Encoder URL を確認 |
| `discord.audio_last_packet_age_sec` | 小さい | 音声入力が止まっている可能性 |
| `discord.voice_disconnect_count` | 0 付近 | Discord 側切断や権限変更を確認 |

## うまく接続できないとき

- Bot が server に招待されているか確認します。
- voice channel への参加権限があるか確認します。
- Control Panel の runtime config が Bot の `SERVICE_ID` と一致しているか確認します。
- token を再発行した場合は Control Panel 側も更新します。
- Service Health の heartbeat が stale ではないか確認します。
- Streams の Audio Bridge で Encoder Recorder へ packet が届いているか確認します。

## 次に読むページ

- [Discord Botを導入する](/services/discord-bot-install)
- [DiscordとYouTube](/control-panel/discord-youtube)
- [配信画面](/control-panel/streams)
