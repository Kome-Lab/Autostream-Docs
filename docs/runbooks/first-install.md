# 最初のインストール

このページでは、AutoStream を初めて動かすまでの全体手順を説明します。細かい設定値は環境によって変わるため、ここでは「どの順番で進めるか」と「どこで確認するか」に絞ります。

## 用意するもの

- Linux サーバー、または Docker を動かせる環境
- AutoStream の release artifact、または Docker image
- Discord Bot token
- 配信先の URL や stream key
- 録画や保存に使う保存先
- Control Panel にアクセスするための公開 URL

実際の token や stream key は GitHub、チャット、スクリーンショットに載せないでください。

## サーバー準備

1. サーバーの時刻が正しいことを確認します。
2. OS を更新します。
3. Docker で動かす場合は Docker と Docker Compose を入れます。
4. host 直接起動の場合は、systemd と必要なパッケージを確認します。
5. 録画を置くディスクに十分な空き容量を用意します。
6. Control Panel を公開するドメインや URL を決めます。

## 基本の流れ

1. サーバーに必要なパッケージを入れます。
2. `.env.example` をコピーして、自分の環境用の env ファイルを作ります。
3. 最初は最小構成で Control Panel、Worker、Encoder Recorder を起動します。
4. ブラウザで Control Panel を開き、ログインできることを確認します。
5. Discord、配信先、録画保存先、通知先を登録します。
6. 短いテスト配信を実行します。
7. 映像、音声、録画、保存、通知を確認します。

## 起動する順番

1. database を起動します。
2. Control Panel を起動します。
3. Worker を起動します。
4. Encoder Recorder を起動します。
5. Discord Bot を起動します。
6. Control Panel で全サービスが見えることを確認します。

Docker Compose を使う場合はまとめて起動できますが、問題が出たときはこの順番でログを確認すると原因を探しやすくなります。

## 最初の確認

- Control Panel の画面が開ける
- 各サービスの状態が online になっている
- Discord Bot が対象のサーバーで動いている
- 配信先に接続できる
- 録画ファイルが作られる
- エラー通知が届く

## 次にやること

インストールできたら、[最初の配信を始める](/runbooks/start-first-stream) に進んでください。Docker で動かす場合は [Dockerで動かす](/deployment/docker) も確認してください。
