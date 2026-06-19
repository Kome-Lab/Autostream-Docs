# 用語集

## Control Panel

AutoStream の operator UI と Control API。service registry、assignment、integration、runtime config、監査、認証を管理します。

Control Panel は media processing を実行しません。Discord audio、FFmpeg、Worker event、Observability detection は各 service の責務で、Control Panel は保存済み設定、dispatch、status、audit、secret reference の整合性を管理します。

## Service registry

Discord Bot、Encoder/Recorder、Worker、Observability が登録される一覧です。service ID、public URL、capability、heartbeat、primary/standby 状態を扱います。

## Runtime config

stream start 時に Control Panel から各 service へ配布される実行設定です。Discord routing、YouTube output、Drive destination、短命 ingest token などを含みます。

runtime config は authenticated service 自身にだけ返されます。別 service の profile や stream-scoped secret を読む目的で使わず、primary / standby assignment と runtime config version が一致していることを readiness と evidence で確認します。

## Provider verification record

外部確認で実 provider を確認した証跡です。Discord guild/channel は masked、Google Drive folder/file ID は fingerprint、YouTube は broadcast/live stream ID と video/audio 受信状態だけを記録します。

provider verification record は provider 値そのものではありません。operator が Discord、YouTube、Google Drive、notification provider 側で確認した結果を secret-free に変換したもので、`observed_at`、stream ID、masked/fingerprint、receipt status が揃っていなければ readiness check では pass 扱いにしません。

## Archive sidecar

録画結果に付随する metadata です。`final.mkv`、`final.mp4`、caption、event、upload result の status と fingerprint を残し、raw credential や local secret は含めません。

sidecar は「画面に見えた」ことの代替ではなく、後から同じ stream ID で event、caption、upload、remux を検証するための証跡です。absolute host path、Drive raw file ID、credential 付き URL は含めず、logical path と fingerprint を使います。

## Runtime secret lease

Control Panel が secret value を長時間配布しないための短命 lease です。service は自分の service ID、stream ID、assignment role に合う secret だけを解決でき、lease active 中の replay や token rotation による迂回は拒否されます。

## Readiness check

外部確認記録を pass 扱いにする前の最終検査です。readiness、provider verification record preflight、stream lifecycle runner、probe summary、evidence compose、secret scan、stream ID binding をまとめて確認し、dry-run や古い証跡を MVP verification pass として扱わないようにします。

readiness check が fail している状態でも、実 provider 値が必要な機能の本番実装は完了している場合があります。その場合は「本番運用実装済み、外部 provider verification record 待ち」として扱い、docs や progress では未確認の provider success と実装完了を混同しません。

## 用語更新の基準

新しい用語を追加するときは、略語の説明だけでなく、どの repo が所有し、どの command または test で検証し、どの evidence field が secret-safe かを含めます。Control Panel 管理値、service runtime 値、external provider 値、operator local 値を混ぜると runbook の判断が壊れるため、用語集でも境界を維持します。古い fallback 用語は削除する前に、互換手順として残す必要があるかを確認します。
