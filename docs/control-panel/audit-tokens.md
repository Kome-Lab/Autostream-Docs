# 監査ログとAPIトークン

Audit Logs と API Tokens は、運用の安全性を保つための画面です。誰が何をしたかを確認し、旧構成や移行時の service token を管理します。新規構成でサービスを登録する場合は、先に [Node Agent登録](/control-panel/node-agent-registration) を使います。

## Audit Logs

Audit Logs では、操作履歴を検索し、必要に応じて CSV export できます。

### filter項目

| 項目 | 説明 |
| --- | --- |
| Action group | 操作の種類 |
| Result | success / failure / all |
| Search | service ID、stream ID、action、actor など |

### action group

| group | 含まれる操作の例 |
| --- | --- |
| Service assignment | services.assign、services.unassign、workers.assign |
| Service runtime | services.register、services.heartbeat、archive artifact report |
| Stream lifecycle | streams.create、streams.start、streams.stop、streams.retry_upload |
| Security / users / roles | login、logout、user update、role update |
| Secrets / tokens / settings | secrets.update、api_tokens.create、api_tokens.revoke |
| Notification channels | notification channel create / update / delete / test |
| All actions | すべて |

## Audit CSV export

`Export CSV` は、現在の filter に近い条件で CSV を出力します。secret value や password hash は含めません。

使う場面:

- 配信開始・停止の操作履歴を確認する
- 誰が設定を変えたか確認する
- service assignment の変更履歴を確認する
- 障害対応後の記録を残す

## API Tokens

API Tokens は、旧構成や移行時に Discord Bot、Worker、Encoder Recorder、Observability が Control Panel に登録するための token を確認、rotate、revoke する画面です。新規構成では Node登録で `config.yml` を生成し、Node Runtime Token を service に渡します。

### Service type

| type | 使うサービス |
| --- | --- |
| `discord_bot` | Discord Bot |
| `encoder_recorder` | Encoder Recorder |
| `worker` | Worker |
| `observability` | Observability |

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

通常は service type を選ぶと、必要な scope が初期選択されます。よく分からない場合は初期選択から減らさず、不要な広い scope を足さない運用にしてください。

### Pre-create service

API Tokens では、互換用途として token 作成と同時に service registry entry を作れます。通常の新規導入では Node登録で Node ID、Host、Port、SSL を登録し、Configuration から `config.yml` を取得します。

| 項目 | 説明 |
| --- | --- |
| Pre-create Node ID | 各サービスの Node ID と一致させる |
| Service name | 画面表示名 |
| Public URL | Control Panel から到達する service URL |
| Version | service version |
| Capabilities | service が対応する機能。カンマ区切り |

pre-create した場合、画面に bootstrap env が一度だけ表示されます。これは旧構成や移行用です。新規構成では bootstrap env ではなく、Node登録で生成した `config.yml` を各 service host に保存します。

## token作成手順

新規構成では次の流れにします。

1. Node登録を開きます。
2. `Node type`、Node ID、Node名、Host、Port、SSL、説明を入れます。
3. Configuration から `config.yml` または Auto Configure command を取得します。
4. `config.yml` を service host に保存し、env の `AUTOSTREAM_NODE_CONFIG` で参照します。
5. service を起動します。
6. Service Health で online になるか確認します。

API Tokens で token を作るのは、旧構成を維持している場合や移行中に限ります。

## Rotate / Revoke

| 操作 | 使う場面 | 注意 |
| --- | --- | --- |
| Rotate | 旧構成の token を入れ替えたい | 新しい token は一度だけ表示。service host の env 更新が必要 |
| Revoke | 旧構成の token を無効化したい | 旧構成の service は Control Panel へ登録や heartbeat ができなくなります |

Node Runtime Token を入れ替える場合は API Tokens ではなく Node登録の Configuration で再生成し、対象 service の `config.yml` を更新して再起動してください。旧構成の token を rotate したら、対象サービスを再起動して新しい token を読み込ませてください。

## よくあるトラブル

| 状況 | 対応 |
| --- | --- |
| Service Health に出てこない | Node Runtime Token、Control Panel URL、Node ID、network を確認 |
| no heartbeat | service は登録済みだが heartbeat 送信に失敗しています |
| runtime config が読めない | `service.config.read` scope と runtime_config capability を確認 |
| secret resolve に失敗 | `service.secret.resolve` scope と対象 service assignment を確認 |
| token をなくした | 再表示はできません。Rotate または新規作成します |
