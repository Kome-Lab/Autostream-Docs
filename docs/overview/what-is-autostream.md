# AutoStreamとは

AutoStream は、配信に必要な作業をまとめて管理するためのソフトウェアです。

通常は、音声の接続、配信、録画、保存、通知をそれぞれ別々に管理する必要があります。AutoStream はそれらを役割ごとのサービスに分け、Control Panel からまとめて扱えるようにします。

## 向いている使い方

- Discord の会話を使って配信したい
- 配信を録画して後で保存したい
- 複数の配信サービスをサーバー上で安定して動かしたい
- 管理画面で状態を確認したい

## 主な構成

- Control Panel: 管理画面と設定の中心
- Discord Bot: Discord との接続
- Encoder Recorder: 配信と録画
- Worker: 配信中に使う補助データの処理
- Observability: 状態確認、通知、トラブル調査

## 最初にやること

まずは [最初のインストール](/runbooks/first-install) を読み、Docker でまとめて起動する方法から始めるのがおすすめです。
