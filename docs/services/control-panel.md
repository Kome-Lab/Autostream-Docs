# Control Panel

Control Panel は AutoStream の中央 control plane です。Discord Bot、Worker、Encoder/Recorder、Observability を直接同居させず、各 service の登録、heartbeat、stream assignment、start / stop / retry-upload dispatch、監査ログ、管理 UI を担当します。

## 責務

- 管理 UI と Control API を提供する。
- user、role、permission、session、CSRF、audit log を管理する。
- stream job を作成し、status lifecycle を管理する。
- service registry と heartbeat を管理する。
- stream ごとに Discord Bot、Worker、Encoder/Recorder を割り当てる。
- Encoder profile、caption profile、overlay profile、archive profile、Discord config、YouTube output を管理する。
- secret は raw 値を返さず、configured / missing / fingerprint の状態だけを表示する。
- Observability の incident、diagnostic、remediation、notification history を表示・proxy する。

Control Panel は heavy media processing を実行しません。Discord 音声取得は Discord Bot、FFmpeg 配信・録画・archive upload は Encoder/Recorder、overlay / caption event 生成は Worker、異常検知と診断は Observability の責務です。

## Distributed Service Dispatch

service への outbound dispatch には `SERVICE_CALL_TOKEN` を使います。service registration / heartbeat 用の inbound token hash とは分離します。

```text
SERVICE_CALL_TOKEN=<SERVICE_CALL_TOKEN>
CONTROL_PANEL_TOKEN=<SERVICE_REGISTRATION_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_SERVICE_REGISTRATION_TOKEN>
```

Control Panel は stream に割り当て済みの service だけへ dispatch します。未割り当て service への start / stop / retry-upload は実行しません。

`SERVICE_CALL_TOKEN` は Control Panel から service を呼ぶ outbound secret であり、各 service が Control Panel へ register / heartbeat するための `CONTROL_PANEL_TOKEN` とは別物です。service registration の token hash と dispatch token hash を混同すると、片方向だけ成功して readiness が誤って見えるため、Service Health と Last service dispatch の両方を確認します。

runtime config は authenticated service 自身にだけ返します。Control Panel は request token から service ID と service type を確定し、別 service の profile、assignment、secret reference、runtime route を横取りして読ませません。standby service は standby として見える non-secret config だけを受け取り、primary に昇格するまで stream-scoped runtime secret lease を解決できません。

## Streams 画面

Streams 画面では、運用前に次の状態を確認できます。

- `Service assignment`: Discord Bot、Worker、Encoder/Recorder の割り当てと heartbeat。
- `Start preflight`: Control Panel 側の token、public URL、assignment、capability 確認。
- `Encoder host preflight`: 割り当て済み Encoder/Recorder の `/preflight` proxy。FFmpeg、archive root、RTMPS、Google Drive 設定を確認する。
- `Discord Bot audio forward`: Discord VC 音声受信と Encoder/Recorder への forward metrics。
- `Encoder audio bridge`: Encoder/Recorder 側で Discord packet を受信しているか。
- `Worker event path`: Worker の overlay / caption event counters。
- `Worker event sidecar`: Encoder/Recorder 側で永続化された Worker event。
- `Stream incident / remediation`: Observability から取得した stream scope の incident と remediation。

`Encoder host preflight` は `GET /streams/{id}/encoder-preflight` で取得します。response には YouTube stream key、Google credential path、Drive folder ID、service token、access token を含めません。

External verification config export は、Streams 画面で選択した stream の secret-safe confirmation を生成するための運用機能です。export には stream ID、YouTube output ID、Drive destination ID、Discord config ID、profile ID、primary assignment ID、runtime config distribution の確認 flag だけを含めます。Discord guild/channel ID、Drive folder ID、RTMPS URL、OAuth token、service token は export しません。

## Security

Control Panel の security は operator session、RBAC、CSRF、service registry、runtime secret reference の境界をまとめて所有します。UI/API は secret value ではなく configured state と masked/fingerprint を返し、service dispatch では inbound registry token と outbound dispatch token を混同しないことを確認します。

- Cookie session は HttpOnly を使います。
- production では Secure cookie を使います。
- cookie based API は CSRF token を要求します。
- RBAC は server-side で fail closed にします。
- audit log は login、password change、user / role 変更、stream start / stop、secret 更新、service assignment、remediation 操作などを記録します。
- raw secret は UI、API response、audit metadata、log に出しません。

## Validation

変更後は Control Panel repository で次を実行します。

```powershell
go test ./...
go build ./...
cd web
npm run build
```

UI 変更を伴う場合は Browser smoke で secret 非表示、readiness blocker、dispatch failure、notification channel、Integration Registry を確認します。runtime config や export 形式を変えた場合は contracts、docs、E2E preflight、docs consistency check を同じ変更で更新し、Control Panel の表示だけが先行しないようにします。
