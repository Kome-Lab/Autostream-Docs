# Encoder Recorderを導入する

Encoder Recorder は、AutoStream の中で最もサーバー資源を使うサービスです。Discord Bot から音声を受け、Worker がjob-scopedに暗号化したSRT over UDPで送るMJPEG scene画像列の最新画像を保持し、設定FPSの映像化・音声MUX・ウォーターマーク・最終encodeを行ってYouTube配信、録画、HLSプレビューへ分岐します。host直接起動では、FFmpeg は同梱しないためサーバー側に入れてください。

Worker画像用のSRT bind/advertise UDP endpointはNode APIのHTTPS URLやCloudflare Tunnelとは別に設定します。primary Worker hostからadvertise先へUDP到達できるよう、host firewall、cloud firewall、NATを構成してください。SRT token/passphraseはControl Panelがjobごとに渡し、FFmpeg argv、URL、service log、audit、env、永続fileへ出しません。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| `ffmpeg` | host側の実行ファイル |
| 録画保存ディレクトリ | `AUTOSTREAM_ARCHIVE_DIR` |
| Encoder Recorder Node Agent `config.yml` | `/etc/autostream-encoder-recorder/config.yml` |
| stream ingest signing key | Node登録時に `config.yml` の `stream_ingest.signing_key` として配布 |
| output relay | 本番配信先への中継 |

YouTube stream key、Drive folder ID、OAuth refresh token などは、標準運用では Control Panel からruntime configとして受け取ります。

Control Panel が保持する `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` は、Node登録時に `config.yml` へ安全に配布されます。Encoder Recorder の Observability signal は、Node Runtime Token で Control Panel に送り、Control Panel が Observability へ転送します。Encoder Recorder env に署名鍵や Observability 接続用tokenは入れません。生成方法は [秘密情報とtoken生成](/security/tokens) を参照してください。

## host直接起動

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

`ffmpeg`は外部packageのためservice installerでは導入しません。続いて
`artifact-manifest.json`を含むarchive-only形式のhost releaseを使います。
管理端末でarchive本体だけをdownloadしてGitHub Attestationを確認し、元
`.tar.gz`だけをサーバーへ転送します。サーバーではbasenameを変更せずroot-owned
directoryへ固定し、元archiveと展開directoryを隣接させて、archive直下で次を
実行します。

公開`v1.3.1`のarchive-only releaseを使用し、古いreleaseへ読み替えないでください。

管理端末:

```bash
gh release download v1.3.1 --repo Kome-Lab/Autostream-Encoder-Recorder \
  --pattern 'autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-Encoder-Recorder \
  --signer-workflow Kome-Lab/Autostream-Encoder-Recorder/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元archiveだけを`/tmp`へ転送した後のサーバー:

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-encoder-recorder_v1.3.1_linux_amd64
sudo test ! -L autostream-encoder-recorder_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-encoder-recorder_v1.3.1_linux_amd64/install-autostream-encoder-recorder
```

installerはarchive内部の`artifact-manifest.json`、`checksums.txt`、host
architecture、binary versionを検証し、元archiveのSHA-256を記録してから、
`autostream` account、rollback用の内部release、
systemd unit、env placeholder、録画/data directory、
`/usr/local/bin/autostream-encoder-recorder`を配置します。既存の直接配置binaryは
managed配置へ移行し、既存envは保持します。旧fileは
`/var/backups/autostream/install-migrations/encoder-recorder`へroot専用で退避します。内部の
`/opt/autostream/encoder-recorder/current`やmarkerは手動編集しません。
installerはserviceを開始せず、output relay、reverse proxy、Docker Compose、
container、imageは変更しません。詳しい取得と検証手順は
[Linuxホストで直接動かす](/deployment/host)を参照してください。

外部archive sidecarと`release-manifest.json*`は自動Updater/旧client互換のため
releaseには残りますが、手動導入ではdownloadもuploadもしません。手動導入には
公開`v1.3.1` archiveを使用します。`v1.2.x`から更新する場合もenvとNode
`config.yml`、起動中の旧`MainPID`は保持されます。installer成功後に明示的に
restartし、既存設定portのhealthと新versionを確認します。詳細は
[既存環境を更新するとき](/deployment/host#既存環境を更新するとき)を参照して
ください。service installerはHost Agentを自動導入しません。

`/etc/autostream/encoder-recorder.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-encoder-recorder/config.yml
AUTOSTREAM_ENV=production
AUTOSTREAM_BIND_ADDR=127.0.0.1:8081
AUTOSTREAM_WORKER_VIDEO_BIND_ADDR=0.0.0.0:10080
AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST=encoder-media.example.internal
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
AUTOSTREAM_OUTPUT_RELAY_MODE=legacy_stream_key
```

`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST`はscheme、port、pathを含めず、primary WorkerからUDP到達できるhost名またはIPを指定します。Node APIの公開HTTPS host名やCloudflare Tunnelを機械的に流用しません。上の例ではhost firewall、cloud firewall、NATでUDP `10080`をWorker hostからだけ許可します。録画先は既定で`/var/lib/autostream/archives`、FFmpeg実行名は既定で`ffmpeg`です。`TZ`を含め、既定値と異なるhostだけで追加設定します。

`AUTOSTREAM_ENV=production`によりControl Panel runtime configとoutput relayは自動的に必須になります。signed ingest tokenは環境に関係なく既定で必須です。`SERVICE_ID`、`CONTROL_PANEL_TOKEN`、`SERVICE_CONTROL_TOKEN[_SHA256]`、`ENCODER_WORKER_EVENTS_TOKEN[_SHA256]`、`ENCODER_DISCORD_AUDIO_TOKEN[_SHA256]`は入力しません。

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-encoder-recorder
sudo systemctl start autostream-encoder-recorder
sudo systemctl status autostream-encoder-recorder
```

この時点で `/etc/autostream-encoder-recorder/config.yml` がまだ無い場合でも、Encoder Recorder は終了せず `node config pending: waiting for /etc/autostream-encoder-recorder/config.yml` を出して待機します。Auto Configure コマンドで `config.yml` を作成した後は、登録、heartbeat、runtime config、runtime secret resolver の初期読込を確実にそろえるため Encoder Recorder を再起動します。

## FFmpegとディスクを確認する

```bash
ffmpeg -version
ffmpeg -hide_banner -muxers | grep -E '(^| )E.* hls'
sudo -u autostream test -w /var/lib/autostream/archives
df -h /var/lib/autostream/archives
```

`hls` muxerが表示されることを確認します。録画は一時的に大きくなります。配信時間、bitrate、保存日数に合わせてディスク容量を見積もってください。

Encoderプレビューは`AUTOSTREAM_ARCHIVE_DIR/tmp/<stream_id>/preview/`へ約2秒segmentを出力し、配信中は開始時点まで戻れるようactive streamの全segmentを保持します。長時間配信では使用量が配信時間に比例して増え、終了済みstreamの`tmp` directoryもfinal archiveの保持期間だけでは削除されない場合があります。`du -sh /var/lib/autostream/archives/tmp`も監視対象にし、active streamのdirectoryは削除しないでください。

## output relay の考え方

本番では FFmpeg の引数に外部配信先のstream keyを直接出さず、同じhost上の relay にだけ出力する構成を推奨します。

1. nginx-rtmp、SRS などの relay を `127.0.0.1` で待ち受けさせます。
2. Encoder Recorder の `AUTOSTREAM_OUTPUT_RELAY_URL` を loopback relay にします。
3. relay 側の非公開設定で YouTube など外部配信先へ push します。
4. relay 設定ファイルはGit管理せず、権限を絞ります。

Docker構成では、Encoder Recorderと`output-relay`を通常のCompose networkへ接続し、`AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://output-relay:1935/autostream/{stream_id}`でservice DNSを使います。この固定service DNSを使うComposeだけで`AUTOSTREAM_COMPOSE_OUTPUT_RELAY=1`を設定します。この値は任意hostを許可せず、host/systemd配置へコピーしません。`network_mode: service:encoder-recorder`によるnetwork namespace共有やDocker内の`127.0.0.1`は使いません。

### 配送モードを選ぶ

固定relayを使うhostは、`AUTOSTREAM_OUTPUT_RELAY_URL`と`AUTOSTREAM_OUTPUT_RELAY_MODE`を組にして設定します。modeは非secretであり、YouTubeのstream key、外部RTMPS URL、視聴URLを入れる場所ではありません。

| mode | 必要なenv | 使用できるYouTube Output | 目的 |
| --- | --- | --- | --- |
| `direct` | `AUTOSTREAM_OUTPUT_RELAY_URL`を設定しない。`AUTOSTREAM_OUTPUT_RELAY_MODE=direct`は任意 | `stream_key`、`live_api`、`live_api_dry_run`（`live_api_relay_static`は不可） | relayなしの構成。productionでrelay必須にしているhostはpreflight/startで停止します |
| `legacy_stream_key` | relay URL。modeは`legacy_stream_key`を明示するか、既存hostでは未設定 | 既存の`stream_key`だけ | 固定relayが既存の固定keyへpushする構成を維持します |
| `live_api_static` | relay URL、`AUTOSTREAM_OUTPUT_RELAY_MODE=live_api_static`、`relay-` + 小文字UUID形式の`AUTOSTREAM_OUTPUT_RELAY_BINDING_ID` | `live_api_relay_static`だけ | 固定relayと再利用するYouTube Live Streamを、binding IDで固定対応させます |

`live_api_static`の例は次のとおりです。`relay-123e4567-e89b-42d3-a456-426614174000`はControl PanelのYouTube Outputに設定する`relay_binding_id`と完全一致させる、`relay-` + 小文字UUID形式の非secret識別子です。stream key、外部RTMPS URL、視聴URL、任意の説明名ではありません。

```text
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
AUTOSTREAM_OUTPUT_RELAY_MODE=live_api_static
AUTOSTREAM_OUTPUT_RELAY_BINDING_ID=relay-123e4567-e89b-42d3-a456-426614174000
```

URLありで`direct`を選ぶ、URLなしで`legacy_stream_key`または`live_api_static`を選ぶ、未知のmodeを使う、または`live_api_static`のbinding形式・一致条件を満たさない設定は、relay `unavailable`としてpreflight/startでfail closedします。`direct`へ読み替えたり、relay URLを無視したりしません。`managed`のような推測用のmodeは設定しません。URLありでmodeが未設定の既存hostだけは、互換のため`legacy_stream_key`として扱われます。

### 既存の固定relayを安全に移行・戻す

既存の`stream_key` profileと固定nginx-rtmp relayを使っているhostは、profile、root管理されたrelay設定、既存のkeyを変更せずに継続できます。Encoder Recorderを更新しても、relay URLありかつmode未設定は`legacy_stream_key`互換です。更新時に意図を明確にするなら、同じrelay URLのまま`AUTOSTREAM_OUTPUT_RELAY_MODE=legacy_stream_key`を設定して再起動します。

`live_api_static`へ切り替える場合は、既存profileを自動変換しません。停止済みであることを確認した上で、別のYouTube Outputに`live_api_relay_static`、Google OAuth account、`relay-` + 小文字UUID形式の`relay_binding_id`、再利用するYouTube Live Stream IDを設定します。relay側がすでにその再利用Live Streamへ固定対応していることを、keyを表示せずに確認してから、Encoder環境のmodeとbinding IDを`live_api_static`へ変更します。形式不正・不一致のrelay設定は`unavailable`であり`direct`へのfallbackではありません。Service Health / preflightがreadyになってから、別の配信枠で小さな開始・停止確認を行います。

戻す場合は、まず新方式の配信枠を停止してinactiveであることを確認します。開始結果が不明ならControl Panelの固定Relay回復を完了してから、配信枠の出力選択を既存の`stream_key` profileへ戻し、Encoderのmodeを`legacy_stream_key`（または既存URLのmode未設定）へ戻して再起動します。`live_api_static`のbindingを別の配信枠へ使い回したり、relay設定からkeyを抽出してprofileへ貼り戻したりしません。

## Control Panelで登録する

1. Node登録で `encoder_recorder` を選び、Node名、Host、Port、SSL、説明を入力します。Runtime Secret取得scopeはEncoder Recorderに必要なため自動付与されます。
2. ConfigurationからAuto Configureコマンドを取得して対象hostで一度実行します。実行時にConfigure Tokenを消費し、Node Runtime Tokenを更新して`config.yml`を保存します。
3. 手動で`config.yml`を配置する方法はAuto Configureの代替です。両方を実行すると、Auto Configureで更新されたRuntime Tokenにより先に配置したconfigが無効になるため、併用しません。どちらもNode Runtime Tokenと`stream_ingest.signing_key`を含むため、ファイル権限は`0640`に制限します。
4. Encoder Recorder が未起動なら起動します。先に起動して pending になっていた場合は `sudo systemctl restart autostream-encoder-recorder` を実行します。
5. Service Health で online、報告バージョン、Capability を確認します。
6. Encoder Profiles を作ります。
7. YouTube Outputs を作ります。
8. Google Driveへ保存する場合は、Drive用のOAuth Connected Account、Drive保存先、録画プロファイルを作ります。
9. Streams で Encoder Profile、YouTube Output、録画プロファイルを選びます。
10. Start前に preflight を確認します。

## Google Drive保存

Google Drive へ保存する場合は、Control Panel の Archive画面でDrive保存先と録画プロファイルを作り、Streamsで配信枠へ割り当てます。

標準運用では service account を使いません。Drive OAuth connected account、Drive Folder ID、共有ドライブ設定は Control Panel から runtime config と runtime secret参照として Encoder Recorder に渡されます。

共有ドライブを使う場合は、Archive画面のDrive保存先で共有ドライブを有効にします。対象folderへ接続済みOAuth accountを参加させます。

## 確認ポイント

| 確認 | 正常な状態 |
| --- | --- |
| Preflight | ffmpeg、archive dir、output relay がok |
| Audio Bridge | Discord Bot からpacketが届く |
| Worker Frame Ingest | `worker_frame_ingest_mjpeg_srt` capabilityが報告され、primary WorkerからSRT接続と初期JPEG frameが到達する |
| 録画 | `final.mkv` 作成後、停止時に `final.mp4` が作られる |
| Encoderプレビュー | Streams画面と発行したVLC URLでHLS映像が再生される |
| Upload | Archive / upload が completed |
| Metrics | fps、bitrate、dropped frames、disk free を確認できる |

## Dockerで起動する場合

Docker image はDebianの`ffmpeg` packageを含み、HLS previewも同じEncoder Recorder API portを使います。preview用の追加公開portや追加volumeは不要です。一方、Worker scene videoにはNode APIとは別のSRT/UDP portが必要です。同一Compose networkでは`AUTOSTREAM_WORKER_VIDEO_BIND_ADDR=0.0.0.0:10080`、`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST=encoder-recorder`としてservice DNSを使い、hostへUDPをpublishしません。Workerを別hostで動かす構成だけ`10080:10080/udp`をpublishし、advertise hostをWorkerから到達できるEncoder host名またはIPへ変更します。composeではarchive dir volumeを`/var/lib/autostream/archives`へ永続化し、通常Compose network上の`output-relay:1935`へ出力します。production起動時の`config.yml`はread-only mountにします。Encoder Recorder repositoryのone-shot Auto Configureを使う場合だけ、production overrideを付けずにbase composeで生成してから、production composeを起動します。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| preflightでffmpeg missing | `FFMPEG_BIN` と `ffmpeg -version` |
| `worker_frame_ingest_mjpeg_srt` capabilityが出ない | `AUTOSTREAM_WORKER_VIDEO_BIND_ADDR`と`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST`、production config error |
| Worker画像が届かない | advertise host、UDP port publish、host/cloud firewall、NAT、primary assignment |
| archive root missing | `AUTOSTREAM_ARCHIVE_DIR` の存在、owner、空き容量 |
| 本番でstream key付きrequestが拒否される | YouTube Output とruntime secret参照を使う |
| 配信はできるが録画がない | 配信枠のArchive保存先、ディスク権限、stop時のpackaging |
| upload失敗 | Drive destination、OAuth/account権限、folder ID、Retry Upload |
| fpsが低い | CPU/GPU負荷、encoder preset、入力jitter、bitrate |

## 次に読むページ

- [プロファイル設定](/control-panel/profiles)
- [OAuthとDrive保存先](/control-panel/integrations-drive)
- [録画と保存](/operations/archive-flow)
