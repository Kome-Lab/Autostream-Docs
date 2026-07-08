# Worker

Worker は配信ジョブの進行に必要なイベントを作り、Encoder Recorder へ渡します。重い media 処理ではなく、配信の制御と状態イベントを担当します。

Linuxサーバーへの導入、Node Agent config、primary assignment、Worker event test の確認は [Workerを導入する](/services/worker-install) にまとめています。

## 役割

- Control Panel から配信ジョブを受ける
- overlay、caption、participant、active speaker event を生成する
- Encoder Recorder へイベントを送る
- Control Panel へ heartbeat を送る
- Control Panel 経由で Observability へ状態やエラーを送る

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `AUTOSTREAM_NODE_CONFIG` | Panel が生成した Worker 用 `config.yml` |

Worker は DB に直接接続せず、標準構成では Observability にも直接接続しません。永続状態と signal 転送は Control Panel と Observability 側で扱います。

## 通常運用のポイント

- Encoder Recorder の送信先 URL と stream ingest token は、通常 Control Panel のジョブから渡されます。
- 本番 env に static な worker-event token を置かない運用にします。
- Worker は primary assignment のジョブだけを受け付けます。

## Control Panelで設定・確認するもの

| 画面 | 使い方 |
| --- | --- |
| Node登録 | Worker Node を作成し、Host、Port、SSL、説明を設定します |
| Service Health | Worker の heartbeat、自動報告された version / capability / OS / arch を確認します |
| Worker Management | Worker を stream に primary / standby として割り当てます |
| Streams | Worker event test、Worker Event Sidecar、Start readiness を確認します |
| Metrics | scene updates、overlay events、caption events、send failures を確認します |

## Worker Managementの項目

| 項目 | 説明 |
| --- | --- |
| Worker | 割り当てる Worker |
| Stream | 対象配信 |
| Assignment role | primary は dispatch 対象、standby は予備 |
| Assign Worker | 選択した stream に割り当て |
| Unassign Worker | 割り当て解除 |
| Restart Worker | Worker restart を要求 |

Worker だけを入れ替えるなら Worker Management、Discord Bot や Encoder Recorder も含めて調整するなら [Service Health](/control-panel/services-workers) を使います。

## Streamsで確認するもの

| 表示 | 意味 |
| --- | --- |
| Worker events | Worker event が Encoder Recorder へ届いているか |
| Worker event test | current_time や caption event を送れるか |
| Worker Event Sidecar | event の一覧や最終到達状態 |
| Start Readiness | Worker assignment と capability が満たされているか |

## Worker event

Worker は配信中の `overlay.*` と `caption.*` event を受け付け、Encoder Recorder へ転送します。

| event type | 主な送信元 | payload |
| --- | --- | --- |
| `overlay.current_time` | Worker event test | 現在時刻 |
| `overlay.participants` | Discord Bot | `participants` |
| `overlay.active_speaker` | Discord Bot | `user_id`, `display_name` |
| `overlay.discord_chat` | Discord Bot | `message_id`, `user_id`, `display_name`, `text`, `text_channel_id`, `created_at` |
| `caption.telop` | Worker event test / caption連携 | `text`, `speaker_user_id` |

Streams の Chat Channel ID が設定されている配信では、開始後に Discord Bot が対象 text channel の新規messageだけを `overlay.discord_chat` として Worker へ送ります。Worker は payload 内の token や secret を要求しません。

## metricの見方

| metric | 正常の目安 |
| --- | --- |
| `worker.scene_updates_total` | 配信中に必要に応じて増える |
| `worker.overlay_events_total` | overlay を使う配信で増える |
| `worker.caption_events_total` | caption を使う配信で増える |
| `worker.event_send_failures_total` | 0 付近 |

## 確認手順

1. Worker を起動します。
2. Control Panel のサービス一覧で online を確認します。
3. テスト配信を開始します。
4. Worker がジョブを受けたことを確認します。
5. Encoder Recorder 側にイベントが届いているか確認します。
6. Observability に heartbeat や metric が Control Panel 経由で届いているか確認します。

イベントが届かない場合は、Worker、Encoder Recorder、Control Panel の Node ID、Node Runtime Token、primary assignment の組み合わせを確認してください。

## 次に読むページ

- [Workerを導入する](/services/worker-install)
- [サービス割り当て](/control-panel/services-workers)
- [配信画面](/control-panel/streams)
