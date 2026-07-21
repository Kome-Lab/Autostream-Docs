# 監査ログとAPIトークン

監査ログと API Tokens は、運用の安全性を保つための画面です。誰が何をしたかを確認し、旧構成や移行時の service token を管理します。新規構成でサービスを登録する場合は、先に [Node Agent登録](/control-panel/node-agent-registration) を使います。

## 監査ログ

監査ログは、サイドバーの `監視・対応` から開きます。配信ログとは別ページで、表示中の履歴を検索し、必要に応じて CSV export できます。

### 表示タブ

| 項目 | 説明 |
| --- | --- |
| 操作履歴 | 担当者やシステムによる変更・操作を表示します。`services.runtime_config.read` は除外されます |
| Node設定参照 | Nodeが実行設定を取得した `services.runtime_config.read` だけを表示します |

### 絞り込み項目

| 項目 | 説明 |
| --- | --- |
| Search | service ID、stream ID、action、actor など |
| 開始日時 / 終了日時 | 表示する期間 |
| 結果 | 成功 / 失敗 / すべての結果 |

## Audit CSV export

`CSV` は、選択中のタブと現在の絞り込み条件で履歴を出力します。secret value や password hash は含めません。

使う場面:

- 配信開始・停止の操作履歴を確認する
- 誰が設定を変えたか確認する
- service assignment の変更履歴を確認する
- 障害対応後の記録を残す

## API Tokens

API Tokens は、旧構成や移行時に Discord Bot、Worker、Encoder Recorder、Observability が Control Panel に登録するための token を確認、rotate、revoke する画面です。新規構成ではNode登録のAuto Configureを使います。通常serviceは`config.yml`を生成し、Update Agentは中央管理ホストに1つだけ作成してroot所有`/etc/autostream/updater.json`の接続identityだけを更新します。管理対象ホストの非常駐helperにはtokenを配布しません。

### Service type

| type | 使うサービス |
| --- | --- |
| `discord_bot` | Discord Bot |
| `encoder_recorder` | Encoder Recorder |
| `worker` | Worker |
| `observability` | Observability |
| `update_agent` | 中央管理ホストで常駐する1つの`autostream-updater` |

### scope

| scope | 用途 |
| --- | --- |
| `service.register` | 初回登録、pre-created service entry |
| `service.heartbeat` | heartbeat 送信 |
| `service.logs.write` | service log 書き込み |
| `service.status.write` | service status や metric 書き込み |
| `service.config.read` | runtime config 読み取り |
| `service.secret.resolve` | 許可された secret reference の解決 |
| `worker.events.write` | Worker event 書き込み |
| `encoder.status.write` | Encoder Recorder status 書き込み |
| `discord.status.write` | Discord Bot status 書き込み |
| `streams.start` | Discord VC参加を起点にした stream auto-start |
| `observability.ingest` | Observability signal ingest |
| `updates.claim` | 中央Update Agentが指定host向け更新jobを取得 |
| `updates.report` | Update Agentがlease付きprogressと結果を報告 |
| `updates.authorize` | root変更直前にjob、host、target、version、mode、plan、sessionへ結び付けた90秒のone-time mutation grantを発行 |

通常は service type を選ぶと、必要な scope が初期選択されます。よく分からない場合は初期選択から減らさず、不要な広い scope を足さない運用にしてください。

### Pre-create service

API Tokens では、互換用途として token 作成と同時に service registry entry を作れます。通常の新規導入ではNode登録でNode ID、Host、Port、SSLを登録し、ConfigurationのAuto Configure commandを使います。Update AgentはYAMLを使いませんが、`autostream-updater configure`で中央JSONの接続identityを更新します。

| 項目 | 説明 |
| --- | --- |
| Pre-create Node ID | 各サービスの Node ID と一致させる |
| Service name | 画面表示名 |
| Public URL | Control Panel から到達する service URL |
| Version | service version |
| Capabilities | service が対応する機能。カンマ区切り |

pre-createした場合、画面にbootstrap envが一度だけ表示されます。これは旧構成や移行用です。新規構成ではbootstrap envではなくNode登録のAuto Configureを使います。Update Agentはsampleとlocal inventoryを準備した中央`updater.json`へ、Auto Configureで接続identityだけを保存します。

## token作成手順

新規構成では次の流れにします。

1. Node登録を開きます。
2. `Node type`、Node ID、Node名、Host、Port、SSL、説明を入れます。
3. Configuration から `config.yml` または Auto Configure command を取得します。
4. `config.yml` を service host に保存し、env の `AUTOSTREAM_NODE_CONFIG` で参照します。
5. service を起動します。
6. Service Health で online になるか確認します。

この手順の4は通常service用です。`update_agent`では各hostのhelperをbootstrapしてtargetを対応付け、中央管理ホストへsampleをinstallしてGitHub token、API、host/target inventory、SSH pathを完成させます。その後、中央管理ホスト用Nodeを1つだけ作成してAuto Configure commandを初回実行します。stageしたRuntime Tokenはactivation成功まではinactiveで、旧Runtime Tokenがactiveのままです。ただしactivationの応答を受け取れず結果不確定になった場合は、CLIだけではどちらのRuntime Tokenがactiveか判断できません。local atomic commit後に失敗した場合、disk上の`updater.json`にはstage済みidentityが残ることがあります。CLIはactivation用のTokenやstateを永続化しないため、Updaterを再起動せず、新しいConfigure Tokenを発行し、同じtoken-free command形へ新しいTokenを入力して再実行します。activation成功を確認した後に`validate-config`を通してから中央`autostream-updater`を再起動します。

API Tokens で token を作るのは、旧構成を維持している場合や移行中に限ります。

## Rotate / Revoke

| 操作 | 使う場面 | 注意 |
| --- | --- | --- |
| Rotate | 旧構成の token を入れ替えたい | 新しい token は一度だけ表示。service host の env 更新が必要 |
| Revoke | 旧構成の token を無効化したい | 旧構成の service は Control Panel へ登録や heartbeat ができなくなります |

Node Runtime Tokenを入れ替える場合はAPI TokensではなくNode登録のConfigurationを使い、通常serviceでは`config.yml`を更新して再起動してください。Update AgentではConfigure Tokenを再生成し、同じtoken-free Auto Configure command形へ新しいTokenを入力して、activation成功と`validate-config`を確認した後に中央Updaterを再起動します。各管理対象ホストには更新するRuntime Tokenがありません。旧構成のtokenをrotateしたら、対象サービスを再起動して新しいtokenを読み込ませてください。

## よくあるトラブル

| 状況 | 対応 |
| --- | --- |
| Service Health に出てこない | Node Runtime Token、Control Panel URL、Node ID、network を確認 |
| no heartbeat | service は登録済みだが heartbeat 送信に失敗しています |
| runtime config が読めない | `service.config.read` scope と runtime_config capability を確認 |
| secret resolve に失敗 | `service.secret.resolve` scope と対象 service assignment を確認 |
| token をなくした | 再表示はできません。Rotate または新規作成します |
