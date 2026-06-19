# セキュリティ

`autostream-discord-bot` は Discord Bot token、Control Panel service token、Control Panel からの inbound dispatch token、Encoder/Recorder への audio ingest token を扱います。raw secret をログ、API response、status response、エラー文、docs に含めないことを前提にします。

## Secret の扱い

- `CONTROL_PANEL_TOKEN` は Control Panel への registration / heartbeat / runtime config / runtime secret 取得に使います。
- `SERVICE_CONTROL_TOKEN_SHA256` は Control Panel から Bot へ送られる job start / stop を検証する inbound token hash です。
- Discord Bot token は Control Panel の Discord Bot Config に write-only secret として保存し、Bot service が runtime secret として解決します。
- `DISCORD_BOT_TOKEN` env は移行期間または local fallback 用です。通常運用では使いません。
- Encoder/Recorder への audio ingest token は、stream start 時に Control Panel から渡される短命 `stream_ingest_token` を優先します。静的 `ENCODER_AUDIO_TOKEN` は互換 fallback です。

## Runtime Config と Secret 解決

Bot service は `service.config.read` scope 付き token で次を呼びます。

```http
GET /services/runtime-config?service_id=<SERVICE_ID>
Authorization: Bearer <SERVICE_TOKEN>
```

runtime config には raw token は含まれません。Control Panel は `service_id` と service token の所有関係を検証し、別 service の Discord Bot Config を返しません。

Bot token が必要な場合は、runtime config 内の `bot_token_secret_name` を使って次を呼びます。

```http
POST /services/runtime-secrets/resolve
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "service_id": "discord-bot-01",
  "secret_name": "discord_bot_token_discord-config-01"
}
```

Control Panel は、指定 secret がその service の runtime config に参照されている場合だけ raw value を返します。レスポンスは cache しません。取得した値は Discord client 初期化だけに使い、log や status に出しません。

## API 認証

以下の書き込み・状態変更 endpoint は bearer token を要求します。

- `POST /heartbeat`
- `POST /jobs/start`
- `POST /jobs/{id}/stop`
- `GET /streams/{id}/participants`
- `POST /streams/{id}/active-speaker`

`GET /health` と `GET /status` は監視用途で公開できますが、本番では reverse proxy と firewall でアクセス元を制限してください。`GET /status` は `encoder_audio_url` や token を返しません。

## Worker 連携

`WORKER_URL` と `WORKER_TOKEN` を設定すると、Discord VC の参加者更新と active speaker 状態を Worker API へ送信します。Worker 送信エラーには token や upstream response body を含めません。

## Encoder/Recorder 音声連携

Control Panel は stream start 時に、割り当て済み Encoder/Recorder の `public_url` を `encoder_audio_url` として Bot に渡します。Bot は受信した Discord Opus packet を次へ送信します。

```text
POST {encoder_audio_url}/streams/{stream_id}/audio/opus
Authorization: Bearer <STREAM_INGEST_TOKEN>
```

Production mode is strict: when `AUTOSTREAM_ENV=production` or `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true`, the Bot must use Control Panel registration, service-scoped runtime config, `bot_token_secret_name` runtime secret resolution, and a real Discord client. It must not fall back to `DISCORD_BOT_TOKEN` or dry-run mode after Control Panel runtime config or runtime secret failures.

送信先 URL、token、credential 付き URL は status response、ログ、error message に raw 値で出さないでください。

## Discord 接続

Discord gateway / voice 接続は `discordgo` を使用します。Control Panel runtime secret と env fallback のどちらからも token を取得できない場合は dry-run mode で起動し、外部 Discord へ接続しません。

VC 音声を受信するため、Bot は self-deaf ではない状態で参加します。Discord 側の Connect / Speak 権限を付与してください。

## 実装時の注意

- 音声送信処理で shell command を組み立てません。
- credential 付き URL を扱う場合は必ず mask してください。
- assignment 外の stream event は送信しない設計を維持してください。
- Control Panel runtime secret resolve の raw response を audit metadata や diagnostic report にコピーしないでください。
