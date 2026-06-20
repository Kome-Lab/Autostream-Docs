# 設定項目

このページでは AutoStream の設定を、初めて使う人向けに整理します。

## 基本の考え方

起動に必要な最小設定は env ファイルやサーバーの環境変数に置きます。配信先、保存先、通知先など運用中に変える値は、できるだけ Control Panel で管理します。

## 自分で用意する値

- Discord Bot の token
- YouTube など配信先の情報
- Google Drive など保存先の認証情報
- 通知用 Webhook URL
- サーバーごとの公開URLやポート

## 書いてはいけないもの

実際の token、配信キー、パスワードはドキュメントや GitHub に書かないでください。env example には placeholder だけを書きます。
