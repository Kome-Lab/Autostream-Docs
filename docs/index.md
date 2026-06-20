<div class="doc-hero">

# AutoStream ドキュメント

AutoStream は、Discord の音声を使った配信を、準備から録画、保存、状態確認までまとめて扱うためのシステムです。初めて使う人が、導入、設定、最初の配信、日常運用まで順番に進められるようにまとめています。

</div>

## まず読むページ

<div class="doc-grid">
  <a class="doc-card" href="/overview/what-is-autostream"><strong>1. 全体像を知る</strong><span>AutoStream でできることと、どのサービスが関係するかを確認します。</span></a>
  <a class="doc-card" href="/overview/service-roles"><strong>2. サービス構成</strong><span>Control Panel、Bot、Worker、Encoder、Observability の役割を確認します。</span></a>
  <a class="doc-card" href="/runbooks/first-install"><strong>3. インストール</strong><span>サーバー準備、起動順、最初の確認まで進めます。</span></a>
  <a class="doc-card" href="/configuration/provider-integrations"><strong>4. 外部連携</strong><span>Discord、YouTube、Google Drive、通知先の設定場所を確認します。</span></a>
  <a class="doc-card" href="/services/encoder-recorder"><strong>5. 配信と録画</strong><span>FFmpeg、録画、upload、output relay の考え方を確認します。</span></a>
  <a class="doc-card" href="/operations/incidents-notifications"><strong>6. 監視と通知</strong><span>異常検知、通知、インシデント対応の流れを確認します。</span></a>
  <a class="doc-card" href="/troubleshooting/"><strong>7. 困ったとき</strong><span>起動、接続、文字化けなどの確認手順に戻ります。</span></a>
</div>

## AutoStreamでできること

- Discord の音声を配信に使う
- YouTube Live などへ配信する
- 配信内容を録画して保存する
- 必要に応じて Google Drive へ保存する
- 管理画面からサービスの状態を確認する
- 各サービスを個別に scale / restart しやすい構成で運用する

## 使う前に用意するもの

- AutoStream を動かす Linux サーバー
- Docker、または直接インストールできる実行環境
- Discord Bot の設定
- YouTube など配信先の設定
- 必要に応じて保存先や通知先の設定

<div class="tip-box">
実際の token、配信キー、Webhook URL は公開リポジトリに置かず、サーバーの env、secret store、または Control Panel に設定してください。
</div>

## 機能別に読む

- 配信先や保存先を設定する: [外部連携の設定](/configuration/provider-integrations)
- 録画と保存先を決める: [録画と保存先の設定](/configuration/archive-storage)
- サービスごとの設定を確認する: [サービス構成](/overview/service-roles)
- HTTPS 公開を整える: [HTTPSとreverse proxy](/deployment/reverse-proxy)
- 通知と監視を使う: [インシデントと通知](/operations/incidents-notifications)

## 大事な注意

パスワード、トークン、配信キー、Webhook URL はドキュメントや GitHub に書かないでください。実際の値はサーバーの環境変数、secret store、または Control Panel に設定します。
