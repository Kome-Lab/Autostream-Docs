# アーキテクチャ

AutoStream は control plane と media plane を分けます。Control Panel は設定、認証、監査、service lifecycle を管理し、media plane の service は配信処理に集中します。

この分離は、単なる実装都合ではなく運用上の安全境界です。Control Panel は DB-backed な Integration Registry、service registry、assignment、audit を持ち、各 service は自分の担当範囲だけを heartbeat と runtime API で報告します。Discord Bot、Encoder/Recorder、Worker、Observability は同じ repository に寄せず、障害時にも個別に再起動、切り戻し、token revoke できる構成を前提にします。

## Service 境界

- `autostream-control-panel`: UI、API、RBAC、session、service registry、assignment、runtime config、connected account。
- `autostream-discord-bot`: Discord gateway/voice 接続、VC join、Opus packet 受信、Encoder/Recorder への forward。
- `autostream-encoder-recorder`: audio ingest、FFmpeg、YouTube RTMPS、録画、remux、archive sidecar、Google Drive upload。
- `autostream-worker`: overlay、caption、participant、active speaker、current time event の生成。
- `autostream-observability`: signal ingest、incident、notification、diagnostic、remediation。
- `autostream-contracts`: schema、permission、API/event contract。

## Control Panel 中心の流れ

1. operator が Control Panel で integration、service、stream assignment を設定する。
2. service は registration/heartbeat で availability と public URL を報告する。
3. stream start 時に Control Panel が runtime config と短命 ingest token を配布する。
4. Discord Bot が VC に接続し、Encoder/Recorder が audio/video pipeline を開始する。
5. Worker と Observability がイベント、状態、異常、通知を処理する。
6. stop 後に Encoder/Recorder が archive と upload metadata を Control Panel/Observability に返す。

本番運用では、stream start のたびに `.env` を編集しません。service は bootstrap env で Control Panel へ接続し、配信ごとの YouTube output、Drive destination、Discord routing、encoder/archive profile は runtime config として受け取ります。assignment が変わった場合は Control Panel の状態を正とし、各 service の local config は接続先、service ID、起動 secret だけに留めます。

## Secret 境界

architecture 上の secret 境界は、bootstrap env、encrypted secret store、runtime config、short-lived lease、provider verification record に分かれます。service repo が直接 provider secret を所有する形に戻さず、Control Panel の source of truth と service 側の消費範囲を分けて設計します。

## Operator Notes

この architecture ページは、AutoStream を単一 process にまとめる説明ではなく、Control Panel を source of truth にして各 service が独立 deploy できることを確認するための入口です。新しい requirement を追加する場合は、operator intent、runtime config、media processing、event generation、notification、provider verification record のどれに属するかを先に決めます。

外部確認の記録は、この architecture の境界を横断して同じ `stream_id` を追える場合だけ pass になります。Control Panel export、service heartbeat、Discord packet、Worker event、Encoder archive、YouTube receipt、Drive upload proof が別々の run から来ている場合は、成功に見える断片があっても完了証跡として扱いません。

実 secret は docs repository に置きません。service token、OAuth token、SMTP password、webhook URL、YouTube stream key、Google credential は encrypted storage または各 service の operator-managed secret として扱い、UI/API/docs/logs では configured/missing/masked/fingerprint のみを表示します。

診断や verification record では、Control Panel の内部 ID、masked value、fingerprint、packet delta、archive byte count、upload file count を使って状態を証明します。raw token や provider URL が必要な確認は operator の shell/session 内で完結させ、Markdown、screenshots、API response、Observability signal には戻しません。
