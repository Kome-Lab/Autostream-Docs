# Host Agent Bridgeでサービスを更新する

AutoStreamのUpdaterは、中央管理ホストから各ホストへSSH接続する`ssh_v1`から、各物理ホストのHost AgentがControl Panelへ接続する`pull_v2`へ段階的に移行します。Bridge期間中は両方式を残し、ホストごとに明示的に実行権限を切り替えます。

> [!IMPORTANT]
> 公開`v1.9.10` Host Releaseはasset、checksum、manifest、attestationを提供します。自己更新のP1電源断境界はdirectory fsync、slot再検証、grant収束、root-only watchdog statusまでsource/focused testsで閉じ、Docker port jobもローカルの実daemon DIND smokeでfresh-process reconcile、unhealthy rollback、foreign owner拒否を確認しました。ただし、実Linux/systemdでのprocess kill/reboot canary、全Docker imageの公開証拠、22/TCPと8090/TCPを閉じたE2E、fleet移行は別の証拠であり未実施です。公開releaseをproduction proofと読み替えず、これらのavailability gateを通過するまで本番ホストの実行権限は`ssh_v1`から切り替えないでください。

## 移行後の構成

物理ホスト1台につき、非rootの`autostream-host-agent`を1つだけ常駐させます。サービスごとにUpdaterやhelperを置きません。

```text
                         outbound HTTPS
+------------------+  <-------------------  +--------------------------+
| Control Panel    |                         | 物理ホスト               |
|                  |                         |                          |
| policy / jobs    |                         | autostream-host-agent    |
| desired endpoint |                         | 非root、受信TCPなし      |
| ownership fence  |                         | 1 hostにつき1 process    |
+------------------+                         |            |             |
                                               Unix socket | target      |
                                                           v             |
                                               root Local Executor       |
                                               systemd / Docker / port   |
                                             +--------------------------+
```

Host AgentからControl Panelへの通信だけを許可し、Control PanelからHost AgentへTCP接続しません。`8090`を含む受信TCPポート、SSH設定、SSH鍵は`pull_v2`には不要です。公開Control PanelにはHTTPSで接続します。loopback HTTPは開発・テストだけに限定してください。

root権限が必要なsystemd、Docker、ポート切替はrootの`autostream-local-executor`だけが担当します。Host Agentとは`/run/autostream-local-executor/executor.sock`で通信し、TCP listenerやHost AgentへのDocker socket mountは使いません。Local Executorはroot所有policy、peer UID/GID、policy revision、ownership epoch、plan digest、session、1回限りのmutation grantを照合し、固定されたtargetとoperation以外を拒否します。

登録直後のHost Agentは`ownership_epoch=0`のobserverです。この状態でもregister、heartbeat、policy refresh、target probeを行いますがjobをclaimしません。Control Panelの「Host Agentへ切り替え」で正のownership epochを発行した後だけ、同じoutbound loopが更新jobをclaimします。

## Bridge期間のtransport

| transport | 配置 | 通信 | Bridge中の扱い |
| --- | --- | --- | --- |
| `pull_v2` | 各物理ホストに非root Host Agentを1つ、root Local Executorを1つ | Control Panelへoutbound HTTPS、host内Unix socket。受信TCPなし | source実装あり。ownership切替前はobserver、切替後だけjobを実行 |
| `ssh_v1` | 中央`autostream-updater`と各hostの`autostream-update-host` helper | 中央からhostへSSH | 既存の更新適用を維持する互換経路。Bridge完了までは削除しない |

transportをホスト単位で切り替えます。同じホストの更新jobを`ssh_v1`と`pull_v2`が同時に実行してはいけません。Control Panelが所有する`execution_host_id`と`ownership_epoch`で実行権をfenceし、active jobがないことを確認してから切り替えます。

## `pull_v2` Host Agentを登録する

Control Panelの **Node登録** でNode typeに`Update Agent`、transportに`pull_v2`を選びます。物理ホストごとに固定Node IDを1つ割り当て、Configurationに表示されたAuto Configure commandを取得します。このcommandは後述のarchive prepareが成功してから対象ホストで実行します。

`pull_v2` Nodeの作成と初回credential発行には`api_tokens.create`、`secrets.update`、`system_updates.execute`が必要です。active Host Agentの専用Runtime Token rotation（stage/cancel/emergency）には旧tokenと新tokenの両方を管理するため、さらに`api_tokens.revoke`を含む4権限すべてが必要です。

```bash
sudo /usr/local/bin/autostream-host-agent configure \
  --panel-url "https://control.example.com" \
  --node "host-agent-tokyo-01" \
  --config "/etc/autostream-host-agent/identity.json"
```

Configure Tokenはargv、環境変数、shell historyへ入れず、promptまたは標準入力から非表示で渡します。生成する`/etc/autostream-host-agent/identity.json`は、次の4項目だけを持つbootstrap identityです。

```json
{
  "panel_url": "https://control.example.com",
  "node_id": "host-agent-tokyo-01",
  "runtime_token": "<NODE_RUNTIME_TOKEN>",
  "service_name": "Tokyo Host Agent"
}
```

許可するキーは`panel_url`、`node_id`、`runtime_token`、`service_name`の4つだけです。次の値を追加しないでください。

- API host、API port、`8090`
- SSH host、SSH port、SSH鍵
- `execution_host_id`、`ownership_epoch`
- target policy、GitHub Release Token
- systemd unit、Docker path、任意command

`execution_host_id`と`ownership_epoch`はControl Panelがtokenとservice bindingから解決するserver-owned値です。Host Agentのconfig、CLI、heartbeatで上書きしません。

Host AgentはControl Panelやruntime serviceのinstallerから自動導入されません。
`Kome-Lab/Autostream-ControlPanel`の別の
`autostream-host-agent_v1.9.10_linux_amd64.tar.gz`に、Host Agent、Local
Executor、両方のunitとinstallerが含まれます。archive-only形式では
`artifact-manifest.json`もarchive内部に含まれます。

公開`v1.9.10`のHost Agent archive本体だけを管理端末へdownloadし、そのarchiveの
GitHub Attestationを確認します。古い`v1.9.9`へ読み替えないでください。

```bash
gh release download v1.9.10 --repo Kome-Lab/Autostream-ControlPanel \
  --pattern 'autostream-host-agent_v1.9.10_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-host-agent_v1.9.10_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元`.tar.gz`だけを安全な経路でサーバーの`/tmp`へ転送します。
`.tar.gz.sha256`、`host-agent-manifest.json*`、`release-manifest.json*`は
自動self-updateと旧client互換のrelease assetとして残りますが、手動導入では
downloadもuploadもしません。サーバーではbasenameを変えずroot-owned
directoryへ固定し、元archiveと展開directoryを隣接させます。

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-host-agent_v1.9.10_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-host-agent_v1.9.10_linux_amd64
sudo test ! -L autostream-host-agent_v1.9.10_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-host-agent_v1.9.10_linux_amd64.tar.gz
cd autostream-host-agent_v1.9.10_linux_amd64
```

package済みinstallerは元archive、`artifact-manifest.json`、
`checksums.txt`、architecture、両binaryのversionを検証し、専用の
`autostream-host-agent` user/group、Host Agent、同じreleaseのLocal Executor、
unit、root-owned directoryをprepareします。`--prepare`はidentity、policy、A/B
runtimeがまだないfresh-onlyの導入です。identityとpolicyは作らず、Host Agent、
Local Executor、socketはinactive/disabledのままです。A/B self-updateの期限超過時に
旧healthy slotへ戻せるよう、固定root recovery timerだけはこの時点でenable/start
します。

```bash
sudo ./install/install-autostream-host-agent --prepare
```

既存Host Agentへ`--prepare`を再実行しません。既存identity、policy、active unit、
A/B runtimeがある場合はfail closedで拒否されます。既存Host AgentとLocal
Executorは、ownership、policy、active job、rotation、recovery状態を確認して、
後述の「Host Agent / Local Executorの自己更新」を使います。archive-only初回導入には
`artifact-manifest.json`を含む公開`v1.9.10` releaseを使います。

prepare後に上のAuto Configure commandを実行します。Control Panelは登録済みのpull policyと各systemd targetの`applied` endpoint/config stateからcanonical Local Executor policyを生成します。clientはroot path、unit、command、digestを指定できません。Docker authorityはAuto Configureで生成せず、Docker targetを含む自動projectionはfail closedです。Dockerは別途root所有の固定policyと承認済みfrozen Compose baselineを準備します。Configureは次を1つのtransactionとして扱います。

1. 実在する非root `autostream-host-agent`のUID/GIDと固定protocolをstage requestへ結び付ける。
2. `/opt/autostream/local-executor/ports`へ対象systemd serviceのsidecarがなければ生成する。
3. `/etc/autostream-local-executor/policy.json`と`/etc/autostream-host-agent/identity.json`の4項目identityをatomicにinstallする。
4. installed bytes、policy SHA-256、source/projection/executor policy revisionを再検証してactivationする。

sidecarは次の固定pathのうち、policyに含まれるtarget分だけです。

| service | sidecar |
| --- | --- |
| Worker | `/opt/autostream/local-executor/ports/worker.env` |
| Encoder Recorder | `/opt/autostream/local-executor/ports/encoder-recorder.env` |
| Discord Bot | `/opt/autostream/local-executor/ports/discord-bot.env` |
| Observability | `/opt/autostream/local-executor/ports/observability.env` |

各sidecarはservice固有のbind変数と`AUTOSTREAM_CONFIG_REVISION`だけを持つ正確な2行、`root:root 0600`です。directoryは`root:root 0700`です。既存sidecarが1 byteでもcanonical policyと異なる場合は上書きせず失敗します。old client、rootのAgent UID/GID、runtime state不足、stage/activate間のbinding変更も拒否します。

Configure成功後にLocal ExecutorとHost Agentを起動します。

```bash
sudo ./install/install-autostream-local-executor \
  --policy /etc/autostream-local-executor/policy.json
sudo systemctl enable --now autostream-host-agent.service
sudo systemctl status autostream-host-agent.service
sudo systemctl status autostream-local-executor.socket
sudo systemctl status autostream-local-executor.service
```

このfilesystem transactionのpure Go/HTTP testはありますが、実root Linuxでの初回configure/rollbackはまだ検証していません。管理端末で元archiveのAttestationを確認し、サーバー側installerによる`artifact-manifest.json`と内部checksum検証が成功した場合だけ続行してください。自動self-update用の外部manifest/checksum、公開release asset、本番canaryが存在・成功することは、この文書だけでは証明できません。

導入後は次を確認します。

```bash
sudo systemctl status autostream-host-agent.service
sudo -u autostream-host-agent \
  /usr/local/bin/autostream-host-agent validate-config \
  --config /etc/autostream-host-agent/identity.json
sudo ss -lntup
```

Host Agentがlistening socket一覧に出ないことを確認します。systemd unitの`SocketBindDeny=any`を弱めないでください。

`/etc/autostream-host-agent/identity.json`が唯一のcanonical identityです。`/etc/autostream`は通常serviceのsecret境界なので`root:root 0750`を維持し、Host Agent userへdirectory traverse権限を恒久付与しません。legacy `/etc/autostream/host-agent.json`はcanonical不在時だけのread-only fallbackです。

非root Agentは、canonical identityのowner、group、mode、regular-file条件と4項目JSONを安全に読み終えた後に限り、`/etc/autostream`をtraverseできないためlegacy probeが`EACCES`になってもcanonicalを使用できます。canonicalがない状態でlegacyが見えない場合、legacyが見える状態でcanonicalも存在する場合、またはprobeが`EACCES`以外の予期しないerrorになった場合は、identityを推測せずfail closedです。installerのmanaged migrationはsourceのinode、owner、mode、digestを固定してcanonical pathへinstallし、旧secretをunlinkできない場合はAgentを停止します。

rootでidentityを書く`autostream-host-agent configure`とRuntime Token rotation/recoveryは、書き込み前とatomic replace後の両方でlegacy pathが存在せずdangling symlinkでもないことを確認します。legacyが存在する、検査できない、または書き込み中に現れた場合はcanonicalをactiveにせずfail closedです。新規設定、書き込み、rotationは常にcanonical pathだけを使ってください。

### `v1.9.9`の一時ACLを保持して`v1.9.10`へ更新する {#remove-v199-acl}

この手順は、`v1.9.9` Host Agentと`root:root 0750`の`/etc/autostream`を使うaffected hostだけが対象です。Agentが現在activeでも、exact access-only named ACL `user:autostream-host-agent:--x`を`v1.9.10` upgrade完了まで保持します。`--upgrade`はhealthy A/B runtimeを前提にし、candidateの起動に失敗した場合は旧slotへ戻して`v1.9.9`を再起動するためです。先にACLを削除するとrollback verificationまで失敗します。

管理端末で`v1.9.10` Control Panel / Host Agent archiveとAttestationを確認し、archiveを安全に配置・展開してから、対象hostで次を実行します。最初にinstalled Agentがexact `v1.9.9`であること、canonical identity、legacy pathの通常fileとdangling symlink双方の不在、parentがnon-symlink `root:root 0750` directoryであることを確認します。Ubuntuではbounded bridgeの追加・確認に`acl` packageが必要です。

```bash
set -euo pipefail
sudo /usr/local/bin/autostream-host-agent --version |
  grep -Fx 'autostream-host-agent v1.9.9'
sudo /usr/local/bin/autostream-host-agent validate-config \
  --config /etc/autostream-host-agent/identity.json
sudo test ! -e /etc/autostream/host-agent.json
sudo test ! -L /etc/autostream/host-agent.json
sudo test -d /etc/autostream
sudo test ! -L /etc/autostream
sudo env LC_ALL=C stat -c '%F %U:%G %a' -- /etc/autostream |
  grep -Fx 'directory root:root 750'
sudo apt-get update
sudo apt-get install -y --no-install-recommends acl
command -v getfacl
command -v setfacl
sudo getfacl -cp -- /etc/autostream
! sudo getfacl -cp -- /etc/autostream |
  grep -q '^default:user:autostream-host-agent:'
if sudo getfacl -cp -- /etc/autostream |
  grep -q '^user:autostream-host-agent:'; then
  sudo getfacl -cp -- /etc/autostream |
    grep -Fx 'user:autostream-host-agent:--x'
else
  sudo setfacl --modify 'u:autostream-host-agent:--x' -- /etc/autostream
fi
sudo getfacl -cp -- /etc/autostream |
  grep -Fx 'user:autostream-host-agent:--x'
sudo -u autostream-host-agent \
  /usr/local/bin/autostream-host-agent validate-config \
  --config /etc/autostream-host-agent/identity.json
sudo systemctl restart autostream-host-agent.service
sudo systemctl is-active --quiet autostream-host-agent.service
cd /opt/autostream/releases/artifacts/autostream-host-agent_v1.9.10_linux_amd64
sudo ./install/install-autostream-host-agent --upgrade
sudo /usr/local/bin/autostream-host-agent --version |
  grep -Fx 'autostream-host-agent v1.9.10'
sudo /usr/local/libexec/autostream-local-executor --version |
  grep -Fx 'autostream-local-executor v1.9.10'
```

directoryがexact non-symlink `root:root 0750`でない、Host Agentのdefault ACLがある、または既存access ACLがexact `--x`でない場合は、permissionを変更せず停止してください。package repositoryへ到達できない、または`acl` packageの導入が許可されていない場合も、directory modeやgroupを緩めず停止します。

matching `v1.9.10` upgradeが成功した後、削除直前に同じcanonical/legacy/parent/ACL条件を再assertします。exact access ACLだけを削除し、access/defaultどちらにもHost Agent ACLが残っていないことを確認してから、ACLなしの非root validationとAgent restartを行います。

```bash
set -euo pipefail
sudo /usr/local/bin/autostream-host-agent --version |
  grep -Fx 'autostream-host-agent v1.9.10'
sudo /usr/local/libexec/autostream-local-executor --version |
  grep -Fx 'autostream-local-executor v1.9.10'
sudo -u autostream-host-agent \
  /usr/local/bin/autostream-host-agent validate-config \
  --config /etc/autostream-host-agent/identity.json
sudo test ! -e /etc/autostream/host-agent.json
sudo test ! -L /etc/autostream/host-agent.json
sudo test -d /etc/autostream
sudo test ! -L /etc/autostream
sudo env LC_ALL=C stat -c '%F %U:%G %a' -- /etc/autostream |
  grep -Fx 'directory root:root 750'
! sudo getfacl -cp -- /etc/autostream |
  grep -q '^default:user:autostream-host-agent:'
sudo getfacl -cp -- /etc/autostream |
  grep -Fx 'user:autostream-host-agent:--x'
sudo setfacl --remove 'u:autostream-host-agent' -- /etc/autostream
! sudo getfacl -cp -- /etc/autostream |
  grep -Eq '^(default:)?user:autostream-host-agent:'
sudo env LC_ALL=C stat -c '%F %U:%G %a' -- /etc/autostream |
  grep -Fx 'directory root:root 750'
sudo -u autostream-host-agent \
  /usr/local/bin/autostream-host-agent validate-config \
  --config /etc/autostream-host-agent/identity.json
sudo systemctl restart autostream-host-agent.service
sudo systemctl is-active --quiet autostream-host-agent.service
```

`setfacl -b`でACL全体を消さず、`chmod 0751`、`chgrp autostream-host-agent`、Host Agentの通常service groupへの追加、read permission付与を行わないでください。unrelated ACLはoperatorの所有物です。exact named entryをこのworkaroundとして追加・確認できないhostでは削除commandも実行せず停止してください。Ubuntuの`acl` packageはこのbounded `v1.9.9` bridgeとcleanupだけに必要で、Host Agentのruntime dependencyではありません。

## Nodeポートの契約

通常のNode serviceでは、Node登録時に`1024..65535`の任意ポートを指定できます。`pull_v2` Host Agent自身はendpointlessなのでNode portを持ちません。Node登録のPortと旧中央UpdaterのAPI port `8090`は、もともと別用途でした。

| ポート | 用途 | `pull_v2`での扱い |
| --- | --- | --- |
| 通常NodeのPort | Worker等、そのサービス本来のAPI listen endpoint | 任意の`1024..65535`。systemdではポート変更jobで切替可能 |
| Control PanelのPort | Host Agentがoutbound HTTPSで接続する公開origin | 通常はreverse proxyの`443`。Host Agentの受信portではない |
| legacy Updaterの`8090` | `ssh_v1`中央Updaterのloopback status API | `pull_v2`では使用しない。legacy撤去releaseで削除 |
| Local Executor | Host Agentからroot operationを依頼するlocal IPC | TCP portなし。固定Unix socketだけ |

Control Panelは`execution_host_id + network_namespace + protocol + port`で、systemdではservice listen port、Dockerではlocalhost published portの現在値と変更予定値を予約します。Docker advertised/containerだけの変更ではport reservationを増やしません。同一ホスト・同一namespaceの競合、範囲外、stale endpoint revisionを拒否します。別ホストで同じ番号を使うことはできます。

ポートは1つの値で上書きせず、次の3状態を分けて扱います。

| 状態 | 所有者 | 意味 |
| --- | --- | --- |
| `desired` | Control Panel | operatorが次に適用したいhost、port、scheme |
| `applied` | executor | 管理対象systemd endpointまたはDocker port mappingへ最後に適用した値 |
| `reported` | service / Host Agent | heartbeatやprobeで実際に観測したlisten endpoint |

`pull_v2`でactiveなsystemd targetは、Node編集からendpointを直接変更できません。Application Infoの「サービスのポート変更」から独立した`port_reconfigure` jobを作成します。UIはControl Panelが返した`eligible_operations`に`port_reconfigure`がある場合だけ操作を有効にします。

対象はWorker、Encoder Recorder、Discord Bot、Observabilityのsystemd配置です。Local Executorは`/opt/autostream/local-executor/ports`配下の固定sidecarだけをatomicに切り替え、対象unitだけをrestartします。新しいlistener owner、service identity、`/health`、`/updater/version`、config revisionとconfig SHA-256を確認できたときだけ`applied`を進めます。

失敗時は旧sidecar・旧port・旧config revisionへrollbackして再検証します。結果は`applied`、`rolled_back`、`unchanged`、`rollback_failed`のいずれかです。`unchanged`は「旧portが一度も置き換わらなかったことを証明済み」、`rolled_back`は「旧portへ復帰して検証済み」です。どちらもpending endpoint generationを消費し、configは旧値のまま、endpoint revisionだけを単調増加させます。

`rollback_failed`では有効portを推測せず、Local Executorをterminal quarantineにしてapplied overlayを書きません。Control Panelは両方のreservationと`rollback_failed`状態を保持し、別の明示的な復旧で旧sidecar/runtimeを証明するまで新jobを許可しません。通信結果が不明な場合は同じmutationを再送せず、durable journalからreconcileします。applied state保存後にprocessが停止した場合も、reconcileはterminal ledgerだけを修復し、sidecar rewriteやservice restartを繰り返しません。

Docker targetでは、Nodeのadvertised port、hostのlocalhost published port、container listen portを別々に指定する専用`port_reconfigure` jobを使います。対象はWorker、Encoder Recorder、Discord Bot、Observabilityです。advertised portは`1..65535`、published/container portは`1024..65535`で、published hostは`127.0.0.1`固定です。Local Executorは`/opt/autostream/local-executor/docker/ports/<service>.env`の固定port envと承認済みfrozen Compose modelだけを使って対象serviceをrecreateし、container/image/repository identity、Compose revision/digest、env digest、healthを再検証します。失敗または通信結果不明時はdurable ledgerからrollback/reconcileし、同じmutationを再送しません。

Docker port jobは、root所有の固定Docker target policyと承認済みfrozen Compose baselineがすでにactiveで、現在のmappingを完全にprobeできるhostだけで有効です。Auto Configureはsystemd policy/sidecarだけを自動生成し、Node登録値からDocker authorityを推測しません。policy、baseline、mappingのどれかが欠ける、busy、stale、drift、recovery中の場合はfail closedです。

## endpointの意味

systemd、Docker、reverse proxyでは、同じ「ポート」という言葉が別のendpointを指します。

| 構成 | Nodeのdesired endpoint | local listen / applied | 外部公開 |
| --- | --- | --- | --- |
| systemd | Control Panelからserviceへ到達するhostとport | service processのbind addressとport | reverse proxyを使う場合は別endpoint |
| Docker | Control Panelから到達するadvertised host/port | container listen portと`127.0.0.1`のpublished portを別々に管理 | reverse proxyを使う場合はpublished portをoriginにする |
| reverse proxy | 通常はproxyから到達するorigin endpoint | upstreamのhostとport | browser向けHTTPSは通常`443` |

公開HTTPSの`443`はreverse proxyの入口であり、管理対象Node service本来のlisten portではありません。systemdのlisten portとDockerのpublished/container portは`1024..65535`です。Docker advertised portだけは既存の公開/proxy endpointも表せるため`1..65535`ですが、Local Executorがprivileged portへbindしたりreverse proxyを変更したりする意味ではありません。

systemd targetではNode編集を使わず、Application Infoからポート変更jobを開始します。Control PanelとLocal Executorが次を順番に行います。

1. `1024..65535`、endpoint revision、config revision、policy revision、同一host/namespaceの予約を確認する。
2. 変更予定portを`api_pending`として予約し、old/new portとsidecar SHA-256をmutation planへ固定する。
3. root所有sidecarをstageし、対象unitだけをrestartする。
4. listener owner、service identity、health、version、config revision、sidecar bytesを確認する。
5. 成功時だけ新portを`applied`へ昇格し、旧port予約を解放する。失敗時は旧値へrollbackする。
6. Host Agentの次のprobeで`reported`を更新し、driftがないことを確認する。

Docker targetでは専用jobにadvertised、localhost published、container listenの3値を渡し、承認済みfrozen Compose baselineとexact policyを再検証してから切り替えます。画面の`desired` / `applied` / `reported` endpointはadvertised側です。published/containerは、applied endpointとHost Agent probeが一致したverified current mapping、pending job plan、完了履歴のold/new tripleとして確認します。Control Panel自身、Update Agent、固定Docker authorityを持たないhostは対象外です。

reverse proxyの自動書き換えはこのreleaseの対象外です。proxy originをpublished portへ追従させる必要がある場合はoperatorが別手順でNginx/Caddy等を変更し、proxy経由のhealthを確認してください。Docker port jobがreverse proxy設定を変更したと解釈してはいけません。

## availability gateと移行順

| gate | 完了条件 | 現在の扱い |
| --- | --- | --- |
| 1. Bridge contract | `ssh_v1` / `pull_v2`、host ownership、desired/applied/reportedを保存できる | source実装とlocal DB/API testsあり。deploy未確認 |
| 2. Observer導入 | register、heartbeat、policy refresh、exact Local Executor policy/target probe。受信TCPなし | 公開`v1.9.10` releaseあり。実host canary未確認 |
| 3. Local Executor | root executor、Unix socket認証、固定operation、grant、durable recovery | systemd/Docker software updateとsystemd/Docker port operationのsource/tests、Linux container tests、root fixtureあり。実systemd VM canaryは未確認 |
| 4. 更新適用 | `pull_v2`でclaim、stage、grant、apply、report、rollback/reconcile | 公開`v1.9.10` artifactあり。22/8090遮断canary未確認 |
| 5. systemd Port apply | reservation、preflight、`port_reconfigure`、health、rollback、旧port解放 | source/UI/testsあり。実systemd VMでのnon-default port smoke未確認 |
| 6. Agent / Executor自己更新 | 同一releaseの2-slot更新、dedicated directive/grant、Agent heartbeatとExecutor probe、root recovery supervisor、失敗時rollback/reconcile | recovery protocol 2と公開`v1.9.10` artifactあり。実systemd process kill/reboot、amd64/arm64 canaryは未確認 |
| 7. Runtime Token rotation | stage→claim→local ack→staged heartbeat proof→activate→旧token revoke | HTTP/Store/Host Agent/Local Executor sourceとtestsあり。mixed-version実host drillとdeployは未確認 |
| 8. Docker port mapping | advertised、localhost published、container listenを別々にtransactional変更 | source/API/UI/unit testsあり。Docker 29.6.2 / Compose 5.3.1のisolated root DINDで連続変更、実process crash後のfresh-process reconcile、unhealthy rollback、foreign ownerのgrant前拒否を確認。公開imageと実Docker host canaryは未確認 |
| 9. Fleet移行 | host単位canary、Control Panel hostを最後に移行、rollback drill | 公開`v1.9.10`とfleet gate CLIあり。実host canaryとfleet証拠は未検証 |
| 10. Legacy撤去 | 全host移行、active jobなし、SSH鍵/helper/中央Updater/8090を別releaseで撤去 | 未着手 |

Gate 1〜5のsourceが存在しても、Gate 6〜9とrelease proofが完了するまでは本番のownershipを切り替えません。Host Agentを`ownership_epoch=0`のobserverとして並行導入し、SSH経路を残したままreadinessを確認できます。

## ownershipを切り替える

Auto Configureのactivationはidentityとexact Local Executor policyを有効にする処理であり、更新実行権限の切替ではありません。最初のheartbeatでは`ownership_epoch=0`、`observe_only=true`で動きます。

Control Panelの「システム更新」で対象Host Agentの設定を開き、「更新実行権限の切替」が「切替可能」になるまで待ちます。Control Panelは少なくとも次を確認します。

- Host Agentがonlineで、observerとしてepoch `0`を報告している。
- Local Executorがexact policy SHA-256とprojection revisionでprobeに成功している。
- 全targetのservice type、deployment mode、applied endpoint、config revision/SHA-256がpolicyと一致する。
- active job、recovery、別のownership operationがない。
- execution hostの現在ownerが`ssh_v1`で、requestに含めるownership epochが最新である。

「Host Agentへ切り替え」を実行すると、Control Panelはこれらをtransaction内で再検証し、execution hostのownerを`pull_v2`へ変更して正のownership epochを発行します。応答が不明な場合は再クリックせず、最新設定を取得してowner/epochを照合します。Host Agentの次のheartbeatで同じ正のepoch、`mutation_enabled=true`、policy revision一致を確認してからjobを作成します。

## Bridge中にownershipを`ssh_v1`へ戻す

既存hostのcanaryとrollback drillでは、「システム更新」の対象Host Agent設定から「SSH updaterへ戻す」を実行できます。この操作はBridge中だけのreverse CASです。requestから復帰先Updaterを指定することはできず、Control Panelが`pull_v2`切替時に保存したlegacy ownerだけを復元します。

Control Panelはtransaction内で少なくとも次を再検証します。

- execution hostの現在ownerが対象`pull_v2` Host Agentで、ownership epoch、source/projection/local policy revision、local policy SHA-256が画面のexpected値と一致する。
- 保存されたlegacy ownerがactiveな`ssh_v1` Update Agentで、Runtime Tokenに`updates.claim`、`updates.report`、`updates.authorize`がある。
- legacy policyが現在のpull policyの全targetを、同じhost、target、service type、deployment modeで覆う。
- active job、Host Agent自己更新、Runtime Token rotation、recovery、未収束または未失効のmutation grantがない。

成功するとexecution hostのownerはserver保存済み`ssh_v1` ownerへ戻り、ownership epochは1増え、pull Host Agentはobserver epoch `0`になります。応答が不明な場合は操作をretryせず、最新状態を再取得してowner/epochを確認します。UIの確認は破壊的操作用のDanger Confirmであり、staleな確認結果を別epochへ再利用しません。

canaryでは復帰後にlegacy経路で更新可能なことを確認し、同じhostを再度`pull_v2`へ切り替えて、さらに1増えたepochをHost Agent heartbeatが報告するところまで記録します。保存済みlegacy ownerがない新規SSH-free hostや、legacy token/policyが不足するhostではreverse CASはfail closedです。local consoleを含むmanual recoveryへ停止し、復帰先を推測してDBを直接変更しないでください。

公開release、全host roster、phase receipt、systemd/Docker canary、bake、別releaseでのlegacy撤去条件は[Bridge release / fleet移行gate](/runbooks/bridge-release-fleet-gate)に従います。legacy撤去release後は`ssh_v1`への自動復帰を前提にしません。

## 更新jobとrollback

`pull_v2`のsoftware updateは、固定Kome-Lab repositoryの公開immutable releaseを匿名HTTPSで取得します。長期GitHub Release TokenをHost AgentやLocal Executorへ配布しません。

1. Control Panelがtarget、version、deployment mode、ownership epoch、policy revisionをjobへ固定する。
2. Host Agentがmanifest、tag commit、asset/checksum、architecture、digestを検証してstageする。
3. root変更直前にControl Panelが短命・1回限りのmutation grantを発行する。
4. Local Executorがpolicy、plan、session、grantを再検証し、固定targetだけを更新する。
5. listener/container identity、health、versionを確認し、成功結果をdurable journalから報告する。
6. 検証に失敗した場合は旧release/imageへrollbackして旧healthまで確認する。結果が不明な場合はreconcileだけを行い、applyを繰り返さない。

このsource pathのunit/integration testが通っていても、実際の公開releaseと実Linux/Docker canaryは別の証拠です。本番ではavailability tableの未確認gateを残したままownershipを切り替えないでください。

## Runtime Token rotation

`pull_v2` Host Agentに対する旧来の即時Runtime Token再生成はfail closedで拒否され、HTTP `409`の`staged_runtime_token_rotation_required`になります。generic token画面から旧tokenを先に失効させないでください。

通常のrotationは次の順序です。Control Panel側の`staged`、`local_staged`、`heartbeat_proved`、`activated`と、Local Executor側のdurable phaseを混同しないでください。server statusはoperator-visibleな進捗、local phaseはresponse lossや再起動後に同じroot mutationを繰り返さないための証拠です。

1. 管理者が新しいstaged credentialを作成する。
2. 旧tokenで動くHost Agentだけがcredentialを1回だけclaimする。
3. Local Executorが`/etc/autostream-host-agent/identity.staged.json`へ固定された新identityをinstallし、local-stage receiptを返す。
4. Host Agentが旧tokenのheartbeatでreceipt、policy/ownership fenceを報告し、staged tokenで同じbindingのheartbeat proofを送る。
5. serverがactivateしてから、Local Executorがstaged identityを`/etc/autostream-host-agent/identity.json`へatomicに昇格する。旧tokenはこのactivateで失効する。

途中で応答を失った場合はexact claim ID/revisionとdurable claim/root ledgerからreconcileします。同じclaimのresponse-loss replayに限って同じcredentialを再取得できますが、別claimへ再表示せず、同じroot mutationも再実行しません。未claimのstaged credentialはserverだけでcancelできます。claim後は`cancel_requested`となり、Local Executorが`cancel_ready`を永続化してstaged identityを破棄し、Host Agentが旧tokenでcancel ackを返した後にstaged tokenとledgerをretireします。activate済みidentityはcancelでは戻しません。root ledgerで追跡できないcancel requestは推測して処理せず、manual recoveryへfail closedにします。

`emergency-revoke`は指定slotがprevious/stagedのどちらでも両tokenを失効し、Agentをofflineにしてheartbeat/capability/sealed credentialをclearするbreak-glass操作です。`recovery_required=true`になり、次のlocal recoveryが必要です。

1. Control Panelで対象rotationが`emergency_revoked`になり、両tokenが失効したことを確認して`rotation_id`を記録する。
2. secret-safeなmanaged recovery手順で、新しい4項目identityをcanonical `/etc/autostream-host-agent/identity.json`へ`root:autostream-host-agent 0640`でinstallする。Node IDとPanel URLは同じにし、Runtime Tokenはprevious/stagedのどちらとも異なる新tokenを使う。tokenをargv、log、shell historyへ出さない。
3. root ledgerのphaseを確認して、root Local Executorで次を実行する。`claim_prepared`、`cancel_ready`、`activated`、`expired`は即時回復でき、staged fileがない`stage_bound`も即時回復できる。staged fileが存在する`stage_bound`と`staged`、`local_staged`、`proof_ready`はstaged credentialのTTL経過を待つ。

```bash
sudo /usr/local/libexec/autostream-local-executor \
  recover-runtime-credential \
  --rotation-id "<ROTATION_ID>" \
  --confirm-emergency-revoked
```

このcommandはcaller指定path/tokenを受け付けず、固定identity、root ledger、policy SHA-256、host/policy/protocol fence、新identity digestを検証します。`manual_recovered`をdurableに保存してstaged identityをexact-digest wipeした後、Host Agentを新identityで再起動します。Agentはpoll後にUnix socketでfinalizeし、ledger cleanupと次rotationの解放を行います。失敗時にledgerやstaged fileを手動削除しないでください。

legacy read-only fallbackからのrotationは行わず、先にcanonical identityへmanaged migrationしてください。公開`v1.9.10`があってもmixed-version実host drillとdeployは別の証拠なので、これらの証拠なしにproduction-readyとは扱いません。

## Host Agent / Local Executorの自己更新

自己更新は通常のservice updateと別のdedicated directiveです。Control Panelはimmutable release metadataとoperationを固定した短命・1回限りのself-update grantだけを発行し、root Local Executorは固定A/B slot`/opt/autostream/host-agent/slots/{a,b}`へ同じverified Host ReleaseのHost AgentとExecutorをstageします。任意URL、path、unit、commandをpolicyやrequestから指定できません。

自己更新の`recovery_protocol_version=2`はHost Agent capability、Host Release manifest、directive、grant、root plan、durable stateのすべてへexactに結びます。recovery protocol 1やmixed-version bindingはfail closedで拒否し、Control Panelもprotocol 2未満のHost Agentを自己更新readyとして扱いません。

slot stagingはbinaryとmarkerだけでなく、`bin`、temporary slot、`slotsRoot`、新しく作成したstate rootとその親directory entryをfsyncしてから`staged`を確定します。syncまたはrenameに失敗した場合は旧slotを復元します。起動時は安全な単一`.old`だけを復元し、`.new`を回収します。複数・malformed・unsafe・durable stateと矛盾するartifactは自動推測せずmanual recoveryへfail closedにします。

activate、resumed activating、rollback、`current`再構築の前に、slot root、`bin`、2 binary、markerのowner/modeと、generation、version、commit、artifact digest、release binding、4 protocol、2 binary SHA-256、実binaryの`--version`をfresh processで再検証します。`current`を切り替えた後も、新Host Agent heartbeatと新Executor probeがpending generation、release、protocol fenceに一致した場合だけcommitします。途中停止、network loss、activation deadline超過ではdurable stateからreconcileし、pending binary自身はrollbackを抑止できません。

staging検証に失敗した場合は、旧healthy slotへ戻した`stable` stateと`failed_generation`をgrant収束より先に永続化します。そのgenerationへexactに一致する`prepared`、`consumed`、`applied`のstage grantは削除せず、`token_sha256`とexact bindingを保持し、receiptを持たないcredential-free terminal `phase=failed`へ収束させます。fresh processのstatusも同じ収束を完了します。socket response喪失後に同一IPC requestをreplayした場合はgrantを再consume・mutationを再applyせずno-op successを返し、異なるbindingのreplayと矛盾するgrantはfail closedにします。

固定のroot recovery timer/supervisorはhealthy slotのExecutorとAgentを再起動し、unit、PID、`/proc/PID/exe`、`--version`に加えて固定Unix socketへ`root-only watchdog status`を要求します。このRPCはcredentialやmutation payloadを持たず、UID 0だけに許可し、2秒timeoutでdurable state、`current`、Executor version/protocol、no-action状態を照合します。Host Agent UIDからのstatus、root peerからの通常mutation、hung socket、status不一致は拒否し、rollback fenceを解除しません。

自己更新のcancelをRuntime Token rotationのtwo-phase cancelと同じものとして扱いません。terminal cancelを許可するのはjobがqueuedかつstage claim前の場合だけです。stage grantのconsumeは同じdurable transactionでjobを`staging`へ予約してrevisionを進めるため、claim後のcancelはunsupportedとしてfail closedにし、durable reconcile/rollbackへ収束させます。Control Panelが先にterminal cancelへ進んだと推測してはいけません。

公開`v1.9.10` Host Releaseのasset/checksum/attestationはrelease baselineです。一方、対象環境からの実GitHub download、実systemdでのrestart/socket activation/process kill/reboot、amd64/arm64 canary、production deployは別の証拠です。これらの外部availability gateが残るため、公開releaseやfocused testだけで自己更新ready、production-readyと扱わないでください。

## 既存`ssh_v1`環境

`ssh_v1`はBridge期間の互換transportです。既存の中央`autostream-updater`、`/etc/autostream/updater.json`、host別SSH鍵、`autostream-update-host` helper、必要なstatus portは、対象ホストのownershipを`pull_v2`へ安全に切り替えるまで維持します。

新しいHost Agentをinstallしても、legacy資産は自動削除されません。現在の`ssh_v1`更新手順は、そのreleaseに付属する検証済み`README.bootstrap.md`を使用してください。Bridge文書の`pull_v2`設定へlegacyのSSH項目や`8090`をコピーしないでください。

SSH/8090資産を削除する条件は次のすべてです。削除はBridge releaseと同じ変更に含めず、bake期間後の別releaseで行います。

- 全execution hostのownerが`pull_v2`で、正のepochをHost Agentが報告している。
- systemdとDockerのsoftware update、systemd/Docker port apply、強制rollback、process/container再起動、Control Panel outage recoveryを実hostで確認した。
- Host Agent / Local Executor自己更新とRuntime Token rotation drillを確認した。
- active/recovery jobがなく、未移行host inventoryが空である。
- Control Panel host自身を最後に移行し、戻し方を記録した。
- legacy削除後に22/TCPと8090/TCPを閉じたE2Eを再実行した。

## Host Agentを撤去する

Host Agentのlocal purgeだけではControl Panel側のRuntime Tokenは失効しません。撤去は次の順序で行います。

1. 新しいjob、rotation、自己更新を止め、active/recovery stateがないことを確認する。
2. Control Panelで対象NodeのRuntime Tokenをrevokeし、Nodeをdisableまたは削除して、旧tokenが拒否されることを確認する。
3. `uninstall-autostream-local-executor --purge`でLocal Executor、policy、executor stateを先に撤去する。
4. `uninstall-autostream-host-agent --purge`でHost Agent所有のroot recovery timer/template、canonical/staged/legacy identity、state、A/B runtime、専用accountを撤去する。
5. 全ホストのBridge gate完了後、別releaseで中央Updater、helper、SSH鍵、SSH設定、`8090`資産を撤去する。

default uninstallは復旧用identity/stateを保持します。`--purge`はowner、mode、inode、pathを検証し、zero overwriteとfile/directory syncをbest-effortで試した後、identityのunlinkを必須で行います。identityが残ればpurgeは失敗します。unlinkに成功してもSSD、copy-on-write filesystem、snapshot、backup上の物理消去は保証しません。必要な媒体・snapshot廃棄は基盤側の手順で行ってください。

## 運用確認

`pull_v2` Host Agentでは次を確認します。

- Host Agent serviceがnonrootの`autostream-host-agent`で動いている。
- 物理ホスト内にHost Agentが1つだけある。
- Control Panel URLへoutbound HTTPSで到達できる。
- Host Agentが受信TCPを開いていない。
- configが4項目だけで、owner/group/modeが正しい。
- `execution_host_id`、`ownership_epoch`、target policyがconfigにない。
- Local Executor socketが`root:autostream-host-agent 0660`、policyが`root:root 0600`である。
- Host Agent capabilityの`recovery_protocol_version`が`2`で、Control Panelの自己更新minimum recovery protocolと一致する。
- root recovery supervisorのwatchdog statusがUID 0専用・2秒timeoutで成功し、失敗時にrollback fenceを解除していない。
- systemd targetのsidecarが固定path、root所有、正確な2行で、service unitがそのoptional EnvironmentFileを最後に読む。
- Node登録の登録済み一覧にtransport、heartbeat、desired / applied / reported endpointが表示される。Application Infoのversion表示とは分けて確認する。
- observer中はepoch `0`、切替後はControl Panelのexecution host ownerと同じ正のepochを報告する。

更新適用が必要な場合は、対象ホストのactive transportが`ssh_v1`か、検証済み`pull_v2`かを必ず確認します。release、checksum、attestation、canary、rollback drillの証拠がない状態でfleetを切り替えないでください。
