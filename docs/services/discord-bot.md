# Discord Bot

Discord Bot は Discord の voice channel に参加し、音声と参加者状態を AutoStream へ渡します。配信の音声入口になるサービスです。

Linuxサーバーへの導入、Bot tokenをControl Panelへ登録する流れ、voice接続確認、Docker起動の考え方は [Discord Botを導入する](/services/discord-bot-install) にまとめています。

## 役割

- Control Panel に service registration と heartbeat を送る
- 配信ジョブの開始、停止を受ける
- Discord の guild と voice channel に参加する
- Discord 音声を Encoder Recorder へ送る
- 参加者、active speaker、配信中の chat message を Worker へ渡す

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `AUTOSTREAM_NODE_CONFIG` | Panel が生成した Discord Bot 用 `config.yml` |
| `WORKER_URL` | Worker へイベントを送る URL |
| `DISCORD_RECONNECT_*` | voice reconnect の基本設定 |
| `CONTROL_PANEL_RUNTIME_CONFIG_REFRESH_INTERVAL` | 待機枠やchannel設定を再読込する間隔。既定は `30s` |

## Control Panelで設定するもの

| 画面 | 設定するもの |
| --- | --- |
| Node登録 | Discord Bot Node を作成し、Host、Port、SSL、説明を設定します |
| Service Health | Bot の online / heartbeat、自動報告された version / capability / OS / arch、assignment |
| Discord Settings | Bot token、Discord BOT Node、reconnect、audio forward |
| Streams | 配信ごとの Discord Config 選択、guild ID、voice channel ID、text channel ID、VC参加自動開始 |
| Metrics / Incidents | audio receiving、voice disconnected、audio forward stale など |

## 設定手順

1. Discord 側で Bot を作成します。
2. Bot token を取得します。
3. 必要な権限で Bot を Discord server に招待します。
4. Control Panel の [Node Agent登録](/control-panel/node-agent-registration) で `discord_bot` Node を作ります。
5. Configuration から `config.yml` を保存し、Discord Bot service の env に `AUTOSTREAM_NODE_CONFIG` を入れます。
6. Discord Bot service を起動します。
7. [Service Health](/control-panel/services-workers) で online になっているか確認します。
8. [Discord Settings](/control-panel/discord-youtube) に Bot token を保存し、登録済み Discord Bot Node を選びます。
9. [Streams](/control-panel/streams) で Discord Config を選び、Discord Guild ID、VC Channel ID、必要なら Chat Channel ID を配信枠に保存し、VC参加で開始する待機枠は `Discord VC参加で自動開始` をONにして、Bot を primary に割り当てます。
10. Check Readiness を実行し、テスト配信で Bot が voice channel に参加するか確認します。

## Discord Settingsで見る項目

| 項目 | Bot側への影響 |
| --- | --- |
| Discord BOT Node | この設定を読める Bot を固定します |
| Bot token | Discord API 接続に使う write-only 値 |
| Enable audio forward | 音声を Encoder Recorder へ送る |
| Reconnect voice automatically | 切断時に再接続する |
| Reconnect attempts / delay | 再接続の回数と間隔 |

Guild ID、VC Channel ID、Chat Channel ID は Streams の配信枠に保存します。VC参加で自動開始する場合は、同じ配信枠で `Discord VC参加で自動開始` をONにします。Chat Channel ID を入れると、配信開始後にその channel の新規messageを Worker の `overlay.discord_chat` に流します。

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
- Control Panel の runtime config が Bot の Node ID と一致しているか確認します。
- Bot 起動後に Streams を追加した場合は、`CONTROL_PANEL_RUNTIME_CONFIG_REFRESH_INTERVAL` の次回更新後に auto-start 候補になります。候補になるのは、`Discord VC参加で自動開始` がONの待機枠だけです。
- chat 表示を使う場合は、Bot に text channel の閲覧権限と Message Content Intent があるか確認します。
- Node Runtime Token を再発行した場合は `config.yml` を更新します。
- Service Health の heartbeat が warning / offline ではないか確認します。
- Streams の Audio Bridge で Encoder Recorder へ packet が届いているか確認します。

## 次に読むページ

- [Discord Botを導入する](/services/discord-bot-install)
- [DiscordとYouTube](/control-panel/discord-youtube)
- [配信画面](/control-panel/streams)
