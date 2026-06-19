# Worker のトラブルシュート

Worker は overlay、caption、participant list、active speaker、current time などの event 生成を担当します。video layer stream は後続機能として扱い、MVP では event generation と forwarding の安定性を優先します。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| assignment | 対象 stream に Worker が割り当てられているか |
| control URL | `CONTROL_PANEL_URL` に到達できるか |
| service token | `CONTROL_PANEL_TOKEN` の scope と service type が正しいか |
| encoder URL | Encoder/Recorder の public URL に Worker から到達できるか |
| dispatch token | Worker から Encoder/Recorder へ送る token が正しいか |
| health | `/health` と `/status` が応答するか |

初期配置では、`localhost` を service public URL に設定すると別 host から到達できません。multi-server 構成では、他 service から到達可能な URL を指定してください。

## job を受け取れない

1. Control Panel の stream assignment を確認します。
2. Worker の service registry entry が online か確認します。
3. `CONTROL_PANEL_TOKEN` の scope に heartbeat / status / event 権限があるか確認します。
4. Control Panel から Worker の `public_url` へ到達できるか確認します。
5. Streams 画面の readiness issue を確認します。

runtime config version が古い場合、Worker は古い Encoder/Recorder URL や profile を使うことがあります。service restart の前に Control Panel の Service Health で last heartbeat、runtime config fetched time、assigned stream ID を確認します。standby Worker は job を受け取っても primary と同じ event publish をしてはいけないため、assignment role を必ず確認します。

## Encoder/Recorder に event が届かない

1. Streams 画面の `Worker event path` を確認します。
2. `worker.event_send_failures_total` が増えていないか確認します。
3. Discord participant / active-speaker event が来ない場合は、Discord Bot 側の `discord.worker_event_publish_failures_total` も確認します。
4. Streams 画面の `Worker event sidecar` に最近の event が残っているか確認します。
5. Encoder/Recorder の `/worker-events` が `202 Accepted` を返しているか確認します。
6. stream ID が Control Panel の stream job と一致しているか確認します。
7. Worker が対象 stream に assigned されているか確認します。
8. token mismatch による `401` / `403` がないか確認します。

transient failure の場合は retry 設定も確認します。

```text
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
```

assignment 外の stream event は拒否されます。まず Control Panel の assignment を修正してください。

`401` / `403` が出る場合、Worker の outbound `CONTROL_PANEL_TOKEN` と Encoder/Recorder の inbound stream ingest token を混同していないか確認します。production では `ENCODER_RECORDER_TOKEN` env fallback を恒久対応にせず、Control Panel から job-scoped token を再発行します。

## caption / overlay が表示されない

確認する event type:

- `caption.telop`
- `caption.final`
- `overlay.current_time`
- `overlay.participants`
- `overlay.active_speaker`

Encoder/Recorder 側の sidecar 保存を確認し、`captions.vtt` と `transcript.json` に反映されているかを見ます。表示だけの問題か、event 自体が届いていないかを分けて調査します。

sidecar に event があり画面だけ出ない場合は Encoder overlay template、font asset、render layer order を確認します。sidecar に event がない場合は Worker event generation、publish retry、Encoder/Recorder `/worker-events` acceptance を確認します。`caption.final` があるのに `captions.vtt` が欠ける場合は archive package phase の問題として扱います。

## Control Panel から test event を送る

Streams 画面の `Worker event test` で `Send current time` または `Send caption` を実行します。

期待値:

- `Worker event path` の `Scene updates` が増える。
- caption test の場合は `Caption events` も増える。
- `Worker event sidecar` に送信した event が表示される。
- Observability に `worker.event.sent` と `worker.event.received` が残る。

`Worker event path` は増えるが sidecar が空の場合、Worker から Encoder/Recorder への publish 経路を確認します。

## event が多すぎる

overlay や caption の更新頻度が高すぎると、Encoder/Recorder と Observability の負荷になります。

確認すること:

- current time event の interval
- partial caption の送信頻度
- active speaker event の debounce
- retry による重複送信
- Observability の `worker.event_send_failures_total`

## 復旧後の確認

Worker の復旧後は、heartbeat online だけでなく、対象 stream の runtime config version、event publish path、Encoder/Recorder sidecar、archive metadata が一致していることを確認します。caption/overlay の本文を必要以上に共有せず、event type、timestamp、sidecar status、masked participant data で復旧を示します。

- Worker heartbeat が正常。
- Control Panel の Worker status が online。
- Encoder/Recorder に worker event が届く。
- caption / overlay / participant event が対象 stream ID で記録される。
- Observability incident が resolved / mitigated になる。
- `Worker event path` と `Worker event sidecar` の両方に同じ stream ID と event type が残る。
- archive の `metadata.json`、`logs.jsonl`、optional sidecar に raw token や provider credential が含まれない。
