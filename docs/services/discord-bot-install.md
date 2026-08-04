# Discord Botを導入する

Discord Bot は、Discord の voice channel に参加し、音声と参加者状態を AutoStream に渡します。Bot token や channel ID は Control Panel で管理し、サービスenvには Control Panel へ接続するための最小値だけを置きます。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| Discord application / Bot | Discord developer portal |
| Bot token | Control Panel の Discord Settings |
| guild ID | Control Panel の Streams |
| voice channel ID | Control Panel の Streams |
| text channel ID | chat表示を使う場合は Control Panel の Streams |
| Discord Bot Node Agent `config.yml` | `/etc/autostream-discord-bot/config.yml` |

Bot には voice channel への参加、音声受信、配信中chatを拾う text channel の閲覧権限を付けます。chat表示を使う場合は Discord Developer Portal で Message Content Intent を有効にします。

Discord Bot service 用に AutoStream 側で手生成する token はありません。Node Runtime Token は Node登録で生成された `config.yml` に入り、Discord Bot token 本体は Discord developer portal で発行して Control Panel の Discord Settings に保存します。固定の `DISCORD_BOT_TOKEN` env は本番標準では使いません。

## host直接起動

`artifact-manifest.json`を含むarchive-only形式のhost releaseを使います。管理端末で
archive本体だけをdownloadしてGitHub Attestationを確認し、元`.tar.gz`だけを
サーバーへ転送します。サーバーではbasenameを変更せずroot-owned directoryへ
固定し、元archiveと展開directoryを隣接させて、archive直下で次を実行します。

公開`v1.3.1`のarchive-only releaseを使用し、古いreleaseへ読み替えないでください。

管理端末:

```bash
gh release download v1.3.1 --repo Kome-Lab/Autostream-DiscordBot \
  --pattern 'autostream-discord-bot_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-discord-bot_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-DiscordBot \
  --signer-workflow Kome-Lab/Autostream-DiscordBot/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元archiveだけを`/tmp`へ転送した後のサーバー:

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-discord-bot_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-discord-bot_v1.3.1_linux_amd64
sudo test ! -L autostream-discord-bot_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-discord-bot_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-discord-bot_v1.3.1_linux_amd64/install-autostream-discord-bot
```

installerはarchive内部の`artifact-manifest.json`、`checksums.txt`、host
architecture、binary versionを検証し、元archiveのSHA-256を記録してから、
`autostream` account、rollback用の内部release、
systemd unit、env placeholder、data directory、
`/usr/local/bin/autostream-discord-bot`を配置します。既存の直接配置binaryは
managed配置へ移行し、既存envは保持します。旧fileは
`/var/backups/autostream/install-migrations/discord-bot`へroot専用で退避します。内部の
`/opt/autostream/discord-bot/current`
やmarkerは手動編集しません。installerはserviceを開始せず、Docker Compose、
container、imageは変更しません。詳しい取得と検証手順は
[Linuxホストで直接動かす](/deployment/host)を参照してください。

外部archive sidecarと`release-manifest.json*`は自動Updater/旧client互換のため
releaseには残りますが、手動導入ではdownloadもuploadもしません。手動導入には
公開`v1.3.1` archiveを使用します。`v1.2.x`から更新する場合もenvとNode
`config.yml`、起動中の旧`MainPID`は保持されます。installer成功後に明示的に
restartし、既存設定portのhealthと新versionを確認します。詳細は
[既存環境を更新するとき](/deployment/host#既存環境を更新するとき)を参照して
ください。service installerはHost Agentを自動導入しません。

`/etc/autostream/discord-bot.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-discord-bot/config.yml
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
DISCORD_RECONNECT_ENABLED=true
DISCORD_RECONNECT_MAX_ATTEMPTS=5
DISCORD_RECONNECT_BASE_DELAY=2s
DISCORD_RECONNECT_MAX_DELAY=30s
CONTROL_PANEL_RUNTIME_CONFIG_REFRESH_INTERVAL=30s
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-discord-bot
sudo systemctl start autostream-discord-bot
sudo systemctl status autostream-discord-bot
```

この時点で `/etc/autostream-discord-bot/config.yml` がまだ無い場合でも、Discord Bot は終了せず `node config pending: waiting for /etc/autostream-discord-bot/config.yml` を出して dry-run で待機します。Auto Configure コマンドで `config.yml` を作成し、Control Panel の Discord Settings に Bot token を保存した後は、実際の Discord 接続を開始するため Discord Bot を再起動します。

## Control Panelで登録する

1. Node登録で `discord_bot` を選び、Node名、Host、Port、SSL、説明を入力します。
2. Configuration から `config.yml` または Auto Configure コマンドを取得します。
3. `config.yml` を `/etc/autostream-discord-bot/config.yml` に配置します。
4. Discord Settings を開きます。
5. Bot token を登録します。
6. `Discord BOT Node` で登録済み Discord Bot Node を選びます。
7. Discord Bot が未起動なら起動します。先に起動して pending / dry-run になっていた場合は `sudo systemctl restart autostream-discord-bot` を実行します。
8. Service Health で Discord Bot が online、報告バージョン、Capability を出しているか確認します。
9. Streams で Discord Config を選び、guild ID、voice channel ID、必要なら text channel ID を配信枠に保存します。VC参加で開始する待機枠は `Discord VC参加で自動開始` をONにします。

## 配信開始時の流れ

1. Streams で Start を押します。
2. Control Panel が primary に割り当てられた Discord Bot へ job を送ります。
3. Bot が runtime config を取り直します。
4. Bot token を runtime secret として解決します。
5. guild / voice channel へ参加します。
6. 音声packetを Encoder Recorder へ送ります。
7. active speaker、参加者状態、配信枠に設定した text channel の新規messageを、配信枠で primary assigned された Worker へ渡します。

本番では `DISCORD_BOT_TOKEN` env に頼らず、Control Panel 管理の runtime secret を使います。
Worker 送信用の固定 `WORKER_URL` / `WORKER_TOKEN` env は使いません。Control Panel が配信開始時に Worker assignment から `worker_events_url` と短期 `worker_events_token` を job に入れます。

## VC参加で自動開始されるか

標準構成では、配信枠で `Discord VC参加で自動開始` をONにした対象 Discord VC にユーザーが参加すると stream auto-start を要求します。Discord Bot は runtime config の stream / guild / voice channel / auto-start trigger 対応表を使い、該当 stream の `POST /services/streams/{id}/start` を Node Runtime Token で呼びます。

Control Panel は、その token が対象 stream の primary Discord Bot に紐づき、`streams.start` scope を持ち、配信枠の auto-start trigger が有効な待機状態の場合だけ開始を許可します。要求 body の override は使わず、保存済み Stream settings だけで start します。同じ guild / voice channel に複数の auto-start 有効streamが紐づく場合は自動開始しません。

Discord Bot は runtime config を定期的に再読込します。Bot 起動後に Streams で待機枠を追加した場合も、次回 refresh 後に VC参加auto-startの対象になります。

## 接続確認

| 確認 | 正常な状態 |
| --- | --- |
| Service Health | `discord_bot` が online |
| Runtime config preview | Discord Config が対象serviceに紐付いている |
| Discord voice channel | Bot が配信開始時に参加する |
| Chat 表示 | 配信枠の text channel ID と Worker event 到達性 |
| Metrics | audio receiving、audio packets、forwarded packets が増える |
| Incidents | voice disconnected や audio forward stale が出ていない |

## Dockerで起動する場合

Dockerでは Panel が生成した `config.yml` を `/etc/autostream-discord-bot/config.yml` へ read-only mount し、env には `AUTOSTREAM_NODE_CONFIG` を入れます。Bot token 本体は Control Panel の Discord Settings に登録します。

Bot container から Control Panel、Encoder Recorder、配信枠で選択される Worker へ到達できる network に置いてください。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| Service Health に出ない | `AUTOSTREAM_NODE_CONFIG`、Node ID、Node Runtime Token |
| Bot がvoice channelに入らない | Discord Bot権限、guild ID、voice channel ID、Bot token |
| Chat 表示が出ない | text channel ID、Bot の channel閲覧権限、Message Content Intent、Worker assignment、Worker event署名鍵 |
| readiness が失敗する | Discord Settings と Streams の Discord Config 選択 |
| 音声がEncoderに届かない | Encoder assignment、stream ingest token、network、Audio Bridge |
| standbyなのにstartされない | standbyは待機用です。primaryに昇格してからstart対象になります |

## 次に読むページ

- [DiscordとYouTube](/control-panel/discord-youtube)
- [サービス割り当て](/control-panel/services-workers)
- [配信画面](/control-panel/streams)
