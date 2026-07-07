# Node Agent登録

Node Agent登録は、Control Panel が各実行サービスを Node として管理するための入口です。Pterodactyl Panel と Wings のように、Panel 側で Node を作成し、Node 側は生成された `config.yml` を読んで起動します。

対象は Encoder Recorder、Worker、Discord Bot、Observability です。Control Panel 自身は Node Agent ではありません。

## 入力する項目

Node登録で入力する項目は次だけです。

| 項目 | 例 | 用途 |
| --- | --- | --- |
| Node type | `worker` | 起動するサービス種別 |
| Node ID | `worker-01` | Panel と Node を対応させる固定ID |
| Node名 | `Studio Worker 01` | 画面に出す名前 |
| Host / FQDN / IP | `worker.example.com` | Panel から Node Agent API へ到達する host |
| Port | `8443` | Node Agent API の port |
| SSL | ON | `https` で接続するか |
| 説明 | `第1スタジオ` | 運用メモ |

次の値は手入力しません。

| 入力しない値 | 理由 |
| --- | --- |
| version | Node 起動後の register / heartbeat / report で自動報告します |
| capability | Node 起動後の report で自動報告します |
| OS / arch / hostname | Node Agent が自動報告します |
| public URL 全体 | Host、Port、SSL から Panel が組み立てます |
| `CONTROL_PANEL_TOKEN` | Panel が `config.yml` に Node Runtime Token として出します |

## 生成されるもの

作成後の Configuration では、次を確認して Node 側へ渡します。

| 生成物 | 扱い |
| --- | --- |
| Configure Token | `/api/node-agent/configure` で `config.yml` を取得するための短期 token |
| Node Runtime Token | register、heartbeat、report、runtime config、Panel から Node への dispatch に使う token |
| `config.yml` | `/etc/autostream-<service>/config.yml` に保存します |
| Auto Configure command | service binary の `configure` サブコマンドで `config.yml` を取得して保存するコマンド |

Configure Token と Node Runtime Token は作成直後だけ表示します。紛失した場合は Configuration から再生成してください。DB には Configure Token をハッシュで、Node Runtime Token を暗号化して保存します。

作成した Node は、同じ Node登録画面の「登録済みNode」一覧で確認できます。この一覧は Node登録に必要な最小情報だけを表示するため、`api_tokens.create` 権限で取得できます。運用監視用の metrics / capability / 詳細 heartbeat は Service Health で確認し、こちらは `service_health.read` 権限が必要です。Auto Configure command を Node 側で実行する前は `pending` / 接続待ちとして表示され、初回 heartbeat 後に online や報告 version が更新されます。

共通の Node 実行ファイルはありません。Node 側では Worker、Encoder Recorder、Discord Bot、Observability の各サービス binary に `configure` サブコマンドがあります。Panel が表示する Auto Configure command は正規の `autostream-<service>` コマンドを使う 1 行のコマンドです。

```bash
sudo autostream-worker configure --panel-url "https://control.example.com" --token "<CONFIGURE_TOKEN>" --node "worker-01" --config "/etc/autostream-worker/config.yml"
```

service type ごとの binary 名は次の通りです。

| Node type | binary |
| --- | --- |
| `worker` | `autostream-worker` |
| `encoder_recorder` | `autostream-encoder-recorder` |
| `discord_bot` | `autostream-discord-bot` |
| `observability` | `autostream-observability` |

`sudo: autostream-observability: command not found` のように出る場合は、Node Agent の host release artifact から `bin/autostream-observability` を `/usr/local/bin/autostream-observability` へ配置できていません。対象サービスの install 手順で正規 binary を配置し直してください。

Auto Configure command は、発行直後の Configure Token を使って次の処理を行うための一度きりのコマンドです。

1. 対象 service binary が `POST /api/node-agent/configure` を呼び出します。
2. レスポンス JSON の `config_yml` を取り出します。
3. `sudo` 実行かつ `/etc/autostream-<service>` 配下へ保存する場合は、directory を `root:autostream 0750`、`config.yml` を `root:autostream 0640` で保存します。
4. 取得した `node.type` が実行した service binary と違う場合は保存前に拒否します。

保存後は対象サービスの env に `AUTOSTREAM_NODE_CONFIG=/etc/autostream-<service>/config.yml` を設定して、サービス本体を起動します。

## config.yml の例

```yaml
panel:
  url: "https://control.example.com"
node:
  id: "worker-01"
  name: "Studio Worker 01"
  type: "worker"
api:
  host: "worker.example.com"
  port: 8443
  ssl_enabled: true
auth:
  token_id: "..."
  token: "ast_svc_..."
agent:
  data_dir: "/var/lib/autostream/worker"
  log_dir: "/var/log/autostream/worker"
```

Linux host では `/etc/autostream-worker/config.yml` のようにサービスごとの directory に保存します。Docker では同じ path に read-only mount し、env に `AUTOSTREAM_NODE_CONFIG=/etc/autostream-worker/config.yml` のように入れます。同じ host で複数サービスを動かす場合も `/etc/autostream-worker/config.yml`、`/etc/autostream-observability/config.yml` のようにサービスごとに分けます。

## Node が報告する値

Node は起動時と heartbeat / report で次を Control Panel へ送ります。

| 値 | 表示場所 |
| --- | --- |
| version | Service Health / Workers |
| capability | Service Health / Start readiness |
| hostname | Service Health |
| OS / arch | Service Health / Workers |
| metrics | Service Health / Dashboard |

heartbeat は既定で 60 秒を超えると warning、180 秒を超えると offline として扱います。必要なら Control Panel 側の `AUTOSTREAM_SERVICE_HEARTBEAT_WARNING_AFTER` と `AUTOSTREAM_SERVICE_HEARTBEAT_OFFLINE_AFTER` で調整します。

## API

Node Agent は次の Panel API を使います。

| API | 用途 |
| --- | --- |
| `POST /api/node-agent/configure` | Configure Token で `config.yml` 相当の設定を取得 |
| `POST /api/node-agent/heartbeat` | 稼働状態、version、capability、metrics を報告 |
| `POST /api/node-agent/report` | hostname、OS、arch、capability などを明示報告 |
| `POST /api/node-agent/events` | Node から stream event を送信 |

Panel から Node Agent API へ送る start / stop / preflight も bearer token で認証します。新方式では Node Runtime Token を優先し、古い構成の互換用途だけ `SERVICE_CALL_TOKEN` を fallback として残します。

Discord Bot Node には、VC参加を起点に Control Panel へ stream start を要求するための `streams.start` scope も付与します。Control Panel は token だけでなく、対象 stream の primary Discord Bot assignment も確認します。

## セキュリティ

- token はログ、監査ログ、通常APIレスポンスに出しません。
- Configure Token は有効期限つきで、使用済み token は再利用できません。
- Node Runtime Token はハッシュ検証と暗号化保存を分けて扱います。
- Panel から Node への bearer token は Node ごとに異なります。
- host 直接起動では `config.yml` を `root:autostream 0640`、`/etc/autostream-<service>` を `root:autostream 0750` にし、Git に入れないでください。
