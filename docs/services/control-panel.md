# Control Panel

Control Panel は AutoStream の中心です。管理画面、認証、ユーザー、権限、配信設定、provider 連携、サービス状態を扱います。

## Control Panelで管理するもの

- 管理者とユーザー
- ロールと権限
- Discord Bot の設定
- YouTube など配信先
- Google Drive など保存先
- 通知先
- サービス登録と heartbeat
- 配信ジョブの開始、停止、再試行

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `AUTOSTREAM_BIND_ADDR` | Control Panel が待ち受けるアドレス |
| `AUTOSTREAM_PUBLIC_URL` | ブラウザや他サービスから見える URL |
| `DATABASE_URL` | Control Panel 用 database |
| `AUTOSTREAM_SESSION_SECRET` | session 保護 |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | 保存 secret の暗号化 |
| `SERVICE_CALL_TOKEN` | Control Panel から各サービスへ送る token |
| `OBSERVABILITY_URL` | Observability の URL |

## 初回セットアップ

1. database を用意します。
2. env ファイルを作成します。
3. Control Panel を起動します。
4. 初回管理者を作成します。
5. HTTPS の公開 URL からログインできることを確認します。
6. Discord、配信先、保存先、通知先を順番に登録します。
7. 各サービスが登録され、online になることを確認します。

## 運用中の見方

- サービス一覧で offline のサービスがないか確認します。
- 配信ジョブが starting のまま止まっていないか確認します。
- 録画や保存の失敗がないか確認します。
- 設定画面に raw secret が表示されていないことを確認します。

Control Panel が動いていても、Discord 接続や FFmpeg 実行は別サービスの責務です。問題の場所は [サービス構成](/overview/service-roles) で切り分けてください。
