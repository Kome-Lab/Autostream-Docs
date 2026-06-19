# Firewall

AutoStream は分散配置を前提にします。必要な通信だけを許可し、service の管理 endpoint を不要に公開しないでください。

## Inbound

| 宛先 | 許可元 | 用途 |
| --- | --- | --- |
| Control Panel HTTPS | operator / reverse proxy | 管理 UI、Control API |
| Discord Bot service endpoint | Control Panel | job start/stop、health |
| Encoder/Recorder service endpoint | Control Panel、Discord Bot、Worker | job start/stop、audio ingest、worker events |
| Worker service endpoint | Control Panel | job start/stop、test event |
| Observability service endpoint | Control Panel、各 service | signal ingest、incident API |
| Output relay loopback | Encoder/Recorder host only | FFmpeg から relay への local RTMP(S) output |

service endpoint は `SERVICE_CONTROL_TOKEN_SHA256` などで request を検証します。network allowlist だけに依存しません。

## Outbound

| 送信元 | 宛先 | 用途 |
| --- | --- | --- |
| Discord Bot | Discord Gateway / Voice | VC 接続、音声取得 |
| Encoder/Recorder | loopback output relay | FFmpeg live output |
| Output relay | YouTube RTMPS | YouTube ingest への転送 |
| Encoder/Recorder | Google Drive API | archive upload |
| Control Panel | Google / GitHub / Discord OAuth | login / connected account |
| Observability | Discord / Slack / Generic webhook、SMTP | alert notification |

本番では Encoder/Recorder の FFmpeg が YouTube RTMPS URL と stream key を直接持たない構成にします。YouTube への outbound は relay process 側に限定し、relay endpoint は同一hostまたは同一network namespaceの loopback に閉じます。

Observability の webhook / SMTP は private network host を既定で拒否します。local 開発で必要な場合だけ明示的に許可してください。

## Segmentation

Control Panel、service endpoints、media relay、database、provider outbound は別の境界として扱います。MariaDB は Control Panel / Observability など必要な service からだけ到達可能にし、operator network や public internet へ直接公開しません。Output relay は Encoder/Recorder host の loopback または同一 network namespace に閉じ、YouTube RTMPS への outbound を relay process に限定します。

Discord Bot から Encoder/Recorder へ許可するのは audio ingest endpoint だけです。Worker から Encoder/Recorder へ許可するのは worker event endpoint だけです。service 間の疎通を広げるために管理 API 全体を相互公開すると、assignment と runtime token の境界が弱くなります。

## 変更時の確認

firewall 変更後は、Control Panel から各 service の `/health` と service-specific dispatch が通ること、Discord Bot から Discord Voice へ出られること、Encoder/Recorder から loopback relay と Google Drive API へ到達できることを分けて確認します。`SERVICE_PUBLIC_URL` を変えた場合は Control Panel の allowlist と heartbeat の public URL が一致しているかも確認してください。

通信を開けるときは、まず最小 port と最小送信元で許可し、失敗した probe の evidence を見て広げます。token を query string に置く例外対応は認めず、reverse proxy や firewall log に Authorization header が残る場合は masking 設定を先に入れます。外部確認のverification record には接続先 host、status、metric だけを残し、raw webhook URL や provider credential は残しません。

Control Panel から到達する service endpoint は、network rule と service token の両方で守ります。
Discord Bot と Encoder/Recorder の間は audio ingest 用の経路だけを許可し、管理 API 全体を相互公開しません。
Observability への signal ingest は各 service からの outbound として扱い、notification provider への outbound と混同しません。

## 注意

- `localhost` や Docker 内部 DNS 名だけを `SERVICE_PUBLIC_URL` にしないでください。Control Panel から到達できる absolute HTTP(S) URL を設定します。
- production では HTTPS と service host allowlist を使います。
- raw token を firewall log や reverse proxy access log に出さないよう、query string に token を載せません。

firewall 変更後の外部確認は、単なる port open 確認ではありません。Discord VC packet delta、Encoder audio ingest、RTMPS receipt、Drive upload、notification delivery が同じ stream ID で通ることを確認し、失敗時はどの境界で止まったかを preflight / probe summary に残します。
