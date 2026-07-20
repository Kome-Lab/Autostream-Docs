# サービス共通の導入と運用

このページは、AutoStream の各サービスを Linux サーバーで動かすときに共通する考え方です。個別のサービス手順を読む前に、ここで置き場所、token の扱い、起動確認、更新方法を揃えてください。

導入後の日常運用で「どのサービスが何を担当するか」を確認したい場合は、[各サービスの使い方](/services/runtime-usage)を先に読むと全体像をつかみやすくなります。

## どのサービスにも共通するもの

| 項目 | 使い方 |
| --- | --- |
| 実行ファイル | release内ではControl Panelは`bin/control-panel`、Node Agentは`bin/autostream-<service>`です。systemdは`/opt/autostream/<service>/current/bin/...`から実行します |
| env ファイル | `.env.example` を元に `/etc/autostream/<service>.env` を作ります |
| systemd unit | `systemd/*.service.example` を元に `/etc/systemd/system/` へ置きます |
| Node ID | Control Panel と各サービスを対応させる固定 ID です |
| Node Agent config | Panel が生成する `/etc/autostream-<service>/config.yml` です。Worker / Encoder Recorder では stream ingest signing key も含みます |
| Node Runtime Token | `config.yml` に入る token です。登録、heartbeat、runtime config、Panel から Node への操作に使います |
| Node Agent API | Host、Port、SSL から Panel が組み立てる API URL です |

新規構成では `SERVICE_ID`、`SERVICE_PUBLIC_URL`、`CONTROL_PANEL_TOKEN`、Node側の `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` を env に手入力しません。Control Panel の Node登録で `config.yml` を生成し、各サービスは `AUTOSTREAM_NODE_CONFIG` でそのファイルを読みます。古い `SERVICE_CALL_TOKEN` / `SERVICE_CONTROL_TOKEN_SHA256` とNode側の署名鍵envは移行中の fallback としてだけ使います。

## token の生成と入力先

生成方法は [秘密情報とtoken生成](/security/tokens) にまとめています。ここでは、各 service で必要になる値だけを確認します。

| service | 手生成する値 | 入力先 |
| --- | --- | --- |
| Control Panel | `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_SETUP_TOKEN`、`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Control Panel env |
| Observability | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Observability env。Control Panel からの API 呼び出しは登録済み Observability Node の Runtime Token を使います |
| Encoder Recorder | なし | signing key と Node Runtime Token は Control Panel が `config.yml` に配布します |
| Worker | なし | signing key と Node Runtime Token は Control Panel が `config.yml` に配布します |
| Discord Bot | なし | Node Runtime Token は `config.yml`、Discord Bot token は Control Panel の Discord Settings に保存します |
| 中央Update Agent | なし | 1つのNode Runtime Tokenとprivate release用GitHub tokenを中央`/etc/autostream/updater.json`だけに保存します |
| 管理対象host helper | なし | Runtime Tokenなし。release tokenと90秒のmutation grantはSSH RPCで一時受信し、保存しません |

Node Runtime Token と Configure Token は Node登録で生成されます。紛失した場合は Control Panel の Node登録 Configuration から再生成し、通常serviceは`config.yml`、中央Update Agentは中央`updater.json`の`runtime_token`を更新してください。管理対象host helperには再生成対象のtokenがありません。

## 推奨ディレクトリ

| 用途 | 例 |
| --- | --- |
| 検証済みrelease | `/opt/autostream/<service>/releases/<version>-<digest12>` |
| 現在release | `/opt/autostream/<service>/current`から検証済みreleaseへのsymlink |
| 互換コマンド | `/usr/local/bin/control-panel`または`/usr/local/bin/autostream-<service>`から`current/bin/...`へのsymlink |
| env | `/etc/autostream/<service>.env` |
| Node config | `/etc/autostream-<service>/config.yml` |
| service作業領域 | `/var/lib/autostream/<service>` |
| 録画保存先 | `/var/lib/autostream/archives` |
| Control Panel web assets | `/opt/autostream/control-panel/current/share/autostream-control-panel` |
| systemd unit | `/etc/systemd/system/autostream-<service>.service` |
| 中央Updater設定 / state | `/etc/autostream/updater.json` / `/var/lib/autostream-updater` |
| remote helper / root policy / state | `/usr/local/libexec/autostream-update-host` / `/etc/autostream/update-host.json` / `/var/lib/autostream-update-host` |

env ファイルと Node Agent の `config.yml` には実値が入るため、権限は `0640` 程度にし、Git 管理しないでください。

## 最初に作るOSユーザー

全サービスを同じ専用ユーザーで動かす場合は、次のようにします。

```bash
sudo useradd --system --home /var/lib/autostream --shell /usr/sbin/nologin autostream
sudo install -d -o autostream -g autostream /var/lib/autostream
sudo install -d -o root -g root /etc/autostream
```

既に同等のユーザーを作っている場合は作り直す必要はありません。

## release artifact の使い方

GitHub Release の host artifact は、archive の中に `bin/` が直接入るのではなく、archive 名と同じ top-level directory を 1 つ含みます。たとえば Control Panel の amd64 版は次の形です。

```text
autostream-control-panel_vX.Y.Z_linux_amd64/
  bin/control-panel
  bin/autostream-updater
  systemd/autostream-control-panel.service.example
  .env.example
  checksums.txt
  README.install.md
  share/autostream-control-panel/
```

GitHub Releaseに添付されているarchiveの`.sha256`は、pathを含まないarchive basenameだけを1行で記録します。downloadしたarchiveとchecksum fileを同じ`artifacts/` directoryに置き、そこでstrict検証します。自動更新対応releaseでは、さらに`release-manifest.json`と`release-manifest.json.sha256`を取得し、manifest sidecar、manifest内のartifact digest、archive内`checksums.txt`の3段階を検証します。private repoのrelease assetは生のURLでは`Not Found`になりやすいため、`gh auth login`済みのGitHub CLIを使います。

Worker `v1.0.16`など既存のmanual-only releaseでsidecarが`artifacts/<asset>`を記録している場合は、fileを書き換えず`/opt/autostream/releases`から検証します。この旧形式はUpdater対象にせず、canonical basename sidecarとimmutable manifestを持つ新releaseへ移行します。

```bash
AUTOSTREAM_VERSION=vX.Y.Z
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
SERVICE_ARTIFACT=autostream-control-panel_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}.tar.gz

sudo install -d -o "$USER" -g "$USER" -m 0755 /opt/autostream/releases/artifacts
cd /opt/autostream/releases
gh release download "${AUTOSTREAM_VERSION}" \
  --repo Kome-Lab/Autostream-ControlPanel \
  --pattern "${SERVICE_ARTIFACT}" \
  --pattern "${SERVICE_ARTIFACT}.sha256" \
  --pattern release-manifest.json \
  --pattern release-manifest.json.sha256 \
  --dir artifacts \
  --clobber
(cd artifacts && sha256sum --check --strict "${SERVICE_ARTIFACT}.sha256")
(cd artifacts && sha256sum --check --strict release-manifest.json.sha256)
tar -xzf "artifacts/${SERVICE_ARTIFACT}" -C /opt/autostream/releases
cd "/opt/autostream/releases/${SERVICE_ARTIFACT%.tar.gz}"
```

その後はarchive同梱の`README.install.md`に従います。READMEはmanifest内のservice、source version、asset名、digestを照合し、次を一続きで行います。

1. archive外側、manifest、archive内fileのchecksumを検証します。
2. `/opt/autostream/<service>/releases/<version>-<digest12>`へroot所有で展開し、`.artifact-sha256`と`.version`を作ります。
3. binaryの`--version`を実際のservice userで確認し、`current` symlinkを原子的に切り替えます。
4. `.env.example`とsystemd unitを配置します。unitは`current/bin/...`、Control Panelのweb directoryは`current/share/...`を参照します。
5. 起動後にsystemdの`MainPID`が`current`配下のbinaryを実行していることを確認します。

Node Agentでは、envの待受address、local保存先などhost固有値だけを確認します。Observabilityだけはこれに加えて`DATABASE_URL`と`AUTOSTREAM_SECRET_ENCRYPTION_KEY`が必要です。Node ID、Control Panel URL、Node Runtime Token、stream ingest署名鍵はenvへ入力せず、Control Panelが表示するAuto Configureコマンドを対象hostで一度実行します。

WorkerもGitHub Release assetが公開されています。`v1.0.16`ではLinux amd64/arm64 archiveを手動導入に利用できますが、immutableなmanifestがないためUpdater管理には使いません。自動更新を有効にする初期releaseには、新しく公開されたmanifest付きreleaseを選びます。各repositoryのsource versionは独立しているため、ほかのserviceと同じtagがあると仮定せず、対象repositoryのrelease tagを指定してください。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-<service>
sudo systemctl status autostream-<service>
```

`AUTOSTREAM_NODE_CONFIG` が指す `config.yml` をまだ作っていない場合、Node Agent は起動を続けて `node config pending: waiting for .../config.yml` を出します。Auto Configure コマンドで `config.yml` を作成した後、Worker、Encoder Recorder、Discord Bot は登録、heartbeat、runtime config の初期読込をそろえるため `sudo systemctl restart autostream-<service>` を実行します。Observability は起動中に `config.yml` を再読込して登録を開始します。

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

中央管理ホストへ常駐`autostream-updater`を1つ配置し、各hostへ非常駐`autostream-update-host` helperを一度だけbootstrapした環境では、Application Infoからbackup、checksum検証、停止、適用、health確認、rollbackを一続きで実行できます。host helperはdaemonではなく、portやRuntime Tokenも不要です。導入方法は[Control Panelからサービスを更新する](/operations/system-updates)を参照してください。

中央Updaterまたは対象hostのhelperを配置していない場合も、manifest付きreleaseに同梱された`README.install.md`を使って手動更新できます。Application Infoの更新候補表示だけは引き続き利用できます。

1. 現在の version と設定を控えます。Node Agent は `autostream-<service> --version`、Control Panel は `control-panel --version` で build version / commit / build date を確認できます。
2. 新しい release artifact を取得します。
3. env に新しい必須項目が増えていないか `.env.example` と比較します。
4. Control PanelまたはObservabilityではdatabaseをbackupします。
5. READMEのchecksum、marker、`current` symlink切替手順を実行します。symlink切替だけでは起動中の旧processは変わりません。
6. `systemctl daemon-reload`後に対象serviceを明示的にrestartします。
7. `MainPID`、`/health`、`/updater/version`、Service Health、短いテスト配信を確認します。

`/usr/local/bin`へbinaryを直接上書きする旧手順は、旧unitを使うmanual-only構成の互換手順です。`current`を参照する新unitはそのcopyを実行しません。既存releaseにmanifestやmarkerを後付けせず、新しいmanifest付きreleaseを初期managed releaseとして導入してください。

新processの起動に失敗した場合は旧releaseへ`current`を戻してrestartし、旧versionのhealthまで確認します。

## よくある失敗

| 症状 | まず確認すること |
| --- | --- |
| 起動直後に終了する | 必須 env、DB接続、`AUTOSTREAM_NODE_CONFIG`、config の `node.type` |
| `node config pending` のまま | Node登録の Auto Configure コマンドを実行したか、保存先が `AUTOSTREAM_NODE_CONFIG` と一致しているか、`root:autostream 0640` で読めるか |
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
