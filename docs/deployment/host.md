# Linuxホストで直接動かす

Docker を使わず、release artifact を Linux サーバーに置いて直接起動する方法です。systemd で常駐させたい場合はこちらを使います。

サービスごとの具体的な配置、env、Control Panel登録、起動確認は [サービス共通の導入と運用](/services/host-operations) から進んでください。

## 用意するもの

- Linux サーバー
- 各サービスの release artifact
- private repo の release artifact を読める GitHub CLI (`gh auth login` 済み)
- manifestとchecksumを検証する`jq`、`sha256sum`
- `.env.example` を元にした env ファイル
- systemd の service example
- ffmpeg など、サービスごとに必要な host 側パッケージ

## release artifact の実際の形

Host Release workflow が作る archive は、`autostream-<service>_<version>_linux_<arch>.tar.gz` です。展開すると archive 名と同じ directory が 1 つ作られ、その中に次のファイルが入ります。

```text
autostream-control-panel_vX.Y.Z_linux_amd64/
  bin/control-panel
  bin/autostream-updater
  systemd/autostream-control-panel.service.example
  .env.example
  checksums.txt
  README.install.md
  share/autostream-control-panel/   # Control Panel のみ
```

Node Agent の service も同じ形式で、`bin/autostream-discord-bot`、`bin/autostream-encoder-recorder`、`bin/autostream-observability`、`bin/autostream-worker` のように正規コマンド名の実行ファイルが入ります。互換用に旧名 binary が同梱される場合がありますが、Panel の Auto Configure command は `autostream-<service>` を使います。

GitHub Releaseに添付されているarchiveの`.sha256`は、pathを含まないarchive basenameだけを1行で記録します。自動更新対応releaseには`release-manifest.json`とその`.sha256`も添付されます。private repoのrelease assetは生のURLでは`Not Found`になりやすいため、標準手順では`gh release download`を使います。download fileを`/opt/autostream/releases/artifacts/`へ置き、archive sidecarとmanifest sidecarをどちらもそのdirectoryでstrict検証します。

Worker `v1.0.16`など既存のmanual-only releaseには、旧形式の`artifacts/<asset>`を記録したsidecarが残る場合があります。そのsidecar自体を書き換えず、archiveとsidecarを`artifacts/`へ置いて親の`/opt/autostream/releases`から検証します。旧形式はUpdaterへ渡さず、新しいmanifest付きreleaseの初期managed releaseにはcanonical basename形式だけを使います。

```bash
VERSION=vX.Y.Z
ARCH=amd64
ASSET="autostream-control-panel_${VERSION}_linux_${ARCH}.tar.gz"
cd /opt/autostream/releases
gh release download "$VERSION" --repo Kome-Lab/Autostream-ControlPanel \
  --pattern "$ASSET" --pattern "$ASSET.sha256" \
  --pattern release-manifest.json --pattern release-manifest.json.sha256 \
  --dir artifacts --clobber
(cd artifacts && sha256sum --check --strict "$ASSET.sha256")
(cd artifacts && sha256sum --check --strict release-manifest.json.sha256)
tar -xzf "artifacts/$ASSET" -C /opt/autostream/releases
cd "/opt/autostream/releases/${ASSET%.tar.gz}"
```

WorkerもGitHub Release assetが公開されています。`v1.0.16`ではLinux amd64/arm64用archiveを手動導入に利用できますが、manifestがないためUpdater管理には使いません。自動更新対応の初期導入では新しいmanifest付きreleaseを選びます。serviceごとにsource versionは独立しているため、対象repositoryで公開済みのtagを指定します。

## 手順

1. releaseから対象serviceの`linux_amd64`または`linux_arm64` artifact、archive sidecar、manifest、manifest sidecarをdownloadします。
2. archive外側とmanifest sidecarを確認します。
3. archive同梱の`README.install.md`に従い、manifest identityとarchive内`checksums.txt`も検証します。
4. root所有の`/opt/autostream/<service>/releases/<version>-<digest12>`へ展開し、markerを作って`current` symlinkを切り替えます。
5. `.env.example`を参考にenvを作り、`current/bin/...`を参照するsystemd unitを配置します。
6. `systemctl daemon-reload`後にserviceを起動します。
7. `MainPID`の実行file、`/health`、`/updater/version`、Control PanelのService Healthを確認します。

## ディレクトリ例

- download先: `/opt/autostream/releases/artifacts`
- 検証済みrelease: `/opt/autostream/<service>/releases/<version>-<digest12>`
- 現在release: `/opt/autostream/<service>/current`
- 実行ファイル: Control Panelは`/opt/autostream/control-panel/current/bin/control-panel`、Node Agentは`/opt/autostream/<service>/current/bin/autostream-<service>`
- env ファイル: `/etc/autostream/<service>.env`
- 録画保存先: `/var/lib/autostream/archives`
- ログ: `journalctl -u <service>`
- systemd unit: `/etc/systemd/system/<service>.service`

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

## 更新するとき

推奨構成では中央管理ホストに常駐`autostream-updater`を1つ置き、各管理対象hostには一度だけ非常駐`autostream-update-host` helperをbootstrapします。Control PanelのApplication Infoから依頼すると、中央UpdaterがSSHで対象hostのhelperを呼びます。Control Panel自身もUpdaterが別processとして残るため停止、切替、再起動できます。設定は[Control Panelからサービスを更新する](/operations/system-updates)を参照してください。

中央Updaterまたはhost helperを導入しない場合も、manifest付きreleaseの`README.install.md`を使って同じ検証済みrelease directoryと`current` symlinkを手動で切り替えます。

1. 現在のversion、`current`のlink先、envを控えます。
2. serviceを動かしたまま、新しいartifact、sidecar、manifestを検証してimmutable release directoryを作ります。
3. env fileに新しい必須項目がないか確認し、databaseを持つserviceはbackupします。
4. markerを確認して`current`を原子的に切り替えます。この時点では起動中の旧processは変わりません。
5. `systemctl daemon-reload`後にserviceを明示的にrestartします。
6. `MainPID`、`/health`、`/updater/version`、Control Panelで確認します。失敗時は旧linkへ戻してrestartし、旧versionのhealthも確認します。

## Dockerとの使い分け

まず簡単に試すなら Docker が向いています。既存の Linux 運用や監視に合わせたい場合、または systemd で個別管理したい場合は host 直接起動が向いています。
