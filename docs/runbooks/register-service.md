# Register Service

この runbook は Discord Bot、Encoder/Recorder、Worker、Observability を Control Panel に登録する手順です。AutoStream は分散配置を前提にしているため、各 service は Control Panel から到達できる `SERVICE_PUBLIC_URL` と service token を持つ必要があります。

## 1. 登録用 token を作成する

Control Panel の `API Tokens` で対象 service type を選び、必要な scope を付けて token を作成します。

scope は service type ごとに最小化します。

| Service type | 必須 scope | 条件付き scope | 用途 |
| --- | --- | --- | --- |
| `discord_bot` | `service.register`, `service.heartbeat`, `service.config.read`, `service.secret.resolve`, `service.status.write`, `discord.status.write` | なし | Discord Bot Config、Bot token secret、VC status、audio forwarding metrics |
| `encoder_recorder` | `service.register`, `service.heartbeat`, `service.config.read`, `service.secret.resolve`, `encoder.status.write` | `service.logs.write` | YouTube output、archive profile、runtime stream key、archive/package status |
| `worker` | `service.register`, `service.heartbeat`, `service.config.read`, `service.secret.resolve`, `worker.events.write` | `service.status.write` | overlay/caption profile、primary assignment、Encoder ingest token、event status |
| `observability` | `service.register`, `service.heartbeat`, `service.status.write`, `observability.ingest` | `remediation.execute` | signal ingest、incident status、remediation dispatch |

runtime config だけを読む service には `service.config.read` が必要です。Discord Bot token、YouTube stream key、Google Drive folder ID、OAuth refresh token などの runtime secret を解決する service には `service.secret.resolve` も付けます。

事前登録する場合は、同じ画面で `service_id`、`service_name`、`public_url`、`version`、`capabilities` を入力します。Control Panel は `pending` の service registry entry を作成し、service 起動前でも stream に割り当てられるようにします。

作成した token は対象 service の `CONTROL_PANEL_TOKEN` に設定します。

```text
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
```

raw token は一度だけ表示されます。紛失または漏えいした場合は `API Tokens` の `Rotate` を使って再発行します。Rotate は旧 token を revoke し、紐づく service registry entry を新 token に付け替えます。

API で確認する場合も token 値は shell env から渡し、command history に raw token を残しません。

```powershell
$headers = @{
  Authorization = "Bearer $env:AUTOSTREAM_ADMIN_TOKEN"
  "Content-Type" = "application/json"
}
$body = @{
  service_id = "worker-01"
  service_type = "worker"
  service_name = "Worker 01"
  public_url = "https://worker.example.com"
  version = "2026.06.12"
  capabilities = @{
    runtime_config = $true
    primary_standby = $true
    worker_events = $true
  }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "https://control.example.com/services/precreate" -Headers $headers -Body $body
```

response には registry entry と token metadata だけを残します。`CONTROL_PANEL_TOKEN` そのものは API response、docs、issue、screenshot に貼り付けません。

## 2. Dispatch 用 token を設定する

Control Panel から各 service へ start / stop / retry-upload を送る場合は、Control Panel 側に `SERVICE_CALL_TOKEN` を設定します。service 側には同じ token の SHA-256 を設定します。

```text
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_CALL_TOKEN>
```

raw `SERVICE_CALL_TOKEN` を service 側へ置かないでください。

PowerShell で hash を確認する場合は raw token を変数に入れ、出力には hash だけを残します。

```powershell
$raw = $env:AUTOSTREAM_SERVICE_CALL_TOKEN
$bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
$hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
```

## 3. service を起動する

service 起動時に `/services/register` が呼ばれ、Control Panel の registry entry が `registered` になります。その後 heartbeat により `last_heartbeat_at` と health status が更新されます。

service 側の env file には、少なくとも次を置きます。

```text
SERVICE_ID=worker-01
SERVICE_NAME=Worker 01
SERVICE_PUBLIC_URL=https://worker.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
```

起動後に runtime config が取得できない service は、本番では成功扱いにしません。Discord Bot、Encoder/Recorder、Worker は start job 直前にも Control Panel が返す assignment と runtime config を確認し、古い primary assignment や env fallback だけで処理を続けないことを確認します。

## 4. stream に割り当てる

Control Panel の Stream 画面で、stream ごとに service を割り当てます。

- Discord Bot: voice channel 接続と音声 forwarding。
- Encoder/Recorder: YouTube RTMPS、MKV 録画、MP4 package、Drive upload。
- Worker: overlay / caption / participant / current-time event。

通常は `primary` を 1 台、必要であれば `standby` を複数台設定します。start / stop は primary だけへ dispatch されます。

API で割り当てを確認する場合は、stream ID と service ID の対応だけを記録します。Discord guild/channel ID、Drive folder ID、YouTube stream key、runtime secret value はこの runbook の証跡に含めません。

```powershell
Invoke-RestMethod -Method Get `
  -Uri "https://control.example.com/streams/<STREAM_ID>/service-assignments" `
  -Headers @{ Authorization = "Bearer $env:AUTOSTREAM_ADMIN_TOKEN" }
```

## 5. 確認する

次を確認します。

- Service Health が stale ではない。
- `current_stream_id` が期待通り。
- runtime config が `Cache-Control: no-store` で返る。
- raw secret が UI、log、audit log に出ていない。
- stream readiness が `missing_stream_assignments` ではない。
- `service_id` と `assignment_role=primary` が start 対象 stream と一致している。
- standby service は heartbeat/readiness だけを出し、primary-only runtime secret を解決できない。
- token rotation 後、古い token で register / heartbeat / runtime config fetch が失敗する。

Control Panel から service health を確認します。

```powershell
Invoke-RestMethod -Method Get `
  -Uri "https://control.example.com/service-health" `
  -Headers @{ Authorization = "Bearer $env:AUTOSTREAM_ADMIN_TOKEN" }
```

service 側では status endpoint と heartbeat log を見ます。response や journal に raw token、runtime secret、webhook URL、SMTP password が出ている場合は registration 成功ではなく secret boundary failure として扱います。

local stack では次のコマンドで smoke を実行できます。

Verify each service `/health`, Control Panel `/service-health`, stream assignment, and runtime config fetch.

## 6. 失敗時の切り分け

`401 missing_or_invalid_service_token` は inbound dispatch token と outbound Control Panel token の取り違えでよく発生します。service が Control Panel へ送る `CONTROL_PANEL_TOKEN` と、Control Panel が service へ送る `SERVICE_CALL_TOKEN` / `SERVICE_CONTROL_TOKEN_SHA256` を分けて確認します。

`403 service_scope_denied` または runtime secret resolve の失敗は、service token scope、service registry binding、assignment role、runtime secret allowlist のいずれかが一致していない状態です。scope を広げる前に、service type と stream assignment が正しいかを確認してください。

`missing_stream_assignments` は service が起動していても、対象 stream の primary assignment が未設定または stale であることを示します。standby を primary に昇格した場合は、新 primary の heartbeat が fresh になってから stream start を再試行します。

Before using external providers, verify the Control Panel secret-safe config view, service heartbeat, stream assignment, and readiness blockers. Do not store raw provider IDs, URLs, tokens, passwords, Drive folder IDs, or Drive file IDs in public docs, logs, or screenshots.
