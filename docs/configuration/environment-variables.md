# 設定項目

このページでは AutoStream の設定を、初めて使う人向けに整理します。

## 基本の考え方

Control Panelのdatabaseなどbootstrap設定はenvに置きます。application Nodeのidentityとrotating tokenは必須のNode `config.yml`へ置きます。Worker、Encoder Recorder、Discord Bot、Observabilityの待受addressとconfig revisionは、Node configの`listener.credential`が選ぶ`node-listener.json`から読みます。配信先、保存先、通知先はControl Panelで管理し、割当て範囲のruntime secret referenceだけをserviceへ渡します。

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
| Encoder Recorderのoutput relay URL / 配送モード / 非secret binding ID | Encoder Recorderのenvファイル。`AUTOSTREAM_OUTPUT_RELAY_MODE`はrelayの方式だけを選び、stream keyや外部RTMPS URLは入れない |
| 通知用 Webhook URL | Control Panel |
| 録画ファイルのlocal path（既定値から変える場合） | Encoder Recorderのenvファイル |
| Discord参加者名・字幕・チャット描画用の日本語font | Workerの必須`AUTOSTREAM_SCENE_FONT_FILE`。`autostream` userが読めるregular fileの絶対pathを指定 |
| Worker映像を受けるSRT/UDPのbind・advertise endpoint | Encoder Recorderの`AUTOSTREAM_WORKER_VIDEO_BIND_ADDR`と`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST`。HTTPSのNode API URLやCloudflare Tunnelとは別にし、advertise hostはprimary WorkerからUDP到達できるhost/IPを指定 |
| Google Drive destination / OAuth | Control Panel |
| YouTube / Google OAuth短期アクセストークンの自動更新間隔 | Control Panelの`AUTOSTREAM_OAUTH_TOKEN_REFRESH_INTERVAL`（既定45分） |
| 管理画面のタイムゾーン | Control Panel |
| `protocol major 2` Host Agentの接続identity | Auto Configureが各物理ホストのroot所有`/etc/autostream/updater/agent.yaml`へ`panel_url`、`node_id`、`runtime_token`、`service_name`だけを生成 |
| execution host binding | `execution_host_id`と`ownership_epoch`はControl Panelのserver-owned state。Host Agent configやenvへ置かない |
| privileged更新policy | Auto Configureが`/etc/autostream/updater/executor-policy.json`へ生成するroot所有固定policy。Host AgentとはUnix socketで分離 |
| systemd Nodeの有効port / revision | `/opt/autostream/local-executor/ports/<service>.json`。root所有`0600`の非secret listener credentialをsystemd `LoadCredential`で対象serviceだけへ渡す |
| Docker Nodeの有効port / revision | 固定Compose `configs`から`/run/autostream-credentials/node-listener.json`へ渡す。container環境の`CREDENTIALS_DIRECTORY`はこのdirectoryだけを指す |

## Nodeの待受設定

4種類のNode configでは、待受設定の入力を次の固定名で指定します。

```yaml
listener:
  credential: node-listener.json
```

listener JSONは`schema_version: 2`、`service_type`、`bind_address`、正の`config_revision`の4項目だけです。systemdではroot-ownedなprivate directoryから`LoadCredential`で渡し、serviceはsystemdが用意する`CREDENTIALS_DIRECTORY`内の固定名だけを読みます。Nodeの公開接続先を示す`api.host` / `api.port`を、local listenerの設定として使いません。

| `service_type` | systemdのcredential source |
| --- | --- |
| `worker` | `/opt/autostream/local-executor/ports/worker.json` |
| `encoder_recorder` | `/opt/autostream/local-executor/ports/encoder-recorder.json` |
| `discord_bot` | `/opt/autostream/local-executor/ports/discord-bot.json` |
| `observability` | `/opt/autostream/local-executor/ports/observability.json` |

JSONの欠落、不正なshape、service typeの不一致、revision未指定ではstartupがfail closedで停止します。identityや待受値を環境変数から補う経路はありません。managed credential、revision、portを手動で書き換えず、承認済みのconfigure / port変更手順を使ってください。Control Panel自身のbootstrap待受設定はこの4種類とは別です。

## Encoder Recorderのv2 output mode

`AUTOSTREAM_OUTPUT_RELAY_MODE`は必須の非secret設定です。次のcanonical modeだけを使います。

| mode | 必須条件 | YouTube Output |
| --- | --- | --- |
| `direct` | `AUTOSTREAM_OUTPUT_RELAY_MODE=direct`を明示し、relay URLを設定しない | `stream_key`、`live_api`、`live_api_dry_run` |
| `live_api_relay_static` | relay URL、同じmode、`relay-` + 小文字UUID形式のbinding IDを明示する | readyな同名modeのOutputだけ |

mode未指定、未知mode、URLとmodeの矛盾、binding不一致はfail closedです。capability未報告のEncoderにも出力しません。stream keyはmodeやbindingへ入れず、Control Panelのassignment-scoped secret referenceで解決します。

`AUTOSTREAM_REQUIRE_OUTPUT_RELAY`が有効ならURLなしのdirectも拒否されます。設定変更はinactiveな時間帯に行い、restart後にService Healthとpreflightを確認します。rollbackは対応するreleaseと設定全体を復元し、互換modeを追加しません。

## Control Panel で管理する値

- Discord Bot の token
- YouTube など配信先の情報
- Google Drive など保存先の認証情報
- 通知用 Webhook URL
- 配信ごとのタイトルや説明文
- Streams、Audit Logs、Account の時刻表示に使うタイムゾーン
- `protocol major 2` Host Agentのhost binding、target、desired endpoint、policy revision

運用中に変える可能性がある値は、できるだけ Control Panel に寄せると管理しやすくなります。

Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。4項目identityは`root:autostream-host-agent 0640`とし、API port、GitHub Release Token、target policy、任意commandを追加しないでください。

Updaterの設定と更新権限は[システム更新](/operations/system-updates)を参照してください。v2では独立Updaterのprotocol major 2だけを使用します。

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
