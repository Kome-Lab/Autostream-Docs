# Dockerで動かす

Docker は、複数の AutoStream サービスをまとめて起動したい場合に向いています。最初に試すときも、本番サーバーに置くときも、同じ考え方で進められます。

## 手順

1. Docker と Docker Compose をサーバーに入れます。
2. release に含まれる compose ファイル、または公開されている compose 例を配置します。
3. `.env.example` を参考に env ファイルを作ります。
4. token、URL、保存先など、自分の環境で必要な値だけを入れます。
5. `docker compose config` で設定の書式を確認します。
6. `docker compose up -d` で起動します。
7. Control Panel を開き、サービス状態を確認します。

## よく確認する場所

- `docker compose ps`: コンテナが起動しているか
- `docker compose logs`: 起動時のエラーが出ていないか
- Control Panel: Worker や Encoder Recorder が見えているか
- 保存先ディレクトリ: 録画ファイルが作られるか

## 本番で気をつけること

- Control Panel は HTTPS の reverse proxy の後ろに置きます。
- env ファイルは公開リポジトリに置かないでください。
- サーバーの firewall で不要なポートを閉じます。
- token を変更したら、関連するコンテナを再起動します。

Docker で起動できたら、[最初の配信を始める](/runbooks/start-first-stream) に進んでください。
