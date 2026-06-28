# Linuxホストで直接動かす

Docker を使わず、release artifact を Linux サーバーに置いて直接起動する方法です。systemd で常駐させたい場合はこちらを使います。

サービスごとの具体的な配置、env、Control Panel登録、起動確認は [サービス共通の導入と運用](/services/host-operations) から進んでください。

## 用意するもの

- Linux サーバー
- 各サービスの release artifact
- private repo の release artifact を読める GitHub CLI (`gh auth login` 済み)
- `.env.example` を元にした env ファイル
- systemd の service example
- ffmpeg など、サービスごとに必要な host 側パッケージ

## release artifact の実際の形

Host Release workflow が作る archive は、`autostream-<service>_<version>_linux_<arch>.tar.gz` です。展開すると archive 名と同じ directory が 1 つ作られ、その中に次のファイルが入ります。

```text
autostream-control-panel_v1.0.0_linux_amd64/
  bin/control-panel
  systemd/autostream-control-panel.service.example
  .env.example
  checksums.txt
  README.install.md
  share/autostream-control-panel/   # Control Panel のみ
```

ほかの service も同じ形式で、`bin/discord-bot`、`bin/encoder-recorder`、`bin/observability` のように service ごとの実行ファイルが入ります。

GitHub Release に添付されている `.sha256` は `artifacts/<asset>.tar.gz` というパスを含みます。private repo の release asset は生の URL では `Not Found` になりやすいため、標準手順では `gh release download` を使います。`sha256sum -c` をそのまま使う場合は、download file と `.sha256` を `/opt/autostream/releases/artifacts/` に置き、`/opt/autostream/releases` で実行してください。

```bash
cd /opt/autostream/releases
sha256sum -c artifacts/autostream-control-panel_v1.0.0_linux_amd64.tar.gz.sha256
tar -xzf artifacts/autostream-control-panel_v1.0.0_linux_amd64.tar.gz -C /opt/autostream/releases
cd /opt/autostream/releases/autostream-control-panel_v1.0.0_linux_amd64
```

2026-06-29 時点では `Autostream-Worker` の GitHub Release asset は公開されていません。Worker は source checkout から build するか、Worker repo の Host Release workflow で artifact を作ってから同じ手順に合わせます。

## 手順

1. release から対象サービスの `linux_amd64` または `linux_arm64` artifact をダウンロードします。
2. `.sha256` と `.tar.gz` を `artifacts/` directory に置いた状態で checksum を確認します。
3. `/opt/autostream/releases` に展開し、作成された `autostream-<service>_<version>_linux_<arch>/` へ移動します。
4. `bin/<service>` に実行権限があることを確認します。
5. `.env.example` を参考に env ファイルを作ります。
6. `systemd/*.service.example` を `/etc/systemd/system/` に配置し、パスを自分の環境に合わせます。
7. `systemctl daemon-reload` を実行します。
8. `systemctl start <service>` で起動します。
9. `systemctl status <service>` と Control Panel で状態を確認します。

## ディレクトリ例

- 展開先: `/opt/autostream/releases/autostream-<service>_<version>_linux_<arch>`
- 実行ファイル: `/opt/autostream/releases/autostream-<service>_<version>_linux_<arch>/bin/<service>`
- env ファイル: `/etc/autostream/<service>.env`
- 録画保存先: `/var/lib/autostream/recordings`
- ログ: `journalctl -u <service>`
- systemd unit: `/etc/systemd/system/<service>.service`

サービスごとに置き場所を分けると、更新や停止を個別に行いやすくなります。

## 確認ポイント

- 実行ファイルが起動できる
- env ファイルの読み込みに失敗していない
- systemd のログに secret が出ていない
- Control Panel からサービスが見える
- サーバー再起動後も自動起動する

## サービス別の手順

| サービス | 手順 |
| --- | --- |
| Control Panel | [Control Panelを導入する](/services/control-panel-install) |
| Discord Bot | [Discord Botを導入する](/services/discord-bot-install) |
| Worker | [Workerを導入する](/services/worker-install) |
| Encoder Recorder | [Encoder Recorderを導入する](/services/encoder-recorder-install) |
| Observability | [Observabilityを導入する](/services/observability-install) |

## 更新するとき

1. 対象サービスを停止します。
2. 既存の実行ファイルを退避します。
3. 新しい artifact を展開します。
4. env ファイルに新しい必須項目がないか確認します。
5. サービスを起動します。
6. `systemctl status` と Control Panel で確認します。

## Dockerとの使い分け

まず簡単に試すなら Docker が向いています。既存の Linux 運用や監視に合わせたい場合、または systemd で個別管理したい場合は host 直接起動が向いています。
