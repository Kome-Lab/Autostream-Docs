# Overlays

Overlay は Worker が生成し、Encoder/Recorder または配信 UI が参照する stream state です。v1 では active speaker、participant、current time、caption summary を中心に扱います。

## Event

- `overlay.current_time`: stream clock と表示用時刻。
- `participant.joined` / `participant.left`: VC 参加状態。
- `active_speaker.changed`: 現在の話者。
- `caption.final`: 確定 caption。

## 運用

Control Panel は overlay 設定の所有者です。Worker は runtime config を受け取り、event を生成して Observability と archive sidecar に残します。overlay に token、webhook URL、credential 付き media URL は含めません。

overlay profile を変更した場合は、Control Panel の profile ID、Worker runtime config version、Encoder/Recorder sidecar schema を同じ変更として扱います。UI だけを変更して Worker event type や archive sidecar を更新しないと、配信画面は動いても completion record が追えなくなります。

## Archive と evidence

Encoder/Recorder は Worker event を映像に焼き込む処理と、後から検証できる sidecar 保存を分けて扱います。外部確認では、overlay が画面に見えたことだけで pass にせず、sidecar に対象 stream ID、event type、event timestamp、保存 byte size が残っていることを確認します。証跡には表示文字列の抜粋を必要最小限に留め、未公開参加者名や Discord user ID を raw 値で残しません。

## 障害切り分け

overlay が更新されない場合は、まず Control Panel の stream assignment、Worker heartbeat、`worker.event_send_failures_total`、Encoder/Recorder の sidecar ingest を順に確認します。Worker が event を作っていないのか、Control Panel dispatch が失敗しているのか、Encoder/Recorder が保存できていないのかを分けて見るため、UI だけで判断しません。再送や補正を行う場合も、stream ID が一致している event だけを対象にします。

## 完了条件

overlay の完了条件は、Worker が対象 stream ID の event を発行し、Encoder/Recorder が sidecar に保存し、archive metadata から logical path と timestamp を確認できることです。画面に一瞬表示されたことだけでは完了扱いにせず、secret-free な event evidence と archive proof を結びます。

## Operator Notes

Overlay は配信画面の飾りではなく、archive sidecar と後続 diagnostics が同じ stream 状態を参照するための runtime data です。Worker が生成した event は Encoder/Recorder に渡り、保存時には raw token や provider URL を含めず、event type、timestamp、stream ID、source service、send result だけを残します。

外部確認で overlay を確認する場合は、画面に表示されたことだけを pass にしません。Worker event send metric、Encoder/Recorder sidecar path、archive metadata、Control Panel の runtime config version が同じ run に属することを確認します。caption や participant 名に個人情報が含まれる運用では、証跡には masked value か count だけを残してください。

外部確認で overlay を pass にするには、Worker から event が出たこと、Encoder/Recorder が対象 stream の sidecar に保存したこと、archive metadata から同じ timestamp を追えることを確認します。画面表示だけでは証跡として弱いため、event count、sidecar byte size、failure metric の 3 点を残します。

operator が overlay 表示だけをスクリーンショットで確認した場合も、それは補助証跡です。正式な pass 条件は `worker.scene_updates_total`、`worker.event_send_failures_total=0`、sidecar の event count、stream ID binding が揃うことです。参加者名や発言内容が含まれる表示は、必要最小限に redaction してから共有します。
