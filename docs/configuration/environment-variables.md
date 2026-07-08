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

## 設定場所の目安

| 種類 | 置く場所 |
| --- | --- |
| 起動に必要な database URL | env ファイル |
| サービス間の内部 URL | env ファイル |
| Discord Bot token | Control Panel または secret store |
| 配信先の stream key | Control Panel |
| 通知用 Webhook URL | Control Panel |
| 録画保存先 | env ファイルまたは Control Panel |
| 管理画面のタイムゾーン | Control Panel |

## Control Panel で管理する値

- Discord Bot の token
- YouTube など配信先の情報
- Google Drive など保存先の認証情報
- 通知用 Webhook URL
- 配信ごとのタイトルや説明文
- Dashboard、Streams、Audit Logs、Account の時刻表示に使うタイムゾーン

運用中に変える可能性がある値は、できるだけ Control Panel に寄せると管理しやすくなります。

## 設定後の確認

1. サービスを起動します。
2. Control Panel にログインします。
3. サービス一覧で online になっているか確認します。
4. 配信先や通知先のテストを実行します。
5. ログに token や stream key が表示されていないか確認します。

## 変更したあと

env ファイルを変更した場合は、対象サービスの再起動が必要です。Control Panel の設定だけを変えた場合は、画面上の保存結果とテスト機能で確認してください。

## 書いてはいけないもの

実際の token、配信キー、パスワードはドキュメントや GitHub に書かないでください。env example には placeholder だけを書きます。
