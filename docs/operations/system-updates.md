# Control Panelからサービスを更新する

AutoStreamは、Control Panelの **Application Info** からControl Panel自身と各サービスの更新を依頼できます。常駐するUpdaterは中央管理ホストの`autostream-updater` 1つだけです。各管理対象ホストにUpdater daemonを置く必要はありません。

各ホストでは、最初に一度だけ`autostream-update-host`をbootstrapします。これはprobe、stage、apply、reconcile中だけ動く非常駐helperです。常駐systemd unit、待受port、Node登録、Node Runtime Token、GitHub tokenの保存はありません。applyはSSH切断でも中途半端に終了しないよう、一時的なsystemd workerとして継続する場合があります。

Updaterを導入しない環境でも最新releaseと現在versionの比較はできますが、更新jobは実行できません。

## 配置するもの

| 場所 | 配置するもの | 配置しないもの |
| --- | --- | --- |
| 中央管理ホスト | 常駐`autostream-updater`、Update Agent Node Runtime Token、private release用GitHub token、host別SSH秘密鍵、strict `known_hosts` | root helper、Docker socket、各hostのprivileged path |
| 各管理対象ホスト | 非常駐`autostream-update-host`、root所有target policy、専用SSH user、forced key、exact sudoers、rollback state | Updater daemon、HTTP listener、Node登録、Runtime Token、長期GitHub token |

中央UpdaterとControl Panelを同じホストに置くこともできます。そのホスト自身を更新対象にする場合も、ほかのhostと同じSSH/helper境界を使います。

## 構成とセキュリティ境界

```text
Browser
  -> Control Panel: 更新jobを作成、leaseと90秒grantを発行
       <- 中央autostream-updater: register / heartbeat / host別claim / report
             -> GitHub Release / GHCR: versionとdigestを検証
             -> host-key-pinned SSH: host別key + fixed RPC
                  -> forced command + exact sudoers
                       -> 非常駐autostream-update-host
                            -> root所有update-host.jsonの対象だけを更新
```

- Control Panelと各serviceはroot権限、Docker socket、`systemctl`権限を持ちません。
- 中央UpdaterはControl Panelへ外向きにpollし、管理対象hostへ外向きSSH接続します。Control PanelからUpdaterへ更新commandをpushしません。
- 更新jobが指定できるのは登録済み`target_id`、公開済みversion、`maintenance`または`when_idle`だけです。任意command、unit、path、URL、image repositoryは指定できません。
- 中央`/etc/autostream/updater.json`のhostはSSH identity、targetはidentity fieldだけです。privileged policyは各hostのroot所有`/etc/autostream/update-host.json`だけに置きます。
- SSHはhostごとに異なるEd25519 keyを使い、server host keyを事前に確認してstrict `known_hosts`へ固定します。password、SSH agent、PTY、port forwarding、SCP、SFTP、対話shellは使いません。
- forced commandは次の1つだけです。

  ```text
  /usr/bin/sudo -n /usr/local/libexec/autostream-update-host rpc --config /etc/autostream/update-host.json
  ```

- `SSH_ORIGINAL_COMMAND`はprotocol marker `autostream-update-rpc-v1`との完全一致が必要です。
- private release用GitHub tokenは中央だけに保存します。remote stage中にbounded SSH stdinで一時送信しますが、remote config、state、process引数、logへ保存しません。
- root変更には、job、host、target、現在版、更新先版、remote root policyのconfig digest、deployment mode、operation、plan digest、session、active leaseへ結び付いた有効期間90秒のone-time mutation grantが必要です。helperはservice変更の直前に消費します。
- Control Panelや各service containerへ`/var/run/docker.sock`をmountしません。Docker CLIを使うのは対象hostで実行中のroot helperだけです。

## 事前条件

1. Control Panelがproduction databaseを使用し、system update migration `039`〜`041`が適用済みである。
2. 操作者に`system_updates.read`があり、実行者には`system_updates.execute`もある。
3. Control Panelがprivate releaseを確認する必要がある場合は`AUTOSTREAM_UPDATE_CHECK_TOKEN`を設定している。
4. 中央管理ホストからControl Panel HTTPS、GitHub API、release asset、GHCR、各hostのSSH portへ到達できる。
5. 各管理対象hostからControl Panel HTTPS、GitHub API、release asset、必要ならGHCRへ到達できる。helperはgrant消費とartifact再検証をhost側でも行う。
6. 各hostのsshdがpublic-key認証と標準の`.ssh/authorized_keys`を有効にしている。
7. 各hostがsystemd 236以上で、固定path`/usr/bin/systemd-run`の`--collect`と`--service-type=`を利用できる。apply/reconcileの一時workerに使う。
8. 各targetの`/health`と`/updater/version`を、そのtargetと同じhostのloopbackから取得できる。
9. Control PanelとObservability targetでは、root所有backup commandと実backupを事前に確認している。
10. 最初のmanaged releaseがimmutable manifest、checksum、`.artifact-sha256`、`.version`、`current` linkを持ち、rollbackできる。

manifestがない既存releaseへassetやmanifestを後付けしません。新しいmanifest付きreleaseを発行し、手動でhealthとversionを確認してから最初のmanaged releaseにします。

`/updater/version`を実装していない旧releaseは、最初のmanaged releaseやrollback baselineに使いません。まず全5serviceでendpoint対応releaseを発行し、各hostへ手動で最初のmanaged releaseとして導入します。各serviceの独自loopback portで`/health`と`/updater/version`を確認してから、host helperと中央Updaterを有効化します。Docker bundleもendpoint対応済みの5つのsource versionから再構築します。

Updater helperがtargetの稼働version確認に使う共通endpointは`/updater/version`です。root policyの`version_url`には、同じhostのloopbackにある`http://127.0.0.1:<service-port>/updater/version`を指定します。このendpointは認証なしで埋め込みversionだけを返すため、public reverse proxyではexact pathを遮断し、helperからloopbackへ直接接続します。Control Panelの既存`/version`は認証付きのApplication Info APIのままであり、helperの`version_url`には指定しません。

## 中央Update Agentを1つ登録する

Auto Configure commandを実行する前に、同じControl Panel release同梱の`autostream-updater` binaryへ更新してください。旧Updaterは`updater.json`を自動生成しません。

1. 後述の手順で各管理対象hostへ非常駐helperをbootstrapし、target policyを配置します。
2. Control Panel host releaseと`autostream-updater` binaryを中央管理ホストへ配置します。初期設定はUpdater本体に内蔵されているため、サンプルファイルを手動copyする必要はありません。
3. Control Panelの **Node登録** でNode typeに`Update Agent`を選び、中央Updater用の固定Node IDを決めます。例: `central-updater`。
4. Host、Port、SSLはこれから設定する`updater.json`の`api`と一致させます。同じホストなら`127.0.0.1:8090`、別ホストならTLSを有効にした管理network endpointにします。Auto Configureはこのlocal API設定を変更しません。
5. 作成後のConfigurationに表示されるAuto Configure commandを中央管理ホストで実行します。`updater.json`が存在しない場合は、Updater本体に内蔵された初期設定から自動生成し、安全チェックポイントとして意図的に非ゼロ終了します。サンプルファイルの配置や`--init-from`指定は不要です。この時点ではConfigure Tokenを要求・消費しません。`--init-from PATH`は互換用の明示的なoverrideであり、不正なpathを指定した場合は内蔵設定へfallbackせず失敗します。
6. 生成された設定のGitHub token、API、host inventory、target identity、SSH pathなどのlocal policyを完成させ、同じtoken-free commandを再実行します。promptへConfigure Tokenを貼り付けますが、commandやprocess argvへTokenを含めず、Node Runtime Tokenも手でJSONへ貼り付けません。
7. activation完了後に`validate-config`を通し、成功してから`autostream-updater`を再起動します。

管理対象hostごとにUpdate Agent Nodeを作成しません。`autostream-update-host`には`config.yml`、Configure Token、Runtime Tokenがありません。

Update Agent tokenには`updates.claim`、`updates.report`、`updates.authorize`が必要です。対応前に発行したtokenは、対応Control Panelをdeployした後にConfigure Tokenを再生成し、同じtoken-free Auto Configure command形へ新しいTokenを入力して中央設定へ反映します。

## 旧per-host Updaterから移行する

旧構成ですでに各hostへ`autostream-updater`を置いている場合は、中央方式と同時稼働させません。次の順序で一度だけ移行します。

1. 既存のqueued jobをcancelし、実行中jobを完了させます。reconcile待ちを含むactive jobが1件もないことを確認します。
2. 新しいControl Panelとmigration `039`〜`041`をdeployします。旧`/services/update-jobs/{id}/authorize`はHTTP 410になり、host mappingを報告しない旧Updaterは新しいjobをclaimできません。新しい`autostream-updater` binaryも`hosts`のない旧configでは起動しません。
3. 各管理対象hostへ、この文書の手順で非常駐`autostream-update-host`、forced SSH key、exact sudoers、root policyをbootstrapします。
4. 中央にするhostを1台決め、そこを含む全hostの旧`autostream-updater.service`を停止・disableします。旧configとstateは移行確認が終わるまでrootだけが読める場所へ保全し、旧daemonと中央Updaterを同時稼働させません。
5. 選んだ中央hostへ新しいbinaryを配置し、Update AgentのAuto Configure commandで中央configを自動生成します。local policyへ`hosts`を設定した後、同じtoken-free commandを再実行します。失敗または結果不確定の場合はUpdaterを再起動せず、新しいConfigure Tokenを発行して同じtoken-free commandへ入力し直します。activation成功後に`validate-config`で全hostのrestricted probeを通してから中央serviceを開始します。reachabilityと現在versionがControl Panelに表示されることを確認します。
6. 影響の小さいtargetで試験更新と必要ならreconcileまで確認した後、旧per-host Update Agent NodeのRuntime Tokenを失効させ、旧Node登録、config、unitを撤去します。旧stateは監査・ロールバックに必要な保持期間を過ぎてから削除します。remote helperのroot policy、state、rollback baselineは削除しません。
7. 各管理対象hostで`systemctl list-unit-files 'autostream-update*'`を確認します。常駐してよいのは中央hostの`autostream-updater.service`だけで、`autostream-update-host.service`はどのhostにも存在してはいけません。

移行後、管理対象hostにControl PanelのRuntime Tokenやprivate release用GitHub tokenを残しません。問題が起きた場合も旧per-host Updaterを再起動せず、中央Updaterを停止してから中央の`validate-config`によるrestricted probeとremote root policyを確認します。

## 中央Updaterを配置する

Control Panel host releaseの`README.install.md`には中央Updaterの配置手順が入っています。archive、`release-manifest.json`、sidecar、archive内`checksums.txt`を検証した後に実行してください。

```bash
set -euo pipefail
RELEASE_DIR="$(readlink -f /opt/autostream/control-panel/current)"

getent group autostream-updater >/dev/null 2>&1 || \
  sudo groupadd --system autostream-updater
id -u autostream-updater >/dev/null 2>&1 || \
  sudo useradd --system --gid autostream-updater \
    --home /var/lib/autostream-updater --shell /usr/sbin/nologin \
    autostream-updater
sudo install -d -o autostream-updater -g autostream-updater -m 0700 \
  /var/lib/autostream-updater
sudo install -d -o root -g autostream-updater -m 0750 \
  /etc/autostream/updater /etc/autostream/updater/ssh
sudo install -o root -g root -m 0755 \
  "$RELEASE_DIR/bin/autostream-updater" /usr/local/bin/autostream-updater
sudo test ! -e /etc/autostream/updater/ssh/known_hosts
sudo install -o root -g autostream-updater -m 0640 /dev/null \
  /etc/autostream/updater/ssh/known_hosts
sudo install -o root -g root -m 0644 \
  "$RELEASE_DIR/systemd/autostream-updater.service.example" \
  /etc/systemd/system/autostream-updater.service
```

この配置手順では`updater.json`をcopyしません。後述のtoken-free commandが、ファイル未作成時だけUpdater本体に内蔵された初期設定から安全に自動生成します。既存`updater.json`、SSH key、`known_hosts`はrelease更新でもAuto Configureでも上書きしません。自動生成された内容を確認し、local設定だけを明示的に変更します。Auto Configureが更新するのは`panel_url`、`node_id`、`runtime_token`、`service_name`だけです。`github_token`、`api`、`state_dir`、interval、`hosts`、`targets`、SSH pathなどのlocal policyは変更しません。

### host別SSH keyを作る

管理対象hostごとに別のkeyを作ります。個人用keyやfleet共通keyを流用しません。

```bash
HOST_ID=host-tokyo-01
sudo test ! -e "/etc/autostream/updater/ssh/${HOST_ID}_ed25519"
sudo test ! -e "/etc/autostream/updater/ssh/${HOST_ID}_ed25519.pub"
sudo ssh-keygen -t ed25519 -N '' \
  -C "autostream-update:${HOST_ID}" \
  -f "/etc/autostream/updater/ssh/${HOST_ID}_ed25519"
sudo chown root:autostream-updater \
  "/etc/autostream/updater/ssh/${HOST_ID}_ed25519"
sudo chmod 0640 "/etc/autostream/updater/ssh/${HOST_ID}_ed25519"
sudo chown root:root \
  "/etc/autostream/updater/ssh/${HOST_ID}_ed25519.pub"
sudo chmod 0644 "/etc/autostream/updater/ssh/${HOST_ID}_ed25519.pub"
```

managed hostのSSH server keyはconsoleや独立したinventoryでfingerprintを確認してから、中央の`/etc/autostream/updater/ssh/known_hosts`へ追加します。`ssh-keyscan`の結果を未確認のまま信用したり、`StrictHostKeyChecking=accept-new`を使ったりしないでください。

### managed hostのSSH認証を専用userだけに制限する

installerより前に、各managed hostで`autostream-update-host` userへpublic-key認証だけを許可します。distributionのsshd include設定へ次を追加します。

```text
Match User autostream-update-host
    AuthenticationMethods publickey
    PubkeyAuthentication yes
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AuthorizedKeysCommand none
    AuthorizedKeysFile .ssh/authorized_keys
```

既存console sessionを開いたまま`sshd -t`と、そのhostで使うSSH serviceのreloadを行います。installerは`sshd -T`でeffective設定を再確認し、password/keyboard-interactive、別のAuthorizedKeysCommand、複数のauthorized key source、別のForceCommandが残っていれば失敗します。restricted probeが成功するまでconsole sessionを閉じないでください。

## managed host helper artifactを取得する

helperはControl Panel host archiveとは別のartifactです。対象hostのarchitectureに一致するarchiveを取得します。

```bash
set -euo pipefail
VERSION="${VERSION:?export VERSION=vX.Y.Z}"
ARCH="${ARCH:-amd64}"
ASSET="autostream-update-host_${VERSION}_linux_${ARCH}.tar.gz"
ARTIFACT_DIR="$(mktemp -d)"

gh release download "$VERSION" \
  --repo Kome-Lab/Autostream-ControlPanel \
  --pattern "$ASSET" \
  --pattern "$ASSET.sha256" \
  --pattern update-host-bootstrap-manifest.json \
  --pattern update-host-bootstrap-manifest.json.sha256 \
  --dir "$ARTIFACT_DIR"

(cd "$ARTIFACT_DIR" && sha256sum --check --strict "$ASSET.sha256")
(cd "$ARTIFACT_DIR" && sha256sum --check --strict update-host-bootstrap-manifest.json.sha256)
DIGEST="$(awk 'NR == 1 { print $1 }' "$ARTIFACT_DIR/$ASSET.sha256")"
SIZE="$(stat -c %s "$ARTIFACT_DIR/$ASSET")"
jq -e \
  --arg version "$VERSION" --arg arch "$ARCH" --arg asset "$ASSET" \
  --arg sha "$DIGEST" --argjson size "$SIZE" \
  '.schema_version == 1 and .release_id == $version and
   .channel == "update-host-bootstrap" and .protocol_version == 1 and
   ([.artifacts[] |
     select(.os == "linux" and .arch == $arch and .name == $asset and
            .sha256 == $sha and .size == $size)] | length == 1)' \
  "$ARTIFACT_DIR/update-host-bootstrap-manifest.json"

tar -C "$ARTIFACT_DIR" -xzf "$ARTIFACT_DIR/$ASSET"
RELEASE_DIR="$ARTIFACT_DIR/${ASSET%.tar.gz}"
(cd "$RELEASE_DIR" && sha256sum --check --strict checksums.txt)
```

release promotion時はprovenanceも確認します。

```bash
gh attestation verify "$ARTIFACT_DIR/update-host-bootstrap-manifest.json" \
  --repo Kome-Lab/Autostream-ControlPanel
```

このdownloadと検証は認証済みの管理端末で行います。archive、sidecar、bootstrap manifest、manifest sidecarを管理経路で対象hostへ転送し、host側でも両sidecarと展開後`checksums.txt`を再検証してから、以降の`RELEASE_DIR`を転送先に読み替えます。managed hostで`gh auth login`して長期credentialを残さないでください。Docker baselineで必要なrelease tokenは、後述のone-time標準入力だけで渡します。

archiveには次が入ります。

```text
bin/autostream-update-host
install/install-autostream-update-host
sudoers/autostream-update-host
autostream-update-host.json.example
autostream-update-host.docker-draft.json.example
README.bootstrap.md
checksums.txt
```

## managed hostのroot policyを作る

archiveのexampleをrootだけが読める作業用pathへコピーし、実際にそのhostにあるtargetだけを残します。

```bash
sudo install -d -o root -g root -m 0700 \
  /root/autostream-update-host-bootstrap
sudo install -o root -g root -m 0600 \
  "$RELEASE_DIR/autostream-update-host.json.example" \
  /root/autostream-update-host.json
sudoedit /root/autostream-update-host.json
```

systemd targetの例です。

```json
{
  "schema_version": 1,
  "host_id": "host-tokyo-01",
  "panel_url": "https://panel.example.com",
  "arch": "amd64",
  "state_dir": "/var/lib/autostream-update-host",
  "targets": [
    {
      "target_id": "control-panel",
      "host_id": "host-tokyo-01",
      "service_type": "control_panel",
      "deployment_mode": "systemd",
      "health_url": "http://127.0.0.1:8080/health",
      "version_url": "http://127.0.0.1:8080/updater/version",
      "backup_argv": [
        "/usr/local/sbin/autostream-backup-control-panel",
        "replace-with-control-panel-database-name"
      ],
      "systemd": {
        "systemctl_path": "/usr/bin/systemctl",
        "runuser_path": "/usr/sbin/runuser",
        "smoke_user": "autostream",
        "unit": "autostream-control-panel.service",
        "release_root": "/opt/autostream/control-panel/releases",
        "current_link": "/opt/autostream/control-panel/current",
        "binary_path": "bin/control-panel",
        "required_paths": ["share/autostream-control-panel"]
      }
    }
  ]
}
```

top-levelと全targetの`host_id`は一致させます。`arch`はhelper artifactと実hostに一致させます。`health_url`と`version_url`は同じhostのloopbackだけを指定し、`version_url`のpathは全serviceで`/updater/version`を使います。Control PanelとObservabilityではroot所有`backup_argv`が必須です。配布スクリプトの標準DB名と実際の`DATABASE_URL`のDB名が異なる場合は、上の例のように実DB名を固定第2引数へ指定します。MariaDBの`GRANT`対象、事前の実dump、`backup_argv`の固定第2引数には、`DATABASE_URL`で確認した同一のDB名を必ず使います。DB名は英数字で始まる1〜64文字のASCII英数字・underscore・hyphenだけを許可し、ブラウザやupdate jobから渡しません。

標準systemd targetの対応は次のとおりです。Node serviceの`target_id`はControl Panelに登録したNode IDに合わせます。

| `service_type` | `release_root` / `current_link` | `unit` | `binary_path` |
| --- | --- | --- | --- |
| `control_panel` | `/opt/autostream/control-panel/releases` / `/opt/autostream/control-panel/current` | `autostream-control-panel.service` | `bin/control-panel` |
| `worker` | `/opt/autostream/worker/releases` / `/opt/autostream/worker/current` | `autostream-worker.service` | `bin/autostream-worker` |
| `encoder_recorder` | `/opt/autostream/encoder-recorder/releases` / `/opt/autostream/encoder-recorder/current` | `autostream-encoder-recorder.service` | `bin/autostream-encoder-recorder` |
| `discord_bot` | `/opt/autostream/discord-bot/releases` / `/opt/autostream/discord-bot/current` | `autostream-discord-bot.service` | `bin/autostream-discord-bot` |
| `observability` | `/opt/autostream/observability/releases` / `/opt/autostream/observability/current` | `autostream-observability.service` | `bin/autostream-observability` |

### Docker targetのroot policy

Docker targetも中央設定にはidentityだけを置き、次のfull policyは対象hostの`update-host.json`だけに置きます。

```json
{
  "target_id": "control-panel",
  "host_id": "host-tokyo-01",
  "service_type": "control_panel",
  "deployment_mode": "docker",
  "health_url": "http://127.0.0.1:8080/health",
  "version_url": "http://127.0.0.1:8080/updater/version",
  "backup_argv": [
    "/usr/local/sbin/autostream-backup-control-panel",
    "replace-with-control-panel-database-name"
  ],
  "docker": {
    "docker_path": "/usr/bin/docker",
    "compose_project": "autostream",
    "project_dir": "/opt/autostream",
    "compose_files": ["/opt/autostream/compose.yml"],
    "service": "control-panel",
    "image_repo": "ghcr.io/kome-lab/autostream-docker/control-panel",
    "image_variable": "AUTOSTREAM_DOCKER_VERSION",
    "version_env_file": "/etc/autostream/updater/control-panel.env",
    "compose_config_sha256": "<APPROVED_LOWERCASE_SHA256>",
    "current_version": "<CURRENT_PUBLISHED_BUNDLE_TAG>",
    "channel": "docker"
  }
}
```

`compose_config_sha256`はroot operatorが確認したcanonical Compose modelを固定します。初回bootstrap中の選択targetだけは、draft configで64個の`0`を明示的なsentinelとして使います。通常の`validate-config`、installer、RPCはsentinelを拒否します。`current_version`には現在実行中で、immutable Docker manifestとrollback policyを持つ公開済みbundle tagを指定します。targetごとに別の`version_env_file`を使い、秘密情報を入れません。

Docker targetでは通常exampleではなく、archiveの`autostream-update-host.docker-draft.json.example`からroot所有draftを作ります。対象hostで現在稼働中のcontainer、manifest、platform digest、source version、Compose modelを照合し、target別version envをseedします。private release read tokenは標準入力だけで一時的に渡します。

```bash
set -euo pipefail
TARGET_ID=worker-docker
DRAFT=/root/autostream-update-host.docker-draft.json
ZERO_SHA=0000000000000000000000000000000000000000000000000000000000000000

sudo install -o root -g root -m 0600 \
  "$RELEASE_DIR/autostream-update-host.docker-draft.json.example" "$DRAFT"
sudoedit "$DRAFT"
sudo jq -e --arg target "$TARGET_ID" --arg zero "$ZERO_SHA" \
  '([.targets[] | select(.target_id == $target and .deployment_mode == "docker")] |
    length) == 1 and
   ((.targets[] | select(.target_id == $target))
     .docker.compose_config_sha256 == $zero)' "$DRAFT" >/dev/null

sudo -v
bootstrap_docker_digest() {
  local token
  IFS= read -r -s -p 'One-time GitHub token: ' token </dev/tty
  printf '\n' >&2
  printf '%s\n' "$token" |
    sudo -n "$RELEASE_DIR/bin/autostream-update-host" \
      bootstrap-docker-target --config "$DRAFT" --target "$TARGET_ID"
}

COMPOSE_SHA="$(bootstrap_docker_digest)"
[[ $COMPOSE_SHA =~ ^[0-9a-f]{64}$ && $COMPOSE_SHA != "$ZERO_SHA" ]]
```

tokenをcommand line、config、shell history、root Docker configへ書きません。成功時、標準出力は承認済みlowercase digestだけです。別のfinal fileでsentinelを置換して通常validationを通します。

```bash
USER_STAGE="$(mktemp)"
ROOT_STAGE="$(sudo mktemp /root/.autostream-update-host.json.new.XXXXXX)"
FINAL_CONFIG=/root/autostream-update-host.json
trap 'rm -f "$USER_STAGE"; sudo -n rm -f "$ROOT_STAGE" 2>/dev/null || true' EXIT

sudo jq --arg target "$TARGET_ID" --arg sha "$COMPOSE_SHA" \
  '(.targets[] | select(.target_id == $target)
     .docker.compose_config_sha256) = $sha' "$DRAFT" >"$USER_STAGE"
sudo install -o root -g root -m 0600 "$USER_STAGE" "$ROOT_STAGE"
sudo "$RELEASE_DIR/bin/autostream-update-host" validate-config \
  --config "$ROOT_STAGE"
sudo mv -f "$ROOT_STAGE" "$FINAL_CONFIG"
rm -f "$USER_STAGE"
trap - EXIT
```

bootstrapは検証に成功した場合だけversion envを原子的にseedし、Compose approval digestを出力します。失敗した場合はversion envを元の状態へ戻します。複数Docker targetがある場合は、未承認sentinelを一度に1件だけ置き、digestへ置換してから次をbootstrapします。最終configにはsystemd targetも含められます。digestを手で捏造したり、sentinelをinstallerやruntimeへ残したりしないでください。

private GHCRを使う場合は対象hostのroot Docker credential storeを、read-only package credentialで事前に認証します。credentialをcommand line、JSON、version env、logへ残さずstdinで渡してください。

### rollback baselineを確認する

最初の自動更新前に、systemd targetでは`current`のlink先、`.artifact-sha256`、`.version`、binary、必要asset、実行中MainPIDを照合します。Docker targetでは現在containerのimage ID、RepoDigest、platform、source version、target別version env、承認済みCompose digestを照合します。いずれもmanifest付きreleaseのarchiveにある`README.install.md`とhelper artifactの`README.bootstrap.md`に従い、local binaryや稼働containerからmarkerを捏造しないでください。

## managed hostへ一度だけinstallする

中央で作った、そのhost専用の公開鍵をfileとして用意します。中央Updaterの送信元はnumeric CIDRで制限します。固定addressならIPv4 `/32`またはIPv6 `/128`を推奨します。

```bash
sudo "$RELEASE_DIR/install/install-autostream-update-host" \
  --config /root/autostream-update-host.json \
  --authorized-key /path/to/host-tokyo-01_ed25519.pub \
  --source-cidr 192.0.2.10/32
```

installerはhelper config、Ed25519 key、CIDR、effective sshd config、sudoersを検証し、forced keyを最後に原子的に有効化します。同じconfig、key、CIDRでの再実行は安全です。既存configやkeyが異なる場合は黙って上書きせずfail closedになります。

最終配置は次のとおりです。

```text
/usr/local/libexec/autostream-update-host
/etc/autostream/update-host.json
/etc/sudoers.d/autostream-update-host
/var/lib/autostream-update-host/
/var/lib/autostream-update-host-login/.ssh/authorized_keys
```

remote systemd unitはありません。作成しないでください。

managed host側を確認します。

```bash
sudo /usr/local/libexec/autostream-update-host validate-config \
  --config /etc/autostream/update-host.json
sudo visudo -cf /etc/sudoers.d/autostream-update-host
sudo -l -U autostream-update-host | grep -F SSH_ORIGINAL_COMMAND
sudo stat -c '%U:%G:%a %n' \
  /usr/local/libexec/autostream-update-host \
  /etc/autostream/update-host.json \
  /etc/sudoers.d/autostream-update-host \
  /var/lib/autostream-update-host-login/.ssh/authorized_keys
```

期待するmodeは順に`root:root:755`、`root:root:600`、`root:root:440`、`root:root:644`です。idle中は`autostream-update-host` processもlistening portも存在しません。

## 中央inventoryを設定する

Control Panelで中央Update Agentを1つ作成します。登録済みの場合はConfigure Tokenを再生成し、Configurationに表示された次のtoken-free commandを中央hostで実行します。

```bash
sudo autostream-updater configure \
  --panel-url "https://control.example.com" \
  --node "central-updater" \
  --config "/etc/autostream/updater.json"
```

`updater.json`が存在しない場合、初回実行はUpdater本体に内蔵された初期設定から自動生成し、所有者を`root:autostream-updater`、mode `0640`にした後、安全チェックポイントとして意図的に非ゼロ終了します。Configure Tokenを要求・消費せず、既存の`updater.json`は上書きしません。生成後にGitHub token、API、host/target inventory、SSH pathなどのlocal policyを完成させ、同じtoken-free commandを再実行します。

中央`/etc/autostream/updater.json`は次の形です。自動生成された後、`github_token`、`api`、`state_dir`、interval、`hosts`、`targets`、SSH pathをこのhostの実値へ変更します。先頭の`panel_url`、`node_id`、`runtime_token`、`service_name`は再実行時のAuto Configureが設定するため、Node Runtime Tokenを手で貼り付けません。

```json
{
  "panel_url": "https://panel.example.com",
  "node_id": "central-updater",
  "runtime_token": "<NODE_RUNTIME_TOKEN>",
  "service_name": "Central Updater",
  "github_token": "<PRIVATE_RELEASE_READ_TOKEN>",
  "api": {
    "bind_host": "127.0.0.1",
    "host": "127.0.0.1",
    "port": 8090,
    "ssl_enabled": false
  },
  "state_dir": "/var/lib/autostream-updater",
  "poll_interval_seconds": 15,
  "heartbeat_interval_seconds": 30,
  "hosts": [
    {
      "host_id": "host-tokyo-01",
      "name": "Tokyo Host 01",
      "address": "192.0.2.20",
      "port": 22,
      "user": "autostream-update-host",
      "identity_file": "/etc/autostream/updater/ssh/host-tokyo-01_ed25519",
      "known_hosts_file": "/etc/autostream/updater/ssh/known_hosts",
      "arch": "amd64"
    }
  ],
  "targets": [
    {
      "target_id": "control-panel",
      "host_id": "host-tokyo-01",
      "service_type": "control_panel",
      "deployment_mode": "systemd"
    }
  ]
}
```

- `hosts`は`host_id`、表示名、SSH address/port/user、host別private key、strict `known_hosts`、architectureだけです。
- `identity_file`も実keyもhost間で共有できません。
- `targets`は`target_id`、`host_id`、`service_type`、`deployment_mode`だけです。
- `target_id`は中央inventory全体で一意にします。同じservice typeを複数hostへ置く場合もNode IDを重複させません。
- central targetへhealth URL、unit、path、backup command、Docker/Compose設定を入れると拒否されます。
- 中央とremoteのhost ID、target ID、service type、mode、architectureは完全一致が必要です。

fileを確認します。

```bash
sudo stat -c '%U:%G:%a %n' /etc/autostream/updater.json
sudo chown root:autostream-updater /etc/autostream/updater/ssh/known_hosts
sudo chmod 0640 /etc/autostream/updater/ssh/known_hosts
sudo find /etc/autostream/updater/ssh -type f -name '*_ed25519' \
  -exec chown root:autostream-updater {} \; \
  -exec chmod 0640 {} \;
```

helper bootstrap、local inventory、file権限を完成させた後、上で使った同じtoken-free commandを再実行します。command自体にはConfigure Tokenを含めません。この再実行でTTY promptへ貼り付けるか、権限を制限した標準入力から渡します。Configure Tokenを1回だけ消費し、`panel_url`、`node_id`、`runtime_token`、`service_name`だけを原子的に更新します。`github_token`、`api`、`hosts`、`targets`、SSH設定、その他のlocal policyは保持されます。

stageしたRuntime Tokenはactivation成功まではinactiveで、旧Runtime Tokenがactiveのままです。ただしactivationの応答を受け取れず結果不確定になった場合は、CLIだけではどちらのRuntime Tokenがactiveか判断できません。local atomic commit後にreload、validation、activationが失敗した場合、disk上の`updater.json`にはstage済みidentityが残ることがあります。CLIはactivation用のTokenやstateを永続化しないため、Updaterを再起動せず、Configurationで必ず新しいConfigure Tokenを発行し、同じtoken-free command形へその新しいTokenを入力して再実行します。activation成功を確認するまで`validate-config`やUpdater起動へ進みません。

## 全hostをprobeして中央Updaterを起動する

中央の`validate-config`はstatic validationだけではありません。全hostへ並列に接続し、各host最大15秒でrestricted probeを行います。OSがLinuxであること、host ID、architecture、remote target集合、service type、deployment modeが中央inventoryと完全一致しない場合は失敗します。probeはroot所有のhelper設定全体のSHA-256と、targetごとの現在版も返します。

新規jobはprobeで確認したconfig digestと現在版をimmutable planへ固定します。現在版は`v1.2.3`または`v1.2.3-rc.1`のようなcanonical tagでなければならず、空、`dev`、`v1.2.3+build.1`など比較不能な値では更新を開始しません。job作成後にroot policy、systemd release、Docker version envや稼働imageが変わった場合、既存jobはfail closedになります。設定変更後はrestricted probeを成功させ、変更後の状態から新しいjobを作成してください。

```bash
sudo /usr/local/bin/autostream-updater validate-config \
  --config /etc/autostream/updater.json
sudo systemd-analyze verify /etc/systemd/system/autostream-updater.service
sudo systemctl daemon-reload
sudo systemctl enable autostream-updater
sudo systemctl restart autostream-updater
sudo systemctl status autostream-updater
sudo journalctl -u autostream-updater -n 100 --no-pager
```

中央unitは専用userで動き、sudo、capability、Docker socketを持ちません。`NoNewPrivileges`、空のcapability set、read-only system imageを弱めないでください。書き込み先は`/var/lib/autostream-updater`だけです。

中央Updaterは初回probeが完了するまで新規jobをclaimしません。現在版を取得できないtargetも`current_version_unknown`として更新対象外です。raw SSHの対話shell、PTY、port forwarding、SCP、SFTPが失敗し、中央validateのrestricted probeだけが成功する状態が正常です。

## 更新jobの実行順

新規jobは次の順で処理されます。

1. Control Panelがtarget、host、version、mode、実行方針を固定してqueueします。
2. 中央Updaterが対象host laneでjobをclaimし、leaseを取得します。
3. 中央Updaterがrelease manifest、sidecar、artifactまたはimage digestを検証します。
4. remote helperが`stage`を実行します。private release credentialはSSH stdinで一時受信し、artifactを再取得・再検証します。この段階ではserviceを変更しません。
5. 中央Updaterが`installing` progressの受理を確認します。
6. 中央Updaterがactive leaseとimmutable planに結び付けた90秒のone-time mutation grantを取得します。
7. remote helperがroot変更の直前にgrantを消費し、`apply`します。
8. backup、停止、切替、起動、MainPID/container image、health、versionを確認し、結果をreportします。

同じhostのjobは直列です。別hostの通常jobは並列に進められます。Control Panel自身の更新だけは例外で、grant、report、lease APIを他jobが利用中に停止しないよう、全hostの既存更新が完了してから単独で実行します。その間は新しい通常jobのclaim・実行も待機します。

## `maintenance`と`when_idle`

| 方針 | 用途 | 動作 |
| --- | --- | --- |
| `maintenance` | 現在配信していないtarget | active streamがなければqueueします。配信中なら拒否します |
| `when_idle` | active streamを報告中のtarget | queueに保持し、配信終了後にclaimします |

claim時にもstream状態を再確認します。強制停止して更新する機能ではありません。

## 再起動、通信断、recovery

中央Updaterはhost別stateを`/var/lib/autostream-updater/hosts/<host_idをSHA-256したlowercase hex>`へ分離します。raw host IDをdirectory名に使わず、job directoryにはsecret-free intentだけ、journalにはtokenを除いたrecovery metadataだけを永続化します。lease token、mutation grant、release credentialは保存しません。通信断や再起動でapply結果が不明になった場合、同じapplyを再実行しません。

- active journalがない到達不能hostは新規jobをclaimしません。
- active journalがあるhostは、表示が接続不可でもrecovery claimを試します。
- recoveryはfresh sessionとfresh 90秒grantを使う`reconcile`だけです。`stage`や`apply`へ戻りません。
- remote root ledgerが同じjob/planの二重適用を防ぎます。
- checkpointから成功状態またはrollback状態を確定できない場合はfailedとして人手の確認を要求します。

## Application Infoから実行する

1. **Application Info**を開き、**再取得**でrelease、中央Updater、host状態、履歴を読み直します。
2. **システム更新**で現在version、更新先version、systemd / Docker、host IDを確認します。
3. 中央Updaterが`online`、対象hostが`到達可`であることを確認します。
4. 配信中でないtargetは **更新**、配信中のtargetは **空き次第更新** を選びます。
5. Control Panel自身では、画面とAPIが一時切断される確認dialogを承認します。
6. **更新履歴**でstage、grant、apply、health、rollbackの進捗と結果を確認します。

中央Updaterの状態とhost到達状態は別です。

| 表示 | 意味 |
| --- | --- |
| 中央Updater online | heartbeatが有効。hostへ到達できることまでは意味しない |
| host 到達可 | 直近のrestricted probeが成功し、identityとtarget集合も一致 |
| host 接続不可 | 直近probeがSSHまたはremote validationで失敗 |
| host 未確認 | 起動直後、情報期限切れ、または有効なprobe結果がまだない |

実行buttonは中央Updaterがonlineかつ対象hostが到達可の場合だけ有効です。最新versionの検出と比較は、どちらかがofflineでも続きます。

## backup、health、rollback

### systemd target

1. 中央とremoteの両方で固定tag、architecture、外側SHA-256、archive内`checksums.txt`を検証します。
2. 絶対path、`..`、symlink、重複・未記載file、展開size超過を拒否します。
3. 新binaryの`--version`を`runuser`で実service userとして確認します。
4. database所有serviceはroot所有backup commandを実行します。
5. 旧`current`とdigestをcheckpointへ保存し、service停止、symlink切替、service起動を行います。
6. systemd `MainPID`が新releaseのbinaryを実行し、loopback healthが2xx、versionが対象versionであることを確認します。
7. 失敗時は旧linkへ戻し、旧binaryのMainPID、health、versionまで確認します。

### Docker target

1. remote root policyにDocker binary、Compose project/files/service、固定image repository、target別version env file、承認済みCompose model digestを置きます。
2. release manifest、sidecar、multi-arch digest、host platform digest、source versionを中央とremoteで検証します。
3. database所有serviceはbackupし、旧version env byte列、container image ID、health versionをcheckpointへ保存します。
4. target専用version envを`<bundle tag>@sha256:<verified multiarch digest>`へ原子的に更新し、検証済みplatform digestへ固定した一時overrideで対象serviceだけを再作成します。
5. 新containerのimage ID、RepoDigest、health、source versionを確認します。
6. 失敗時はversion envを元のbyte列へ戻し、旧image IDから対象serviceだけを再作成して旧health/versionを確認します。

共有`.env`へdesired versionを書き戻しません。Updater管理serviceを手動でCompose操作する場合も、remote policyと同じtarget専用`--env-file`を使います。private GHCRでは対象hostのroot Docker credential storeを使い、中央GitHub tokenをDocker loginへ流用しません。

Control PanelとObservabilityのbackupはdatabaseを自動restoreしません。rollback後もschemaやdataの確認が必要なら、事前に用意したrestore runbookを実行します。

## releaseとversionの扱い

- systemd targetは各service repositoryのhost releaseとsource versionを使います。
- Docker targetは`Autostream-Docker`のbundle releaseを使います。bundle versionと各serviceのsource versionは別管理で、表示差は正常です。
- manifest、sidecar、必要component、rollback policyがそろわないreleaseは自動更新できません。
- 既存のControl Panel `v1.6.5`やDocker `v1.2.3`など、公開済みtagとassetを移動・置換しません。修正版は新しいtagとして発行します。
- `source-versions.env`の更新は、新しいControl Panel releaseを発行・検証した後のDocker release作業で別途行います。helper導入手順で既存値を書き換えません。

## 中央Updaterとremote helperを更新する

中央Updaterは自分自身の更新targetではありません。active jobがないことを確認し、新しいControl Panel host artifactを検証してから固定pathを明示的に置き換えます。

```bash
set -euo pipefail
RELEASE_DIR="$(readlink -f /opt/autostream/control-panel/current)"
sudo systemctl stop autostream-updater
sudo install -o root -g root -m 0755 \
  "$RELEASE_DIR/bin/autostream-updater" /usr/local/bin/autostream-updater.next
sudo mv -f /usr/local/bin/autostream-updater.next /usr/local/bin/autostream-updater
/usr/local/bin/autostream-updater --version
sudo systemctl start autostream-updater
```

remote helperもactive jobがないmaintenance中に、新しいhelper artifactを検証して明示的に再bootstrapします。中央Updaterの更新で別hostのhelperを暗黙に置き換えません。config、key、CIDRを変更する場合は通常の再実行ではなく、差分を確認した明示的rotationとして扱います。

## troubleshooting

| 状況 / code | 確認すること |
| --- | --- |
| 中央Updater未設定 / offline | `update_agent`を1つだけ登録したか、中央systemd、Runtime Token、Panel URL、時刻、TLSを確認 |
| host `未確認` | 中央起動直後のprobe待ちか、heartbeat情報が期限切れでないか確認 |
| `ssh_timeout` | address/port、route、firewall、source CIDR、sshdを確認 |
| `ssh_connection_refused` | sshd起動、port、security groupを確認 |
| `ssh_auth_failed` | host別private/public keyの組合せ、owner/mode、password-lock user、authorized_keysを確認 |
| `ssh_host_key_mismatch` | 接続を止め、consoleからserver key変更理由を確認。未確認keyへ置換しない |
| `remote_helper_unavailable` | helper binary、forced command、exact sudoers、`SSH_ORIGINAL_COMMAND`、architectureを確認 |
| `remote_config_invalid` | central/remoteのhost ID、target集合、service type、mode、arch、root config owner/modeを確認 |
| `target_reachability_unknown` / `target_unreachable` | 中央onlineとは別に対象hostのprobe結果を確認 |
| `current_version_unknown` | targetの`.version`またはDocker version env、稼働image、公開済みrelease tagの対応を確認し、restricted probeを再実行 |
| release manifest取得失敗 | 中央GitHub token、rate limit、tag、manifest/sidecar/artifactを確認 |
| stage失敗 | remoteからGitHub/GHCRへの到達、disk、remote checksum検証を確認。serviceはまだ変更されていない |
| grant発行・消費失敗 | lease、job/host/target/version/mode、plan digest、session、90秒期限を確認。古いgrantを再利用しない |
| `rolled_back` | backup、中央/remote log、service log、artifact/image digest、旧health/versionを確認 |
| recovery中 | 新しいapplyをqueueせず、journalとremote ledgerからreconcileが完了するのを確認 |
| versionは見えるが実行不可 | central offline、host未確認/接続不可、`manifest_unverified`、busy stream、権限不足を確認 |

helperを置かずに手動更新を続けることもできます。その場合Application Infoは検出専用です。手動更新後はbinaryの`--version`、systemd MainPIDまたはcontainer image ID、`/health`、`/updater/version`、Service Health、短いテスト配信まで確認してください。
