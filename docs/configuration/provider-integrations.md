# 外部連携の設定

AutoStream は Discord、YouTube、Google Drive、通知先など複数の外部サービスと連携します。実際の provider 値は公開ドキュメントや GitHub に置かず、Control Panel または secret store で管理します。

## 連携ごとの置き場所

| 連携 | 主な値 | 置く場所 |
| --- | --- | --- |
| Discord | Bot token、Bot service ID、配信枠ごとの guild / voice / chat channel | Control Panel |
| YouTube | RTMPS URL、stream key | Control Panel |
| Google Drive | folder、OAuth connected account | Control Panel |
| 通知 | Webhook URL、SMTP password | Control Panel / Observability |
| サービス間通信 | Node Runtime Token、allowed hosts | Node Agent config / secret store |

## Discord

1. Discord 側で Bot を作ります。
2. Bot を対象 server に招待します。
3. Control Panel の Discord Settings に Bot token と Bot service ID を登録します。
4. Streams の配信枠に guild / voice channel / 必要なら chat channel を登録します。
5. Discord Bot service を起動します。
6. テスト配信で voice channel へ参加するか確認します。

## YouTube

1. YouTube 側で配信枠を作ります。
2. RTMPS URL と stream key を確認します。
3. Control Panel に配信先として登録します。
4. 本番では output relay を使い、FFmpeg の process 引数に stream key を出さない構成にします。

## Google Drive

1. 保存先 folder を決めます。
2. OAuth connected account を用意します。
3. Control Panel に archive destination と profile を登録します。
4. 短い録画で upload できるか確認します。

## 通知

1. 通知先を作ります。
2. Webhook URL や SMTP 情報を Control Panel / Observability に登録します。
3. テスト通知を送ります。
4. 通知文に stream 名や service 名が含まれるか確認します。

漏れた可能性がある token や URL は、provider 側で無効化して作り直してください。
