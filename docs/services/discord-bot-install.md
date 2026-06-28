# Discord Botを導入する

Discord Bot は、Discord の voice channel に参加し、音声と参加者状態を AutoStream に渡します。Bot token や channel ID は Control Panel で管理し、サービスenvには Control Panel へ接続するための最小値だけを置きます。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| Discord application / Bot | Discord developer portal |
| Bot token | Control Panel の Discord Settings |
| guild ID | Control Panel の Discord Settings |
| voice channel ID | Control Panel の Discord Settings |
| text channel ID | 必要なら Control Panel の Discord Settings |
| Discord Bot用service token | Bot env の `CONTROL_PANEL_TOKEN` |
| inbound control token hash | Bot env の `SERVICE_CONTROL_TOKEN_SHA256` |

Bot には voice channel への参加、音声受信、必要なメッセージ送信権限を付けます。

## host直接起動

```bash
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
cd "/opt/autostream/releases/autostream-discord-bot_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
sudo install -o root -g root -m 0755 bin/discord-bot /usr/local/bin/discord-bot
sudo install -d -o autostream -g autostream /var/lib/autostream/discord-bot
sudo install -o root -g root -m 0644 systemd/autostream-discord-bot.service.example /etc/systemd/system/autostream-discord-bot.service
sudo install -o root -g root -m 0640 .env.example /etc/autostream/discord-bot.env
```

`/etc/autostream/discord-bot.env` を編集します。

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://<DISCORD_BOT_SERVICE_HOST>
CONTROL_PANEL_URL=https://<CONTROL_PANEL_HOST>
CONTROL_PANEL_TOKEN=<DISCORD_BOT_SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
DISCORD_RECONNECT_ENABLED=true
DISCORD_RECONNECT_MAX_ATTEMPTS=5
DISCORD_RECONNECT_BASE_DELAY=2s
DISCORD_RECONNECT_MAX_DELAY=30s
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-discord-bot
sudo systemctl status autostream-discord-bot
```

## Control Panelで登録する

1. API Tokens で `discord_bot` 用 token を作ります。
2. 必要なscopeに registration、heartbeat、config read、runtime secret resolve を含めます。
3. token作成時に `SERVICE_ID` と同じ service を pre-create します。
4. Discord Settings を開きます。
5. Bot token、guild ID、voice channel ID、text channel ID を登録します。
6. `Bot service ID` に `SERVICE_ID` を指定します。
7. Service Health で Discord Bot が online になっているか確認します。
8. Streams で Discord Config を選びます。

## 配信開始時の流れ

1. Streams で Start を押します。
2. Control Panel が primary に割り当てられた Discord Bot へ job を送ります。
3. Bot が runtime config を取り直します。
4. Bot token を runtime secret として解決します。
5. guild / voice channel へ参加します。
6. 音声packetを Encoder Recorder へ送ります。
7. active speaker や参加者状態を Worker / Control Panel へ渡します。

本番では `DISCORD_BOT_TOKEN` env に頼らず、Control Panel 管理の runtime secret を使います。

## 接続確認

| 確認 | 正常な状態 |
| --- | --- |
| Service Health | `discord_bot` が online |
| Runtime config preview | Discord Config が対象serviceに紐付いている |
| Discord voice channel | Bot が配信開始時に参加する |
| Metrics | audio receiving、audio packets、forwarded packets が増える |
| Incidents | voice disconnected や audio forward stale が出ていない |

## Dockerで起動する場合

Dockerでも必要な値は同じです。compose の env に `SERVICE_ID`、`SERVICE_PUBLIC_URL`、`CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN`、`SERVICE_CONTROL_TOKEN_SHA256` を入れ、Bot token 本体は Control Panel の Discord Settings に登録します。

Bot container から Control Panel と Encoder Recorder へ到達できる network に置いてください。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| Service Health に出ない | `CONTROL_PANEL_URL`、service token、service ID |
| Bot がvoice channelに入らない | Discord Bot権限、guild ID、voice channel ID、Bot token |
| readiness が失敗する | Discord Settings と Streams の Discord Config 選択 |
| 音声がEncoderに届かない | Encoder assignment、stream ingest token、network、Audio Bridge |
| standbyなのにstartされない | standbyは待機用です。primaryに昇格してからstart対象になります |

## 次に読むページ

- [DiscordとYouTube](/control-panel/discord-youtube)
- [サービス割り当て](/control-panel/services-workers)
- [配信画面](/control-panel/streams)
