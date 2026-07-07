# Discord Botを導入する

Discord Bot は、Discord の voice channel に参加し、音声と参加者状態を AutoStream に渡します。Bot token や channel ID は Control Panel で管理し、サービスenvには Control Panel へ接続するための最小値だけを置きます。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| Discord application / Bot | Discord developer portal |
| Bot token | Control Panel の Discord Settings |
| guild ID | Control Panel の Discord Settings |
| voice channel ID | Control Panel の Discord Settings |
| text channel ID | 必要なら Control Panel の Discord Settings |
| Discord Bot Node Agent `config.yml` | `/etc/autostream-discord-bot/config.yml` |

Bot には voice channel への参加、音声受信、必要なメッセージ送信権限を付けます。

Discord Bot service 用に AutoStream 側で手生成する token はありません。Node Runtime Token は Node登録で生成された `config.yml` に入り、Discord Bot token 本体は Discord developer portal で発行して Control Panel の Discord Settings に保存します。固定の `DISCORD_BOT_TOKEN` env は本番標準では使いません。

## host直接起動

```bash
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
cd "/opt/autostream/releases/autostream-discord-bot_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
sudo install -o root -g root -m 0755 bin/autostream-discord-bot /usr/local/bin/autostream-discord-bot
sudo ln -sf /usr/local/bin/autostream-discord-bot /usr/local/bin/discord-bot
sudo install -d -o autostream -g autostream /var/lib/autostream/discord-bot
sudo install -o root -g root -m 0644 systemd/autostream-discord-bot.service.example /etc/systemd/system/autostream-discord-bot.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/discord-bot.env
```

`/etc/autostream/discord-bot.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-discord-bot/config.yml
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
DISCORD_RECONNECT_ENABLED=true
DISCORD_RECONNECT_MAX_ATTEMPTS=5
DISCORD_RECONNECT_BASE_DELAY=2s
DISCORD_RECONNECT_MAX_DELAY=30s
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-discord-bot
sudo systemctl status autostream-discord-bot
```

この時点で `/etc/autostream-discord-bot/config.yml` がまだ無い場合でも、Discord Bot は終了せず `node config pending: waiting for /etc/autostream-discord-bot/config.yml` を出して dry-run で待機します。Auto Configure コマンドで `config.yml` を作成し、Control Panel の Discord Settings に Bot token を保存した後は、実際の Discord 接続を開始するため Discord Bot を再起動します。

## Control Panelで登録する

1. Node登録で `discord_bot` を選び、Node名、Host、Port、SSL、説明を入力します。
2. Configuration から `config.yml` または Auto Configure コマンドを取得します。
3. `config.yml` を `/etc/autostream-discord-bot/config.yml` に配置します。
4. Discord Settings を開きます。
5. Bot token、guild ID、voice channel ID、text channel ID を登録します。
6. `Bot service ID` に Node ID を指定します。
7. Discord Bot が未起動なら起動します。先に起動して pending / dry-run になっていた場合は `sudo systemctl restart autostream-discord-bot` を実行します。
8. Service Health で Discord Bot が online、報告バージョン、Capability を出しているか確認します。
9. Streams で Discord Config を選びます。

## 配信開始時の流れ

1. Streams で Start を押します。
2. Control Panel が primary に割り当てられた Discord Bot へ job を送ります。
3. Bot が runtime config を取り直します。
4. Bot token を runtime secret として解決します。
5. guild / voice channel へ参加します。
6. 音声packetを Encoder Recorder へ送ります。
7. active speaker や参加者状態を Worker / Control Panel へ渡します。

本番では `DISCORD_BOT_TOKEN` env に頼らず、Control Panel 管理の runtime secret を使います。

## VC参加で自動開始されるか

標準構成では、対象 Discord VC にユーザーが参加すると stream auto-start を要求します。Discord Bot は runtime config の stream / guild / voice channel 対応表を使い、該当 stream の `POST /services/streams/{id}/start` を Node Runtime Token で呼びます。

Control Panel は、その token が対象 stream の primary Discord Bot に紐づき、`streams.start` scope を持つ場合だけ開始を許可します。要求 body の override は使わず、保存済み Stream settings だけで start します。同じ guild / voice channel に複数 stream が紐づく場合は自動開始しません。

## 接続確認

| 確認 | 正常な状態 |
| --- | --- |
| Service Health | `discord_bot` が online |
| Runtime config preview | Discord Config が対象serviceに紐付いている |
| Discord voice channel | Bot が配信開始時に参加する |
| Metrics | audio receiving、audio packets、forwarded packets が増える |
| Incidents | voice disconnected や audio forward stale が出ていない |

## Dockerで起動する場合

Dockerでは Panel が生成した `config.yml` を `/etc/autostream-discord-bot/config.yml` へ read-only mount し、env には `AUTOSTREAM_NODE_CONFIG` を入れます。Bot token 本体は Control Panel の Discord Settings に登録します。

Bot container から Control Panel と Encoder Recorder へ到達できる network に置いてください。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| Service Health に出ない | `AUTOSTREAM_NODE_CONFIG`、Node ID、Node Runtime Token |
| Bot がvoice channelに入らない | Discord Bot権限、guild ID、voice channel ID、Bot token |
| readiness が失敗する | Discord Settings と Streams の Discord Config 選択 |
| 音声がEncoderに届かない | Encoder assignment、stream ingest token、network、Audio Bridge |
| standbyなのにstartされない | standbyは待機用です。primaryに昇格してからstart対象になります |

## 次に読むページ

- [DiscordとYouTube](/control-panel/discord-youtube)
- [サービス割り当て](/control-panel/services-workers)
- [配信画面](/control-panel/streams)
