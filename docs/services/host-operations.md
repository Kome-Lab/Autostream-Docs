# サービス共通の導入と運用

このページは、AutoStream の各サービスを Linux サーバーで動かすときに共通する考え方です。個別のサービス手順を読む前に、ここで置き場所、token の扱い、起動確認、更新方法を揃えてください。

導入後の日常運用で「どのサービスが何を担当するか」を確認したい場合は、[各サービスの使い方](/services/runtime-usage)を先に読むと全体像をつかみやすくなります。

## どのサービスにも共通するもの

| 項目 | 使い方 |
| --- | --- |
| 実行ファイル | Control Panel は `bin/control-panel`、Node Agent は release artifact に入っている `bin/autostream-<service>` を配置します |
| env ファイル | `.env.example` を元に `/etc/autostream/<service>.env` を作ります |
| systemd unit | `systemd/*.service.example` を元に `/etc/systemd/system/` へ置きます |
| Node ID | Control Panel と各サービスを対応させる固定 ID です |
| Node Agent config | Panel が生成する `/etc/autostream-<service>/config.yml` です |
| Node Runtime Token | `config.yml` に入る token です。登録、heartbeat、runtime config、Panel から Node への操作に使います |
| Node Agent API | Host、Port、SSL から Panel が組み立てる API URL です |

新規構成では `SERVICE_ID`、`SERVICE_PUBLIC_URL`、`CONTROL_PANEL_TOKEN` を env に手入力しません。Control Panel の Node登録で `config.yml` を生成し、各サービスは `AUTOSTREAM_NODE_CONFIG` でそのファイルを読みます。古い `SERVICE_CALL_TOKEN` / `SERVICE_CONTROL_TOKEN_SHA256` は移行中の fallback としてだけ使います。

## token の生成と入力先

生成方法は [秘密情報とtoken生成](/security/tokens) にまとめています。ここでは、各 service で必要になる値だけを確認します。

| service | 手生成する値 | 入力先 |
| --- | --- | --- |
| Control Panel | `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_SETUP_TOKEN`、`AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Control Panel env |
| Observability | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Observability env。Control Panel からの API 呼び出しは登録済み Observability Node の Runtime Token を使います |
| Encoder Recorder | `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | Encoder Recorder env。signing key は Control Panel と同じ値にします |
| Worker | なし | signal は Node Runtime Token で Control Panel 経由にします |
| Discord Bot | なし | Node Runtime Token は `config.yml`、Discord Bot token は Control Panel の Discord Settings に保存します |

Node Runtime Token と Configure Token は Node登録で生成されます。紛失した場合は Control Panel の Node登録 Configuration から再生成し、対象 service の `config.yml` を更新してください。

## 推奨ディレクトリ

| 用途 | 例 |
| --- | --- |
| 実行ファイル | Control Panel は `/usr/local/bin/control-panel`、Node Agent は `/usr/local/bin/autostream-<service>` |
| env | `/etc/autostream/<service>.env` |
| Node config | `/etc/autostream-<service>/config.yml` |
| service作業領域 | `/var/lib/autostream/<service>` |
| 録画保存先 | `/var/lib/autostream/archives` |
| Control Panel web assets | `/usr/share/autostream-control-panel` |
| systemd unit | `/etc/systemd/system/autostream-<service>.service` |

env ファイルには実値が入るため、権限は `0640` 程度にし、Git 管理しないでください。

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
autostream-control-panel_v1.0.0_linux_amd64/
  bin/control-panel
  systemd/autostream-control-panel.service.example
  .env.example
  checksums.txt
  README.install.md
  share/autostream-control-panel/
```

GitHub Release に添付されている `.sha256` は `artifacts/<asset>.tar.gz` というパスを含むため、download した archive と checksum file は `artifacts/` directory に置いてから確認してください。private repo の release asset は生の URL では `Not Found` になりやすいので、`gh auth login` 済みの GitHub CLI で取得します。

```bash
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
SERVICE_ARTIFACT=autostream-control-panel_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}.tar.gz

sudo install -d -o "$USER" -g "$USER" -m 0755 /opt/autostream/releases/artifacts
cd /opt/autostream/releases
gh release download "${AUTOSTREAM_VERSION}" \
  --repo Kome-Lab/Autostream-ControlPanel \
  --pattern "${SERVICE_ARTIFACT}" \
  --pattern "${SERVICE_ARTIFACT}.sha256" \
  --dir artifacts \
  --clobber
sha256sum -c "artifacts/${SERVICE_ARTIFACT}.sha256"
tar -xzf "artifacts/${SERVICE_ARTIFACT}" -C /opt/autostream/releases
cd "/opt/autostream/releases/${SERVICE_ARTIFACT%.tar.gz}"
```

その後、展開後 directory の中で次を実行します。

1. `bin/` の実行ファイルを `/usr/local/bin/` に配置します。Node Agent は `autostream-<service>` が正規コマンド名です。
2. `.env.example` を `/etc/autostream/<service>.env` にコピーします。
3. `systemd/*.service.example` を `/etc/systemd/system/` にコピーし、必要ならパスを調整します。
4. env の placeholder を実運用値に置き換えます。
5. `systemctl daemon-reload` 後に起動します。

2026-06-29 時点では `Kome-Lab/Autostream-Worker` の GitHub Release asset は未公開です。Worker は source checkout から `go build -o bin/autostream-worker ./cmd/worker` で build するか、Worker repo の Host Release workflow で artifact を作成してから同じ配置手順を使ってください。

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

1. 現在の version と設定を控えます。Node Agent は `autostream-<service> --version`、Control Panel は `control-panel --version` で build version / commit / build date を確認できます。
2. 新しい release artifact を取得します。
3. env に新しい必須項目が増えていないか `.env.example` と比較します。
4. 対象サービスを停止します。
5. 実行ファイルを置き換えます。
6. 起動します。
7. Service Health と短いテスト配信で確認します。

```bash
sudo systemctl stop autostream-<service>
sudo install -o root -g root -m 0755 bin/autostream-<service> /usr/local/bin/autostream-<service>
sudo systemctl start autostream-<service>
sudo systemctl status autostream-<service>
```

Control Panel、Observability のように database を使うサービスは、更新前にバックアップを取ってください。

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
