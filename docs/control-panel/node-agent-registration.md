# Node Agent登録

Node Agent登録は、Control Panel が各実行サービスを Node として管理するための入口です。Pterodactyl Panel と Wings のように、Panel 側で Node を作成し、Node 側は生成された `config.yml` を読んで起動します。

対象は Encoder Recorder、Worker、Discord Bot、Observability、Update Agent です。Control Panel 自身は Node Agent ではありません。Update Agent は中央管理ホストで常駐する `autostream-updater` 1つだけを登録します。管理対象ホストごとにUpdate Agentを作成しません。各ホストの非常駐 `autostream-update-host` helperはNodeではなく、Node Runtime Tokenも持ちません。

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

中央Update Agentの既定portは`8090`です。更新jobは中央Updaterが外向きpullで取得します。Updaterのinbound APIはhealth、version、認証付きstatusだけを提供し、更新commandは受け付けません。Host、Port、SSLは中央`/etc/autostream/updater.json`の`api`と一致させます。同一ホストならloopbackだけで待ち受け、別ホストならTLSを有効にしてControl Panelから到達できる管理networkだけに公開します。管理対象ホストのhelperには待受portがありません。

次の値は手入力しません。

| 入力しない値 | 理由 |
| --- | --- |
| version | Node 起動後の register / heartbeat / report で自動報告します |
| capability | Node 起動後の report で自動報告します |
| OS / arch / hostname | Node Agent が自動報告します |
| public URL 全体 | Host、Port、SSL から Panel が組み立てます |
| `CONTROL_PANEL_TOKEN` | Panel が `config.yml` に Node Runtime Token として出します |

Worker / Encoder Recorderの設定にはstream ingest署名鍵を含むため、それらのNodeを作成するoperatorには`secrets.update`権限が必要です。Encoder RecorderにはYouTube / Driveのruntime secret取得に必要な`service.secret.resolve` scopeも自動付与します。Configure Token再生成とRuntime Token再生成には`api_tokens.create`と`api_tokens.revoke`の両方に加え、既存scopeと署名鍵を再発行できる権限が必要です。Worker / Encoder Recorderでは再生成時も`secrets.update`を要求します。

## 生成されるもの

作成後の Configuration では、次を確認して Node 側へ渡します。

| 生成物 | 扱い |
| --- | --- |
| Configure Token | 通常Nodeでは`POST /api/node-agent/configure`、Update Agentでは`POST /api/node-agent/configure/stage`へ渡す短期token。Update Agentではcommandへ埋め込まずTTYまたは標準入力から渡します |
| Node Runtime Token | register、heartbeat、report、runtime config、Panel から Node への dispatch に使う token |
| `config.yml` | 通常Nodeでは`/etc/autostream-<service>/config.yml`に保存します |
| Auto Configure command | service binaryの`configure`サブコマンドで設定を取得し、通常Nodeは`config.yml`、Update Agentは中央`updater.json`の接続identityを更新します |

Configure Token と Node Runtime Token は作成直後だけ表示します。紛失した場合や期限切れの場合は、登録済みNodeの操作から再生成してください。DB には Configure Token をハッシュで、Node Runtime Token を暗号化して保存します。

Worker / Encoder Recorderを作成する前に、Control Panel envの`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY`へ32バイト以上のランダム値を設定して再起動してください。未設定、32バイト未満、`CHANGE_ME`等のplaceholderのままでは、Node作成・Auto Configure・Token再生成を実行できません。

作成した Node は、同じ Node登録画面の「登録済みNode」一覧で確認できます。この一覧は Node登録に必要な情報と、Node が heartbeat で送った安全化済みの capability / 数値 metrics summary を表示します。Auto Configure command を Node 側で実行する前は `pending` / 接続待ちとして表示されます。最新の service binary で Auto Configure command を実行すると version、hostname、OS、arch が報告され、起動後の heartbeat で online、capability、metrics が更新されます。運用監視の詳細値は Service Health と Metrics で確認します。

登録済みNodeの操作列では、次の管理ができます。

| 操作 | 用途 | 注意 |
| --- | --- | --- |
| Configuration表示 | `config.yml` と Auto Configure command を確認 | 生の token は通常表示しません |
| Configure Token再生成 | 期限切れ、紛失、未使用tokenの作り直し | `api_tokens.create`、`api_tokens.revoke`、既存scope権限が必要。再生成後のtokenは一度だけ表示します |
| Runtime Token再生成 | 漏えい疑い、紛失、Node側token更新 | 同じ権限を要求します。通常Nodeではrotation時に旧Runtime Tokenが直ちに無効になります。Update Agentでは新しいConfigure TokenでAuto Configure commandを実行し、activation成功後にだけ旧Runtime Tokenが無効になります。成功を確認してから再起動します |
| 編集 | Node名、説明、Host、Port、SSL を変更 | Node ID と Node type は変更できません |
| 削除 | Node登録、割り当て、Runtime Token を無効化 | 削除後は同じ Node ID で作り直してください |

共通の Node 実行ファイルはありません。Worker、Encoder Recorder、Discord Bot、Observability、中央Update Agentの各service binaryに`configure`サブコマンドがあります。Panelが表示するAuto Configure commandは正規の`autostream-<service>`コマンドを使う1行のコマンドです。

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
| `update_agent` | 中央管理ホストの`autostream-updater` |

`sudo: autostream-observability: command not found`のように出る場合は、`/usr/local/bin/autostream-observability`互換symlinkが`/opt/autostream/observability/current/bin/autostream-observability`を指しているか確認します。壊れている場合は、manifest付きhost releaseに同梱された`README.install.md`で検証済み`current` linkと互換symlinkを配置し直してください。local binaryを直接copyしてmarkerだけ作る方法は使いません。

Update AgentのAuto Configure commandはTokenを含まないため、失敗または結果不確定の後も同じcommand形を使えます。ただしCLIはactivation用のTokenやstateを永続化しません。再実行するたびにConfigurationで新しいConfigure Tokenを発行し、その新しいTokenを入力します。通常Nodeのcommandは上記のとおりConfigure Tokenを引数に含むため、一度だけ実行します。

Auto Configureの通信とRuntime Token rotationはNode typeによって異なります。

通常Nodeでは次の順序です。

1. 対象service binaryがConfigure Tokenを使って`POST /api/node-agent/configure`を呼び出します。
2. Configure Tokenを一度だけ消費し、新しいRuntime Tokenを直ちに有効化して旧Runtime Tokenを無効化します。
3. レスポンスJSONから新しいRuntime Tokenと必要な署名鍵を含む`config_yml`を取り出します。
4. `config.yml`を安全なowner/modeで保存します。取得したNode typeが実行したservice binaryと違う場合は保存前に拒否します。

Update Agentでは、通常Nodeの即時rotation endpointを使わず、次の二段階で切り替えます。

1. token-free commandが実行時にConfigure TokenをTTYまたは標準入力から読み取り、`POST /api/node-agent/configure/stage`を呼び出します。`update_agent`がlegacyの`POST /api/node-agent/configure`を呼び出した場合、PanelはHTTP `409`で拒否します。
2. Panelは新しい接続identityをstageします。新しくstageされたRuntime Tokenはまだinactiveで、旧Runtime Tokenは引き続きactiveです。
3. `autostream-updater`は既存`/etc/autostream/updater.json`の安全性を通信前に確認し、`panel_url`、`node_id`、`runtime_token`、`service_name`だけを原子的にcommitして、設定をreload・validationします。
4. local commit、reload、validationがすべて成功した場合だけ、`POST /api/node-agent/configure/activate`を呼び出します。
5. activation成功後にだけ旧Runtime Tokenを無効化し、stageしたRuntime Tokenをactiveにします。

Update Agentの`github_token`、`api`、`state_dir`、interval、`hosts`、`targets`、SSH pathなどのlocal policyは変更しません。取得したNode typeが`update_agent`と違う場合はlocal commit前に拒否します。

通常Nodeでは、Configuration画面から手動で`config.yml`を配置する方法とAuto Configure commandは代替手段です。両方を実行すると、Auto ConfigureがRuntime Tokenを差し替えて先に配置したconfigを無効にするため、どちらか一方だけを使います。通常はAuto Configureを推奨します。Update Agentは下記のsample/local inventoryを用意してからAuto Configure commandを実行します。

## 中央Update Agentのlocal inventoryとAuto Configure

Update Agent Nodeを作成する前に、Control Panel host releaseの`autostream-updater.json.example`を中央管理ホストの`/etc/autostream/updater.json`へ`root:autostream-updater 0640`でinstallします。各hostのhelperをbootstrapし、`github_token`、`api`、`state_dir`、interval、`hosts`、`targets`、SSH pathをlocal inventoryに合わせて設定します。Node Runtime Tokenは手で貼り付けません。

```json
{
  "panel_url": "https://control.example.com",
  "node_id": "central-updater",
  "runtime_token": "<NODE_RUNTIME_TOKEN>",
  "service_name": "Central Updater",
  "github_token": "<PRIVATE_RELEASE_READ_TOKEN>",
  "api": {
    "bind_host": "127.0.0.1",
    "host": "127.0.0.1",
    "port": 8090,
    "ssl_enabled": false
  },
  "state_dir": "/var/lib/autostream-updater",
  "hosts": [
    {
      "host_id": "host-tokyo-01",
      "name": "Tokyo Host 01",
      "address": "192.0.2.20",
      "port": 22,
      "user": "autostream-update-host",
      "identity_file": "/etc/autostream/updater/ssh/host-tokyo-01_ed25519",
      "known_hosts_file": "/etc/autostream/updater/ssh/known_hosts",
      "arch": "amd64"
    }
  ],
  "targets": [
    {
      "target_id": "control-panel",
      "host_id": "host-tokyo-01",
      "service_type": "control_panel",
      "deployment_mode": "systemd"
    }
  ]
}
```

helper bootstrap、local inventory、file権限を完成させた後、中央Update Agentを1つ作成します。登録済みの場合はConfigure Tokenを再生成し、Configurationに表示された次の形のcommandを中央hostで初回実行します。

```bash
sudo autostream-updater configure --panel-url "https://control.example.com" --node "central-updater" --config "/etc/autostream/updater.json"
```

初回実行では、promptにConfigure Tokenを貼り付けます。Tokenはprocess argvや表示commandに含まれません。Auto Configureが更新するのは`panel_url`、`node_id`、`runtime_token`、`service_name`だけです。`github_token`、`api`、`hosts`、`targets`、SSH設定などのlocal policyは保持されます。

stageしたRuntime Tokenはactivation成功まではinactiveで、旧Runtime Tokenがactiveのままです。ただしactivationの応答を受け取れず結果不確定になった場合は、Panel側でactivationが成功済みの可能性があるため、CLIだけではどちらのRuntime Tokenがactiveか判断できません。またlocal atomic commit後にreload、validation、activationが失敗した場合、disk上の`updater.json`にはstage済みidentityが残ることがあります。

CLIはactivation用のTokenやstateを永続化しないため、stage、commit、validation、activationの失敗または結果不確定時はUpdaterを再起動せず、Configurationで必ず新しいConfigure Tokenを発行し、同じtoken-free command形へその新しいTokenを入力して再実行します。activation成功を確認した後にだけ、`sudo -u autostream-updater /usr/local/bin/autostream-updater validate-config --config /etc/autostream/updater.json`を実行し、成功後に`sudo systemctl restart autostream-updater`で反映します。

中央設定はroot所有、group `autostream-updater`、mode `0640`にし、Node Runtime Token、private release用GitHub token、ホスト別SSH秘密鍵を中央管理ホストの外へコピーしません。`hosts`にはSSH接続先とホスト別identityだけ、`targets`には`target_id`、`host_id`、service type、deployment modeだけを置きます。unit、path、backup command、Compose設定、image repositoryは各管理対象ホストのroot所有`/etc/autostream/update-host.json`だけに固定します。

Update Agentには`updates.claim`、`updates.report`、`updates.authorize` scopeが付与されます。`updates.authorize`は90秒のone-time mutation grantを発行するために使います。対応前に発行したUpdate Agent tokenは、対応Control Panelをdeployした後にConfigure Tokenを再生成し、同じtoken-free Auto Configure command形へ新しいTokenを入力して中央JSONへ反映します。各ホストの一度きりのSSH/bootstrap、root helper設定、systemd/Docker例、起動方法は[Control Panelからサービスを更新する](/operations/system-updates)を参照してください。

保存後は対象サービスの env に `AUTOSTREAM_NODE_CONFIG=/etc/autostream-<service>/config.yml` を設定して、サービス本体を起動します。サービスを先に起動していた場合、`config.yml` 未作成中は `node config pending` として待機します。Auto Configure コマンドで `config.yml` を作成した後、Worker、Encoder Recorder、Discord Bot は `sudo systemctl restart autostream-<service>` で登録と runtime config の初期読込をそろえます。Observability は起動中に再読込して登録を開始します。

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
stream_ingest:
  signing_key: "<PANEL_GENERATED_SECRET>"
agent:
  data_dir: "/var/lib/autostream/worker"
  log_dir: "/var/log/autostream/worker"
```

Linux host では `/etc/autostream-worker/config.yml` のようにサービスごとの directory に保存します。Docker では同じ path に read-only mount し、env に `AUTOSTREAM_NODE_CONFIG=/etc/autostream-worker/config.yml` のように入れます。同じ host で複数サービスを動かす場合も `/etc/autostream-worker/config.yml`、`/etc/autostream-observability/config.yml` のようにサービスごとに分けます。

## Node が報告する値

Node は起動時と heartbeat / report で次を Control Panel へ送ります。

| 値 | 表示場所 |
| --- | --- |
| version | Node登録 / Service Health / Workers |
| capability | Service Health / Start readiness |
| hostname | Service Health |
| OS / arch | Node登録 / Service Health / Workers |
| metrics | Node登録 / Service Health / Metrics |

heartbeat は既定で 60 秒を超えると warning、180 秒を超えると offline として扱います。必要なら Control Panel 側の `AUTOSTREAM_NODE_HEARTBEAT_WARNING_AFTER` と `AUTOSTREAM_NODE_HEARTBEAT_OFFLINE_AFTER` で調整します。

## API

Node Agent は次の Panel API を使います。

| API | 用途 |
| --- | --- |
| `POST /api/node-agent/configure` | 通常NodeのConfigure Tokenを消費し、新しいRuntime Tokenへ即時rotationして`config.yml`相当の設定を取得。`update_agent`からの利用はHTTP `409`で拒否 |
| `POST /api/node-agent/configure/stage` | Update AgentのConfigure Tokenを消費し、inactiveな新Runtime Tokenと接続identityをstage。旧Runtime Tokenはactiveのまま維持 |
| `POST /api/node-agent/configure/activate` | Update Agentのlocal atomic commit・reload・validation成功後にstaged Runtime Tokenをactive化し、この成功時だけ旧Runtime Tokenを無効化 |
| `POST /api/node-agent/heartbeat` | 稼働状態、version、capability、metrics を報告 |
| `POST /api/node-agent/report` | hostname、OS、arch、capability などを明示報告 |
| `POST /api/node-agent/events` | Node から stream event を送信 |

中央Update Agentは通常のNode APIに加え、Node Runtime Tokenでhostを指定した`POST /services/update-jobs/claim`、`POST /services/update-jobs/{id}/report`、mutation grant発行APIを使います。Updater側は`GET /health`、`GET /version`、bearer認証付き`GET /status`だけを提供し、Control Panelから更新commandを受けるAPIはありません。管理対象ホストのhelperは中央Updaterからのhost-key-pinned SSHと固定RPCだけを受け付け、HTTP APIを提供しません。

Panel から Node Agent API へ送る start / stop / preflight も bearer token で認証します。新方式では Node Runtime Token を優先し、古い構成の互換用途だけ `SERVICE_CALL_TOKEN` を fallback として残します。

Discord Bot Node には、VC参加を起点に Control Panel へ stream start を要求するための `streams.start` scope も付与します。Streamsで選んだDiscord Configの `service_id` がそのBot Node IDと一致する場合、Botは待機枠をruntime configで受け取り、Control Panelは開始直前に primary Discord Bot assignment を作成します。すでに別Botが明示的に primary assigned されているstreamは上書きしません。

## セキュリティ

- token はログ、監査ログ、通常APIレスポンスに出しません。
- Configure Token は有効期限つきで、使用済み token は再利用できません。
- Node Runtime Token はハッシュ検証と暗号化保存を分けて扱います。
- Panel から Node への bearer token は Node ごとに異なります。
- host 直接起動では `config.yml` を `root:autostream 0640`、`/etc/autostream-<service>` を `root:autostream 0750` にし、Git に入れないでください。
- 中央の`updater.json`はroot所有、group `autostream-updater`、mode `0640`、ホスト別SSH秘密鍵は`autostream-updater`所有`0600`にします。管理対象ホストの`/etc/autostream/update-host.json`はroot所有`0600`にし、tokenやSSH秘密鍵を置きません。
- 各管理対象ホストにはUpdater daemon、待受port、Node登録、Runtime Tokenを追加しません。Control Panelや各service containerへDocker socketもmountしないでください。
