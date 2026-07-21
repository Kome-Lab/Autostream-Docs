# 設定項目

このページでは AutoStream の設定を、初めて使う人向けに整理します。

## 基本の考え方

起動に必要な最小設定は env ファイルやサーバーの環境変数に置きます。配信先、保存先、通知先など運用中に変える値は、できるだけ Control Panel で管理します。

## 最初に設定する値

- サービスが使う database の接続情報
- Control Panel自身の公開URLとdatabase接続
- Node host固有の待受address、local保存先、output relay
- 初回管理者を作るための設定
- 保存先ディレクトリや一時ファイル置き場

## 設定場所の目安

| 種類 | 置く場所 |
| --- | --- |
| 起動に必要な database URL | env ファイル |
| Control Panelのbootstrap URL / database | Control Panelのenvファイル |
| 通常NodeのNode ID / Panel URL / Node Runtime Token / ingest署名鍵 | Panel生成のNode `config.yml` |
| streamごとのservice route / provider値 | Control Panel runtime config |
| Discord Bot token | Control Panel または secret store |
| 配信先の stream key | Control Panel |
| 通知用 Webhook URL | Control Panel |
| 録画ファイルのlocal path（既定値から変える場合） | Encoder Recorderのenvファイル |
| Google Drive destination / OAuth | Control Panel |
| 管理画面のタイムゾーン | Control Panel |
| 中央Update Agentの接続identity、GitHub token、API、SSH host inventory、target identity | 中央管理ホストのroot所有`/etc/autostream/updater.json`。接続identityだけAuto Configure、その他はlocal設定 |
| 更新対象のunit、path、backup command、Compose policy、image repository | 各管理対象ホストのroot所有`/etc/autostream/update-host.json` |

## Control Panel で管理する値

- Discord Bot の token
- YouTube など配信先の情報
- Google Drive など保存先の認証情報
- 通知用 Webhook URL
- 配信ごとのタイトルや説明文
- Streams、Audit Logs、Account の時刻表示に使うタイムゾーン

運用中に変える可能性がある値は、できるだけ Control Panel に寄せると管理しやすくなります。

ただしhost更新のprivileged targetはControl Panelや中央設定で変更しません。中央`updater.json`はroot所有、group `autostream-updater`、mode `0640`にし、各hostの`update-host.json`はroot所有`0600`にします。中央にはSSH routingとtarget identityだけ、privileged commandやpathはremote root設定だけに置き、画面や更新jobから任意commandやpathを渡せない境界を保ちます。詳細は[Control Panelからサービスを更新する](/operations/system-updates)を参照してください。

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
