# Discord Bot 環境変数

Discord Bot は Discord gateway / voice channel に接続し、Control Panel からの job 指示、participant / active speaker 状態、Discord VC audio packet forwarding を扱います。

通常運用では Discord Bot token、guild ID、voice channel ID、caption/STT 設定は Control Panel の Discord Bot Config で管理します。env は service 起動と Control Panel 接続に必要な bootstrap 値だけにします。

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://discord-bot.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_DISCORD_BOT_TOKEN>
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
DATABASE_URL=mysql://autostream:<PASSWORD>@tcp(db.example.com:3306)/autostream_discord_bot?parseTime=true
TZ=Asia/Tokyo
```

`CONTROL_PANEL_TOKEN` は Discord Bot が Control Panel へ register / heartbeat / runtime-config 取得 / runtime-secret 解決を行うための service token です。必要な scope は次の通りです。

```text
service.register
service.heartbeat
service.config.read
service.secret.resolve
service.status.write
discord.status.write
```

`SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Discord Bot へ job start / stop を送る token の hash です。raw token は Control Panel 側の `SERVICE_CALL_TOKEN` として保持し、service 側には hash だけを置きます。

`SERVICE_ID` は Control Panel に事前登録した Discord Bot service ID と一致させます。Control Panel は `/services/runtime-config?service_id=<SERVICE_ID>` で、この service に紐付く Discord Bot Config だけを返します。

## Production startup

本番では `AUTOSTREAM_ENV=production` と `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` を標準にします。この状態では、Discord Bot Config、Bot token secret reference、guild / voice channel、audio forward target、assignment role が Control Panel から取得できない場合、dry-run token や `DISCORD_BOT_TOKEN` env fallback で起動成功扱いにしません。

Discord Bot が start job を受けたときは、request body の channel ID より Control Panel runtime config と stream assignment を優先します。request に guild / voice channel override が含まれていても、service が対象 stream の primary assignment でなければ拒否します。standby Bot は heartbeat と readiness までは出せますが、primary へ昇格するまで VC join と audio forward を開始しません。

## Control Panel で管理する値

| 値 | 管理場所 | API/UI の返却 |
| --- | --- | --- |
| Discord Bot token | Discord Bot Config | `bot_token_configured` / `bot_token_fingerprint` のみ |
| guild ID | Discord Bot Config または stream override | ID として表示可 |
| voice channel ID | Discord Bot Config または stream override | ID として表示可 |
| text channel ID | Discord Bot Config または stream override | ID として表示可 |
| caption/STT 設定 | Discord Bot Config / Caption profile | profile ID と状態のみ |

raw Discord Bot token は env、docs、log、audit metadata、frontend に出しません。service は `bot_token_secret_name` を受け取り、必要な時だけ `/services/runtime-secrets/resolve` で短命解決します。

## Verification

変更後は Discord Bot repository の `go test ./...` に加え、Control Panel の Service Health、runtime config fetch、VC join、`discord.audio_packets_total`、`discord.audio_forwarded_total` を確認します。外部確認の記録には masked guild / channel proof と packet delta だけを残し、Bot token、voice endpoint、short-lived ingest token は記録しません。
