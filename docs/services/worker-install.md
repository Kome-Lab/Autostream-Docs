# Workerを導入する

Worker は、配信中のparticipant、active speaker、current time、caption、Discord chatを配信sceneへ描画し、job-scopedに暗号化したSRT over UDPで選択されたEncoder Recorderへ映像を送るサービスです。Encoder Recorderはウォーターマーク、最終encode、YouTube/HLS出力、録画、archiveを担当します。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| Worker Node Agent `config.yml` | `/etc/autostream-worker/config.yml` |
| Worker Node名、Host、Port、SSL | Control Panel の Node登録画面 |
| Stream ingest signing key | Node登録時に `config.yml` の `stream_ingest.signing_key` として配布 |
| `ffmpeg` | Worker映像の生成とEncoder Recorderへの送信 |
| `fontconfig` / `fonts-noto-cjk` | 参加者名、字幕、チャットの日本語描画 |

Encoder Recorder のSRT advertise endpointやjob-scoped credentialは、通常 Control Panel の stream job から渡されます。本番envに固定の `ENCODER_RECORDER_URL` や固定tokenを置かない運用にします。SRT token/passphraseはメモリ内だけで扱い、FFmpeg argv、URL、service log、audit、env、永続fileへ出しません。

Worker の Observability signal は、Node Runtime Token で Control Panel に送ります。Worker env に stream ingest signing key や Observability 接続用tokenは入れません。生成方法は [秘密情報とtoken生成](/security/tokens) を参照してください。

## host直接起動

Worker hostへ映像生成の外部依存を導入します。

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg fontconfig fonts-noto-cjk
ffmpeg -version
fc-match -f '%{file}\t%{lang}\n' ':lang=ja'
test -r /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

`fc-match`の出力は、先頭が読めるfont fileで、tab以降のlanguage listに`ja`を含むことを確認します。`ffmpeg`、`fontconfig`、`fonts-noto-cjk`は外部packageのためservice installerでは導入しません。

`artifact-manifest.json`を含むarchive-only形式のhost releaseを使います。管理端末で
archive本体だけをdownloadしてGitHub Attestationを確認し、元`.tar.gz`だけを
サーバーへ転送します。サーバーではbasenameを変更せずroot-owned directoryへ
固定し、元archiveと展開directoryを隣接させて、archive直下で次を実行します。

公開`v1.3.1`のarchive-only releaseを使用し、古いreleaseへ読み替えないでください。

管理端末:

```bash
gh release download v1.3.1 --repo Kome-Lab/Autostream-Worker \
  --pattern 'autostream-worker_v1.3.1_linux_amd64.tar.gz' \
  --clobber
gh attestation verify autostream-worker_v1.3.1_linux_amd64.tar.gz \
  --repo Kome-Lab/Autostream-Worker \
  --signer-workflow Kome-Lab/Autostream-Worker/.github/workflows/release-host.yml \
  --deny-self-hosted-runners
```

確認済みの元archiveだけを`/tmp`へ転送した後のサーバー:

```bash
sudo install -d -o root -g root -m 0755 /opt/autostream/releases/artifacts
sudo install -o root -g root -m 0644 /tmp/autostream-worker_v1.3.1_linux_amd64.tar.gz /opt/autostream/releases/artifacts/
cd /opt/autostream/releases/artifacts
sudo test ! -e autostream-worker_v1.3.1_linux_amd64
sudo test ! -L autostream-worker_v1.3.1_linux_amd64
sudo tar --no-same-owner --no-same-permissions -xzf autostream-worker_v1.3.1_linux_amd64.tar.gz
sudo ./autostream-worker_v1.3.1_linux_amd64/install-autostream-worker
```

installerはarchive内部の`artifact-manifest.json`、`checksums.txt`、host
architecture、binary versionを検証し、元archiveのSHA-256を記録してから、
`autostream` account、rollback用の内部release、
systemd unit、env placeholder、data directory、
`/usr/local/bin/autostream-worker`を配置します。既存の直接配置binaryはmanaged配置へ
移行し、既存envは保持します。旧fileは
`/var/backups/autostream/install-migrations/worker`へroot専用で退避します。内部の
`/opt/autostream/worker/current`やmarkerは
手動編集しません。installerはserviceを開始せず、Docker Compose、container、
imageは変更しません。詳しい取得と検証手順は
[Linuxホストで直接動かす](/deployment/host)を参照してください。

外部archive sidecarと`release-manifest.json*`は自動Updater/旧client互換のため
releaseには残りますが、手動導入ではdownloadもuploadもしません。手動導入には
公開`v1.3.1` archiveを使用します。`v1.2.x`から更新する場合もenvとNode
`config.yml`、起動中の旧`MainPID`は保持されます。installer成功後に明示的に
restartし、既存設定portのhealthと新versionを確認します。詳細は
[既存環境を更新するとき](/deployment/host#既存環境を更新するとき)を参照して
ください。service installerはHost Agentを自動導入しません。

source checkoutからbuildしたlocal binaryは開発確認用です。既存releaseへ
`artifact-manifest.json`やmarkerを後付けせず、自動更新に使うbinaryは新しい
immutable releaseとして公開してください。

`/etc/autostream/worker.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-worker/config.yml
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
FFMPEG_BIN=ffmpeg
TZ=Asia/Tokyo
```

root-ownedの`/etc/autostream/worker.env`へ、Workerが使う日本語fontの絶対pathを必ず設定します。標準のNoto CJK fontを使う例は次のとおりです。

```text
AUTOSTREAM_SCENE_FONT_FILE=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

指定fileは`autostream` userから読めるregular fileにし、`ProtectHome=true`のsystemd unitから参照できないhome directoryへ置きません。fontを解決できない場合はscene rendererをreadyにせず、文字を欠いたまま配信を始めません。

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable autostream-worker
sudo systemctl start autostream-worker
sudo systemctl status autostream-worker
```

この時点で `/etc/autostream-worker/config.yml` がまだ無い場合でも、Worker は終了せず `node config pending: waiting for /etc/autostream-worker/config.yml` を出して待機します。Auto Configure コマンドで `config.yml` を作成した後は、登録、heartbeat、runtime config の初期読込を確実にそろえるため Worker を再起動します。

## Control Panelで登録する

1. Node登録で `worker` を選び、Node名、Host、Port、SSL、説明を入力します。
2. 作成後の Configuration で `config.yml` または Auto Configure コマンドを取得します。
3. `config.yml` を `/etc/autostream-worker/config.yml` に配置します。Node Runtime Token と `stream_ingest.signing_key` を含むため、生成直後だけ取得でき、ファイル権限は `0640` に制限されます。
4. Worker が未起動なら起動します。先に起動して pending になっていた場合は `sudo systemctl restart autostream-worker` を実行します。
5. Service Health で online、報告バージョン、Capability が表示されることを確認します。
6. Worker Management または Stream assignment planner で stream に primary として割り当てます。
7. Streams の Worker event test を実行します。

## 配信中の動き

1. Control Panel が Worker へ job を送ります。
2. Worker が runtime config を取り直します。
3. 自分が primary に割り当てられたstreamだけを処理します。
4. overlayやcaptionなどのeventをscene stateへ反映します。
5. Discord Bot から来る参加者、active speaker、chat event は stream-scoped `worker_events` token で検証します。
6. 参加者名・アイコン、発言中の緑枠、現在時刻、字幕、チャットを含む映像を生成します。
7. stream job に含まれる選択済みEncoder Recorderへjob-scopedに暗号化したSRT over UDPで生成映像を送ります。
8. Control Panel 経由で Observability へ状態や失敗を送ります。

standby Worker は予備です。通常はstart対象にならず、primaryへ切り替えた後に使います。

## 確認ポイント

| 確認 | 正常な状態 |
| --- | --- |
| Service Health | `worker` が online |
| Assignment | 対象streamで primary |
| Worker event test | current time やcaption testが成功 |
| Scene renderer | 参加者、発言中の緑枠、現在時刻、字幕、チャットを含む映像が生成される |
| Encoder Recorder | 選択されたWorkerの映像を受信し、ウォーターマークを重ねたpreviewを生成する |
| Observability | worker event failures が増えない |

## Dockerで起動する場合

Worker Docker imageは`ffmpeg`、`fontconfig`、`fonts-noto-cjk`を含み、`AUTOSTREAM_SCENE_FONT_FILE`の既定値をNoto CJKのcontainer内pathに固定します。compose では Panel が生成した `config.yml` を read-only mount します。env には `AUTOSTREAM_NODE_CONFIG=/etc/autostream-worker/config.yml` だけを指定し、`CONTROL_PANEL_TOKEN` や `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` を手入力しません。

Docker network 上で Control Panel と Encoder Recorder に到達できることを確認してください。SRT/UDPはNode APIのHTTPSやCloudflare Tunnelとは別経路です。同一Compose networkではEncoder Recorderのadvertise hostにservice DNSを使い、hostへUDPをpublishしません。別host構成だけEncoder RecorderのSRT listen portをhostへUDP publishし、primary Workerからadvertise hostへ到達できるようhost firewall、cloud firewall、NATを設定します。参加者・チャットのアイコン取得にはWorkerから `cdn.discordapp.com:443` と `media.discordapp.net:443` へのDNS/HTTPS outboundも必要です。到達できない場合も配信は止めず、名前とplaceholderを描画します。標準構成では Worker から Observability へ直接接続しません。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| event test が失敗する | Worker assignment、stream ingest token、署名鍵 |
| 参加者名・字幕・チャットが描画されない | `fc-match -f '%{file}\t%{lang}\n' ':lang=ja'`の`ja` coverage、`AUTOSTREAM_SCENE_FONT_FILE`、`sudo -u autostream test -r <fontの絶対path>` |
| Worker映像がEncoderへ届かない | Primary Worker/Encoder assignment、配信jobの映像送信先、両Node間の到達性 |
| standbyのまま処理されない | primary assignment に切り替える |
| Service Health が warning/offline | heartbeat interval、`AUTOSTREAM_NODE_CONFIG`、Node Runtime Token |
| 映像送信が失敗する | Encoder Recorder のService Health、network、job-scoped credential |
| Productionで起動しない | runtime config必須設定とservice registrationの失敗理由 |

## 次に読むページ

- [サービス割り当て](/control-panel/services-workers)
- [配信画面](/control-panel/streams)
- [状態を確認する](/operations/monitoring)
