# 秘密情報とtoken生成

AutoStream では、同じ env 名でも service によって意味が違うものがあります。標準構成では `OBSERVABILITY_TOKEN` を手で入れるのは Control Panel だけで、値は Observability admin token です。Worker / Encoder Recorder は Node Runtime Token で Control Panel に signal を送り、Control Panel が Observability へ転送します。

## 基本方針

新規構成では、サービス間の認証はできるだけ Control Panel の Node登録に寄せます。Encoder Recorder、Worker、Discord Bot、Observability の `CONTROL_PANEL_TOKEN` は手入力せず、Node登録で生成される `config.yml` の Node Runtime Token を使います。Worker / Encoder Recorder の Observability signal もこの Node Runtime Token で Control Panel に送ります。

一方で、次の値は役割が違うため同じ token にまとめません。

| 分ける値 | 理由 |
| --- | --- |
| `OBSERVABILITY_ADMIN_TOKEN` | Control Panel が Observability API を読む/操作するための管理用 token です |
| `OBSERVABILITY_INGEST_TOKEN` | 互換fallbackで Worker / Encoder Recorder が Observability へ直接 signal を送る場合だけ使う投入用 token です |
| Discord Bot token | Discord developer portal が発行する Bot 接続用 token です |
| YouTube stream key / Google OAuth secret | YouTube / Google 側が発行する外部 provider secret です |

手入力を減らす場合も、admin token、互換fallback用 ingest token、provider secret を同じ値にしないでください。漏えい時の影響範囲が広がります。

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
| `OBSERVABILITY_ADMIN_TOKEN` | Control Panel env の `OBSERVABILITY_TOKEN` | random hex | Control Panel が Observability API を読む/操作するための生 token です |
| `OBSERVABILITY_ADMIN_TOKEN_SHA256` | Observability env | `OBSERVABILITY_ADMIN_TOKEN` の SHA-256 | Observability 側には生 token を置きません |

標準構成の Observability admin binding には signal 転送用の `observability.ingest` scope も入れます。

```text
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>:observability.read|observability.ingest|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
```

次の値は、Worker / Encoder Recorder から Observability へ直接送る互換fallbackを使う場合だけ生成します。

| 管理名 | 入力先 | 生成方法 | 注意 |
| --- | --- | --- | --- |
| `OBSERVABILITY_INGEST_TOKEN` | Worker env、Encoder Recorder env | random hex | 標準構成では使いません |
| `OBSERVABILITY_INGEST_TOKEN_SHA256` | Observability env | `OBSERVABILITY_INGEST_TOKEN` の SHA-256 | 直接ingest互換fallback用です |
| `OBSERVABILITY_INGEST_TOKEN_BINDINGS` | Observability env | token hash と service type / Node ID の対応 | Node ID を Control Panel の Node登録と一致させます |

## サービス別の入力一覧

| service | 手生成して入力する値 | Control Panel が生成する値 | provider から取得する値 |
| --- | --- | --- | --- |
| Control Panel | `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_SETUP_TOKEN`、`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY`、`OBSERVABILITY_ADMIN_TOKEN` | なし | Google OAuth client secret、Webhook URL、SMTP password などを画面から保存 |
| Observability | `AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`OBSERVABILITY_ADMIN_TOKEN_SHA256` | Node Runtime Token を `config.yml` で受け取る | 通知先 webhook などを必要に応じて保存 |
| Encoder Recorder | `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Node Runtime Token を `config.yml` で受け取る | YouTube stream key は標準運用では Control Panel の YouTube Outputs に保存 |
| Worker | なし | Node Runtime Token を `config.yml` で受け取る | なし |
| Discord Bot | なし | Node Runtime Token を `config.yml` で受け取る | Discord developer portal の Bot token を Control Panel の Discord Settings に保存 |

`AUTOSTREAM_SECRET_ENCRYPTION_KEY` は Control Panel と Observability の保存 secret 暗号化に使います。別 environment へ同じ DB を移す場合を除き、環境ごとに管理してください。

## Observability token の対応

標準構成では、Control Panel だけが Observability admin token の生値を持ちます。Worker / Encoder Recorder は `OBSERVABILITY_TOKEN` を持たず、Node Runtime Token で Control Panel の `/services/observability/signals` に signal を送ります。Control Panel は登録済み Node ID と service type を付け直して Observability へ転送します。

```text
Control Panel env:
  OBSERVABILITY_URL=https://<OBSERVABILITY_HOST>
  OBSERVABILITY_TOKEN=<OBSERVABILITY_ADMIN_TOKEN>

Worker env:
  AUTOSTREAM_NODE_CONFIG=/etc/autostream-node/worker.yml

Encoder Recorder env:
  AUTOSTREAM_NODE_CONFIG=/etc/autostream-node/encoder-recorder.yml

Observability env:
  OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>
  OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<SHA256_OF_OBSERVABILITY_ADMIN_TOKEN>:observability.read|observability.ingest|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
```

直接ingest互換fallbackを使う場合だけ、Worker / Encoder Recorder に `OBSERVABILITY_TOKEN=<OBSERVABILITY_INGEST_TOKEN>` を入れ、Observability 側に ingest token hash と binding を追加します。binding の service ID は Control Panel の Node登録で決めた Node ID と一致させます。

```text
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<SHA256_OF_OBSERVABILITY_INGEST_TOKEN>:encoder_recorder:encoder-recorder-01,<SHA256_OF_OBSERVABILITY_INGEST_TOKEN>:worker:worker-01
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
| `OBSERVABILITY_INGEST_TOKEN` | 直接ingest互換fallback用です。標準構成では Worker / Encoder Recorder に入れません |

## Provider から発行する secret

Discord Bot token、YouTube stream key、Google OAuth client secret、Google Drive credential、Webhook URL、SMTP password は、AutoStream が生成する値ではありません。各 provider で発行し、Control Panel の画面や secret manager に保存します。公開 docs、GitHub、チャット、スクリーンショットには載せないでください。
