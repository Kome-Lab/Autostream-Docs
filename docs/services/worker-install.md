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

WorkerのGitHub Release assetは公開済みです。`v1.0.16`のLinux amd64/arm64 archiveは手動導入に利用できますが、immutableな`release-manifest.json`がないためUpdater管理には使いません。Control Panelから更新する新規構成では、manifest付きで新しく公開されたreleaseを選び、archive同梱の`README.install.md`に従って導入します。

READMEはarchive、manifest、archive内fileを検証し、`/opt/autostream/worker/releases/<version>-<digest12>`を作って`/opt/autostream/worker/current`を切り替え、systemd unitとenvを配置します。`/usr/local/bin/autostream-worker`は`current/bin/autostream-worker`への互換symlinkです。詳しい検証手順は[Linuxホストで直接動かす](/deployment/host)を参照してください。

source checkoutからbuildしたlocal binaryは開発確認用です。既存releaseへmanifestやmarkerを後付けせず、自動更新に使うbinaryは新しいimmutable releaseとして公開してください。

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
