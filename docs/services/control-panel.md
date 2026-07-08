# Control Panel

Control Panel は AutoStream の中心です。管理画面、認証、ユーザー、権限、配信設定、外部連携、サービス状態、監視通知を扱います。

細かい画面操作は [Control Panel画面の全体像](/control-panel/) から順番に確認してください。このページでは、Control Panel service 自体の役割と、初期構築で必要な設定を整理します。

Linuxサーバーへの配置、systemd、Docker、初回起動、公開URL、database、web assets の手順は [Control Panelを導入する](/services/control-panel-install) にまとめています。

画面を操作する順番は、[Control Panel画面別操作ガイド](/control-panel/page-usage)を使います。画面の入力項目をまとめて確認したい場合は、[Control Panel項目リファレンス](/control-panel/field-reference)を使います。サービスごとの日常運用は、[各サービスの使い方](/services/runtime-usage)に分けています。

## Control Panelで管理するもの

| 領域 | 代表画面 | 管理するもの |
| --- | --- | --- |
| 配信運用 | Streams | stream、start / stop、readiness、service assignment |
| 配信先 | YouTube Outputs | RTMPS URL、stream key、Live API 設定 |
| Discord | Discord Settings + Streams | Bot token、Discord BOT Node、配信枠ごとの guild / voice channel、audio forward |
| 録画保存 | Archive Settings、Integrations、Archive | archive profile、Drive destination、local artifact管理、upload dry-run |
| サービス | Service Health、Node登録 | Node Runtime Token、heartbeat、capability、runtime config |
| ユーザー | Users、Roles、Security Settings | user、role、MFA、Passkey、secret 更新 |
| 監視 | Monitoring、Incidents、Diagnostics | metric、incident、通知、対応候補 |
| 監査 | Audit Logs | 操作履歴、CSV export |

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `AUTOSTREAM_BIND_ADDR` | Control Panel が待ち受けるアドレス |
| `AUTOSTREAM_PUBLIC_URL` | ブラウザや他サービスから見える URL |
| `DATABASE_URL` | Control Panel 用 database |
| `AUTOSTREAM_SESSION_SECRET` | session 保護 |
| `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | 保存 secret の暗号化 |
| `AUTOSTREAM_SETUP_TOKEN` | 初回管理者作成 |
| `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` | stream scoped ingest token の署名 |
| `SERVICE_CALL_TOKEN` | 旧構成からの移行用 fallback |

`AUTOSTREAM_PUBLIC_URL` は OAuth callback、cookie、他サービスからの参照に関係します。本番では HTTPS の外部 URL を入れます。

token の生成方法と対応関係は [秘密情報とtoken生成](/security/tokens) を参照してください。

## 初回セットアップの順番

1. database を用意します。
2. env ファイルを作成します。
3. migration が走る状態で Control Panel を起動します。
4. 初回管理者を作成します。
5. HTTPS の公開 URL からログインできることを確認します。
6. Node登録で各サービス用 Node を作り、`config.yml` を保存します。
7. Discord Bot、Worker、Encoder Recorder、Observability を起動します。
8. Service Health で online を確認します。
9. Integrations、Discord Settings、YouTube Outputs、Archive Settings を登録します。
10. Streams で配信を作成し、Check Readiness を通してから Start します。

## Control Panelでの入力ルール

| 値 | 入力先 | 表示のされ方 |
| --- | --- | --- |
| Discord Bot token | Discord Settings | 保存後は configured / fingerprint |
| YouTube stream key | YouTube Outputs | 保存後は configured / fingerprint |
| OAuth client secret | Integrations | 保存後は configured / fingerprint |
| OAuth refresh token | OAuth callback で保存 | 画面で手入力しません |
| Google Drive folder ID | Drive destination | 保存後は masked / configured |
| 通知 webhook URL | Notification Channels | 保存後は masked target |
| SMTP password | Notification Channels | 保存後は configured |
| TOTP secret / recovery codes | Current User MFA | 一度だけ表示 |

raw secret は再表示できません。値を忘れた場合は、元 provider で再発行し、Control Panel で更新します。

## 日常運用で見る画面

| やりたいこと | 見る画面 |
| --- | --- |
| 今日の配信が始められるか確認 | Dashboard、Streams |
| サービスが落ちていないか確認 | Service Health |
| Discord channel を変える | Streams の Discord Guild ID / VC Channel ID / Chat Channel ID |
| 配信先を変える | YouTube Outputs、Streams |
| 録画保存先を変える | Integrations、Archive Settings |
| 通知先を追加する | Notification Channels |
| ユーザーを追加する | Users、Roles |
| Node Runtime Token を入れ替える | Node登録の Configuration |
| Observability の接続先を変える | Node登録の Observability Node |
| 誰が変更したか見る | Audit Logs |

## 運用中の見方

- サービス一覧で offline のサービスがないか確認します。
- 配信ジョブが starting のまま止まっていないか確認します。
- 録画や保存の失敗がないか確認します。
- 設定画面に raw secret が表示されていないことを確認します。

Control Panel が動いていても、Discord 接続や FFmpeg 実行は別サービスの責務です。問題の場所は [サービス構成](/overview/service-roles) と [サービス割り当て](/control-panel/services-workers) で切り分けてください。

## 次に読むページ

- [Control Panelを導入する](/services/control-panel-install)
- [Control Panel画面の全体像](/control-panel/)
- [Control Panel画面別操作ガイド](/control-panel/page-usage)
- [配信画面](/control-panel/streams)
- [DiscordとYouTube](/control-panel/discord-youtube)
- [OAuthとDrive保存先](/control-panel/integrations-drive)
- [監視と通知](/control-panel/observability)
