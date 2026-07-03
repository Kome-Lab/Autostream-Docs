# サービス割り当て

Service Health と Worker Management は、起動済みサービスを stream に割り当てる画面です。配信が始まらない時は、まずここを確認します。

## 登録されるサービス

各サービスは、起動時に Control Panel へ登録と heartbeat を送ります。Control Panel 側には次の情報が表示されます。

| 表示 | 意味 |
| --- | --- |
| Name | サービス名 |
| Type | `discord_bot`、`worker`、`encoder_recorder`、`observability` |
| Status | registered、online、offline など |
| URL | Control Panel から到達する service public URL |
| Role | primary または standby |
| Stream | 現在割り当てられている stream |
| Capabilities | runtime config、audio forward、archive upload などの対応機能 |
| Heartbeat Metrics | サービスが送っている代表 metric |
| Heartbeat | 最終 heartbeat 時刻 |

## health status の読み方

| 表示 | 意味 | 対応 |
| --- | --- | --- |
| healthy / online | 最近 heartbeat があり、利用可能 | 通常はそのまま使えます |
| warning | heartbeat が60秒以上古い | host、network、service log を確認 |
| offline | heartbeat が180秒以上古い | host、network、service log を確認 |
| no heartbeat | 登録はあるが heartbeat がない | 起動設定や token を確認 |
| offline | service が停止、または明示的に offline | systemd / Docker の状態を確認 |

## primary と standby

| role | 意味 |
| --- | --- |
| primary | Start / Stop / Retry などの dispatch 対象 |
| standby | 予備候補。通常 dispatch 先ではない |

同じ stream の同じ service type に primary は 1 つだけです。新しい primary を割り当てると、既存 primary は置き換わります。

## 必須の割り当て

標準的な配信では、次の primary が必要です。

| service type | 必要な理由 |
| --- | --- |
| `discord_bot` | Discord voice channel 参加と音声取得 |
| `worker` | overlay、caption、participant、event 生成 |
| `encoder_recorder` | FFmpeg、配信、録画、upload |

Observability は配信処理そのものの dispatch 対象ではないため、stream assignment からは除外されます。

## Service Healthで割り当てる

1. Service Health を開きます。
2. `Service` で割り当てたい service を選びます。
3. `Stream` で対象配信を選びます。
4. `Assignment role` で primary または standby を選びます。
5. `Assign as primary` または `Assign as standby` を押します。
6. `Selected stream assignments` で必須 service type がそろったか確認します。
7. `Open Stream Operations` で Streams に移動し、Check Readiness を実行します。

## Stream assignment planner

planner には、service type ごとの状態が表示されます。

| 表示 | 意味 |
| --- | --- |
| missing | 対象 service type の primary がありません |
| ready | primary があり、heartbeat も問題ありません |
| attention | primary はありますが warning / offline など注意が必要です |
| standby | 予備 service が登録されています |
| assign | 候補 service を primary にします |
| as standby | 候補 service を standby にします |

## Runtime config preview

Service Health では、選択した service に配布される有効設定の preview が見られます。

| 項目 | 見る内容 |
| --- | --- |
| Assignments | どの stream に割り当てられているか |
| Profiles | Encoder、Archive、YouTube など profile 数 |
| Stream configs | stream ごとの Discord、Archive、YouTube 設定 |

preview に raw secret は出ません。secret は configured 状態、fingerprint、または secret reference 名として表示されます。

## Worker Management

Worker Management は Worker だけを素早く割り当てるための画面です。

| 項目 | 説明 |
| --- | --- |
| Worker | 割り当てる Worker |
| Stream | 対象配信 |
| Assignment role | primary または standby |
| Assign Worker | 選択した Worker を割り当て |
| Unassign Worker | 割り当て解除 |
| Restart Worker | Worker restart を要求 |

Worker だけを入れ替えたい時は Worker Management、全サービスを見ながら調整したい時は Service Health を使います。

## サービス削除

`Delete Service Registry` は、登録情報、割り当て、service stream events、紐づく token を削除する操作です。通常の一時停止には使いません。

使う場面:

- dry-run で作った不要な service entry を消す
- service host を廃止した
- token を完全に失効させて登録し直したい

使わない場面:

- 一時的にサービスを止めたいだけ
- heartbeat が warning / offline になっているだけ
- 配信中の service を入れ替えたいだけ

## よくあるトラブル

| 状況 | 対応 |
| --- | --- |
| 候補 service が出ない | 対象サービスが起動し、API token で登録されているか確認 |
| assign できない | 権限、CSRF、service ID、stream ID を確認 |
| assigned なのに Start できない | heartbeat と capability を確認 |
| service が別 stream にいる | primary assignment は移動扱いになるため、影響を確認 |
| runtime config preview が空 | service.config.read scope、runtime_config capability、割り当てを確認 |
