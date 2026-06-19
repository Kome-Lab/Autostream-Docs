# Network Troubleshooting

AutoStream は分散 service 構成です。Control Panel、Discord Bot、Worker、Encoder/Recorder、Observability は別 server、VPS、VM、container host に配置できます。同じ Docker network にいる前提で設計しないでください。

## Source / ownership

`SERVICE_PUBLIC_URL` と allowlist は operator が DNS、reverse proxy、firewall と合わせて管理します。`CONTROL_PANEL_URL` は各 service が Control Panel へ到達する bootstrap value、`Control Panel` から service への dispatch URL は service registry の configured `public_url` が source of truth です。credential-bearing source URL、webhook URL、OAuth token、Drive folder/file ID は troubleshooting evidence に raw value を残さず、masked host、configured state、fingerprint だけを共有します。

## 通信方向

| 送信元 | 送信先 | 目的 |
| --- | --- | --- |
| service | Control Panel | registration、heartbeat、status、logs、events |
| Control Panel | service | start、stop、assign、package、restart、preflight |
| Worker | Encoder/Recorder | overlay / caption / participant event |
| Discord Bot | Encoder/Recorder | Discord Opus audio packet |
| Encoder/Recorder | YouTube | RTMPS output |
| Encoder/Recorder | Google Drive API | archive upload |
| services | Observability | signal ingest |
| Observability | webhook / SMTP target | notification delivery |

## まず確認すること

- `SERVICE_PUBLIC_URL` が Control Panel から到達可能な absolute HTTP(S) URL になっている。
- `CONTROL_PANEL_URL` が各 service から到達可能である。
- firewall が必要な inbound / outbound port を許可している。
- reverse proxy が `Authorization`、`X-CSRF-Token`、`Content-Type` を落としていない。
- outbound RTMPS と Google / Discord / YouTube API への HTTPS が許可されている。
- MariaDB は許可された host からのみ接続できる。

## `localhost` 問題

複数 host に分散する場合、`localhost` は自分自身を指します。Control Panel に登録する `public_url` に `http://localhost:...` を使うと、別 host の Control Panel から到達できません。

```text
SERVICE_PUBLIC_URL=https://encoder-01.example.com
CONTROL_PANEL_URL=https://control.example.com
```

private network の service を使う場合は、Control Panel 側で allowlist を明示します。

```text
AUTOSTREAM_SERVICE_ALLOWED_HOSTS=encoder.internal.example,worker.internal.example
AUTOSTREAM_SERVICE_ALLOWED_CIDRS=10.40.0.0/16
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=encoder.example.com,worker.example.com,*.services.example.com
```

## Reverse Proxy

reverse proxy を使う場合、次を確認します。

- HTTPS termination が正しく設定されている。
- request body size limit が worker event や log ingest を遮断していない。
- `Authorization` header を upstream に渡している。
- OAuth callback / webhook / service control path を誤って外部公開しすぎていない。
- Control Panel の trusted proxy 設定が実 IP と合っている。

## RTMPS が失敗する

Encoder/Recorder host から YouTube への outbound 443 が許可されているか確認します。企業 network や VPS firewall で TLS outbound が制限されている場合、FFmpeg 側には handshake error や reconnect loop として見えることがあります。

確認項目:

- Control Panel の YouTube output が対象 stream に割り当てられている。
- stream start payload に短命 `rtmp_url` / `stream_key` が含まれている。
- `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` の場合、env fallback に依存していない。
- `ffmpeg` が proxy / firewall 越しに外部へ接続できる。
- Observability に `encoder.rtmp_reconnect_count` が増えていない。

## Google Drive upload が失敗する

Google Drive API への outbound HTTPS が許可されているか確認します。proxy 環境では OAuth token refresh と resumable upload の両方が proxy を通れる必要があります。

確認項目:

- Control Panel の Drive destination が対象 archive profile に割り当てられている。
- OAuth connected account または Service Account mode が configured。
- 共有ドライブ folder ID の場合は `shared_drive=true`。
- Service Account mode の場合、target folder が Service Account email に共有されている。
- response、logs、diagnostics に credential path や access token が出ていない。

## Secret 付き URL

認証情報付き URL を疎通確認ログに残さないでください。

```text
rtsp://user:<PASSWORD>@camera.example.com/live
https://discord.com/api/webhooks/<WEBHOOK_ID>/<WEBHOOK_TOKEN>
```

共有する場合は host、port、path のみを残し、password / token 部分を placeholder に置き換えます。
