# Multi-server 構成

`autostream-discord-bot` は Control Panel と別 host に配置できます。同一 Docker network を前提にしません。

## 必要な通信

- Bot から Control Panel: `/services/register`
- Bot から Control Panel: `/services/runtime-config`
- Bot から Control Panel: `/services/runtime-secrets/resolve`
- Bot から Control Panel: `/services/heartbeat`
- Control Panel から Bot: `/jobs/start`、`/jobs/{id}/stop`
- 監視基盤から Bot: `/health`、`/status`
- Bot から Encoder/Recorder: `/streams/{id}/audio/opus`
- Bot から Worker: participant / active speaker event forwarding

## Bootstrap Env

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://discord-bot.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
```

Discord Bot token、guild ID、voice channel ID は Control Panel 側の Discord Bot Config で管理します。Bot service は自分の `SERVICE_ID` に紐付いた config だけを取得できます。

## Firewall

本番では `AUTOSTREAM_BIND_ADDR=127.0.0.1:8080` とし、reverse proxy で HTTPS 終端する構成を推奨します。Control Panel からの inbound job API は許可元 IP を制限してください。

Bot から Control Panel、Encoder/Recorder、Worker への outbound 通信は、必要な host と port のみに制限します。credential 付き URL や token を firewall log や reverse proxy access log に出さない設定にしてください。

## Runtime Config と assignment

multi-server 構成では、Discord Bot host 上の env に stream 固有値を戻さないでください。Discord guild/channel、reconnect policy、audio forward destination、Worker event route は Control Panel の Discord Bot Config と stream assignment から runtime config として配布します。Bot は自分の `SERVICE_ID` に紐付いた config だけを読み、別 service の config 取得や standby service の stream-scoped secret 解決は拒否される前提です。

operator は配信前に Control Panel UI/API で service registration、heartbeat、primary assignment、runtime config version を確認します。VC join 失敗時は token を env fallback に戻すのではなく、Bot role、guild/channel permission、Control Panel config、runtime secret reference を順に確認します。

## Evidence

本番証跡には、Control Panel から見た service health、Bot の `/status`、Discord VC connected 状態、packet counter delta、last packet age、audio forward error count を残します。raw Discord token、guild ID、channel ID、Encoder audio token、Worker token は残しません。外部確認のverification record では、同一 `stream_id` で Discord packet delta と Encoder/Recorder 側の受信 counter が両方増えていることを確認します。
