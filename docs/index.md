# AutoStream ドキュメント

AutoStream は、Discord の音声を使った配信を、準備から録画、保存、状態確認までまとめて扱うためのシステムです。

このドキュメントは、初めて使う人が迷わず始められるように、細かい内部仕様よりも「何をすればよいか」を中心にまとめています。

## まず読むページ

1. [AutoStreamとは](/overview/what-is-autostream)
2. [最初のインストール](/runbooks/first-install)
3. [Dockerで動かす](/deployment/docker)
4. [設定項目](/configuration/environment-variables)
5. [最初の配信を始める](/runbooks/start-first-stream)
6. [困ったとき](/troubleshooting/)

## AutoStreamでできること

- Discord の音声を配信に使う
- YouTube Live などへ配信する
- 配信内容を録画して保存する
- 必要に応じて Google Drive へ保存する
- 管理画面からサービスの状態を確認する

## 使う前に用意するもの

- AutoStream を動かす Linux サーバー
- Docker、または直接インストールできる実行環境
- Discord Bot の設定
- YouTube など配信先の設定
- 必要に応じて保存先や通知先の設定

## 大事な注意

パスワード、トークン、配信キー、Webhook URL はドキュメントや GitHub に書かないでください。実際の値はサーバーの環境変数、secret store、または Control Panel に設定します。
