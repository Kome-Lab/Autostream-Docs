# Docker デプロイ

## 開発起動

```bash
cp .env.example .env
docker compose up --build
```

`.env` の placeholder は実行環境の値に置き換えます。実 token は repository、compose file、README にコミットしません。

## Network

Control Panel と同じ Docker network にいる前提にはしません。必ず `CONTROL_PANEL_URL` に到達可能な HTTP(S) URL を設定してください。本番では HTTPS を使います。local 開発では `http://host.docker.internal:<PORT>` を使えます。

## Bootstrap Env

Docker で注入する値は Control Panel 接続と inbound job 検証に限定します。

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://discord-bot.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
AUTOSTREAM_BIND_ADDR=0.0.0.0:8080
TZ=Asia/Tokyo
```

Discord Bot token、guild ID、voice channel ID は Control Panel の Discord Bot Config で管理します。`DISCORD_BOT_TOKEN` は互換 fallback と dry-run 検証用に限定します。

## Secret

次の値は raw で compose file に書かず、Docker secret、orchestrator secret、または外部 secret manager から注入してください。

- `CONTROL_PANEL_TOKEN`
- `SERVICE_CONTROL_TOKEN_SHA256`
- fallback として使う場合の `DISCORD_BOT_TOKEN`
- fallback として使う場合の `ENCODER_AUDIO_TOKEN`

Control Panel 管理の Bot token は、runtime config の secret reference と `/services/runtime-secrets/resolve` で service にだけ渡します。

## 本番運用の確認

Docker container が起動しただけでは本番 ready としません。`GET /health`、Control Panel の Service Health、`/services/runtime-config` の取得、Discord Bot Config の configured 状態、対象 stream への primary assignment を同じ `SERVICE_ID` で確認します。Discord VC の実接続は provider verification record の対象なので、dry-run や fallback env の成功を外部 verification pass として扱いません。

証跡には raw Bot token、guild ID、voice channel ID、audio ingest token を残しません。残すのは service ID、runtime config version、masked config、heartbeat timestamp、VC connected / disconnected の状態、audio packet counter、forward error count です。container log に credential 付き URL や token が出た場合は、デプロイ成功ではなく secret exposure incident として token rotation と log 削除を先に行います。

## Rollback

rollback は前の image に戻すだけでは不十分です。Control Panel 側の Discord Bot Config、service token、runtime secret lease、primary/standby assignment が rollback 先の service と一致していることを確認します。image を戻した後は `discord.gateway_connected`、`discord.voice_connected`、`discord.audio_packets_total`、`discord.audio_forwarded_total` が同じ stream で回復したことを確認してから完了にします。
