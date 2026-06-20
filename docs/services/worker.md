# Worker

Worker は配信ジョブの進行に必要なイベントを作り、Encoder Recorder へ渡します。重い media 処理ではなく、配信の制御と状態イベントを担当します。

## 役割

- Control Panel から配信ジョブを受ける
- overlay、caption、participant、active speaker event を生成する
- Encoder Recorder へイベントを送る
- Control Panel へ heartbeat を送る
- Observability へ状態やエラーを送る

## envで設定するもの

| 項目 | 目的 |
| --- | --- |
| `SERVICE_ID` | Worker を識別する ID |
| `SERVICE_PUBLIC_URL` | Control Panel から見える URL |
| `CONTROL_PANEL_URL` | Control Panel の URL |
| `CONTROL_PANEL_TOKEN` | service registration 用 token |
| `SERVICE_CONTROL_TOKEN_SHA256` | inbound dispatch の検証 |
| `OBSERVABILITY_URL` | Observability の URL |
| `DATABASE_URL` | Worker 用 database |

## 通常運用のポイント

- Encoder Recorder の送信先 URL と stream ingest token は、通常 Control Panel のジョブから渡されます。
- 本番 env に static な worker-event token を置かない運用にします。
- Worker は primary assignment のジョブだけを受け付けます。

## 確認手順

1. Worker を起動します。
2. Control Panel のサービス一覧で online を確認します。
3. テスト配信を開始します。
4. Worker がジョブを受けたことを確認します。
5. Encoder Recorder 側にイベントが届いているか確認します。
6. Observability に heartbeat や metric が届いているか確認します。

イベントが届かない場合は、Worker、Encoder Recorder、Control Panel の service ID と token の組み合わせを確認してください。
