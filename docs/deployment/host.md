# Linuxホストで直接動かす

Docker を使わず、release artifact を Linux サーバーに置いて直接起動する方法です。systemd で常駐させたい場合はこちらを使います。

サービスごとの具体的な配置、env、Control Panel登録、起動確認は [サービス共通の導入と運用](/services/host-operations) から進んでください。

## 用意するもの

- Linux サーバー
- 各サービスの release artifact
- private repo の release artifact を読める GitHub CLI (`gh auth login` 済み)
- manifestとchecksumを検証する`jq`、`sha256sum`
- `.env.example` を元にした env ファイル
- ffmpeg など、サービスごとに必要な host 側パッケージ

インストーラーはservice用の`autostream` OS account、systemd unit、envの
placeholder、data directory、安定した実行pathを配置します。MariaDB、
Encoder Recorder用の`ffmpeg`、reverse proxyなど、host共通の外部packageや
設定は自動で導入しません。

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
  install-autostream-control-panel
  share/autostream-control-panel/   # Control Panel のみ
```

Node Agent の service も同じ形式で、`bin/autostream-discord-bot`、`bin/autostream-encoder-recorder`、`bin/autostream-observability`、`bin/autostream-worker` のように正規コマンド名の実行ファイルが入ります。互換用に旧名 binary が同梱される場合がありますが、Panel の Auto Configure command は `autostream-<service>` を使います。

GitHub Releaseに添付されているarchiveの`.sha256`は、pathを含まないarchive basenameだけを1行で記録します。自動更新対応releaseには`release-manifest.json`とその`.sha256`も添付されます。private repoのrelease assetは生のURLでは`Not Found`になりやすいため、標準手順では`gh release download`を使います。download fileを`/opt/autostream/releases/artifacts/`へ置き、archive sidecarとmanifest sidecarをどちらもそのdirectoryでstrict検証します。

既存のmanual-only releaseに旧形式のsidecarが残っている場合は、そのfileを書き換えず、新しいmanifest付きreleaseを初期managed releaseとして使います。

次はControl Panel amd64版の形です。`vX.Y.Z`だけを実際のrelease versionへ
置き換えて、そのまま上から実行します。

```bash
cd /tmp
gh release download vX.Y.Z --repo Kome-Lab/Autostream-ControlPanel \
  --pattern autostream-control-panel_vX.Y.Z_linux_amd64.tar.gz \
  --pattern autostream-control-panel_vX.Y.Z_linux_amd64.tar.gz.sha256 \
  --pattern release-manifest.json \
  --pattern release-manifest.json.sha256 \
  --clobber
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-control-panel_vX.Y.Z_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/autostream-control-panel_vX.Y.Z_linux_amd64.tar.gz.sha256 /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/release-manifest.json /opt/autostream/releases/artifacts/
sudo install -o root -g root -m 0644 /tmp/release-manifest.json.sha256 /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
gh attestation verify autostream-control-panel_vX.Y.Z_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
gh attestation verify release-manifest.json \
  --repo Kome-Lab/Autostream-ControlPanel \
  --signer-workflow Kome-Lab/Autostream-ControlPanel/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
sudo tar --no-same-owner --no-same-permissions -xzf autostream-control-panel_vX.Y.Z_linux_amd64.tar.gz
cd autostream-control-panel_vX.Y.Z_linux_amd64
sudo ./install-autostream-control-panel
```

Control Panel以外では、最後のcommandをarchiveに入っている
`install-autostream-discord-bot`、`install-autostream-encoder-recorder`、
`install-autostream-observability`、`install-autostream-worker`へ読み替えます。
serviceごとにsource versionは独立しているため、対象repositoryで公開済みの
tagを指定してください。全serviceが同じversionとは限りません。

## 手順

1. releaseから対象serviceの`linux_amd64`または`linux_arm64` artifact、archive sidecar、manifest、manifest sidecarをdownloadします。
2. downloadした4 filesをroot-owned artifact directoryへ固定します。
3. `gh attestation verify`でarchive本体とmanifestの両方を確認します。
4. archiveをroot所有で展開し、そのdirectory直下の`install-autostream-<service>`を`sudo`で実行します。
5. インストーラーがmanifest identityとarchive内`checksums.txt`を照合し、検証済みrelease、rollback用link、systemd unit、env placeholder、data directoryを配置します。
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

## 更新するとき

新規hostでは、物理ホストごとに非rootの`pull_v2` Host Agentを1つ置き、root Local Executorと固定Unix socketで分離します。Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。登録直後はepoch `0`のobserverで、公開releaseと実host canaryを確認した後にだけownershipを切り替えます。systemd/Docker software updateと4 Node serviceの任意port変更はsource実装済みですが、実Linux/Docker gateは未確認です。Docker port変更には事前の固定policyと承認済みCompose baselineが必要で、reverse proxyは自動変更しません。設定とavailability gateは[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

更新適用が必要な既存hostでは、Bridge期間のlegacy `ssh_v1`として中央`autostream-updater`と`autostream-update-host` helperを維持します。どちらも使わず手動更新する場合も、manifest付きreleaseのservice installerを使います。

1. 現在のversionとenvを控えます。
2. serviceを動かしたまま、新しいartifact、sidecar、manifestを取得して検証します。
3. 展開先で`sudo ./install-autostream-<service>`を実行します。インストーラーが検証済みreleaseを配置し、内部linkを切り替えます。この時点では起動中の旧processは変わりません。
4. env fileに新しい必須項目がないか確認し、databaseを持つserviceはbackupします。
5. `systemctl daemon-reload`後にserviceを明示的にrestartします。
6. `MainPID`、`/health`、`/updater/version`、Control Panelで確認します。失敗時はControl Panelのrollbackまたはrelease同梱の回復手順を使い、内部linkを直接編集しません。

## Dockerとの使い分け

まず簡単に試すなら Docker が向いています。既存の Linux 運用や監視に合わせたい場合、または systemd で個別管理したい場合は host 直接起動が向いています。

このページのservice installerが変更するのはhostへ直接配置したsystemd
serviceだけです。Docker Compose、container、image、Docker repositoryは変更しません。
