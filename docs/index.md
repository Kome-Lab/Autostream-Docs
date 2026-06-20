<div class="doc-hero">

# AutoStream ドキュメント

AutoStream は、Discord の音声を使った配信を、準備から録画、保存、状態確認までまとめて扱うためのシステムです。初めて使う人が、導入、設定、最初の配信、日常運用まで順番に進められるようにまとめています。

</div>

## まず読むページ

<div class="doc-grid">
  <a class="doc-card" href="/overview/what-is-autostream"><strong>1. 全体像を知る</strong><span>AutoStream でできることと、どのサービスが関係するかを確認します。</span></a>
  <a class="doc-card" href="/runbooks/first-install"><strong>2. インストールする</strong><span>サーバー準備、起動順、最初の確認まで進めます。</span></a>
  <a class="doc-card" href="/configuration/environment-variables"><strong>3. 設定する</strong><span>env に置く値と Control Panel で管理する値を分けて確認します。</span></a>
  <a class="doc-card" href="/runbooks/start-first-stream"><strong>4. 最初の配信</strong><span>短いテスト配信で映像、音声、録画、通知を確認します。</span></a>
  <a class="doc-card" href="/operations/daily-checklist"><strong>5. 日常運用</strong><span>配信前、配信中、配信後に見るポイントを確認します。</span></a>
  <a class="doc-card" href="/troubleshooting/"><strong>6. 困ったとき</strong><span>起動、接続、文字化けなどの確認手順に戻ります。</span></a>
</div>

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

<div class="tip-box">
実際の token、配信キー、Webhook URL は公開リポジトリに置かず、サーバーの env、secret store、または Control Panel に設定してください。
</div>

## 大事な注意

パスワード、トークン、配信キー、Webhook URL はドキュメントや GitHub に書かないでください。実際の値はサーバーの環境変数、secret store、または Control Panel に設定します。
