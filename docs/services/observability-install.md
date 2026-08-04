# Observabilityを導入する

Observability は、AutoStream の状態、metric、incident、通知、診断、対応候補を扱うサービスです。配信処理そのものは行いませんが、本番運用では異常に気づくために必須に近い役割を持ちます。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| database | `DATABASE_URL` |
| secret encryption key | 通知先secretの暗号化 |
| Observability Node Agent `config.yml` | `/etc/autostream-observability/config.yml` |
| 通知先 | Control Panel の Notification Channels |
| 共通SMTP | email通知を使う場合にControl PanelのSettingsで設定 |

Webhook URL は Notification Channels から登録します。email通知のSMTP host、port、TLS、From、username、passwordは通知先ごとに入力せず、Control PanelのSettingsにある共通メールサーバーを使います。Webhook URLやSMTP passwordはAPI responseやログにraw値を出さない運用にします。

標準構成では、Worker / Encoder Recorder の signal は Control Panel が Observability へ転送します。Observability API の認可には、Node登録で生成された `AUTOSTREAM_NODE_CONFIG` 内の Node Runtime Token を使います。Observability env に別の admin token hash や ingest token hash は置きません。生成方法と各サービスの対応は [秘密情報とtoken生成](/security/tokens) を参照してください。email relayにはRuntime Tokenの `notifications.email.send` scopeを使います。新規Node登録では自動付与されます。この更新より前のObservability Nodeは、対応するControl PanelをdeployしたあとにConfigurationでRuntime Tokenを再生成すると、既存scopeを保持したままこのscopeが追加されます。新しい`config.yml`を実行環境へ反映してObservabilityを再起動してください。

## host直接起動

`artifact-manifest.json`を含むarchive-only形式のhost releaseを使います。管理端末で
archive本体だけをdownloadしてGitHub Attestationを確認し、元`.tar.gz`だけを
サーバーへ転送します。サーバーではbasenameを変更せずroot-owned directoryへ
固定し、元archiveと展開directoryを隣接させて、archive直下で次を実行します。

公開`v1.3.1`のarchive-only releaseを使用し、古いreleaseへ読み替えないでください。

管理端末:

```bash
gh release download v1.3.1 --repo Kome-Lab/Autostream-Observability \
  --pattern 'autostream-observability_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-observability_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-Observability \
  --signer-workflow Kome-Lab/Autostream-Observability/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元archiveだけを`/tmp`へ転送した後のサーバー:

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-observability_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-observability_v1.3.1_linux_amd64
sudo test ! -L autostream-observability_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-observability_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-observability_v1.3.1_linux_amd64/install-autostream-observability
```

installerはarchive内部の`artifact-manifest.json`、`checksums.txt`、host
architecture、binary versionを検証し、元archiveのSHA-256を記録してから、
`autostream` account、rollback用の内部release、
systemd unit、env placeholder、data directory、
`/usr/local/bin/autostream-observability`を配置します。backup executable、
backup directory、root-only MariaDB defaults placeholderも配置しますが、実際の
backup account、password、database grant、database nameは推測しません。
archive同梱`README.install.md`に従ってoperatorが設定し、実dumpを確認してください。

既存の直接配置binaryはmanaged配置へ移行し、既存envは保持します。旧fileは
`/var/backups/autostream/install-migrations/observability`へroot専用で退避します。内部の
`/opt/autostream/observability/current`やmarkerは手動編集しません。installerは
serviceを開始せず、MariaDB、reverse proxy、Docker Compose、container、imageを
変更しません。詳しい取得と検証手順は
[Linuxホストで直接動かす](/deployment/host)を参照してください。

外部archive sidecarと`release-manifest.json*`は自動Updater/旧client互換のため
releaseには残りますが、手動導入ではdownloadもuploadもしません。手動導入には
公開`v1.3.1` archiveを使用します。`v1.2.x`から更新する場合もenvとNode
`config.yml`、起動中の旧`MainPID`は保持されます。`v1.2.0`だけはbackup
credentialが旧`/etc/autostream/mariadb-backup.cnf`にあるため、新installerの前に
canonical pathを確認します。installer成功後に明示的にrestartし、database、
既存設定portのhealth、新versionを確認します。詳細は
[既存環境を更新するとき](/deployment/host#既存環境を更新するとき)を参照して
ください。service installerはHost Agentを自動導入しません。

`/etc/autostream/observability.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-observability/config.yml
DATABASE_URL=mysql://<DB_USER>:<DB_PASSWORD>@tcp(<DB_HOST>:3306)/autostream_observability?parseTime=true
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
OBSERVABILITY_BIND_ADDR=127.0.0.1:8082
REMEDIATION_MODE=suggest_only
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-observability
sudo systemctl start autostream-observability
sudo systemctl status autostream-observability
```

この時点で `/etc/autostream-observability/config.yml` がまだ無い場合でも、Observability は終了せず `node config pending: waiting for /etc/autostream-observability/config.yml` を出して待機します。Auto Configure コマンドで `config.yml` を作成すると、起動中のプロセスが再読込して Control Panel へ登録と heartbeat を開始します。

## Control Panelで使う

1. Node登録で `observability` を選び、Node名、Host、Port、SSL、説明を入力します。
2. Configuration から `config.yml` または Auto Configure コマンドを取得し、`/etc/autostream-observability/config.yml` に配置します。
3. Observability が未起動なら起動します。すでに起動済みなら pending 状態から自動で登録されます。
4. Service Health で online、報告バージョン、Capability を確認します。
5. Monitoring Dashboard を開きます。
6. email通知を使う場合は、Settingsのメールサーバーを保存してテスト送信します。
7. Notification Channels で通知先を作ります。旧個別SMTP方式から移行する場合は、編集画面で共有SMTPへの移行を明示的に選んで保存します。
8. channelの`テスト送信`を実行し、delivery resultとNotification Deliveriesが`success`で、実際に通知が届くことを確認します。
9. Incidents と Diagnostics を確認します。

## 通知先を登録する

| type | 入力するもの |
| --- | --- |
| `discord` | Webhook URL、severity filter |
| `slack` | Slack Incoming Webhook URL、severity filter |
| `generic` | 任意の公開 HTTPS Webhook URL、severity filter |
| `email` | recipients、severity filter。SMTPはSettingsの共通メールサーバーを利用 |

Slack は Slack App の Incoming Webhooks から `https://hooks.slack.com/services/...` を発行し、Control Panel の Notification Channels に貼り付けます。email は recipients を改行またはカンマで指定します。編集時に recipients を空欄のまま更新すると既存の宛先を保持し、入力した場合だけ置き換えます。

SMTP未設定でもemail通知先の作成と編集はできますが、テスト送信と実送信は `smtp_not_configured` で失敗します。emailはObservabilityからControl Panelを経由して共通SMTPへ送信され、SMTP passwordはブラウザやObservabilityへ渡りません。Control PanelとSMTPサーバーの到達性を確認してください。WebhookはObservabilityから通知先へ直接送信します。

本番ではprivate network向けWebhookやSMTPを安易に許可しないでください。通知先は外部到達性と送信先を確認してから登録します。

## 閾値を調整する

Observability は heartbeat、disk、upload retry、packet loss、encoder fps、bitrate、audio silence などを見ます。環境に合わせて threshold env を調整できます。

| 例 | 使い方 |
| --- | --- |
| `OBSERVABILITY_THRESHOLD_HEARTBEAT_AGE_SEC` | stale判定までの秒数 |
| `OBSERVABILITY_THRESHOLD_DISK_FREE_BYTES` | ディスク空き容量の警告 |
| `OBSERVABILITY_THRESHOLD_ENCODER_LOW_FPS` | fps低下の判定 |
| `OBSERVABILITY_THRESHOLD_AUDIO_SILENCE_SEC` | 無音継続の判定 |
| `OBSERVABILITY_RATE_LIMIT_BURST` | API rate limit |

最初は既定値で運用し、通知が多すぎる場合だけ調整します。

## 確認ポイント

| 確認 | 正常な状態 |
| --- | --- |
| Service Health | `observability` が online |
| Signal ingest | Worker / Encoder Recorder のmetricが Control Panel 経由で届く |
| Metrics | 2回目以降の heartbeat で `node.cpu.used_percent` が表示され、`node.cpu_count`、`node.memory.used_percent`、`node.filesystem.root.used_percent`、`process.heap_alloc_bytes` と各service metricも表示される |
| Monitoring Dashboard | incident、metric、deliveryが表示される |
| テスト送信 | delivery resultが`success`で、通知が届く |
| Delivery History | raw URLやpasswordが表示されない |
| Remediation | `suggest_only` で提案だけ表示される |

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| 起動しない | `DATABASE_URL`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、`AUTOSTREAM_NODE_CONFIG` |
| signalが届かない | Observability Node登録、Worker / Encoder Recorder の Node Runtime Token、Control Panel のログ |
| Control Panelから読めない | Observability Node の Host / Port / SSL、`OBSERVABILITY_BIND_ADDR`、firewall、reverse proxy |
| 公開URLの `/` が想定外 | root `/` は安全な状態JSONだけを返します。Metrics は Control Panel の Metrics 画面、または token付き `/metrics` で確認します |
| OS / Arch が未取得 | `autostream-observability configure` を最新binaryで実行したか、`config.yml` の保存先と `AUTOSTREAM_NODE_CONFIG` が一致しているか、heartbeat が成功しているか |
| Webhook通知が届かない | channel設定、Observabilityから通知先へのnetwork、severity filter、delivery history |
| email通知が届かない | Settingsの共通SMTP、Observability Node Runtime Tokenの`notifications.email.send` scope、ObservabilityからControl Panel、Control PanelからSMTPサーバーへの到達性、delivery history |
| 通知が多すぎる | threshold、event type filter、severity filter |

OS / Arch や Metrics が出ない場合は、まず次を確認します。

```bash
command -v autostream-observability
autostream-observability --version
sudo -u autostream test -r /etc/autostream-observability/config.yml
journalctl -u autostream-observability -n 100 --no-pager
```

`/metrics` は token 保護されています。ブラウザで直接開くのではなく、通常は Control Panel の Metrics 画面で確認します。

## 次に読むページ

- [監視と通知](/control-panel/observability)
- [インシデントと通知](/operations/incidents-notifications)
- [状態を確認する](/operations/monitoring)
