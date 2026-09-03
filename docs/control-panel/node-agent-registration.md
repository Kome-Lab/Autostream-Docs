# Node登録とAuto Configure

Control PanelはNode identity、service type、権限、runtime policy、credential
rotationのauthorityです。v2構成ではapplication runtimeごとにNodeを登録し、
物理execution hostごとにendpointlessなUpdater Nodeを1つ登録します。

## Application runtime Node

次の5種類のapplication runtime identityは独立して保持します。

- Control Panel
- Worker
- Encoder Recorder
- Discord Bot
- Observability

各serviceはNode登録で生成した`config.yml`からNode identityとrotating Runtime
Tokenを読みます。service tokenを環境変数へ追加したり、別Nodeのcredentialを
コピーしたりしないでください。5つのApplication Runtime Identity Probesは
引き続きreadinessのauthorityです。Updaterの状態表示で置き換えません。

Worker、Encoder Recorder、Discord Bot、ObservabilityではNode configに次の固定名を含めます。

```yaml
listener:
  credential: node-listener.json
```

systemd unitは`LoadCredential`で`/opt/autostream/local-executor/ports/<service>.json`を渡します。sourceはroot-ownedのprivate directory内にある非secretの`0600` fileです。processはsystemdの`CREDENTIALS_DIRECTORY`から固定名`node-listener.json`を読みます。Dockerでは承認済みCompose `configs`を`/run/autostream-credentials/node-listener.json`へmountします。

listener JSONは`schema_version: 2`、`service_type`、`bind_address`、正の`config_revision`だけを含みます。公開接続先の`api.host` / `api.port`はlocal listenerとは別です。service typeとrevisionを照合し、欠落時に暗黙の待受addressへfallbackしません。

新しいconfigとlistener credentialをinstallした後は対象serviceだけを明示的にrestartし、identity
probeのservice type、version、commit、config revisionを照合します。
`config.yml`またはlistener credentialがない場合や不正な場合は、startupがfail closedで停止することを
確認してください。

## 物理hostのUpdater Node

物理execution hostごとに`update_agent` Nodeを1つ作ります。Host、Port、SSL、
SSH、repository token、任意command、target pathを入力するNodeではありません。
独立した非rootの`autostream-host-agent`がControl Panelへoutbound HTTPSで
接続し、rootのLocal Executorへ固定Unix socket経由でprivileged operationを
依頼します。受信TCP listenerは開きません。

検証済みの独立Updater packageをprepareした後、Configuration画面のone-time
Auto Configure commandを対象hostで実行します。Configure Tokenは非表示prompt
または標準入力だけで渡します。処理は次をatomicにinstallします。

- `/etc/autostream/updater/agent.yaml`: `root:autostream-host-agent 0640`。
  `panel_url`、`node_id`、`runtime_token`、`service_name`の4項目だけ。
- `/etc/autostream/updater/executor-policy.json`: `root:root 0600`。
  serverが生成した固定Local Executor policyだけで、tokenを含みません。
- `/opt/autostream/local-executor/ports`以下の不足しているcanonical systemd
  listener JSON。Control Panel自身のbootstrap port管理とは分離します。


生成されるidentityのshapeは次のとおりです。値はAuto Configureが設定し、手動でcredentialを入力しません。

```yaml
panel_url: "https://panel.example.invalid"
node_id: "host-example-01"
runtime_token: "<CONFIGURE_GENERATED_RUNTIME_TOKEN>"
service_name: "Host example 01"
```

Agent identityはYAML専用です。未知field、JSON入力、複数document、不正な
owner/mode、symlinkは拒否されます。execution host ID、ownership epoch、
endpoint、operation、release policyはserver-ownedであり、identityへ追加しません。

Auto Configureは認証されたprotocol major 2のruntime-identity APIでstageと
activateを行います。Configure Tokenはsingle-useです。応答を失った場合は
Nodeとhostの状態を照合してから対応し、local fileだけでactivation成功を
推測しないでください。

## Readinessと更新権限

登録だけではmutation authorityは付与されません。Control Panelはfresh
heartbeat、protocol major、host ownership fence、exact policy revisionと
SHA-256、Local Executor probe、target observationの一致を確認します。
更新直前にはjobとfenceに結び付いた短命・single-use grantも必要です。

Local Executorは`/run/autostream-local-executor/executor.sock`で固定operation
だけを受け付けます。Agentから任意command、URL、path、unit、image、portを
渡すことはできません。

## Credential rotationと撤去

Runtime Tokenはstage方式でrotateします。current credentialによるone-time
claim、inactiveなstaged YAML identityの保存、staged credentialのproof、
Control Panelでのactivate、atomicなidentity昇格の順です。current credentialを
先に失効させたり、credentialをlogへ出したりしないでください。

撤去前には新規jobを止め、jobとrecoveryをterminalまで収束させ、Control Panelで
Runtime Tokenをrevokeし、Nodeをdisableします。その後に独立Updaterのuninstaller
を使います。local fileの削除はserver側revokeの証拠にはなりません。

rescue modeは再stage・再applyしません。
journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。
systemd conditionを回避しないでください。

更新、recovery、whole-release rollbackは[システム更新](/operations/system-updates)
を参照してください。source/CIの完了は実host canaryやproduction deployの完了を
意味しません。
