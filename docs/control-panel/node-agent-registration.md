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

中央Update Agentの既定portは`8090`です。更新jobと「システム更新」で保存した設定は中央Updaterが外向きに取得します。Updaterのinbound APIはhealth、version、認証付きstatusだけを提供し、更新commandは受け付けません。同一ホストならloopbackだけで待ち受けます。管理対象ホストのhelperには待受portがありません。

次の値は手入力しません。

| 入力しない値 | 理由 |
| --- | --- |
| version | Node 起動後の register / heartbeat / report で自動報告します |
| capability | Node 起動後の report で自動報告します |
| OS / arch / hostname | Node Agent が自動報告します |
| public URL 全体 | Host、Port、SSL から Panel が組み立てます |
| `CONTROL_PANEL_TOKEN` | Panel が `config.yml` に Node Runtime Token として出します |

Worker / Encoder Recorderの設定にはstream ingest署名鍵を含むため、それらのNodeを作成するoperatorには`secrets.update`権限が必要です。Encoder RecorderにはYouTube / Driveのruntime secret取得に必要な`service.secret.resolve` scopeも自動付与します。中央Update Agentの認証情報はManaged更新用GitHub Release Tokenへ到達できるため、Node作成には`api_tokens.create`、`system_updates.execute`、`secrets.update`が必要です。Configure Token再生成とRuntime Token再生成には`api_tokens.create`と`api_tokens.revoke`の両方に加え、既存scopeとsecret境界を再発行できる権限が必要です。Worker / Encoder Recorderと中央Update Agentでは再生成時も`secrets.update`を要求します。

## 生成されるもの

作成後の Configuration では、次を確認して Node 側へ渡します。

| 生成物 | 扱い |
| --- | --- |
| Configure Token | 通常Nodeでは`POST /api/node-agent/configure`、Update Agentでは`POST /api/node-agent/configure/stage`へ渡す短期token。Update Agentではcommandへ埋め込まずTTYまたは標準入力から非表示で渡します |
| Node Runtime Token | register、heartbeat、report、runtime config、Panel から Node への dispatch に使う token |
| `config.yml` | 通常Nodeでは`/etc/autostream-<service>/config.yml`に保存します |
| Auto Configure command | service binaryの`configure`サブコマンドで設定を取得し、通常Nodeは`config.yml`、Update Agentは中央`/etc/autostream/updater.json`へ接続identityを自動生成します |

Configure Token と Node Runtime Token は作成直後だけ表示します。紛失した場合や期限切れの場合は、登録済みNodeの操作から再生成してください。DB には Configure Token をハッシュで、Node Runtime Token を暗号化して保存します。

Worker / Encoder Recorderを作成する前に、Control Panel envの`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY`へ32バイト以上のランダム値を設定して再起動してください。未設定、32バイト未満、`CHANGE_ME`等のplaceholderのままでは、Node作成・Auto Configure・Token再生成を実行できません。

作成した Node は、同じ Node登録画面の「登録済みNode」一覧で確認できます。この一覧は Node登録に必要な情報と、Node が heartbeat で送った安全化済みの capability / 数値 metrics summary を表示します。Auto Configure command を Node 側で実行する前は `pending` / 接続待ちとして表示されます。最新の service binary で Auto Configure command を実行すると version、hostname、OS、arch が報告され、起動後の heartbeat で online、capability、metrics が更新されます。運用監視の詳細値は Service Health と Metrics で確認します。

登録済みNodeの操作列では、次の管理ができます。

| 操作 | 用途 | 注意 |
| --- | --- | --- |
| Configuration表示 | `config.yml` と Auto Configure command を確認 | 生の token は通常表示しません |
| Configure Token再生成 | 期限切れ、紛失、未使用tokenの作り直し | `api_tokens.create`、`api_tokens.revoke`、既存scope権限が必要。再生成後のtokenは一度だけ表示します |
| Runtime Token再生成 | 漏えい疑い、紛失、Node側token更新 | 同じ権限を要求します。通常Nodeではrotation時に旧Runtime Tokenが直ちに無効になります。Update Agentでは新しいConfigure TokenでAuto Configure commandを実行し、activation成功後にだけ旧Runtime Tokenが無効になります。rotation時だけ中央Updaterを再起動して新しいidentityを読み込みます |
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

`sudo: autostream-observability: command not found`のように出る場合は、`/usr/local/bin/autostream-observability`互換symlinkが`/opt/autostream/observability/current/bin/autostream-observability`を指しているか確認します。壊れている場合は、manifest付きhost releaseに同梱された`README.install.md`で検証済み`current` linkと互換symlinkを配置し直してください。未検証のlocal binaryを使わないでください。

Update Agentの通常導入ではAuto Configure commandを1回だけ実行します。Configure Tokenはコマンドに含まれず、TTYまたは標準入力から非表示で読み取られます。`/etc/autostream/updater.json`は接続identityだけを保存するbootstrap設定として原子的に自動生成され、root所有、group `autostream-updater`、mode `0640`になります。`updater.json`を手で編集しません。

Auto Configureの通信とRuntime Token rotationはNode typeによって異なります。

通常Nodeでは次の順序です。

1. 対象service binaryがConfigure Tokenを使って`POST /api/node-agent/configure`を呼び出します。
2. Configure Tokenを一度だけ消費し、新しいRuntime Tokenを直ちに有効化して旧Runtime Tokenを無効化します。
3. レスポンスJSONから新しいRuntime Tokenと必要な署名鍵を含む`config_yml`を取り出します。
4. `config.yml`を安全なowner/modeで保存します。取得したNode typeが実行したservice binaryと違う場合は保存前に拒否します。

Update Agentでは次の順序です。

1. `autostream-updater configure`がConfigure TokenをTTYまたは標準入力から読み取り、`POST /api/node-agent/configure/stage`を呼び出します。`update_agent`がlegacyの`POST /api/node-agent/configure`を呼び出した場合、PanelはHTTP `409`で拒否します。
2. Panelは新しい接続identityをstageします。新しくstageされたRuntime Tokenはまだinactiveで、旧Runtime Tokenは引き続きactiveです。
3. Updaterは`/etc/autostream/updater.json`へ接続identityだけを原子的に保存します。
4. 保存と検証が成功した場合だけ`POST /api/node-agent/configure/activate`を呼び出し、stageしたRuntime Tokenをactiveにします。

## 中央Update Agentの登録と管理設定

中央管理ホストへ`/usr/local/bin/autostream-updater`を配置し、Control PanelのNode登録で中央Update Agent Nodeを1つだけ作成します。Configurationに表示された次のコマンドを中央ホストで実行してください。

```bash
sudo /usr/local/bin/autostream-updater configure --panel-url "https://control.example.com" --node "central-updater"
```

表示されたpromptへConfigure Tokenを貼り付けます。入力内容は画面に表示されず、process argvやshell historyにも入りません。この1回の実行で`/etc/autostream/updater.json`が自動生成され、接続identityのstage、保存、activationまで行われます。GitHub Release Token、管理対象ホスト、target、SSH設定はこのファイルに書きません。

その後、Control Panelの **システム更新** で中央Updaterを選び、次を設定します。

- GitHub Release Token。repositoryの公開状態にかかわらずManaged更新では必須です。画面では書き込み専用で、保存後は画面へ再表示しません。更新jobを取得した中央Updaterへだけ一度限り配布します。
- loopbackで待ち受けるAPIポートと、設定・jobの更新確認間隔、Heartbeat間隔。
- 管理対象ホストの表示名、address、SSH port、SSHユーザー、architecture。
- server consoleなどの独立した経路で確認した完全なSSHホスト公開鍵。
- 管理するtargetとdeployment mode。

`ssh-keyscan`は公開鍵の取得補助には使えますが、`ssh-keyscan`の出力だけを信用しないでください。server consoleや契約先の管理画面など、SSH接続とは独立した経路でfingerprintを照合します。

保存すると中央Updaterが設定を自動で取得し、検証して反映します。設定反映のための再起動は不要です。更新jobの実行中は安全に完了するまで反映を保留し、画面には **反映済み**、**反映待ち**、**反映失敗** のいずれかを表示します。**反映済み** は保存したrevisionを受理して動作中という意味で、hostの到達状態とは別です。反映失敗時は更新操作を停止し、失敗した段階に応じて直前の有効な設定へ戻るか安全な保存処理を自動再試行します。表示された理由を確認し、入力に問題がある場合は修正してもう一度保存します。

新しいホストを保存すると、UpdaterがホストごとのEd25519鍵を生成し、**SSHクライアント公開鍵**をシステム更新画面へ報告します。その公開鍵だけを管理対象ホストの`autostream-update-host`へ登録します。SSH秘密鍵、Node Runtime Token、Configure Token、GitHub Release Tokenを管理対象ホストへコピーしません。

Runtime Tokenを漏えいなどでrotationする場合だけ、新しいConfigure Tokenを発行してAuto Configure commandを再実行します。activation成功を確認してから中央Updaterを再起動し、新しいidentityを読み込みます。activationの結果が不確定な場合はUpdaterを停止・再起動せず、Configurationで新しいConfigure Tokenを発行してからやり直してください。

Update Agentには`updates.claim`、`updates.report`、`updates.authorize` scopeが付与されます。各ホストの一度きりのSSH/bootstrap、root helper設定、起動方法は[Control Panelからサービスを更新する](/operations/system-updates)を参照してください。

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

中央Update Agentは通常のNode APIに加え、Node Runtime Tokenで管理設定の取得、hostを指定した`POST /services/update-jobs/claim`、`POST /services/update-jobs/{id}/report`、mutation grant発行APIを使います。GitHub Release Tokenは更新jobを取得した中央Updaterへだけ一度限りで渡され、設定やlogへ永続化しません。Updater側は`GET /health`、`GET /version`、bearer認証付き`GET /status`だけを提供し、Control Panelから更新commandを受けるAPIはありません。管理対象ホストのhelperは中央Updaterからのホスト公開鍵固定済みSSHと固定RPCだけを受け付け、HTTP APIを提供しません。

Panel から Node Agent API へ送る start / stop / preflight も bearer token で認証します。新方式では Node Runtime Token を優先し、古い構成の互換用途だけ `SERVICE_CALL_TOKEN` を fallback として残します。

Discord Bot Node には、VC参加を起点に Control Panel へ stream start を要求するための `streams.start` scope も付与します。Streamsで選んだDiscord Configの `service_id` がそのBot Node IDと一致する場合、Botは待機枠をruntime configで受け取り、Control Panelは開始直前に primary Discord Bot assignment を作成します。すでに別Botが明示的に primary assigned されているstreamは上書きしません。

## セキュリティ

- token はログ、監査ログ、通常APIレスポンスに出しません。
- Configure Token は有効期限つきで、使用済み token は再利用できません。
- Node Runtime Token はハッシュ検証と暗号化保存を分けて扱います。
- Panel から Node への bearer token は Node ごとに異なります。
- host 直接起動では `config.yml` を `root:autostream 0640`、`/etc/autostream-<service>` を `root:autostream 0750` にし、Git に入れないでください。
- 中央の`/etc/autostream/updater.json`は接続identityだけを保存し、root所有、group `autostream-updater`、mode `0640`にします。ホスト別SSH秘密鍵は中央Updaterのstate directoryで`autostream-updater`所有`0600`にします。管理対象ホストの`/etc/autostream/update-host.json`はroot所有`0600`にし、tokenやSSH秘密鍵を置きません。
- 各管理対象ホストにはUpdater daemon、待受port、Node登録、Runtime Tokenを追加しません。Control Panelや各service containerへDocker socketもmountしないでください。
