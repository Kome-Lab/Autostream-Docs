# 監査ログとAPIトークン

Audit Logs と API Tokens は、運用の安全性を保つための画面です。誰が何をしたかを確認し、サービスが Control Panel に登録するための token を管理します。

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

API Tokens は、Discord Bot、Worker、Encoder Recorder、Observability が Control Panel に登録するために使います。

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
| `observability.ingest` | Observability signal ingest |

通常は service type を選ぶと、必要な scope が初期選択されます。よく分からない場合は初期選択から減らさず、不要な広い scope を足さない運用にしてください。

### Pre-create service

API Tokens では、token 作成と同時に service registry entry を作れます。

| 項目 | 説明 |
| --- | --- |
| Pre-create service ID | 各サービスの `SERVICE_ID` と一致させる |
| Service name | 画面表示名 |
| Public URL | Control Panel から到達する service URL |
| Version | service version |
| Capabilities | service が対応する機能。カンマ区切り |

pre-create した場合、画面に bootstrap env が一度だけ表示されます。各サービス host の env に入れて起動します。

## token作成手順

1. API Tokens を開きます。
2. `Service type` を選びます。
3. scope が用途に合っているか確認します。
4. 可能なら `Pre-create service ID`、`Service name`、`Public URL` を入れます。
5. `Create Token` を押します。
6. one-time token と bootstrap env を各 service host の env に入れます。
7. service を起動します。
8. Service Health で online になるか確認します。

## Rotate / Revoke

| 操作 | 使う場面 | 注意 |
| --- | --- | --- |
| Rotate | token を入れ替えたい | 新しい token は一度だけ表示。service host の env 更新が必要 |
| Revoke | token を無効化したい | service は Control Panel へ登録や heartbeat ができなくなります |

token を rotate したら、対象サービスを再起動して新しい token を読み込ませてください。

## よくあるトラブル

| 状況 | 対応 |
| --- | --- |
| Service Health に出てこない | token、CONTROL_PANEL_URL、SERVICE_ID、network を確認 |
| no heartbeat | service は登録済みだが heartbeat 送信に失敗しています |
| runtime config が読めない | `service.config.read` scope と runtime_config capability を確認 |
| secret resolve に失敗 | `service.secret.resolve` scope と対象 service assignment を確認 |
| token をなくした | 再表示はできません。Rotate または新規作成します |
