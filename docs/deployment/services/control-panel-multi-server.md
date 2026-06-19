# マルチサーバー配置

Control Panel、Discord Bot、Encoder/Recorder、Worker、Observability は別 host に配置できます。同一 Docker network を前提にしません。

## Control Panel の外向き通信

```text
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
SERVICE_CALL_TOKEN=<CONTROL_PANEL_TO_SERVICE_TOKEN>
SERVICE_CALL_TIMEOUT_SEC=5
AUTOSTREAM_SERVICE_ALLOWED_HOSTS=encoder.internal.example,worker.internal.example
AUTOSTREAM_SERVICE_ALLOWED_CIDRS=10.40.0.0/16
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=encoder.example.com,worker.example.com,*.services.example.com
AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true
```

`SERVICE_CALL_TOKEN` は Control Panel から各 service へ job 指示を送るための token です。各 service 側では同じ raw token の SHA-256 を `SERVICE_CONTROL_TOKEN_SHA256` として設定します。

## 通信方向

```text
Control Panel -> Discord Bot:      /jobs/start, /jobs/{id}/stop
Control Panel -> Worker:           /jobs/start, /jobs/{id}/stop
Control Panel -> Encoder/Recorder: /streams/start, /streams/{id}/stop, /streams/package, /preflight
Control Panel -> Observability:    /incidents, /diagnostics, /metrics, /remediation-actions, /notification-deliveries

Discord Bot -> Control Panel:      /services/register, /services/heartbeat
Worker -> Control Panel:           /services/register, /services/heartbeat
Encoder/Recorder -> Control Panel: /services/register, /services/heartbeat
Observability -> Control Panel:    /services/remediation-actions/execute
```

service は `SERVICE_PUBLIC_URL` を Control Panel から到達可能な URL にしてください。localhost や compose service name は、Control Panel が同じ host / network にいない場合は使えません。

public internet の HTTPS endpoint も既定では allowlist 必須です。`SERVICE_CALL_TOKEN` の送信先を固定するため、`AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS` に許可 host を明示します。開発用途で広く許可する場合だけ `AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=false` を明示してください。
private IP、内部 DNS、Docker Desktop の `host.docker.internal` は既定で拒否されるため、必要な host または CIDR だけを allowlist に追加します。登録時だけでなく、dispatch 時の DNS 解決結果と redirect 先も検証されます。

## Service assignment

stream start / stop の dispatch 対象は、`POST /services/{id}/assign` または Worker 互換の `POST /workers/{id}/assign` で stream に割り当てた service だけです。

必須 service:

```text
discord_bot
worker
encoder_recorder
```

不足している場合は `409 missing_stream_assignments` を返し、service へ request を送りません。

## Firewall

- Control Panel から各 service の public URL へ到達できるようにします。
- 各 service から Control Panel の `CONTROL_PANEL_URL` へ到達できるようにします。
- Observability から notification webhook の宛先へ到達できるようにします。
- MariaDB は必要な host からだけ接続を許可します。

## Secret policy

service token、`SERVICE_CALL_TOKEN`、webhook URL、DB password、session secret は raw 値を log や API response に出しません。`.env.example` は placeholder のみです。
