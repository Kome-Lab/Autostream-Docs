# システム更新

AutoStream v2のhost更新は独立Updater repositoryとprotocol major 2だけを使います。
Control Panelはorchestration、desired state、認可、audit、dataを所有します。
非root Host Agentはoutbound pollingと観測を、root Local Executorは固定policyで
認可されたhost mutationだけを担当します。

Control Panel内に中央Updater runtimeはありません。host側のUpdater受信TCP
listenerもありません。5つのApplication Runtime Identity Probes、Worker scene
appearance、Encoder Video Cover、Watermark、audio continuity、Observabilityの
detect/propose/evidence authorityは更新経路と独立して保持します。

## 新規installとconfigure

使用する独立Updater releaseのexact archive、checksum、provenanceを照合してから
展開します。v2 releaseの公開と実host canaryはsource/CIとは別のgateです。
未公開artifactや未検証の組合せを本番へ導入しないでください。

検証済みarchive内でruntimeを起動せずprepareします。

```bash
sudo ./install/install-autostream-host-agent --prepare
```

Control Panelで物理hostごとにendpointless Updater Nodeを1つ登録し、生成された
Auto Configure commandを実行します。one-time Configure Tokenは非表示prompt
または標準入力から渡します。次のcanonical fileと不足するsidecarをinstallします。

- `/etc/autostream/updater/agent.yaml`
- `/etc/autostream/updater/executor-policy.json`
- `/opt/autostream/local-executor/ports/<service>.json`の固定systemd listener credential

Agent identityは`panel_url`、`node_id`、`runtime_token`、`service_name`の4項目だけを
持つYAMLで、`root:autostream-host-agent 0640`です。executor policyはtokenを含まず、
`root:root 0600`です。未知fieldや不正なfile layoutはfail closedで拒否します。

Control Panelのactivationを確認してからHost AgentとLocal Executor socketを
明示的にenableします。Agentが非rootで、outbound HTTPSだけを使い、受信TCPを
開かず、protocol major 2を報告することを確認してください。


生成されるidentityのshapeは次のとおりです。値はAuto Configureが設定し、手動でcredentialを入力しません。

```yaml
panel_url: "https://panel.example.invalid"
node_id: "host-example-01"
runtime_token: "<CONFIGURE_GENERATED_RUNTIME_TOKEN>"
service_name: "Host example 01"
```

## 更新jobの実行

Control Panelは次のexact stateが一致する場合だけ更新を許可します。

- execution hostと正のownership epoch
- Agent、Executor、mutation、recoveryのprotocol version
- source、projection、ownership、executor policy revision
- Local Executor policy SHA-256とeligible operation
- target service type、deployment mode、applied endpoint、config revisionとdigest
- conflicting job、recovery、credential rotation、未収束grantがないこと

Host Agentはimmutable jobをclaimし、release metadataとartifact digestを検証して
固定planをstageします。mutation直前にControl Panelがjob、target、operation、
revision、ownership fence、plan digestへ結び付いた短命・single-use grantを
発行します。Local Executorは同じbindingを再検証し、durable ledgerを保存してから
実行します。

Worker、Encoder Recorder、Discord Bot、Observabilityのsystemd targetは固定service profileと`LoadCredential`による`node-listener.json`を使います。Node configの`listener.credential`が固定名を指定し、JSONの`schema_version: 2`、`service_type`、`bind_address`、正の`config_revision`を照合します。port変更は同じCAS、digest、revision、rollback境界でcredentialを更新し、restart後のApplication Runtime Identity Probeで確認します。Docker targetは
Compose project、service、image repository、credential path、承認済みbaselineを
policyで固定します。requestから任意command、path、unit、image、public endpointを
指定することはできません。reverse proxyは自動変更しません。

## 結果、recovery、rollback

mutation後はprocess/container identity、listener、health、version、applied configを
検証し、durable resultを報告します。応答を失った場合はjournal、ledger、checkpoint、
grantからreconcileし、推測でmutationを再実行しません。

検証に失敗した場合は旧release/image全体を復元し、旧healthを確認します。
rollbackはwhole-releaseだけです。v2 release内へ廃止済みroute、field、環境変数、
binary、unit、image、helperを部分的に戻してはいけません。

rescue modeは再stage・再applyしません。
journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。
systemd conditionを回避しないでください。

未解決または矛盾したstateはfail closedのまま、承認されたconsole recoveryへ
停止します。公開release、CI、実host canary、production deployは別々の証拠です。

## Host Agent / Local Executorの自己更新

自己更新は専用directiveとgrantを使います。2つのbinaryは同じ検証済みUpdater
releaseから取得し、`/opt/autostream/host-agent/slots/{a,b}`のinactive slotへstage
します。activate前にrelease、commit、build date、archive/binary digest、全protocol、
systemd unit、process executable、watchdog statusを照合します。

root recovery timerはdurable stateだけからrestart/rollbackします。caller指定の
path、URL、unit、command、credentialは受け付けません。Host runtimeの更新は
application serviceのversionを変更しません。

既存のhealthy installationの通常更新は検証済みinstallerで行います。

```bash
sudo ./install/install-autostream-host-agent --upgrade
```

identity、policy、sidecar、Runtime Tokenは保持されます。configureの再実行や新しい
Configure Tokenの発行は不要です。`--upgrade --recover-active-job`はそのreleaseが
明示的に許可したexact pairとactive interrupted jobだけのrecoveryです。通常更新と
混同せず、前提が一致しなければ停止してください。再stage・再applyはしません。

## Runtime Token rotation

rotationはprepare、stage、proof、activate、finalizeのphaseを使います。staged
identityは`/etc/autostream/updater/agent.staged.yaml`へ保存し、activate時に
`/etc/autostream/updater/agent.yaml`へatomicに昇格します。response-loss replayは
同じrotation bindingだけに限り、root mutationを重複実行しません。

emergency revokeは両credentialを無効化し、新しいmanaged identityと固定Local
Executor recoveryを要求します。tokenをargv、環境変数、log、evidence、shell
historyへ入れないでください。

## 撤去

新しいworkを止め、job、grant、rotation、self-update、recoveryがterminalであることを
確認します。Control PanelでNode Runtime Tokenをrevokeし、Nodeをdisableしてから
local uninstallerを実行します。Local Executorを先に、Host Agentを後に撤去します。

default uninstallは復旧用stateを保持します。`--purge`はpath、owner、mode、identity
を厳密に検証してmanaged local stateを削除します。local purgeだけではControl Panel
側のrevokeを証明できません。SSD、copy-on-write filesystem、snapshot、backup上の
物理消去も保証しません。
