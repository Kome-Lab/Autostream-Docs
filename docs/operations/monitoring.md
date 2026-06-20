# 状態を確認する

Control Panel とログを使って、AutoStream が正しく動いているか確認する方法です。

## Control Panelで見るところ

- Control Panel が開けるか
- Worker が online か
- Encoder Recorder が online か
- 配信状態が starting、running、stopped のどれか
- 最後のエラーが出ていないか
- 録画や保存の結果が成功しているか

## サーバーで見るところ

1. サービスが起動しているか確認します。
2. ログに同じエラーが繰り返し出ていないか確認します。
3. ディスク容量が不足していないか確認します。
4. CPU やメモリが常に高すぎないか確認します。
5. 外部保存先や配信先に接続できるか確認します。

## 異常に気づいたとき

- running にならない場合は、配信先と Worker を確認します。
- 録画だけ失敗する場合は、Encoder Recorder と保存先を確認します。
- 通知だけ来ない場合は、通知先の設定を確認します。
- ログを共有するときは、token や stream key が含まれていないか確認します。

日常的な確認項目は [日常チェック](/operations/daily-checklist) にまとめています。
