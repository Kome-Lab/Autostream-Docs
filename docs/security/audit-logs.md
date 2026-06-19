# Audit Logs

Audit Logs は、Control Panel で行われた重要操作と、service token 経由で行われた実行時操作を追跡するための記録です。認証、ユーザー管理、ロール変更、stream lifecycle、service assignment、service runtime、secret 更新、notification、remediation を対象にします。

## 記録対象

主な action は次のとおりです。

- `auth.login`
- `auth.logout`
- `auth.change_password`
- `users.create`
- `users.update`
- `users.disable`
- `users.reset_password`
- `roles.create`
- `roles.update`
- `roles.delete`
- `api_tokens.create`
- `api_tokens.revoke`
- `services.assign`
- `services.unassign`
- `services.register`
- `services.heartbeat`
- `archive.artifacts.reported`
- `workers.assign`
- `workers.unassign`
- `workers.restart`
- `streams.create`
- `streams.start`
- `streams.stop`
- `streams.retry_upload`
- `security.settings.update`
- `secrets.update`
- `incidents.acknowledge`
- `incidents.resolve`
- `remediation.approve`
- `remediation.execute`

通常 heartbeat の成功は高頻度になるため監査ログへ大量記録しません。heartbeat は、未登録 service、token 不一致、未 assignment stream への heartbeat などの失敗時に記録します。

## フィールド

```json
{
  "id": "audit-01",
  "timestamp": "2026-06-01T00:00:00Z",
  "actor_user_id": "user-01",
  "actor_username": "admin",
  "actor_ip": "203.0.113.10",
  "user_agent": "Mozilla/5.0",
  "action": "services.assign",
  "resource_type": "service",
  "resource_id": "encoder-01",
  "result": "success",
  "metadata": {
    "stream_id": "stream-01",
    "service_type": "encoder_recorder"
  },
  "request_id": "req-01"
}
```

Service token による操作では、`actor_user_id` は `service:<service_type>`、`actor_username` は `worker` や `encoder_recorder` などの service type になります。対象 service ID は `resource_id` または redaction 済み metadata で追跡します。raw service token と token binding ID は audit log response / export に保存・表示しません。

`metadata` には判断に必要な最小限の情報だけを入れます。raw secret、password hash、service token、Google credential、YouTube stream key、webhook URL、credential 付き stream URL は記録しません。secret らしいキーや値は store 境界で redaction されます。

## Action Group

Audit Logs 画面と API では、調査しやすいように action group で絞り込めます。

| group | 対象 |
| --- | --- |
| `service_assignment` | `services.assign`, `services.unassign`, `workers.assign`, `workers.unassign` |
| `service_runtime` | `services.register`, `services.heartbeat`, `archive.artifacts.reported` |
| `stream_lifecycle` | `streams.create`, `streams.start`, `streams.stop`, `streams.mark_failed`, `streams.retry_upload` |
| `security` | login、user、role、password、MFA 関連 |
| `secrets` | secret、security settings、API token 関連 |
| `notifications` | notification channel 関連 |
| `all` | 全 action |

API 例:

```http
GET /audit-logs?action_group=service_runtime&result=failure&q=encoder-01&limit=100
```

指定できる主な query parameter:

| parameter | 用途 |
| --- | --- |
| `action_group` | 上記 group 名 |
| `action` | comma-separated action names。例: `services.assign,services.unassign` |
| `result` | `success` または `failure` |
| `q` | action、actor、resource、metadata に対する簡易検索 |
| `limit` | 取得件数。最大 500 |

## Stream Lifecycle の確認

Stream lifecycle の調査では `action_group=stream_lifecycle` を使います。

```http
GET /audit-logs?action_group=stream_lifecycle&result=failure&q=stream-01&limit=100
```

`missing_stream_assignments` が発生した場合、`metadata.missing_service_types` に不足 service type が記録されます。dispatch failure は `metadata.dispatch` で概要を確認できます。ただし dispatch token や upstream secret は返しません。

## Service Runtime の確認

Service runtime の調査では `action_group=service_runtime` を使います。

- `services.register`: service registration の成功/失敗
- `services.heartbeat`: heartbeat の失敗
- `archive.artifacts.reported`: Encoder/Recorder からの artifact report の成功/失敗

Artifact report の監査 metadata には `service_id` と `artifact_count` を残します。artifact の raw local path や Drive credential は残しません。

## CSV Export

Audit Logs 画面から CSV export できます。CSV export は raw secret を含みません。

```text
id,timestamp,actor_user_id,actor_username,actor_ip,action,resource_type,resource_id,result,request_id
```

CSV には metadata を含めません。詳細な metadata は Control Panel の Audit Logs 画面で確認します。CSV export でも同じ query parameter を使えます。

```http
GET /audit-logs/export?action_group=stream_lifecycle&result=failure&limit=500
```

## 運用メモ

- 失敗操作も audit log に残します。
- assignment 不足や dispatch failure は `result=failure` で確認します。
- Secret 更新は `configured=true/false` などの状態だけを記録します。
- Audit log を任意に削除・改ざんする運用は避け、DB backup の対象に含めます。
