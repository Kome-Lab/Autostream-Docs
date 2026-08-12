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
| Encoder Recorderのoutput relay URL / 配送モード / 非secret binding ID | Encoder Recorderのenvファイル。`AUTOSTREAM_OUTPUT_RELAY_MODE`はrelayの方式だけを選び、stream keyや外部RTMPS URLは入れない |
| 通知用 Webhook URL | Control Panel |
| 録画ファイルのlocal path（既定値から変える場合） | Encoder Recorderのenvファイル |
| Discord参加者名・字幕・チャット描画用の日本語font | Workerの必須`AUTOSTREAM_SCENE_FONT_FILE`。`autostream` userが読めるregular fileの絶対pathを指定 |
| Worker映像を受けるSRT/UDPのbind・advertise endpoint | Encoder Recorderの`AUTOSTREAM_WORKER_VIDEO_BIND_ADDR`と`AUTOSTREAM_WORKER_VIDEO_ADVERTISE_HOST`。HTTPSのNode API URLやCloudflare Tunnelとは別にし、advertise hostはprimary WorkerからUDP到達できるhost/IPを指定 |
| Google Drive destination / OAuth | Control Panel |
| YouTube / Google OAuth短期アクセストークンの自動更新間隔 | Control Panelの`AUTOSTREAM_OAUTH_TOKEN_REFRESH_INTERVAL`（既定45分） |
| 管理画面のタイムゾーン | Control Panel |
| `pull_v2` Host Agentの接続identity | Auto Configureが各物理ホストのroot所有`/etc/autostream-host-agent/identity.json`へ`panel_url`、`node_id`、`runtime_token`、`service_name`だけを生成 |
| execution host binding | `execution_host_id`と`ownership_epoch`はControl Panelのserver-owned state。Host Agent configやenvへ置かない |
| privileged更新policy | Auto Configureが`/etc/autostream-local-executor/policy.json`へ生成するroot所有固定policy。Host AgentとはUnix socketで分離 |
| systemd Nodeの有効port | `/opt/autostream/local-executor/ports/<service>.env`。service bind変数と`AUTOSTREAM_CONFIG_REVISION`だけのroot所有2行sidecar |

## Encoder Recorder の output relay 配送モード

`AUTOSTREAM_OUTPUT_RELAY_MODE` はEncoder Recorderが固定relayをどう使うかを表す非secret設定です。YouTubeのstream key、外部RTMPS URL、視聴URLをこの値や`AUTOSTREAM_OUTPUT_RELAY_BINDING_ID`へ書きません。値と`AUTOSTREAM_OUTPUT_RELAY_URL`の組み合わせは次のとおりです。

| 実効モード | envの組み合わせ | 使うYouTube Output | 用途 |
| --- | --- | --- | --- |
| `direct` | `AUTOSTREAM_OUTPUT_RELAY_URL`を設定せず、`AUTOSTREAM_REQUIRE_OUTPUT_RELAY`を無効にする。`AUTOSTREAM_OUTPUT_RELAY_MODE=direct`は任意 | `stream_key`、`live_api`、`live_api_dry_run`（`live_api_relay_static`は不可） | relayなしで出力する環境 |
| `legacy_stream_key` | URLを設定し、modeは未設定または`legacy_stream_key` | 既存の`stream_key`だけ | 固定nginx-rtmpなどが既存の固定keyへpushする旧構成を、そのまま互換運用します |
| `live_api_static` | URL、`AUTOSTREAM_OUTPUT_RELAY_MODE=live_api_static`、`relay-` + 小文字UUID形式の`AUTOSTREAM_OUTPUT_RELAY_BINDING_ID` | `live_api_relay_static`だけ | 固定relayと事前作成した再利用YouTube Live Streamを、非secret bindingで明示対応させる新方式です |

`live_api_static`のbinding IDは、必ず`relay-`に小文字UUIDを続けた形式にします。例: `relay-123e4567-e89b-42d3-a456-426614174000`。これは非secretな識別子であり、stream key、外部RTMPS URL、視聴URL、任意の説明名を代用できません。

`AUTOSTREAM_REQUIRE_OUTPUT_RELAY`が有効なhost（productionでrelay必須にする構成を含む）では、URL未設定は`direct`ではありません。output relayは`missing`（利用不可）となり、preflightと開始処理はfail closedします。URLを外して`direct`へ自動fallbackすることはありません。productionでrelayを必須にするhostは、有効なlocal relay URLを設定してから開始してください。

URLありで`direct`を指定する、URLなしで`legacy_stream_key`または`live_api_static`を指定する、未知のmodeを指定する、または`live_api_static`のbinding形式・一致条件を満たさない、といった設定はrelay `unavailable`としてfail closedします。`direct`へ自動的に読み替えたり、URLを無視して出力したりしません。`managed`のような推測用の値は使いません。

URLを設定した既存hostでmodeを未設定にした場合だけ、移行互換のため実効`legacy_stream_key`になります。新規設定では意図を明示するため`legacy_stream_key`または`live_api_static`を設定してください。modeの変更後はEncoder Recorderを再起動し、Service Health / preflightで実効capabilityを確認します。

段階的な更新の間は、旧Encoderが報告するhistorical capability `static`をControl Panelが`legacy_stream_key`として扱います。これは既存の`stream_key` relayを止めないための互換だけです。新しいEncoderが報告するcanonical capabilityは`direct`、`legacy_stream_key`、`live_api_static`であり、envに`static`を設定して新方式を選ぶことはできません。

relay capabilityを報告していないEncoder、または未知の値を報告するEncoderは、移行中の安全な互換として`stream_key`だけを使えます。`live_api`、`live_api_dry_run`、`live_api_relay_static`へ自動的に広げません。これは有効な旧Encoder向けの互換であり、relay設定が`unavailable`のEncoderには適用しません。

## Control Panel で管理する値

- Discord Bot の token
- YouTube など配信先の情報
- Google Drive など保存先の認証情報
- 通知用 Webhook URL
- 配信ごとのタイトルや説明文
- Streams、Audit Logs、Account の時刻表示に使うタイムゾーン
- `pull_v2` Host Agentのhost binding、target、desired endpoint、policy revision

運用中に変える可能性がある値は、できるだけ Control Panel に寄せると管理しやすくなります。

Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。4項目identityは`root:autostream-host-agent 0640`とし、API port、GitHub Release Token、target policy、任意commandを追加しないでください。

Bridge期間中の`ssh_v1`では、中央`updater.json`、SSH host、remote `update-host.json`、GitHub Release Tokenをlegacy互換設定として維持します。これらを新しい`pull_v2` configへ移し替えません。詳細は[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

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
