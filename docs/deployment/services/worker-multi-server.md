# マルチサーバー構成

Worker は Control Panel、Encoder/Recorder、Observability と別 host に配置できます。同一 Docker network を前提にしません。

## 通信方向

- Worker から Control Panel: `/services/register`、`/services/heartbeat`
- Control Panel から Worker: `/jobs/start`、`/jobs/{id}/stop`、`/streams/{id}/events/*`
- Worker から Encoder/Recorder: `/worker-events`
- Worker から Observability: `/signals`

## 必須設定

```text
SERVICE_ID=worker-01
SERVICE_PUBLIC_URL=https://worker.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
ENCODER_RECORDER_RETRY_MAX=2
ENCODER_RECORDER_RETRY_BASE_DELAY_SEC=1
OBSERVABILITY_URL=https://observability.example.com
OBSERVABILITY_TOKEN=<SERVICE_TOKEN>
```

Encoder/Recorder への route と worker-event token は、Control Panel の stream assignment から job-scoped runtime config として渡します。複数 Encoder/Recorder を登録する構成では、stream ごとに primary service を選び、Worker はその job context の `encoder_recorder_url` / `stream_ingest_token` だけを使います。`ENCODER_RECORDER_URL` / `ENCODER_RECORDER_TOKEN` は local migration / dry-run 互換 fallback であり、本番 multi-server env には置きません。

## Firewall

Worker の inbound API は Control Panel からのアクセスだけを許可してください。`GET /health` と `GET /status` も本番では監視元に制限することを推奨します。

## Assignment evidence

Multi-server 本番では、Worker を直接 Encoder/Recorder に固定しません。Control Panel に登録された Worker と Encoder/Recorder の service record、primary/standby assignment、job-scoped runtime config が 1 つの stream に対して一致していることを evidence として残します。

確認する証跡は以下です。

- Worker の `/services/register` と `/services/heartbeat` が同じ `SERVICE_ID` で継続している。
- Control Panel からの `/jobs/start` payload に、選択済み primary Encoder/Recorder の URL と token が含まれている。
- Worker env に本番用 `ENCODER_RECORDER_URL` / `ENCODER_RECORDER_TOKEN` が残っていない。
- standby Worker へ assignment を切り替えた後、同じ stream の dispatch が新しい Worker だけへ届く。

## Failure handling

Control Panel から runtime config が届かない、署名・token が不一致、または Encoder/Recorder の publish が retry 上限を超えた場合、Worker は job を partial success として進めません。job status、structured log、Observability signal に同じ correlation ID を残し、operator が Control Panel UI から再配布または standby 切替を行える状態にします。
