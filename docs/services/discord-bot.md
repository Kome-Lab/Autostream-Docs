# Discord Bot

Discord Bot は Discord guild / voice channel に接続し、参加者状態と VC 音声を AutoStream の他サービスへ渡す service です。stream ごとの guild / channel は Control Panel の Discord Bot Config で管理します。

## 役割

- Control Panel へ service registration と heartbeat を送る。
- stream start / stop job を受け取る。
- 指定された Discord guild / voice channel に参加する。
- 参加者一覧、参加 / 退出、active speaker 状態を収集する。
- Discord VC の Opus packet を Encoder/Recorder の audio ingest endpoint へ送る。
- audio forwarding 状態を heartbeat metrics として報告する。
- Observability へ warning / error / metric を送る。

Discord Bot は映像合成、RTMPS 配信、録画、archive upload を行いません。media output は Encoder/Recorder の責務です。

## Control Panel 管理 config

Discord Bot token、guild ID、voice channel ID、caption/STT forwarding 設定は Control Panel の Discord Bot Config に保存します。`service_id` を指定すると、その config は該当 Discord Bot service だけが runtime config として取得できます。

```json
{
  "name": "Main Discord Bot",
  "service_id": "discord-bot-01",
  "guild_id": "<DISCORD_GUILD_ID>",
  "voice_channel_id": "<VOICE_CHANNEL_ID>",
  "text_channel_id": "<TEXT_CHANNEL_ID>",
  "bot_token": "<DISCORD_BOT_TOKEN>",
  "audio_forward_enabled": true,
  "reconnect_enabled": true
}
```

`bot_token` は write-only です。Control API、UI、audit、logs には raw token を返しません。Control Panel は `configured`、fingerprint、masked target だけを返します。

## Stream 別割り当て

stream ごとに Discord Bot Config を選択できます。

1. Control Panel で Discord Bot Config を作成する。
2. `service_id` に使用する Discord Bot service ID を設定する。
3. Streams 画面で対象 stream の `Discord Config` を選択して保存する。
4. Service Health で同じ Discord Bot service を primary として割り当てる。

start 時に config の `service_id` と primary Discord Bot が一致しない場合、Control Panel は `discord_config_service_mismatch` で start を拒否します。standby Discord Bot は failover 候補ですが、通常 start では dispatch されません。

## Job flow

Control Panel は stream start 時に、割り当て済み primary Discord Bot へ次の job を送ります。

```text
POST /jobs/start
Authorization: Bearer <SERVICE_CALL_TOKEN>
```

job には stream id、guild id、voice channel id、Encoder/Recorder の public URL、audio ingest URL、短命 stream ingest token が含まれます。Discord Bot は VC に参加し、取得した Opus packet を次へ送ります。

```text
POST /streams/{stream_id}/audio/opus
Authorization: Bearer <STREAM_INGEST_TOKEN>
```

stop 時は Control Panel から `POST /jobs/{id}/stop` が送られます。Discord Bot は voice connection を閉じ、転送中の packet queue を破棄します。

## Runtime config

Bot service は起動後、Control Panel の service token で自分用 runtime config を取得します。

```http
GET /services/runtime-config?service_id=discord-bot-01
Authorization: Bearer <SERVICE_TOKEN>
```

返される profile は `service_id=discord-bot-01` に紐づくものだけです。別の Bot service の config や token secret reference は返されません。必要な secret は `/services/runtime-secrets/resolve` で、許可された secret name だけ短命に取得します。

## Heartbeat metrics

代表的な metrics:

```text
discord.gateway_connected
discord.voice_connected
discord.audio_receiving
discord.audio_forward_enabled
discord.audio_forward_active
discord.audio_forwarded_total
discord.audio_forward_errors_total
discord.participant_count
discord.reconnect_count
discord.voice_disconnect_count
```

`discord.audio_receiving=1` かつ `discord.audio_forward_active=1` の場合、Discord 側で音声を受け取り Encoder/Recorder へ転送できています。`audio_receiving=1` で `audio_forward_active=0` の場合は、Encoder/Recorder URL、stream ingest token、network、service assignment を確認します。

## Bootstrap env

env は Control Panel へ接続するための bootstrap に限定します。

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://discord-bot.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
TZ=Asia/Tokyo
```

`DISCORD_BOT_TOKEN` は互換 fallback または local dry-run 用に残せますが、標準運用では Control Panel の Discord Bot Config と encrypted secret store を使います。

## Security

Discord Bot の security 境界は、Discord provider token、VC 接続先、Encoder/Recorder への audio forward、Worker event publish に分かれます。Bot は Control Panel から割り当てられた stream の runtime config だけを使い、guild/channel の raw ID や token を evidence に出さず、packet counter と masked routing で状態を共有します。

- Bot token は raw で返さない、ログに出さない、audit metadata に含めない。
- voice packet の raw payload は通常ログに保存しない。
- Control Panel から渡される Encoder/Recorder URL は absolute HTTP(S) URL として検証する。
- 未割り当て stream への heartbeat / event は Control Panel 側で拒否される。
- reconnect や転送失敗は metric として報告し、secret を含まない error code で扱う。

## 残タスク

- 実 Discord token を使った VC 参加、音声受信、Opus 転送の段階的 E2E。
- reconnect / backoff の実測 tuning。
- active speaker 検出の精度確認。
- STT へ音声を分岐する場合の contract 固定。
