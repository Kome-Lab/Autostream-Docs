# Linuxホストで直接動かす

Docker を使わず、release artifact を Linux サーバーに置いて直接起動する方法です。systemd で常駐させたい場合はこちらを使います。

サービスごとの具体的な配置、env、Control Panel登録、起動確認は [サービス共通の導入と運用](/services/host-operations) から進んでください。

## 用意するもの

- Linux サーバー
- 各サービスのarchive-only形式のhost release `.tar.gz`
- release artifactを取得し、転送前に確認する管理端末のGitHub CLI
  (`gh auth login`済み)
- サーバー側でarchive内部metadataとchecksumを検証する`jq`、`sha256sum`、`tar`
- `.env.example` を元にした env ファイル
- ffmpeg など、サービスごとに必要な host 側パッケージ

インストーラーはservice用の`autostream` OS account、systemd unit、envの
placeholder、data directory、安定した実行pathを配置します。MariaDB、
Encoder Recorder用の`ffmpeg`、reverse proxyなど、host共通の外部packageや
設定は自動で導入しません。

## release artifact の実際の形

現在のamd64版Host Release archiveは次のとおりです。

- `autostream-control-panel_v1.9.11_linux_amd64.tar.gz`
- `autostream-host-agent_v1.9.11_linux_amd64.tar.gz`
- `autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz`
- `autostream-worker_v1.3.1_linux_amd64.tar.gz`
- `autostream-discord-bot_v1.3.1_linux_amd64.tar.gz`
- `autostream-observability_v1.3.1_linux_amd64.tar.gz`

展開するとarchive名と同じdirectoryが1つ作られ、その中に次のfileが入ります。

```text
autostream-control-panel_v1.9.11_linux_amd64/
  bin/control-panel
  bin/autostream-updater
  systemd/autostream-control-panel.service.example
  .env.example
  artifact-manifest.json
  checksums.txt
  README.install.md
  install-autostream-control-panel
  share/autostream-control-panel/   # Control Panel のみ
```

Node Agent の service も同じ形式で、`bin/autostream-discord-bot`、`bin/autostream-encoder-recorder`、`bin/autostream-observability`、`bin/autostream-worker` のように正規コマンド名の実行ファイルが入ります。互換用に旧名 binary が同梱される場合がありますが、Panel の Auto Configure command は `autostream-<service>` を使います。

archive-only形式では`artifact-manifest.json`がservice、version、commit、
architecture、必要な互換情報をarchive内部に保持し、`checksums.txt`がinstallerを
含む全同梱fileを覆います。手動導入のサーバーへ渡すrelease assetは元の
`.tar.gz`だけです。サーバー上のinstallerは内部metadata、checksum、host
architecture、binary versionを確認し、元archiveのSHA-256を記録します。

GitHub Releaseには自動Updaterと旧clientの互換用として`.tar.gz.sha256`、
`release-manifest.json`、`release-manifest.json.sha256`も引き続き添付します。
自動Updaterはこれらを取得してrelease identityを検証しますが、archive-onlyの
手動導入ではdownloadもサーバーへのuploadもしません。内部checksumだけをGitHub
由来の証明とは扱わず、archive本体のAttestationを管理端末で確認してから安全な
経路で転送します。

既存のimmutableな旧release assetは書き換えません。現在のarchive-only releaseは
Control Panel / Host Agentが`v1.9.11`、runtime serviceが`v1.3.1`です。
componentごとにrepositoryとtagを一致させ、古いreleaseへ読み替えないでください。

管理端末でControl Panel archive本体だけを取得してAttestationを確認します。

```bash
gh release download v1.9.11 --repo Kome-Lab/Autostream-ControlPanel \
  --pattern 'autostream-control-panel_v1.9.11_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-control-panel_v1.9.11_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元archiveだけをサーバーの`/tmp`へ転送します。サーバーではbasenameを
変更せずroot所有directoryへ固定し、archiveを残したまま同じdirectoryへ展開して
installerを実行します。

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-control-panel_v1.9.11_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-control-panel_v1.9.11_linux_amd64
sudo test ! -L autostream-control-panel_v1.9.11_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-control-panel_v1.9.11_linux_amd64.tar.gz
sudo ./autostream-control-panel_v1.9.11_linux_amd64/install-autostream-control-panel
```

全componentのliteral download、Attestation、server-side install commandは
[最初のインストール](/runbooks/first-install)
にあります。既存環境では、下記のbackupを完了してから同じarchiveを決められた順序で
配置します。

## 手順

1. 管理端末で対象serviceのarchive-only `linux_amd64` `.tar.gz`だけをdownloadします。
2. 管理端末でarchive本体のGitHub Attestationを確認し、その元archiveだけを安全な経路でサーバーへ転送します。
3. サーバーでarchive basenameを変更せず、root-owned artifact directoryへ固定します。
4. 元archiveと展開directoryを隣接させてroot所有で展開し、そのdirectory直下の`install-autostream-<service>`を`sudo`で実行します。
5. インストーラーが`artifact-manifest.json`とarchive内`checksums.txt`を照合し、managed release、rollback用link、systemd unit、env placeholder、data directoryを配置します。
6. `/etc/autostream/<service>.env`を実環境に合わせて編集します。既存envは上書きされないため、更新時は新しい`.env.example`と比較します。
7. `systemctl daemon-reload`後、serviceを明示的に起動または再起動します。インストーラー自身はserviceを開始しません。
8. `MainPID`の実行file、`/health`、`/updater/version`、Control PanelのService Healthを確認します。

## ディレクトリ例

- download先: `/opt/autostream/releases/artifacts`
- 実行ファイル: Control Panelは`/usr/local/bin/control-panel`、Node Agentは`/usr/local/bin/autostream-<service>`
- Control Panel web assets: `/usr/share/autostream-control-panel`
- env ファイル: `/etc/autostream/<service>.env`
- 旧direct配置の退避先: `/var/backups/autostream/install-migrations/<service>`
- 録画保存先: `/var/lib/autostream/archives`
- ログ: `journalctl -u <service>`
- systemd unit: `/etc/systemd/system/<service>.service`

内部ではインストーラーが`/opt/autostream/<service>/releases/`と`current`
symlinkを管理し、安定した`/usr/local/bin` pathから現在releaseへ接続します。
Control Panelのweb assetsも同じ方法で`/usr/share/autostream-control-panel`
から現在releaseへ接続します。これらの内部link、digest、markerを手動で作成、
編集しないでください。既存の直接配置binary/web assetsは初回実行時にこの
managed配置へ移行し、既存envは保持します。旧fileの退避先はserviceが書き込む
state directoryの外にあるroot専用directoryです。

サービスごとに置き場所を分けると、更新や停止を個別に行いやすくなります。

## 確認ポイント

- 実行ファイルが起動できる
- env ファイルの読み込みに失敗していない
- systemd のログに secret が出ていない
- Control Panel からサービスが見える
- サーバー再起動後も自動起動する

## サービス別の手順

| サービス | 手順 |
| --- | --- |
| Control Panel | [Control Panelを導入する](/services/control-panel-install) |
| Discord Bot | [Discord Botを導入する](/services/discord-bot-install) |
| Worker | [Workerを導入する](/services/worker-install) |
| Encoder Recorder | [Encoder Recorderを導入する](/services/encoder-recorder-install) |
| Observability | [Observabilityを導入する](/services/observability-install) |

## 既存環境を更新するとき

新規hostでは、物理ホストごとに非rootの`pull_v2` Host Agentを1つ置き、root Local Executorと固定Unix socketで分離します。Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。登録直後はepoch `0`のobserverで、公開`v1.9.11`のAttestationと実host canaryを確認した後にだけownershipを切り替えます。systemd/Docker software updateと4 Node serviceの任意port変更はsource実装済みですが、実Linux/Docker gateは未確認です。Docker port変更には事前の固定policyと承認済みCompose baselineが必要で、reverse proxyは自動変更しません。設定とavailability gateは[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

Host Agent identityはcanonical `/etc/autostream-host-agent/identity.json`だけへ書きます。
`/etc/autostream`は`root:root 0750`を維持し、Host Agent用の恒久ACL、`chmod 0751`、
`chgrp`、通常service groupへの追加を行いません。affected `v1.9.9` hostはcandidate
rollbackで旧Agentを再起動できるよう、exact access-only ACLをmatching `v1.9.11`
upgrade完了まで保持します。upgrade前から
[ACL add-or-verify、matched upgrade、exact cleanup](/operations/system-updates#remove-v199-acl)
を一続きで実行してください。

Control Panel `v1.8.x`またはruntime service `v1.2.x`から更新するときも、
uninstallや設定の作り直しは行いません。更新適用が必要な既存hostでは、Bridge期間の
legacy `ssh_v1`中央`autostream-updater`、各host helper、SSH/必要なstatus portを
維持します。Host Agentを追加してもこれらは自動削除されません。

1. 現在のversion、unitのactive状態、`MainPID`、envとNode
   `config.yml`のowner/mode/digestを控えます。
2. Control PanelとObservabilityは、現在のbackup helperで実database dumpを成功させてからinstallerを実行します。既定database名なら次を使います。

   ```bash
   sudo /usr/local/sbin/autostream-backup-control-panel autostream_control_panel
   sudo /usr/local/sbin/autostream-backup-observability autostream_observability
   ```

   database名を変更している場合は、envの実database名を上の引数へ直接指定します。
3. Control Panel `v1.8.0` / `v1.8.1`とObservability `v1.2.0`のbackup
   credentialは旧`/etc/autostream/mariadb-backup.cnf`にあります。Control Panel
   `v1.8.2`以降とObservability `v1.2.1`以降はcanonical
   `/etc/autostream-local-executor/mariadb-backup.cnf`です。旧pathだけが存在する
   hostでは、新installerを実行する前にowner/modeを確認し、canonical pathが
   未存在の場合だけ次のcopyを行います。

   ```bash
   sudo test "$(sudo stat -c '%U:%G:%a' /etc/autostream/mariadb-backup.cnf)" = "root:root:600" \
     && sudo test ! -e /etc/autostream-local-executor/mariadb-backup.cnf \
     && sudo install -d -o root -g root -m 0700 /etc/autostream-local-executor \
     && sudo install -o root -g root -m 0600 /etc/autostream/mariadb-backup.cnf /etc/autostream-local-executor/mariadb-backup.cnf
   ```

   両方が存在する場合は上書きせず、内容と使用中helperを確認します。
4. 公開`v1.9.11` / `v1.3.1`を管理端末で次の順に取得します。
   shellのversion変数や外部sidecarは使いません。

   ```bash
   gh release download v1.3.1 --repo Kome-Lab/Autostream-Encoder-Recorder \
     --pattern 'autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz' \
     --clobber
   gh attestation verify autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz \
     --repo Kome-Lab/Autostream-Encoder-Recorder \
     --signer-workflow Kome-Lab/Autostream-Encoder-Recorder/.github/workflows/release-host.yml \
     --deny-self-hosted-runners

   gh release download v1.3.1 --repo Kome-Lab/Autostream-Worker \
     --pattern 'autostream-worker_v1.3.1_linux_amd64.tar.gz' \
     --clobber
   gh attestation verify autostream-worker_v1.3.1_linux_amd64.tar.gz \
     --repo Kome-Lab/Autostream-Worker \
     --signer-workflow Kome-Lab/Autostream-Worker/.github/workflows/release-host.yml \
     --deny-self-hosted-runners

   gh release download v1.3.1 --repo Kome-Lab/Autostream-DiscordBot \
     --pattern 'autostream-discord-bot_v1.3.1_linux_amd64.tar.gz' \
     --clobber
   gh attestation verify autostream-discord-bot_v1.3.1_linux_amd64.tar.gz \
     --repo Kome-Lab/Autostream-DiscordBot \
     --signer-workflow Kome-Lab/Autostream-DiscordBot/.github/workflows/release-host.yml \
     --deny-self-hosted-runners

   gh release download v1.3.1 --repo Kome-Lab/Autostream-Observability \
     --pattern 'autostream-observability_v1.3.1_linux_amd64.tar.gz' \
     --clobber
   gh attestation verify autostream-observability_v1.3.1_linux_amd64.tar.gz \
     --repo Kome-Lab/Autostream-Observability \
     --signer-workflow Kome-Lab/Autostream-Observability/.github/workflows/release-host.yml \
     --deny-self-hosted-runners

   gh release download v1.9.11 --repo Kome-Lab/Autostream-ControlPanel \
     --pattern 'autostream-control-panel_v1.9.11_linux_amd64.tar.gz' \
     --clobber
   gh attestation verify autostream-control-panel_v1.9.11_linux_amd64.tar.gz \
     --repo Kome-Lab/Autostream-ControlPanel \
     --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
     --deny-self-hosted-runners
   ```

   Attestationに成功した元`.tar.gz`だけを対応するservice hostの`/tmp`へ転送します。
5. 対象hostで元archiveをroot-owned directoryへ固定し、次の順序でinstallerを
   実行します。serviceが別hostにある場合も、Encoder/Recorderの確認を終えてから
   Worker、Discord Bot、Observabilityへ進み、Control Panelを最後に配置します。

   ```bash
   sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
   sudo install -o root -g root -m 0644 /tmp/autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
   sudo install -o root -g root -m 0644 /tmp/autostream-worker_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
   sudo install -o root -g root -m 0644 /tmp/autostream-discord-bot_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
   sudo install -o root -g root -m 0644 /tmp/autostream-observability_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
   sudo install -o root -g root -m 0644 /tmp/autostream-control-panel_v1.9.11_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
   cd /opt/autostream/releases/artifacts

   sudo test ! -e autostream-encoder-recorder_v1.3.1_linux_amd64
   sudo test ! -L autostream-encoder-recorder_v1.3.1_linux_amd64
   sudo tar --no-same-owner --no-same-permissions -xzf autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz
   sudo ./autostream-encoder-recorder_v1.3.1_linux_amd64/install-autostream-encoder-recorder

   sudo test ! -e autostream-worker_v1.3.1_linux_amd64
   sudo test ! -L autostream-worker_v1.3.1_linux_amd64
   sudo tar --no-same-owner --no-same-permissions -xzf autostream-worker_v1.3.1_linux_amd64.tar.gz
   sudo ./autostream-worker_v1.3.1_linux_amd64/install-autostream-worker

   sudo test ! -e autostream-discord-bot_v1.3.1_linux_amd64
   sudo test ! -L autostream-discord-bot_v1.3.1_linux_amd64
   sudo tar --no-same-owner --no-same-permissions -xzf autostream-discord-bot_v1.3.1_linux_amd64.tar.gz
   sudo ./autostream-discord-bot_v1.3.1_linux_amd64/install-autostream-discord-bot

   sudo test ! -e autostream-observability_v1.3.1_linux_amd64
   sudo test ! -L autostream-observability_v1.3.1_linux_amd64
   sudo tar --no-same-owner --no-same-permissions -xzf autostream-observability_v1.3.1_linux_amd64.tar.gz
   sudo ./autostream-observability_v1.3.1_linux_amd64/install-autostream-observability

   sudo test ! -e autostream-control-panel_v1.9.11_linux_amd64
   sudo test ! -L autostream-control-panel_v1.9.11_linux_amd64
   sudo tar --no-same-owner --no-same-permissions -xzf autostream-control-panel_v1.9.11_linux_amd64.tar.gz
   sudo ./autostream-control-panel_v1.9.11_linux_amd64/install-autostream-control-panel
   ```

   各hostでは実際に配置しているserviceのarchive commandだけを実行します。
6. installerは既存envをbyte-for-byteで保持し、Node `config.yml`を変更しません。
   managed `current`を切り替えても、起動中の旧`MainPID`とprocessはこの時点では
   変わりません。binary更新とport/config revision変更を同時に行わず、
   Control Panelと通常のNode serviceで`AUTOSTREAM_BIND_ADDR`がない旧構成、
   Observabilityで`OBSERVABILITY_BIND_ADDR`がない旧構成は、いずれも従来の
   `127.0.0.1:8080`を維持します。
7. `.env.example`と既存envを比較し、必要な設定だけを別の変更として反映します。
   Control Panel `v1.8.0` / `v1.8.1`では新processの初回起動時にdatabase
   migration 059が適用されます。`v1.8.2`には既に059があります。
8. runtime serviceを1つずつ明示的にrestartします。各commandの直後に、その
   serviceの既存設定portで`/health`と`/updater/version`、新しい`MainPID`の
   実行file、`--version`を確認し、成功してから次へ進みます。

   ```bash
   sudo systemctl restart autostream-encoder-recorder
   sudo systemctl restart autostream-worker
   sudo systemctl restart autostream-discord-bot
   sudo systemctl restart autostream-observability
   ```

   各hostでは実際に配置したunitのcommandだけを実行します。
9. runtime serviceがすべて正常であることを確認してからControl Panelを最後に
   restartします。Control Panel `v1.8.0` / `v1.8.1`からの更新では、この起動で
   migration 059が適用されます。

   ```bash
   sudo systemctl restart autostream-control-panel
   ```

10. Control Panelも`systemctl status`、新しい`MainPID`の実行file、`--version`、
   既存設定portの`/health`と`/updater/version`を確認します。最後にControl Panelの
   Service Healthと短いテスト配信を確認します。

installer実行中の失敗は同じtransaction内で旧配置へ戻しますが、installer成功後の
service restartやhealth失敗は自動rollbackされません。Control Panelのrollbackまたは
release同梱の回復手順を使い、内部`current`を直接編集しません。database migration
後にpre-059 Control Panelへ戻す場合は、全Control Panel writerを止めた
single-writer手順とdatabase backup/restore判断が必要です。旧binaryを新しい
System Updates policyのwriterとして動かさないでください。

Host Agentの`install-autostream-host-agent --prepare`はidentity、policy、A/B
runtimeがないfresh host専用です。既存Host Agentへ再実行せず、既存Agent /
Local ExecutorはControl Panelの専用self-updateまたは検証済みHost Agent archiveの
manual upgradeで更新します。fresh hostでもservice archiveとは別のHost Agent
archiveを使い、物理ホストごとに1つだけ導入します。

manual upgradeは、上の手順でControl Panel `v1.9.11`を導入・再起動し、Panelの
`/updater/version`が`v1.9.11`になった後だけ実行します。通常hostは次です。

```bash
sudo /opt/autostream/releases/artifacts/autostream-host-agent_v1.9.11_linux_amd64/install/install-autostream-host-agent --upgrade
```

Panel更新が`99%`の`inspecting interrupted host update state without reapplying`で止まった場合は、installed Agent / Executorが同じexact `v1.9.9` pairまたは同じexact `v1.9.10` pairで、installerがexact active jobを証明できるhostに限り、通常commandの代わりに次を1回実行します。

```bash
sudo /opt/autostream/releases/artifacts/autostream-host-agent_v1.9.11_linux_amd64/install/install-autostream-host-agent --upgrade --recover-active-job
```

manual upgradeとrescue modeは既存identity/policyを保持するためConfigure Tokenを使いません。rescueはdurable stateのreconcileとexact terminal reportだけを行います。rescue modeは再stage・再applyしません。journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。systemd conditionを回避しないでください。fail closedになったら表示されたerrorを保存して停止します。詳細は[既存Host Agent / Local Executorを`v1.9.11`へ更新する](/operations/system-updates#upgrade-host-agent-v1911)を参照してください。

## Dockerとの使い分け

まず簡単に試すなら Docker が向いています。既存の Linux 運用や監視に合わせたい場合、または systemd で個別管理したい場合は host 直接起動が向いています。

このページのservice installerが変更するのはhostへ直接配置したsystemd
serviceだけです。Docker Compose、container、image、Docker repositoryは変更しません。
