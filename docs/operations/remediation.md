# Remediation

Remediation は incident と diagnostic report に基づいて復旧操作を提案、承認、または安全な範囲で実行する仕組みです。AutoStream では安全側を標準とし、ライブ配信停止や認証情報変更のような危険操作は自動実行しません。

## Mode

| mode | 動作 |
| --- | --- |
| `disabled` | remediation を作成しません。 |
| `suggest_only` | 推奨 action を表示するだけです。 |
| `safe_auto` | safe action のみ自動実行候補にします。 |
| `manual_approval` | 承認後に実行します。 |

既定値は `suggest_only` です。

```text
REMEDIATION_MODE=suggest_only
```

## Safe Auto Actions

次は安全な自動実行候補です。

- `retry_gdrive_upload`
- `retry_package_remux`
- `refresh_service_status`
- `rerun_diagnostics`
- `clear_stale_warning`

`retry_gdrive_upload` と `retry_package_remux` は Observability が archive を直接操作せず、Control Panel の service-token endpoint へ dispatch します。Control Panel は対象 stream の primary `encoder_recorder` assignment を確認し、割り当て済み Encoder/Recorder だけへ `/streams/package` を dispatch します。

Control Panel へ送る remediation request には `action_id`、`incident_id`、`stream_id`、`action` が必須です。Observability は実際の remediation action record と incident context からこれらを作成します。

Control Panel は dispatch 直前に Observability read API で `action_id`、`incident_id`、`stream_id`、`action` を照合し、実行可能な remediation action であることを確認します。その後に `action_id` を一度だけ claim します。同じ `action_id` が再送された場合は `409 remediation_action_replayed` を返し、Encoder/Recorder へ再 dispatch しません。失敗した action を再試行したい場合は、Diagnostics を再実行して新しい remediation action を作成します。

## Control Panel Dispatch Result

Remediation Actions 画面の `Result` では実行結果を確認できます。

| result | 意味 |
| --- | --- |
| `control_panel_dispatch_executed` | Control Panel が対象 Encoder/Recorder へ dispatch しました。 |
| `recorded_noop` | 状態記録のみです。外部 dispatch は行っていません。 |
| `control panel dispatch failed` | Control Panel または対象 service への dispatch に失敗しました。 |
| `control panel dispatch is not configured` | `CONTROL_PANEL_URL` または `CONTROL_PANEL_TOKEN` が未設定です。 |
| `action_id, action, incident_id, and stream_id are required` | dispatch context が不足しています。 |
| `remediation_context_not_verified` | Control Panel が Observability の action / incident / stream context を検証できませんでした。 |
| `remediation_action_replayed` | 同じ `action_id` が再送されました。再 dispatch は行いません。 |
| `manual approval is required` | 承認前の manual action を実行しようとしました。 |
| `dangerous action is never auto-executed` | 自動実行禁止の危険操作です。 |

`blocked` の action は Result を確認し、Diagnostics を再実行してから次の action を判断します。

## Archive / Remux の扱い

`archive_remux_slow` は remux が完了したが想定より時間がかかった状態です。すぐ retry せず、次を確認します。

- `recorder.remux_duration_ms`
- `archive.final_mkv_exists`
- `archive.final_mp4_exists`
- `recorder.disk_free_bytes`
- remux log
- archive disk I/O

`archive_package_failed` は package / remux が失敗した状態です。`final.mkv` が残っていて破損していない場合だけ `retry_package_remux` を候補にします。

`gdrive_upload_failed` は local package は完了しているが upload が失敗した状態です。`failure_phase=upload` の evidence がある場合は、Drive folder 共有、OAuth / Service Account 権限、API quota、network を優先して確認します。

## Manual Approval Actions

次は人の承認を必要とします。

- Discord Bot restart
- Encoder/Recorder restart
- Worker restart
- Discord voice reconnect
- YouTube RTMPS output restart
- healthy Encoder/Recorder への stream reassignment

承認前に、live stream への影響と rollback を確認します。

## Never Auto Actions

次は自動実行してはいけません。

- archive delete
- credential rotation
- role / permission change
- live stream stop
- YouTube broadcast recreate
- service token revoke

## 実行前チェック

1. incident が active であることを確認します。
2. diagnostic report の evidence を確認します。
3. action が safe auto か manual approval かを確認します。
4. `action_id`、`incident_id`、`stream_id` が揃っていることを確認します。
5. 対象 service と stream ID が一致していることを確認します。
6. secret を含む parameter が request / audit metadata に入っていないことを確認します。

## 失敗時

Control Panel dispatch に失敗した場合、action は `blocked` になり、`control panel dispatch failed` を result に残します。同じ action を無限 retry せず、Diagnostics を再実行してから次の action を判断します。

## 残る hardening

`action_id` / `incident_id` / `stream_id` は必須化され、Control Panel は Observability read API で context を照合し、`action_id` replay も拒否します。さらに強化する場合は、dispatch request に署名付き nonce を導入します。
