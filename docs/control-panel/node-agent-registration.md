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
| `config.yml` | `/etc/autostream-node/config.yml` に保存します |
| Auto Configure command | setup 作業を自動化するためのコマンド例 |
| systemd unit 例 | Node Agent として起動する場合の unit 例 |

Configure Token と Node Runtime Token は作成直後だけ表示します。紛失した場合は Configuration から再生成してください。DB には Configure Token をハッシュで、Node Runtime Token を暗号化して保存します。

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
  data_dir: "/var/lib/autostream-node"
  log_dir: "/var/log/autostream-node"
```

Linux host では `/etc/autostream-node/config.yml` に保存します。Docker では同じ path に read-only mount し、env に `AUTOSTREAM_NODE_CONFIG=/etc/autostream-node/config.yml` を入れます。

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

## セキュリティ

- token はログ、監査ログ、通常APIレスポンスに出しません。
- Configure Token は有効期限つきで、使用済み token は再利用できません。
- Node Runtime Token はハッシュ検証と暗号化保存を分けて扱います。
- Panel から Node への bearer token は Node ごとに異なります。
- `config.yml` は `0640` 程度にし、Git に入れないでください。
