# Observabilityを導入する

Observability は、AutoStream の状態、metric、incident、通知、診断、対応候補を扱うサービスです。配信処理そのものは行いませんが、本番運用では異常に気づくために必須に近い役割を持ちます。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| database | `DATABASE_URL` |
| secret encryption key | 通知先secretの暗号化 |
| ingest token hash | 各サービスからsignalを受ける |
| admin token hash | Control Panel から通知・incidentを管理する |
| Observability Node Agent `config.yml` | `/etc/autostream-node/config.yml` |
| 通知先 | Control Panel の Notification Channels |

Webhook URL やSMTP passwordはControl Panelから登録し、API responseやログにはraw値を出さない運用にします。

## host直接起動

```bash
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
cd "/opt/autostream/releases/autostream-observability_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
sudo install -o root -g root -m 0755 bin/observability /usr/local/bin/observability
sudo install -d -o autostream -g autostream /var/lib/autostream/observability
sudo install -o root -g root -m 0644 systemd/autostream-observability.service.example /etc/systemd/system/autostream-observability.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/observability.env
```

`/etc/autostream/observability.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-node/config.yml
DATABASE_URL=mysql://<DB_USER>:<DB_PASSWORD>@tcp(<DB_HOST>:3306)/autostream_observability?parseTime=true
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
OBSERVABILITY_INGEST_TOKEN_SHA256=<SHA256_OF_INGEST_TOKEN>
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<TOKEN_BINDINGS>
OBSERVABILITY_REQUIRE_INGEST_TOKEN_BINDINGS=true
OBSERVABILITY_ADMIN_TOKEN_SHA256=<SHA256_OF_ADMIN_TOKEN>
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<ADMIN_SCOPE_BINDINGS>
OBSERVABILITY_REQUIRE_ADMIN_TOKEN_BINDINGS=true
REMEDIATION_MODE=suggest_only
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-observability
sudo systemctl status autostream-observability
```

## token binding の考え方

ingest token は、どのサービスがsignalを送ってよいかを絞るために使います。

```text
OBSERVABILITY_INGEST_TOKEN_BINDINGS=<TOKEN_SHA256>:encoder_recorder:encoder-recorder-01
```

admin token は、Control Panel が incident やnotification channelを扱うためのscopeを絞るために使います。

```text
OBSERVABILITY_ADMIN_TOKEN_BINDINGS=<ADMIN_TOKEN_SHA256>:observability.read|incidents.update|notifications.read|notifications.manage|remediation.read|remediation.approve|remediation.execute
```

placeholder のままでは動きません。実際のhashは本番のsecret管理手順で生成してください。

## Control Panelで使う

1. Control Panel の env に `OBSERVABILITY_URL` と `OBSERVABILITY_TOKEN` を設定します。
2. Node登録で `observability` を選び、Node名、Host、Port、SSL、説明を入力します。
3. Configuration から `config.yml` または Auto Configure コマンドを取得し、`/etc/autostream-node/config.yml` に配置します。
4. Observability を起動します。
5. Service Health で online、報告バージョン、Capability を確認します。
6. Monitoring Dashboard を開きます。
7. Notification Channels で通知先を作ります。
8. Test Channel を実行します。
9. Incidents と Diagnostics を確認します。

## 通知先を登録する

| type | 入力するもの |
| --- | --- |
| `discord` | Webhook URL、severity filter |
| `slack` | Webhook URL、severity filter |
| `generic` | 任意のWebhook URL、header設定 |
| `email` | SMTP host、port、TLS、recipients、password |

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
| Signal ingest | Worker / Encoder Recorder からmetricが届く |
| Monitoring Dashboard | incident、metric、deliveryが表示される |
| Test Channel | 通知が届く |
| Delivery History | raw URLやpasswordが表示されない |
| Remediation | `suggest_only` で提案だけ表示される |

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| 起動しない | `DATABASE_URL`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY` |
| signalが届かない | ingest token hash、bindings、service ID |
| Control Panelから読めない | admin token scope、`OBSERVABILITY_URL` |
| 通知が届かない | channel設定、network、severity filter、delivery history |
| 通知が多すぎる | threshold、event type filter、severity filter |

## 次に読むページ

- [監視と通知](/control-panel/observability)
- [インシデントと通知](/operations/incidents-notifications)
- [状態を確認する](/operations/monitoring)
