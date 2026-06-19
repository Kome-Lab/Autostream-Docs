# Maintenance

定期メンテナンスでは、配信継続性、archive 保全、security posture、Observability の正常性を確認します。

このページのチェックは「見るだけ」ではなく、異常を見つけたときにどの repository / service の責務へ戻すかを決めるためのものです。Control Panel の設定、service heartbeat、archive artifact、provider upload、notification delivery を同じ stream ID で結び付け、raw secret を作業メモに残さずに状態を記録します。

## 日次チェック

- Control Panel の `Service Health` に offline service がない。
- open incident が放置されていない。
- Encoder/Recorder の disk free が十分。
- Google Drive upload failed が残っていない。
- recent audit events に不審な操作がない。

日次チェックで異常を見つけた場合は、その場で docs にメモを追記するのではなく、Control Panel incident、Observability diagnostic、または runbook の作業記録へ紐づけます。operator memo には raw URL、token、Drive folder ID、OAuth code を書かず、stream ID、service ID、incident ID、masked provider verification record だけを残します。

## 週次チェック

- MariaDB backup が取得できている。
- archive directory の容量が増えすぎていない。
- Observability の notification delivery failure がない。
- disabled / locked user を確認する。
- service token の不要な発行がない。
- `.env.example` と実運用 env の差分を把握する。

週次では、Control Panel の integration registry と実 provider 側の状態がずれていないかを確認します。YouTube output、Drive destination、Discord Bot Config、notification channel、OAuth login provider は、Control Panel の configured/fingerprint と provider UI の実状態が一致している必要があります。差分がある場合は、実 secret を export せず Control Panel UI/API から再登録します。

## 月次チェック

- dependency update の確認。
- systemd unit と Docker image の version 確認。
- recovery runbook の手順確認。
- Secret rotation 計画の確認。
- service account key と webhook URL の棚卸し。
- restore rehearsal の計画。

月次では restore rehearsal と external verification rehearsal を分けて計画します。restore rehearsal は backup が戻せること、external verification は Discord VC、Encoder audio packet、YouTube RTMPS、final remux、Drive upload が同じ stream ID で証明できることを確認します。provider の実値が必要な rehearsal は、operator が local runtime env または Control Panel UI で扱い、docs repository に値を持ち込みません。

## archive 容量管理

archive を削除する場合は、Google Drive upload 済み、metadata 保存済み、保持期間満了を確認します。live stream 中や incident 調査中の archive は削除しません。

## security maintenance

- MFA / TOTP / WebAuthn の導入状態を確認する。
- session timeout と cookie 設定を確認する。
- RBAC の不要 permission を削除する。
- last super_admin を削除しない。
- secret status は configured / missing のみ表示する。

## メンテナンス後

- `GET /health` を確認する。
- Service Health を確認する。
- test notification を送る。
- dry-run archive package を実行する。
- Audit Logs に作業記録が残っているか確認する。

作業後は、変更した token 世代、service config version、migration version、docs/runbook の更新要否を短く記録します。実 secret を rotation した場合は値ではなく secret name、fingerprint、rotation audit ID だけを共有し、外部確認に影響する変更は次回 provider verification record の `observed_at` を更新してから readiness check を通します。

maintenance で threshold、permission、runtime config schema、service assignment、provider integration を変えた場合は、対応する docs と docs consistency check も更新します。運用回避として一時的に入れた env fallback や allowlist 例外は、期限と削除条件を持たない限り本番設定として残しません。
