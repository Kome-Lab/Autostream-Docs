# Workerを導入する

Worker は、配信中に必要な overlay、caption、participant、active speaker、current time などのイベントを作り、Encoder Recorder へ送るサービスです。映像をエンコードするサービスではなく、配信の制御イベントを担当します。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| Worker Node Agent `config.yml` | `/etc/autostream-worker/config.yml` |
| Worker Node名、Host、Port、SSL | Control Panel の Node登録画面 |
| Stream ingest signing key | Node登録時に `config.yml` の `stream_ingest.signing_key` として配布 |

Encoder Recorder のURLやstream ingest tokenは、通常 Control Panel の stream job から渡されます。本番envに固定の `ENCODER_RECORDER_URL` や固定tokenを置かない運用にします。

Worker の Observability signal は、Node Runtime Token で Control Panel に送ります。Worker env に stream ingest signing key や Observability 接続用tokenは入れません。生成方法は [秘密情報とtoken生成](/security/tokens) を参照してください。

## host直接起動

`artifact-manifest.json`を含むarchive-only形式のhost releaseを使います。管理端末で
archive本体だけをdownloadしてGitHub Attestationを確認し、元`.tar.gz`だけを
サーバーへ転送します。サーバーではbasenameを変更せずroot-owned directoryへ
固定し、元archiveと展開directoryを隣接させて、archive直下で次を実行します。

> [!CAUTION]
> 2026-07-31現在、公開済み最新`v1.3.0`は旧4-file手動導入契約です。次の
> `v1.3.1`は未公開のarchive-only候補なので、matching releaseが公開されるまで
> 実行せず、`v1.3.0`へ読み替えないでください。

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
releaseには残りますが、手動導入ではdownloadもuploadもしません。既存のimmutableな
`v1.3.0`は旧4-file手動導入契約です。`v1.2.x`から更新する場合もenvとNode
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
TZ=Asia/Tokyo
```

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
4. overlayやcaptionなどのeventを作ります。
5. Discord Bot から来る参加者、active speaker、chat event は stream-scoped `worker_events` token で検証します。
6. stream job に含まれる Encoder Recorder へeventを送ります。
7. Control Panel 経由で Observability へ状態や失敗を送ります。

standby Worker は予備です。通常はstart対象にならず、primaryへ切り替えた後に使います。

## 確認ポイント

| 確認 | 正常な状態 |
| --- | --- |
| Service Health | `worker` が online |
| Assignment | 対象streamで primary |
| Worker event test | current time やcaption testが成功 |
| Encoder Recorder | Worker event sidecar が更新される |
| Observability | worker event failures が増えない |

## Dockerで起動する場合

compose では Panel が生成した `config.yml` を read-only mount します。env には `AUTOSTREAM_NODE_CONFIG=/etc/autostream-worker/config.yml` だけを指定し、`CONTROL_PANEL_TOKEN` や `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` を手入力しません。

Docker network 上で Control Panel と Encoder Recorder に到達できることを確認してください。標準構成では Worker から Observability へ直接接続しません。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| event test が失敗する | Worker assignment、Encoder Recorder URL、stream ingest token、署名鍵 |
| standbyのまま処理されない | primary assignment に切り替える |
| Service Health が warning/offline | heartbeat interval、`AUTOSTREAM_NODE_CONFIG`、Node Runtime Token |
| event送信が失敗する | Encoder Recorder のService Health、network、inbound token |
| Productionで起動しない | runtime config必須設定とservice registrationの失敗理由 |

## 次に読むページ

- [サービス割り当て](/control-panel/services-workers)
- [配信画面](/control-panel/streams)
- [状態を確認する](/operations/monitoring)
