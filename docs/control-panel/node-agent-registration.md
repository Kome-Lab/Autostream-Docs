# Node Agent登録

Node Agent登録は、Control Panelが通常のNode serviceとUpdater transportを管理する入口です。通常Nodeと`pull_v2` Host Agentではendpointの持ち方が異なります。

| 種別 | 例 | Node endpoint |
| --- | --- | --- |
| 通常Node | Worker、Encoder Recorder、Discord Bot、Observability | Control Panelから到達するHost、Port、SSLを持つ |
| `pull_v2` Host Agent | 物理ホストの`autostream-host-agent` | endpointless。Host、Port、SSL、`8090`を持たない |
| `ssh_v1` Update Agent | Bridge期間の中央`autostream-updater` | legacy互換設定を維持 |

新規ホストは`pull_v2`で登録します。登録・Auto Configure直後は`ownership_epoch=0`のobserverであり、register、heartbeat、policy refresh、target probeだけを行います。Local Executorと全targetがreadyになった後、管理者が「Host Agentへ切り替え」を実行したときだけ正のownership epochを取得して更新jobをclaimします。公開releaseと実host canaryが未検証の間は、本番の`ssh_v1`を維持してください。

## 通常Nodeを登録する

通常Nodeで入力する項目は次のとおりです。

| 項目 | 例 | 用途 |
| --- | --- | --- |
| Node type | `worker` | 起動するサービス種別 |
| Node ID | `worker-01` | PanelとNodeを対応させる固定ID |
| Node名 | `Studio Worker 01` | 画面に出す名前 |
| Host / FQDN / IP | `worker.example.com` | PanelからNode APIへ到達するhost |
| Port | `8443` | Panelから到達するNode API port |
| SSL | ON | `https`で接続するか |
| 説明 | `第1スタジオ` | 運用メモ |

Portには`1024..65535`の任意番号を指定できます。Node登録のPortは「そのサービス本来のport」であり、Host Agent用portでも、legacy中央Updaterの`8090`でもありません。Control Panelは同じexecution host / network namespace / protocolで現在値と変更予定値を予約し、競合を拒否します。

次の値は入力しません。

| 入力しない値 | 理由 |
| --- | --- |
| version | 起動後のregister、heartbeat、reportで自動報告します |
| capability | 起動後のreportで自動報告します |
| OS / arch / hostname | Node Agentが自動報告します |
| public URL全体 | Host、Port、SSLからPanelが組み立てます |
| Node Runtime Token | Configurationで安全に生成します |

Worker / Encoder Recorderの設定にはstream ingest署名鍵を含むため、それらのNodeを作成するoperatorには`secrets.update`権限が必要です。Encoder RecorderにはYouTube / Driveのruntime secret取得に必要な`service.secret.resolve` scopeも自動付与します。

## 通常NodeのConfiguration

作成後のConfigurationでは、次を確認してNode側へ渡します。

| 生成物 | 扱い |
| --- | --- |
| Configure Token | `POST /api/node-agent/configure`へ渡す短期token |
| Node Runtime Token | register、heartbeat、report、runtime config、dispatchに使うtoken |
| `config.yml` | `/etc/autostream-<service>/config.yml`へ保存 |
| Auto Configure command | service binaryの`configure`で設定を取得 |

この節の再生成手順はWorker、Encoder Recorder、Discord Bot、Observabilityの通常Node用です。Configure TokenとNode Runtime Tokenは作成直後だけ表示し、紛失・期限切れ・漏えい疑いの場合は登録済みNodeの操作から再生成して`config.yml`を更新します。activeな`pull_v2` Host Agentはgeneric再生成ではなく、後述の専用staged rotationまたはemergency recoveryを使います。

```bash
sudo autostream-worker configure \
  --panel-url "https://control.example.com" \
  --token "<CONFIGURE_TOKEN>" \
  --node "worker-01" \
  --config "/etc/autostream-worker/config.yml"
```

service typeごとのbinary名は次のとおりです。

| Node type | binary |
| --- | --- |
| `worker` | `autostream-worker` |
| `encoder_recorder` | `autostream-encoder-recorder` |
| `discord_bot` | `autostream-discord-bot` |
| `observability` | `autostream-observability` |
| `update_agent` + `pull_v2` | `autostream-host-agent` |
| `update_agent` + `ssh_v1` | legacy `autostream-updater` |

保存後は対象サービスのenvに`AUTOSTREAM_NODE_CONFIG=/etc/autostream-<service>/config.yml`を設定します。`config.yml`未作成中は`node config pending`として待機します。

通常Nodeの`config.yml`例です。

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

Linux hostではサービスごとの`/etc/autostream-<service>/config.yml`へ保存します。Dockerでは同じpathへread-only mountします。

## `pull_v2` Host Agentを登録する

物理ホストごとに`update_agent` Nodeを1つ作り、transportに`pull_v2`を選びます。同じ物理ホスト上のWorker、Encoder Recorder、Discord Bot、ObservabilityごとにHost Agentを増やしません。Node登録画面のExecution Host IDには、その物理ホストを表す固定IDを入力します。この入力はControl Panel内のhost bindingを作るためのもので、Host Agent configへは入りません。

`pull_v2` Nodeの作成と初回credential発行には`api_tokens.create`、`secrets.update`、`system_updates.execute`が必要です。active Host Agentの専用rotationでstage、cancel、emergency revokeを行うoperatorには、これらに`api_tokens.revoke`を加えた4権限すべてが必要です。

`pull_v2`はendpointlessなので、Host、Port、SSLを入力しません。受信TCPや`8090`も設定しません。Host AgentはControl Panelへoutbound HTTPSで接続します。

検証済みHost Agent releaseを展開し、先に同じreleaseのHost Agent、Local Executor、systemd unitを`--prepare`で配置します。`--prepare`はserviceを起動せず、identityやpolicyを推測しません。

```bash
sudo ./install/install-autostream-host-agent --prepare
```

続いてConfigurationに表示されたAuto Configure commandを対象ホストで実行します。

```bash
sudo /usr/local/bin/autostream-host-agent configure \
  --panel-url "https://control.example.com" \
  --node "host-agent-tokyo-01" \
  --config "/etc/autostream-host-agent/identity.json"
```

Configure Tokenはcommandへ埋め込まず、TTYまたは標準入力から非表示で渡します。生成される`/etc/autostream-host-agent/identity.json`は次の4項目だけを持ちます。

```json
{
  "panel_url": "https://control.example.com",
  "node_id": "host-agent-tokyo-01",
  "runtime_token": "<NODE_RUNTIME_TOKEN>",
  "service_name": "Tokyo Host Agent"
}
```

許可するキーは`panel_url`、`node_id`、`runtime_token`、`service_name`だけです。API port、SSH設定、GitHub Release Token、target policy、任意commandを追加しません。

`execution_host_id`と`ownership_epoch`はControl Panelが所有するserver-owned値です。Control Panelは登録tokenとservice bindingから対象hostを解決し、Host Agentへread-only policyとして返します。これらをidentity、CLI引数、環境変数へ入れたり、heartbeatから変更したりしないでください。

Auto Configureは4項目identityだけでなく、Control Panelがsystemd target向けに生成したexact Local Executor policyを`/etc/autostream-local-executor/policy.json`へ保存し、初期port sidecarを`/opt/autostream/local-executor/ports/*.env`へ不足分だけ生成します。policyとsidecarは`root:root 0600`、sidecar directoryは`root:root 0700`です。既存sidecarがcanonical bytesと異なる場合は上書きせず、identity、policy、sidecarのtransaction全体をfail closedにします。Docker authorityはNode登録値から生成せず、Docker targetのAuto Configure projectionはfail closedです。Docker port jobには別途root所有の固定policyと承認済みfrozen Compose baselineが必要です。

Host Agent packageは専用の非root `autostream-host-agent` userを使います。物理ホスト1台につきprocessは1つだけです。Host AgentからControl Panelへのoutbound HTTPSだけを許可し、systemdの`SocketBindDeny=any`を維持します。Local Executorはrootで動きますが、固定Unix socket、root所有policy、固定target/operationだけを受け付けます。

root recovery supervisorだけは、同じ固定socketの`host_self_update_watchdog_status`をUID 0で使用します。このoperationはcredentialやmutation payloadを持たない`root-only watchdog status`で、2秒timeoutの間にdurable state、`current` slot、Executor version/protocol、no-action状態を返します。status取得はstate初期化やgrant recoveryを行いません。Host Agent UIDからのwatchdog statusと、root peerからの通常mutationは双方を拒否します。

自己更新のstaging失敗は、`stable + failed_generation`を先に永続化した後、exact matching stage grantを削除せず、`token_sha256`とexact bindingを保持し、receiptなしのcredential-free terminal `phase=failed`へ収束させます。socket response喪失後の同一IPC replayはgrant再consume・mutation再applyなしのno-op successとなり、異なるbindingは拒否します。

Auto Configure成功後、同じ検証済みreleaseのinstallerで生成済みpolicyを再検証してLocal Executorを起動し、最後にHost Agentを起動します。

```bash
sudo ./install/install-autostream-local-executor \
  --policy /etc/autostream-local-executor/policy.json
sudo systemctl enable --now autostream-host-agent.service
```

初回heartbeatはobserverとしてepoch `0`を報告します。Control Panelの更新実行権限を明示的に切り替えるまではjobをclaimしません。

Host Agent / Local Executor自己更新のreadinessには`recovery_protocol_version=2`が必要です。Host Agent capability、Host Release manifest、directive、grant、root plan、durable stateのprotocolが一致しない場合や、legacy recovery protocol 1の場合は自己更新をfail closedにします。

Host Agentの即時Runtime Token置換は`staged_runtime_token_rotation_required`で拒否されます。専用rotationはstage、旧tokenでの1回だけのclaim、Local Executorのlocal ack、staged token heartbeat proof、activate、canonical identity昇格、旧token revokeの順です。activate前はcancelでき、emergency revokeは両tokenを失効してlocal recoveryを要求します。

## endpointの3状態

通常Nodeのendpointは次の3状態を別々に保持します。

| 状態 | 意味 |
| --- | --- |
| `desired` | Node登録・編集でoperatorが次に適用したいHost、Port、SSL |
| `applied` | executorが管理対象systemd endpointまたはDocker mappingへ最後に適用した値 |
| `reported` | service heartbeatやHost Agent probeで実際に観測したendpoint |

activeな`pull_v2` systemd targetは、Node編集からendpointを直接変更できません。Application Infoの「サービスのポート変更」で`port_reconfigure` jobを作ります。Control Panelが`eligible_operations`へ`port_reconfigure`を返し、targetがidle、Host Agentがonline、policy/probeがready、endpointが`applied`、recoveryやactive jobがない場合だけ操作できます。

systemdの対象はWorker、Encoder Recorder、Discord Bot、Observabilityです。Local Executorが新sidecarをstageし、unit restart、listener owner、service identity、health、version、config revision/SHA-256を確認した後だけ`applied`を更新します。失敗時は旧portへrollbackし、`reported`は次のheartbeat/probeが更新します。

同じ4サービスのDocker targetでは、固定Docker policyと承認済みfrozen Compose baselineがある場合だけ、advertised、`127.0.0.1` published、container listenの3ポートを専用jobで変更できます。advertisedは`1..65535`、published/containerは`1024..65535`です。Local Executorは固定port envと対象Compose serviceだけを切り替え、container/image/repository identity、Compose/env digest、healthを確認してrollback/reconcileします。Auto ConfigureはDocker authorityを自動生成せず、reverse proxyも変更しません。

| 配置 | Node登録で指定するendpoint |
| --- | --- |
| systemd | Control Panelからservice processへ到達するhostとlisten port |
| Docker | Control Panel containerから到達するservice DNS名とcontainer port |
| reverse proxy | 必要な場合はproxyから到達するorigin。公開HTTPS `443`とは分ける |

詳細は[Dockerでインストールする](/deployment/docker)と[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

## Bridge中の`ssh_v1`

transportを省略した既存Update Agentは`ssh_v1`として扱います。中央`autostream-updater`、`/etc/autostream/updater.json`、host別SSH鍵、`autostream-update-host` helper、必要なstatus portはBridge互換資産です。

`pull_v2` Host Agentを登録しただけでは、legacy資産やSSH設定を削除しません。同じhostでactive jobがないこと、ownership fenceが切り替わったこと、release/canary/rollback gateを通過したことを確認してから、別releaseで撤去します。

## 現在のavailability

| 機能 | 状態 |
| --- | --- |
| `pull_v2`登録、4項目identity、exact policy、初期systemd sidecar、register/heartbeat/probe | sourceとlocal testsあり。公開releaseと本番deployは別途検証が必要 |
| root Local ExecutorとのUnix socket RPC | software update、systemd port apply/reconcile/rollback、UID 0専用self-update watchdog statusのsource/tests、Linux container tests、root fixtureあり。実systemd VM E2Eは未検証 |
| `pull_v2`でのjob claim、stage、apply、report、rollback | source/testsあり。公開artifactと22/8090遮断canary未検証 |
| `1024..65535`のport reservationとsystemd `port_reconfigure` | source/API/UI/testsあり。実systemd VM smoke未検証 |
| Docker port mapping | advertised、localhost published、container listenの専用job/API/UI/unit testsあり。Docker 29.6.2 / Compose 5.3.1のisolated root DINDで連続変更、実process crash後のfresh-process reconcile、unhealthy rollback、foreign ownerのgrant前拒否を確認。固定Docker policyと承認済みbaselineが必須。公開imageと実Docker host canaryは未確認 |
| staged Runtime Token rotation | stage/claim/local ack/staged heartbeat/activate/cancel/emergencyのHTTP/Store/Host Agent/Executor sourceとtestsあり。mixed-version実host drill、公開release、deployは未実施 |
| Host Agent / Executor自己更新 | recovery protocol 2、directory fsync、reserved artifact recovery、fresh-process slot検証、`failed_generation`とreceipt-free terminal `phase=failed` grant収束、同一IPC replayのno-op success、異binding拒否、stage claim後cancel拒否、root-only watchdog statusのsource/focused testsあり。公開artifact、実systemd process kill/reboot、amd64/arm64 canaryは未確認 |
| fleet canary、Control Panel hostの最終移行、SSH/`8090`撤去 | 未検証・未着手 |

## API

通常Nodeは次のPanel APIを使います。

| API | 用途 |
| --- | --- |
| `POST /api/node-agent/configure` | Configure Tokenを消費し、通常Nodeの`config.yml`相当を取得 |
| `POST /api/node-agent/heartbeat` | 稼働状態、version、capability、metricsを報告 |
| `POST /api/node-agent/report` | hostname、OS、arch、capabilityを報告 |
| `POST /api/node-agent/events` | stream eventを送信 |

`pull_v2` Host Agentは登録とheartbeatに加え、Host Agent用policy endpointをpollします。ownership epochが`0`の間はobserverです。正のepochと一致するpolicy digestが有効になった後だけclaim/report APIと短命mutation grantを使い、Local Executorへ固定operationを依頼します。

Panelから通常Node APIへ送るstart、stop、preflightもbearer tokenで認証します。新方式ではNode Runtime Tokenを優先し、古い構成の互換用途だけ`SERVICE_CALL_TOKEN`をfallbackとして残します。

## セキュリティ

- tokenはargv、env、log、監査ログ、通常APIレスポンスへ出しません。
- Configure Tokenは有効期限つきで、使用済みtokenを再利用しません。
- Node Runtime TokenはNodeごとに分け、暗号化保存とhash検証を使います。
- 通常Nodeの`config.yml`は`root:autostream 0640`、directoryは`root:autostream 0750`を基準にします。
- Host Agent configは`root:autostream-host-agent 0640`とし、4項目以外を拒否します。
- canonical configは`/etc/autostream-host-agent/identity.json`です。legacy `/etc/autostream/host-agent.json`はcanonical不在時のread-only fallbackだけで、両方が存在すればfail closedにします。
- Host Agentはnonroot、受信TCPなし、Docker socket mountなしで動かします。
- Local Executorは`/run/autostream-local-executor/executor.sock`だけでHost Agentと通信し、`/etc/autostream`を読めません。policyとDocker credentialは`/etc/autostream-local-executor`へ分離します。
- source実装が存在しても、公開release、attestation、実Linux canary、rollback drillの証拠がないホストではownershipを切り替えません。
