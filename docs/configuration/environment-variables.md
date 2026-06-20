# 設定項目

このページでは AutoStream の設定を、初めて使う人向けに整理します。

## 基本の考え方

起動に必要な最小設定は env ファイルやサーバーの環境変数に置きます。配信先、保存先、通知先など運用中に変える値は、できるだけ Control Panel で管理します。

## 最初に設定する値

- サービスが使う database の接続情報
- Control Panel の公開 URL
- サービス間通信に使う内部 URL
- 初回管理者を作るための設定
- 保存先ディレクトリや一時ファイル置き場

## Control Panel で管理する値

- Discord Bot の token
- YouTube など配信先の情報
- Google Drive など保存先の認証情報
- 通知用 Webhook URL
- 配信ごとのタイトルや説明文

運用中に変える可能性がある値は、できるだけ Control Panel に寄せると管理しやすくなります。

## 設定後の確認

1. サービスを起動します。
2. Control Panel にログインします。
3. サービス一覧で online になっているか確認します。
4. 配信先や通知先のテストを実行します。
5. ログに token や stream key が表示されていないか確認します。

## 書いてはいけないもの

実際の token、配信キー、パスワードはドキュメントや GitHub に書かないでください。env example には placeholder だけを書きます。
