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

2026-06-29 時点では `Kome-Lab/Autostream-Worker` の GitHub Release asset は公開されていません。release artifact だけで入れる場合は、先に Worker repo の Host Release workflow で `autostream-worker_<version>_linux_<arch>.tar.gz` を作る必要があります。ここでは source checkout から build する手順を示します。

```bash
cd /opt/autostream/src/autostream-worker
go build -o bin/autostream-worker ./cmd/worker

sudo install -o root -g root -m 0755 bin/autostream-worker /usr/local/bin/autostream-worker
sudo ln -sf /usr/local/bin/autostream-worker /usr/local/bin/worker
sudo install -d -o autostream -g autostream /var/lib/autostream/worker
sudo install -o root -g root -m 0644 systemd/autostream-worker.service.example /etc/systemd/system/autostream-worker.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/worker.env
```

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
sudo systemctl enable --now autostream-worker
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
