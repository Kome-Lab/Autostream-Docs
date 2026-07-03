# 秘密情報とtoken生成

AutoStream では、同じ env 名でも service によって意味が違うものがあります。特に `OBSERVABILITY_TOKEN` は、Control Panel では admin token、Worker / Encoder Recorder では ingest token として使います。実値を混同しないように、作業時は下の名前で管理してください。

## 生成コマンド

Linux / macOS では、32 byte の random hex を使います。

```bash
openssl rand -hex 32
```

Windows PowerShell では、PowerShell の文字化けや改行混入を避けるため、.NET の乱数生成器で作ります。

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

SHA-256 が必要な token は、改行を入れずに hash 化します。Linux / macOS では `echo` ではなく `printf` を使います。

```bash
printf '%s' '<TOKEN_RAW_VALUE>' | sha256sum | awk '{print $1}'
```

PowerShell では次のように計算します。

```powershell
$token = '<TOKEN_RAW_VALUE>'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($token)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString('x2') }) -join ''
```

## 最初に生成する値

| 管理名 | 入力先 | 生成方法 | 注意 |
| --- | --- | --- | --- |
| `AUTOSTREAM_SESSION_SECRET` | Control Panel env | random hex | session 保護用。Control Panel だけで使います |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Control Panel env、Observability env | random hex | 保存 secret の暗号化用。環境ごとに固定し、紛失しないでください |
| `AUTOSTREAM_SETUP_TOKEN` | Control Panel env | random hex | 初回管理者作成用。初回作成後は rotation するか無効値へ変えます |
| `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Control Panel env、Encoder Recorder env | random hex | Control Panel が stream scoped ingest token を発行し、Encoder Recorder が検証します |
| `OBSERVABILITY_INGEST_TOKEN` | Worker env、Encoder Recorder env | random hex | Observability へ signal を送るための生 token です |
| `OBSERVABILITY_INGEST_TOKEN_SHA256` | Observability env | `OBSERVABILITY_INGEST_TOKEN` の SHA-256 | Observability 側には生 token を置きません |
| `OBSERVABILITY_ADMIN_TOKEN` | Control Panel env の `OBSERVABILITY_TOKEN` | random hex | Control Panel が Observability API を読む/操作するための生 token です |
| `OBSERVABILITY_ADMIN_TOKEN_SHA256` | Observability env | `OBSERVABILITY_ADMIN_TOKEN` の SHA-256 | Observability 側には生 token を置きません |

## Observability token の対応

Control Panel の `OBSERVABILITY_TOKEN` は admin token です。Worker / Encoder Recorder の `OBSERVABILITY_TOKEN` は ingest token です。名前は同じですが、同じ値にしないでください。

```text
Control Panel env:
  OBSERVABILITY_URL=https://<OBSERVABILITY_HOST>
  OBSERVABILITY_TOKEN=<OBSERVABILITY_ADMIN_TOKEN>

Worker env:
  OBSERVABILITY_URL=https://<OBSERVABILITY_HOST>
  OBSERVABILITY_TOKEN=<OBSERVABILITY_INGEST_TOKEN>

Encoder Recorder env:
  OBSERVABILITY_URL=https://<OBSERVABILITY_HOST>
  OBSERVABILITY_TOKEN=<OBSERVABILITY_INGEST_TOKEN>

Observability env:
  OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_OBSERVABILITY_INGEST_TOKEN>
  OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>
```

Observability の binding は、hash と service ID を結びます。service ID は Control Panel の Node登録で決めた Node ID と一致させます。

```text
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_OBSERVABILITY_INGEST_TOKEN>:encoder_recorder:encoder-recorder-01,<SHA256_OF_OBSERVABILITY_INGEST_TOKEN>:worker:worker-01
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
```

## 手入力しない token

次の token は、標準構成では手で生成して env に貼りません。

| token | 標準の扱い |
| --- | --- |
| Node Runtime Token | Control Panel の Node登録で生成され、`config.yml` に入ります |
| Configure Token | Node登録の Configuration で短期 token として表示されます |
| `CONTROL_PANEL_TOKEN` | `config.yml` 内の Node Runtime Token として配布されます。env へ手入力しません |
| `SERVICE_CALL_TOKEN` | 古い構成からの移行用 fallback です。新規構成では空にします |
| `SERVICE_CONTROL_TOKEN_SHA256` | 古い構成からの移行用 fallback です。新規構成では `AUTOSTREAM_NODE_CONFIG` を使います |
| `ENCODER_WORKER_EVENTS_TOKEN_SHA256` | 固定 Worker event token の fallback です。標準構成では stream job の token を使います |
| `ENCODER_DISCORD_AUDIO_TOKEN_SHA256` | 固定 audio token の fallback です。標準構成では stream scoped token を使います |

## Provider から発行する secret

Discord Bot token、YouTube stream key、Google OAuth client secret、Google Drive credential、Webhook URL、SMTP password は、AutoStream が生成する値ではありません。各 provider で発行し、Control Panel の画面や secret manager に保存します。公開 docs、GitHub、チャット、スクリーンショットには載せないでください。
