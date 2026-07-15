# 安全に公開する

AutoStream をインターネットから使えるようにする場合の基本方針です。細かい攻撃手順ではなく、公開前に確認する運用上のポイントだけをまとめます。

## 公開前の確認

- Control Panel は HTTPS で公開する
- reverse proxy の後ろに置く
- 不要なポートを外部公開しない
- 管理画面へアクセスできる人を制限する
- サーバーの firewall を有効にする
- OS と Docker image を定期的に更新する

## 運用中に続けること

- 管理者アカウントを定期的に見直す
- 使っていない配信先や通知先を削除する
- token を入れ替えたら古い値を無効化する
- ログやスクリーンショットに secret が出ていないか確認する
- `/stream-previews/` の署名token付きpathをreverse proxy、CDN、WAF、APMのaccess logへ残さない
- バックアップの保存先にもアクセス制限をかける

## 公開しない情報

- 実際の secret
- VLC等へ発行した配信preview URL
- 内部監査ログ
- 脆弱性の詳しい再現手順
- 実運用のスクリーンショットや検証証跡

配信preview URLは最大12時間の期限がありますが、期限内はURLを知る人がactive streamを再生できるbearer credentialです。チケット、チャット、メール、監査metadataへ貼らず、漏えいした場合は配信停止で直ちに無効化し、再開後に新しいURLを発行します。preview trafficはControl Panel proxyを通るため、帯域制限やDDoS対策もControl Panelの公開経路に適用してください。
