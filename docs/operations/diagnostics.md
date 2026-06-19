# Diagnostics

Diagnostic report は、incident や stream failure に対して Observability が生成する日本語の原因切り分けです。自動復旧の前に、人が判断できる証拠を揃えることを目的にします。

## Report 構造

```json
{
  "summary": "string",
  "likely_cause": "string",
  "confidence": 0.0,
  "evidence": [],
  "impact": "string",
  "recommended_actions": [],
  "safe_auto_remediation_candidates": [],
  "actions_requiring_approval": []
}
```

## Evidence に含めてよいもの

- stream ID
- service ID
- service type
- metric name と数値
- incident rule
- timestamp
- archive file existence
- upload status
- `failure_phase` / `error_class`
- Discord audio forward counters
- Discord Bot to Worker event publish failure counters
- Worker event send failure counters

secret、access token、stream key、webhook URL、credential 付き URL は含めません。

## Control Panel での表示

Control Panel の `Incidents` と `Diagnostics` では、rule ごとの report と evidence highlight を表示します。

| key | 表示内容 |
| --- | --- |
| `failure_phase` | archive / package の失敗段階 |
| `error_class` | 安全に分類された error |
| `upload_attempts` | Google Drive upload 試行回数 |
| `remux_duration_ms` | remux 所要時間 |
| `discord.audio_forward_errors_total` | Discord 音声 forward 失敗回数 |
| `discord.audio_forwarded_total` | Encoder/Recorder へ転送できた packet 数 |
| `discord.audio_last_forward_age_sec` | 最後の forward 成功からの秒数 |
| `discord.audio_last_packet_age_sec` | 最後の Discord packet 受信からの秒数 |
| `discord.reconnect_count` | Discord Gateway 再接続回数 |
| `discord.voice_disconnect_count` | Discord Bot が VC から切断された回数 |
| `discord.worker_event_publish_failures_total` | Discord Bot から Worker への participant / active-speaker event publish 失敗回数 |
| `worker.event_send_failures_total` | Worker から Encoder/Recorder への event publish 失敗回数 |

## Confidence

| confidence | 解釈 |
| --- | --- |
| 0.8 以上 | evidence が揃っており、原因の可能性が高い |
| 0.5 - 0.79 | 有力だが追加確認が必要 |
| 0.49 以下 | 仮説。人による確認が必要 |

confidence が低い場合は remediation を自動実行せず、追加 metric や service log を確認します。

diagnostic confidence は自動実行の許可ではありません。0.8 以上でも archive deletion、credential rotation、role change、live stream stop、service token revoke は approval record が必要です。0.49 以下の report は、追加 metric の要求、provider verification record の再取得、service heartbeat の再確認に進め、operator が仮説を evidence と誤読しないようにします。

## よくある診断例

| summary | likely cause | 推奨 action |
| --- | --- | --- |
| Encoder heartbeat timeout | service 停止または network 到達不可 | service health と systemd / Docker log を確認 |
| Recorder not writing | archive directory 権限または disk full | disk free と write permission を確認 |
| RTMPS reconnect loop | network 不安定または bitrate 過大 | bitrate と outbound RTMPS を確認 |
| Google Drive upload failed | folder 権限または transient API failure | folder share を確認して retry-upload |
| Discord audio forward failed | Encoder public URL、token、network の問題 | audio-status、token、public URL を確認 |
| Discord reconnect loop | Gateway 再接続や network 瞬断の繰り返し | `discord.reconnect_count`、Bot host network、heartbeat を確認 |
| Discord voice disconnected | Bot が配信中の VC から外れた | `discord.voice_disconnect_count`、VC 権限、audio-status を確認 |
| Worker event send failed | Worker から Encoder/Recorder への publish 失敗 | Worker event path と sidecar を確認 |

## 生成タイミング

- incident opened
- stream failed
- operator が diagnostics run を実行
- remediation 前の確認
- recovery 後の postmortem

Control Panel は diagnostic report を表示しますが、診断ロジックは Observability に置きます。Control Panel 側で raw metric や secret を加工して推論しないようにします。

report を共有する場合は、summary、likely cause、metric name、masked service/stream ID、recommended action だけに絞ります。raw log excerpt、request body、OAuth code、webhook URL、SMTP password、Drive raw file ID、YouTube stream key は貼り付けません。postmortem では diagnostic report の全文ではなく、原因分類、影響範囲、修正した repository、再発防止 gate を記録します。

## 運用判断の境界

diagnostic report は判断材料であり、Control Panel の操作そのものではありません。Observability が high confidence の原因を出しても、live stream stop、retry-upload、service restart、credential rotation、role change は Control Panel の approval record と audit log を通します。operator は report の `recommended_actions` を見て、対象 repository、service owner、provider owner、rollback 手順を確認してから実行します。

原因が複数 boundary にまたがる場合は、report を 1 つの結論にまとめすぎないようにします。たとえば Discord packet が届かず、同時に Drive upload も失敗している場合は、audio input と archive/upload を別 incident または別 evidence section として扱います。これにより、音声復旧のための Bot 修正と、upload 復旧のための Drive destination 修正を混同しません。

diagnostic の再実行後は、古い confidence や古い evidence を最新の状態として使いません。復旧後の report は新しい `generated_at`、stream ID、runtime config version、service heartbeat、provider verification record timestamp を持つ必要があります。postmortem では、初回 report、修正内容、再実行 report、readiness check の順で残し、どの時点の判断が本番運用の完了に使われたかを追えるようにします。

diagnostic を UI で見た operator は、まず report がどの service boundary を指しているかを確認します。Control Panel の assignment 不足、Discord Bot の VC 接続失敗、Encoder/Recorder の FFmpeg failure、Worker の event publish failure、Observability の notification delivery failure は、同じ stream failure でも修正先が異なります。report が複数 owner を示す場合は、primary cause と downstream impact を分けて incident comment に残します。

report の evidence section は、数値と状態を安全に共有するための領域です。packet count、retry count、duration、status、fingerprint、masked target は残せますが、raw log、provider response body、OAuth code、Drive file ID、YouTube stream key、SMTP password は残しません。必要に応じて元ログの保管場所を operator-only の安全な場所に残し、docs evidence には要約だけを書きます。

remediation 候補が出た場合も、候補の種類ごとに扱いを分けます。read-only diagnostic refresh や retry status fetch は自動実行しやすい一方で、stream stop、service restart、credential rotation、assignment promotion、archive delete は manual approval が必要です。report はこの差を明示し、Control Panel の approval record がない destructive operation を完了証跡に含めません。

diagnostic report の変更は、Observability repo だけでなく docs repo と Control Panel UI の表示にも影響します。新しい field を追加した場合は、UI が raw value を表示していないこと、evidence checker が secret-like value を拒否すること、operator runbook がどの field を共有してよいかを説明していることを確認します。

本番で report を使うときは、report の language や formatting も運用品質の一部として扱います。文字化け、途中で切れた JSON、table だけで説明のない report は、remediation の根拠として弱いため、PowerShell 表示問題か source corruption かを UTF-8 strict read と mojibake detector で確認してから修正します。
