# Discord Bot Host Deployment

`autostream-discord-bot` を Linux host に直接配置する手順です。Discord Bot token、guild ID、voice channel ID は env ではなく Control Panel の Discord Bot Config で管理します。

## 前提

- Linux host に `autostream` user を作成済み
- Control Panel に到達できる HTTPS URL がある
- Control Panel で `discord_bot` service token を作成済み
- Control Panel で Discord Bot service entry と Discord Bot Config を作成済み
- Control Panel からこの Bot の `SERVICE_PUBLIC_URL` に到達できる

## Directory

```bash
sudo install -d -o autostream -g autostream -m 0750 /var/lib/autostream/discord-bot
sudo install -d -o root -g autostream -m 0750 /etc/autostream
```

## Environment

`/etc/autostream/discord-bot.env` は Control Panel 接続と inbound control token だけを置きます。

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://discord-bot-01.example.com
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true

CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>

DISCORD_RECONNECT_ENABLED=true
DISCORD_RECONNECT_MAX_ATTEMPTS=5
DISCORD_RECONNECT_BASE_DELAY=2s
DISCORD_RECONNECT_MAX_DELAY=30s

AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
TZ=Asia/Tokyo
```

env file の権限:

```bash
sudo install -o root -g autostream -m 0640 /tmp/discord-bot.env /etc/autostream/discord-bot.env
```

## Control Panel 側の設定

Control Panel で以下を作成します。

1. `discord_bot` service token
2. service registry entry: `SERVICE_ID=discord-bot-01`
3. Discord Bot Config
4. stream への primary または standby assignment

Discord Bot Config の例:

```json
{
  "name": "Main Discord Bot",
  "service_id": "discord-bot-01",
  "guild_id": "<DISCORD_GUILD_ID>",
  "voice_channel_id": "<VOICE_CHANNEL_ID>",
  "text_channel_id": "<TEXT_CHANNEL_ID>",
  "bot_token": "<DISCORD_BOT_TOKEN>",
  "audio_forward_enabled": true,
  "reconnect_enabled": true,
  "reconnect_max_attempts": 5,
  "reconnect_base_delay": "2s",
  "reconnect_max_delay": "30s",
  "caption_enabled": false
}
```

`bot_token` は write-only です。Control Panel の API/UI は raw token を返しません。stream ごとに guild / voice channel を変える場合は、stream 作成時に Discord Bot service と Discord config を選択します。

## Build and Install

```bash
cd /opt/autostream-discord-bot
go test ./...
go build -o discord-bot ./cmd/discord-bot

sudo install -o root -g root -m 0755 discord-bot /usr/local/bin/discord-bot
sudo install -o root -g root -m 0644 systemd/autostream-discord-bot.service.example /etc/systemd/system/autostream-discord-bot.service
```

## systemd

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-discord-bot
sudo systemctl status autostream-discord-bot
```

ログ確認:

```bash
journalctl -u autostream-discord-bot -f
```

## Control Panel 連携

起動後、Discord Bot は次を行います。

- `/services/register` で service 登録
- `/services/runtime-config?service_id=<SERVICE_ID>` で自分用の Discord Bot Config を取得
- `/services/runtime-secrets/resolve` で自分に許可された Bot token だけを取得
- `/services/heartbeat` で状態送信
- stream start 時に `/jobs/start` を受信

Bot service は自分の `service_id` に紐づかない Discord Bot Config や runtime secret を読めません。

## dry-run

Production deployments should keep `AUTOSTREAM_ENV=production` or `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true`. With either setting, startup fails closed unless registration, runtime config fetch, `bot_token_secret_name` resolution, and real Discord client initialization all succeed. `DISCORD_BOT_TOKEN` and dry-run mode are local migration fallbacks only.

Control Panel 側に Discord Bot Config がない、または Bot token が未設定の場合、Bot は dry-run mode で起動できます。この場合は外部 Discord へ接続せず、registration、heartbeat、job API のみを確認できます。

## Troubleshooting

- Control Panel に表示されない場合は `CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN`、`SERVICE_PUBLIC_URL` を確認します。
- runtime config が `403` の場合は、service token が対象 `SERVICE_ID` を所有しているか、`service.config.read` scope があるか確認します。
- runtime secret resolve が `403` の場合は、Discord Bot Config の `service_id` と `SERVICE_ID` が一致しているか確認します。
- job start が `401` の場合は、Control Panel の `SERVICE_CALL_TOKEN` と Bot の `SERVICE_CONTROL_TOKEN_SHA256` の対応を確認します。
- Discord VC に参加しない場合は、Control Panel の Discord Bot Config、Discord Bot 権限、guild ID、voice channel ID を確認します。
