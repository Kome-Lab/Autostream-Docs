# Linuxホストで直接動かす

Docker を使わず、release artifact を Linux サーバーに置いて直接起動する方法です。systemd で常駐させたい場合はこちらを使います。

## 用意するもの

- Linux サーバー
- 各サービスの release artifact
- `.env.example` を元にした env ファイル
- systemd の service example
- ffmpeg など、サービスごとに必要な host 側パッケージ

## 手順

1. release から対象サービスの `linux_amd64` または `linux_arm64` artifact をダウンロードします。
2. サーバー上の `/opt/autostream/<service>` など、管理しやすい場所へ展開します。
3. `bin/<service>` に実行権限があることを確認します。
4. `.env.example` を参考に env ファイルを作ります。
5. `systemd/*.service.example` を `/etc/systemd/system/` に配置し、パスを自分の環境に合わせます。
6. `systemctl daemon-reload` を実行します。
7. `systemctl start <service>` で起動します。
8. `systemctl status <service>` と Control Panel で状態を確認します。

## ディレクトリ例

- 実行ファイル: `/opt/autostream/<service>/bin/<service>`
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

## 更新するとき

1. 対象サービスを停止します。
2. 既存の実行ファイルを退避します。
3. 新しい artifact を展開します。
4. env ファイルに新しい必須項目がないか確認します。
5. サービスを起動します。
6. `systemctl status` と Control Panel で確認します。

## Dockerとの使い分け

まず簡単に試すなら Docker が向いています。既存の Linux 運用や監視に合わせたい場合、または systemd で個別管理したい場合は host 直接起動が向いています。
