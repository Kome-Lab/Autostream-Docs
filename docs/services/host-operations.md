# サービス共通の導入と運用

このページは、AutoStream の各サービスを Linux サーバーで動かすときに共通する考え方です。個別のサービス手順を読む前に、ここで置き場所、token の扱い、起動確認、更新方法を揃えてください。

導入後の日常運用で「どのサービスが何を担当するか」を確認したい場合は、[各サービスの使い方](/services/runtime-usage)を先に読むと全体像をつかみやすくなります。

## どのサービスにも共通するもの

| 項目 | 使い方 |
| --- | --- |
| 実行ファイル | Control Panelは`/usr/local/bin/control-panel`、Node Agentは`/usr/local/bin/autostream-<service>`です。operatorとsystemdはこの安定したpathを使います |
| env ファイル | installerが`.env.example`から`/etc/autostream/<service>.env`を初回だけ作り、既存fileは保持します |
| systemd unit | installerが`systemd/*.service.example`を`/etc/systemd/system/`へ置きます |
| Node ID | Control Panel と各サービスを対応させる固定 ID です |
| Node Agent config | Panel が生成する `/etc/autostream-<service>/config.yml` です。Worker / Encoder Recorder では stream ingest signing key も含みます |
| Node Runtime Token | `config.yml` に入る token です。登録、heartbeat、runtime config、Panel から Node への操作に使います |
| Node Agent API | Host、Port、SSL から Panel が組み立てる API URL です |

Control PanelのNode登録で`config.yml`を生成し、各サービスは`AUTOSTREAM_NODE_CONFIG`で必ず読みます。identity、rotating Runtime Token、Worker / Encoderの署名鍵はNode configがauthorityです。4種類のruntime Nodeの待受addressとrevisionは`listener.credential: node-listener.json`が選ぶ固定JSONから読みます。共有tokenや待受環境変数へのfallbackはありません。

## token の生成と入力先

生成方法は [秘密情報とtoken生成](/security/tokens) にまとめています。ここでは、各 service で必要になる値だけを確認します。

| service | 手生成する値 | 入力先 |
| --- | --- | --- |
| Control Panel | `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_SETUP_TOKEN`、`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Control Panel env |
| Observability | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Observability env。Control Panel からの API 呼び出しは登録済み Observability Node の Runtime Token を使います |
| Encoder Recorder | なし | signing key と Node Runtime Token は Control Panel が `config.yml` に配布します |
| Worker | なし | signing key と Node Runtime Token は Control Panel が `config.yml` に配布します |
| Discord Bot | なし | Node Runtime Token は `config.yml`、Discord Bot token は Control Panel の Discord Settings に保存します |
| `protocol major 2` Host Agent | なし | 物理ホストごとにAuto Configureで`panel_url`、`node_id`、`runtime_token`、`service_name`だけを`/etc/autostream/updater/agent.yaml`へ生成します |
| root Local Executor | なし | Host Agentと固定Unix socketで分離。policy/grantとgeneric requestにNode Runtime Tokenを含めない。専用credential-stageのprivate Unix socket requestだけがraw tokenをroot境界へ渡し、log/durable request stateへ残さない。rotation/recoveryは固定canonical/staged identity pathだけを読み書きし、caller指定path/tokenは受け付けない |

Node Runtime TokenとConfigure TokenはNode登録で生成されます。通常serviceはConfigurationから`config.yml`を更新します。`protocol major 2` Host Agentの即時Runtime Token再生成は拒否され、staged rotationが必要です。zero-downtime rotationのrelease gateが完了するまでgeneric Rotateで旧tokenを先に失効させません。`execution_host_id`と`ownership_epoch`はserver-ownedであり、configへ入れません。

## 推奨ディレクトリ

| 用途 | 例 |
| --- | --- |
| 安定したコマンド | `/usr/local/bin/control-panel`または`/usr/local/bin/autostream-<service>` |
| env | `/etc/autostream/<service>.env` |
| Node config | `/etc/autostream-<service>/config.yml` |
| service作業領域 | `/var/lib/autostream/<service>` |
| 旧direct配置の退避先 | `/var/backups/autostream/install-migrations/<service>`。service書込範囲外のroot専用directory |
| 録画保存先 | `/var/lib/autostream/archives` |
| Control Panel web assets | `/usr/share/autostream-control-panel` |
| systemd unit | `/etc/systemd/system/autostream-<service>.service` |
| protocol major 2 Host Agent設定 / state | `/etc/autostream/updater/agent.yaml` / `/var/lib/autostream-host-agent` |
| Local Executor policy / state / socket | `/etc/autostream/updater/executor-policy.json` / `/var/lib/autostream-local-executor` / `/run/autostream-local-executor/executor.sock` |
| 4種類のsystemd Nodeのlistener credential | `/opt/autostream/local-executor/ports/<service>.json`。root-owned `0600`、private directory `0700`。unitの`LoadCredential`で`node-listener.json`として渡す |

内部ではinstallerが`/opt/autostream/<service>/releases/`、`current` symlink、
digest、markerを管理します。operatorはこれらを手動で作成、編集せず、
上表の安定したpathだけを使ってください。既存の直接配置binaryやControl Panel
web assetsは初回installer実行時にmanaged配置へ移行し、既存envは保持します。
旧fileの退避先はserviceの作業領域外に置かれます。

env ファイルと Node Agent の `config.yml` には実値が入るため、権限は `0640` 程度にし、Git 管理しないでください。

## OSユーザー

service installerが共通の`autostream` system accountと必要なdirectoryを
idempotentに作成します。事前に手動作成する必要はありません。既存accountが
ある場合は作り直さず、安全に利用できることを確認して保持します。

## release artifact の使い方

GitHub Release の host artifact は、archive の中に `bin/` が直接入るのではなく、archive 名と同じ top-level directory を 1 つ含みます。たとえば Control Panel の amd64 版は次の形です。

```text
autostream-control-panel_v1.9.11_linux_amd64/
  bin/control-panel
  systemd/autostream-control-panel.service.example
  .env.example
  artifact-manifest.json
  checksums.txt
  README.install.md
  install-autostream-control-panel
  share/autostream-control-panel/
```

archive-only形式の手動導入では、サーバーへ転送するrelease assetは元の
`.tar.gz` 1つだけです。`artifact-manifest.json`はservice、version、commit、
architecture、互換情報をarchive内部に持ち、`checksums.txt`はinstallerを含む
同梱fileを覆います。

GitHub Releaseには自動Updaterの検証用としてarchive sidecar、
`release-manifest.json`、manifest sidecarも残ります。自動Updaterはこれらを
取得・検証しますが、手動導入ではdownloadもサーバーへのuploadもしません。
既存のimmutableな旧release assetは書き換えません。以下のapplication archive手順は
公開Control Panel `v1.9.11`とruntime service `v1.3.1`を対象にした版固定の説明です。
これらの公開済みarchiveがv2 listener契約や独立Updaterの条件を満たすという意味ではありません。
v2を導入する前に、その契約を含む新しいimmutable releaseと対応する全componentを検証してください。
Host Agent / Local ExecutorはControl Panel archiveから取得せず、独立Updaterの検証済みreleaseを使います。

管理端末でarchive本体だけをdownloadし、そのarchiveのGitHub Attestationを
確認します。内部checksumはarchive内の整合性確認であり、GitHub由来の真正性は
この転送前確認が担います。

```bash
gh release download v1.9.11 --repo Kome-Lab/Autostream-ControlPanel \
  --pattern 'autostream-control-panel_v1.9.11_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-control-panel_v1.9.11_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

成功した元archiveだけを安全な経路でサーバーの`/tmp`へ転送します。basenameを
変更せずroot-owned directoryへ固定し、元archiveと展開directoryが隣接した状態で
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

ほかのserviceを含むliteral commandは
[最初のインストール](/runbooks/first-install)
にまとめています。service installerは次を一続きで行います。

1. 元archiveを安定して読み取り、`artifact-manifest.json`のservice、source version、asset名、architectureとarchive内fileのchecksum、binary versionを検証し、元archiveのSHA-256を記録します。
2. `autostream` account、検証済みrelease、rollback用の内部linkとmarkerを作ります。
3. `/usr/local/bin`の安定したcommand、systemd unit、env placeholder、data directoryを配置します。
4. Control Panelでは`/usr/share/autostream-control-panel`を、Control PanelとObservabilityでは検証済みbackup executable、backup directory、root-only MariaDB defaults placeholderを配置します。
5. 既存の直接配置はserviceの書込範囲外にある`/var/backups/autostream/install-migrations/<service>`へroot専用で退避し、envは保持します。serviceは開始せず終了します。

Node Agentでは、envの待受address、local保存先などhost固有値だけを確認します。Observabilityだけはこれに加えて`DATABASE_URL`と`AUTOSTREAM_SECRET_ENCRYPTION_KEY`が必要です。Node ID、Control Panel URL、Node Runtime Token、stream ingest署名鍵はenvへ入力せず、Control Panelが表示するAuto Configureコマンドを対象hostで一度実行します。

Control PanelとObservabilityのinstallerはbackup用fileを配置しますが、実際の
MariaDB backup account、password、database grant、database nameは推測しません。
service別READMEに従い、operatorが対話的に設定して実dumpを確認します。

各repositoryのsource versionは独立しているため、ほかのserviceと同じtagがあると
仮定せず、対象repositoryのarchive-only release tagを指定してください。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-<service>
sudo systemctl start autostream-<service>
sudo systemctl status autostream-<service>
```

`AUTOSTREAM_NODE_CONFIG`が指す`config.yml`が未作成・不正ならstartupはfail closedで停止します。Auto Configureで生成・installした後に対象serviceを明示的に起動し、identity probe、登録、heartbeatを確認します。

## 起動後に必ず見る場所

| 確認場所 | 見る内容 |
| --- | --- |
| `systemctl status` | process が起動しているか |
| `journalctl -u <unit>` | env不足、DB接続、token不一致、port競合がないか |
| Control Panel の Service Health | online、heartbeat、Node報告の version / capability / OS / arch |
| Control Panel の Audit Logs | token作成、設定変更、start / stop の履歴 |
| Observability | metric、incident、通知結果 |

systemd が active でも、Control Panel 側で heartbeat が warning / offline なら、`AUTOSTREAM_NODE_CONFIG`、Node ID、Host / Port / SSL、firewall、reverse proxy を確認します。

## 更新方法

新規hostには物理ホストごとに非rootの`protocol major 2` Host Agentとroot Local Executorを1つずつ置きます。Host Agentはoutbound HTTPSだけを使い、受信TCP、`8090`、SSH設定を持ちません。epoch `0`ではobserver、明示的ownership切替後だけjobをclaimします。systemd/Docker software updateとsystemd/Docker port変更のsource実装はありますが、公開releaseと実host canaryは未確認です。導入方法とavailability gateは[システム更新](/operations/system-updates)を参照してください。

service installerはHost Agentを自動導入しません。物理ホストごとに独立UpdaterのAgent / Executorを1組だけ導入します。`--prepare`はfresh hostだけ、既存hostは専用self-updateまたは検証済みinstallerを使います。

独立Updaterの検証済みreleaseでHost Agent / Local Executorを更新します。Control Panelとのprotocol major 2、policy、identity probeの一致が前提です。通常の`--upgrade`は既存identity/policyとRuntime Tokenを保持するためConfigure Tokenは不要です。`--upgrade --recover-active-job`はreleaseが許可したexact pairとactive interrupted jobだけに使います。

rescue modeは再stage・再applyしません。journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。systemd conditionを回避しないでください。完全な前提と順序は[システム更新](/operations/system-updates)を参照してください。

Control Panel `v1.8.x`またはruntime service `v1.2.x`から更新するときは、
[Linuxホストで直接動かす](/deployment/host#既存環境を更新するとき)のdatabase
backupとcredential path移行を先に実行します。更新適用が必要な既存hostでは、
v2では独立Updaterのprotocol major 2だけを使用し、whole-release rollback以外の互換経路は再導入しません。

1. 現在のversion、設定、active状態、`MainPID`を控えます。Node Agentは
   `autostream-<service> --version`、Control Panelは`control-panel --version`で
   build version / commit / build dateを確認できます。
2. 管理端末で新しいarchive本体だけを取得・Attestation確認し、サーバーへ転送します。
3. Control PanelまたはObservabilityでは実database dumpを成功させます。
4. 前節と同じく元archiveを隣接させたまま展開し、
   `sudo ./install-autostream-<service>`を実行します。installerは既存envを
   byte-for-byteで保持し、Node `config.yml`を変更しません。内部linkを
   切り替えても起動中の旧`MainPID`は変わりません。
5. binary更新とport/config revision変更を同時に行わず、envに新しい必須項目が
   ないか`.env.example`と比較します。
6. `systemctl daemon-reload`後に対象serviceを明示的にrestartします。
7. 新しい`MainPID`、`--version`、既存設定portの`/health`と
   `/updater/version`、Service Health、短いテスト配信を確認します。

`/usr/local/bin`へbinaryを直接上書きする旧手順は使いません。新installerが
安定したpathをmanaged releaseへ接続します。既存releaseにmanifestやmarkerを
後付けせず、`artifact-manifest.json`を含む新しいimmutable releaseを初期managed
releaseにしてください。

installer途中の失敗は同じtransaction内で旧配置へ戻しますが、installer成功後の
restart/health失敗は自動rollbackされません。Control Panelのrollbackまたは
release同梱の回復手順を使い、内部`current`を直接編集しません。旧versionの
healthまで確認します。Control Panelのdatabase migration後にpre-059 binaryへ
戻す場合はsingle-writer手順とbackup/restore判断が必要です。

service installerはsystemd host配置だけを対象にします。`ffmpeg`、MariaDB、
reverse proxyなどの外部packageや設定、Docker Compose、container、image、
Docker repositoryは変更しません。

## よくある失敗

| 症状 | まず確認すること |
| --- | --- |
| 起動直後に終了する | 必須 env、DB接続、`AUTOSTREAM_NODE_CONFIG`、config の `node.type` |
| Nodeのstartupが停止する | Node登録のAuto Configureを実行したか、Node configの保存先・owner/mode、`listener.credential`とsystemd `LoadCredential`、固定JSONのservice type / revisionを確認する |
| Service Health に出ない | Node Runtime Token、Control Panel URL、Node ID、名前解決、firewall |
| start / stop が拒否される | Node Runtime Token の rotation 後に `config.yml` を更新したか |
| runtime config が取れない | Node ID、Node type、primary assignment、token scope |
| 本番だけ動かない | `AUTOSTREAM_ENV=production` と必須設定の不足 |
| ログが読みにくい | 文字化けならまず端末やPowerShellの表示エンコードを疑います |

## 次に読むページ

- [Control Panelを導入する](/services/control-panel-install)
- [Discord Botを導入する](/services/discord-bot-install)
- [Workerを導入する](/services/worker-install)
- [Encoder Recorderを導入する](/services/encoder-recorder-install)
- [Observabilityを導入する](/services/observability-install)
