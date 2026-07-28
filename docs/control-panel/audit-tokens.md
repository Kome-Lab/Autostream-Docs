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

API Tokens は、旧構成や移行時に Discord Bot、Worker、Encoder Recorder、Observability が Control Panel に登録するための token を確認、rotate、revoke する画面です。新規構成ではNode登録のAuto Configureを使います。通常serviceは`config.yml`を生成し、`pull_v2` Update Agentは物理ホストごとに非rootの`autostream-host-agent`を1つ登録して、root所有`/etc/autostream-host-agent/identity.json`へ4項目identityを生成します。

### Service type

| type | 使うサービス |
| --- | --- |
| `discord_bot` | Discord Bot |
| `encoder_recorder` | Encoder Recorder |
| `worker` | Worker |
| `observability` | Observability |
| `update_agent` | 新規は物理ホストごとのendpointlessな`pull_v2` Host Agent。legacy `ssh_v1`もBridge中は残る |

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
| `updates.claim` | 更新transportが指定host向け更新jobを取得。`pull_v2`は正のownership epochへ切替後だけ使用 |
| `updates.report` | 更新transportがlease付きprogress、availability、terminal結果を報告 |
| `updates.authorize` | root変更直前に短命・1回限りのmutation grantを取得。Local Executorがplan/session/policyと再照合 |

通常は service type を選ぶと、必要な scope が初期選択されます。よく分からない場合は初期選択から減らさず、不要な広い scope を足さない運用にしてください。

### Pre-create service

API Tokens では、互換用途としてtoken作成と同時にservice registry entryを作れます。通常の新規導入ではNode登録でNode ID、Host、`1024..65535`のPort、SSLを登録し、ConfigurationのAuto Configure commandを使います。`pull_v2` Host Agentはendpointlessで、Host、Port、SSLを持ちません。

| 項目 | 説明 |
| --- | --- |
| Pre-create Node ID | 各サービスの Node ID と一致させる |
| Service name | 画面表示名 |
| Public URL | Control Panel から到達する service URL |
| Version | service version |
| Capabilities | service が対応する機能。カンマ区切り |

pre-createした場合、画面にbootstrap envが一度だけ表示されます。これは旧構成や移行用です。新規構成ではbootstrap envではなくNode登録のAuto Configureを使います。Host Agentは対象の物理ホストでConfigure Tokenを標準入力から非表示で受け取り、`panel_url`、`node_id`、`runtime_token`、`service_name`だけを`/etc/autostream-host-agent/identity.json`へ保存します。

## token作成手順

新規構成では次の流れにします。

1. Node登録を開きます。
2. `Node type`、Node ID、Node名、Host、Port、SSL、説明を入れます。
3. Configuration から `config.yml` または Auto Configure command を取得します。
4. `config.yml` を service host に保存し、env の `AUTOSTREAM_NODE_CONFIG` で参照します。
5. service を起動します。
6. Service Health で online になるか確認します。

この手順の4は通常service用です。`pull_v2`の`update_agent`では、物理ホストごとにNodeを1つ作成し、Configurationの`autostream-host-agent configure`をそのホストで1回実行します。Configure Tokenは標準入力から非表示で渡し、4項目identityだけを`/etc/autostream-host-agent/identity.json`へ保存します。同じtransactionでtokenを含まないcanonical Local Executor policyと不足しているsystemd port sidecarもroot所有pathへ生成します。`execution_host_id`と`ownership_epoch`はserver-ownedなのでidentity configへ入れません。Host AgentはControl Panelへoutbound HTTPSで接続し、受信TCP、`8090`、SSH設定を持ちません。

API Tokens で token を作るのは、旧構成を維持している場合や移行中に限ります。

## Rotate / Revoke

| 操作 | 使う場面 | 注意 |
| --- | --- | --- |
| Rotate | 旧構成の token を入れ替えたい | 新しい token は一度だけ表示。service host の env 更新が必要 |
| Revoke | 旧構成の token を無効化したい | 旧構成の service は Control Panel へ登録や heartbeat ができなくなります |

Node Runtime Tokenを入れ替える場合はAPI TokensではなくNode登録のConfigurationを使い、通常serviceでは`config.yml`を更新して再起動してください。`pull_v2` Host Agentの旧来の即時Runtime Token再生成は`staged_runtime_token_rotation_required`で拒否されます。専用flowはstage→旧tokenで1回だけclaim→Local Executorのlocal ack→staged token heartbeat proof→activate→canonical identity昇格→旧token revokeです。activate前はcancelでき、`emergency-revoke`は通信を止めてlocal recoveryを要求するbreak-glass操作です。generic Rotateで旧tokenを先に失効させないでください。legacy identityは先にcanonical pathへmanaged migrationし、legacy `ssh_v1`のtoken rotationはBridge互換手順に従います。公開release、mixed-version実host drill、production deployは未実施です。

## よくあるトラブル

| 状況 | 対応 |
| --- | --- |
| Service Health に出てこない | Node Runtime Token、Control Panel URL、Node ID、network を確認 |
| no heartbeat | service は登録済みだが heartbeat 送信に失敗しています |
| runtime config が読めない | `service.config.read` scope と runtime_config capability を確認 |
| secret resolve に失敗 | `service.secret.resolve` scope と対象 service assignment を確認 |
| token をなくした | 再表示はできません。Rotate または新規作成します |
