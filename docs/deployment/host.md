# Host

direct host では、各 repository を個別に build し、`autostream` user で実行します。Docker を使わない場合でも、service 間の責務と Control Panel 管理 config の方針は同じです。

## 推奨パス

| service | env file | data path |
| --- | --- | --- |
| Control Panel | `/etc/autostream/control-panel.env` | `/var/lib/autostream/control-panel` |
| Discord Bot | `/etc/autostream/discord-bot.env` | `/var/lib/autostream/discord-bot` |
| Encoder/Recorder | `/etc/autostream/encoder-recorder.env` | `/var/lib/autostream/encoder-recorder` |
| Worker | `/etc/autostream/worker.env` | `/var/lib/autostream/worker` |
| Observability | `/etc/autostream/observability.env` | `/var/lib/autostream/observability` |
| Archive | managed by Encoder/Recorder | `/var/lib/autostream/archives` |

## bootstrap env

service env には Control Panel へ接続するための値だけを置きます。

```text
SERVICE_ID=discord-bot-01
SERVICE_NAME=Discord Bot 01
SERVICE_PUBLIC_URL=https://discord-bot.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
TZ=Asia/Tokyo
```

Discord Bot token、YouTube stream key、Drive folder ID、OAuth refresh token、webhook URL、SMTP password は env file に置きません。Control Panel UI で登録してください。

## build / install

```bash
go build ./...
sudo install -o autostream -g autostream -m 0755 ./autostream-encoder-recorder /usr/local/bin/autostream-encoder-recorder
sudo install -d -o autostream -g autostream /var/lib/autostream/encoder-recorder
```

systemd unit は [systemd](./systemd.md) を参照してください。

## permission / ownership

`/etc/autostream/*.env` は root と対象 service user だけが読める permission にします。archive、runtime data、log directory は `autostream` user が書ける最小範囲に限定し、Google Service Account JSON を使う互換構成では credential file の path だけを env に置きます。file content を docs、unit、process argument、shell history に貼り付けません。

複数 service を同じ host に置く場合も、service token、data path、systemd unit、log file は service ごとに分けます。Discord Bot、Worker、Encoder/Recorder が同じ `CONTROL_PANEL_TOKEN` を共有すると、Control Panel の service type / service ID scope が崩れるため本番では許可しません。

## 検証

```bash
curl -fsS https://control.example.com/health
curl -fsS https://encoder.example.com/health
```

Control Panel の Service Health で heartbeat、capabilities、assignment role を確認します。

`/health` only proves that the process is listening. After host install, verify Control Panel start readiness, service heartbeat, Observability signal ingest, and archive directory write access. If external provider verification is still pending, record whether the blocker is provider input or host configuration.

## 運用時の注意

direct host では package 更新、unit 更新、env file 更新が別々に発生します。binary を入れ替えた後は `systemctl restart` だけで終えず、Control Panel の heartbeat generation、runtime config version、dispatch result を確認してください。複数 host に分散する場合は、NTP、DNS、TLS 証明書、firewall、archive mount の差分が外部確認の失敗原因になりやすいため、host ごとの確認結果を evidence に残します。

host 障害時は service を別 host へ移す前に、Control Panel の service assignment を更新し、旧 host の heartbeat が stale になったことを確認します。standby を primary に昇格する場合は、runtime secret lease が新しい primary にだけ発行され、旧 primary が Drive / YouTube / Discord stream-scoped secret を解決できないことを確認します。
