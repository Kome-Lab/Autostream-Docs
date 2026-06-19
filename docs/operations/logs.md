# Logs

AutoStream は structured log を前提にします。配信単位のログは archive directory の `logs.jsonl` にも保存し、Control Panel と Observability から参照できるようにします。

log は障害調査の入口ですが、secret の退避先ではありません。service log、archive `logs.jsonl`、audit log、Observability signal は目的が違うため、同じ内容を無差別にコピーしません。operator が共有するのは request ID、stream ID、service ID、error code、masked/fingerprint 値だけです。

## log に含める情報

- timestamp
- level
- service ID
- service type
- stream ID
- request ID
- action
- status
- error code
- masked URL
- incident ID

## log に含めてはいけない情報

- Discord Bot token
- Deepgram API key
- YouTube stream key
- Google access token
- OAuth refresh token
- service token
- webhook URL
- session secret
- database password
- 認証情報付き stream URL の raw 値

必要な場合は `<REDACTED>`、`<TOKEN>`、`<PASSWORD>` などの placeholder に置き換えます。

## 配信単位の logs.jsonl

Encoder/Recorder は配信成果物として次を保存します。

```text
/var/lib/autostream/archives/final/{stream_id}/logs.jsonl
```

ここには、start、FFmpeg launch、worker events、remux、upload、retry の要約を保存します。

`logs.jsonl` は 1 行 1 JSON object とし、少なくとも `timestamp`、`stream_id`、`service_id`、`phase`、`status`、`request_id` を持たせます。FFmpeg の full argv、RTMPS URL、credentialed input URL、local absolute archive path は入れず、logical relative path、configured state、fingerprint、duration、byte count に変換します。

例:

```json
{"timestamp":"2026-06-12T00:00:00Z","stream_id":"stream-01","service_id":"encoder-recorder-primary","phase":"remux","status":"completed","artifact":"final/stream-01/final.mp4","duration_ms":1842,"request_id":"req-01"}
```

## Control Panel audit logs との違い

| 種別 | 目的 |
| --- | --- |
| service log | service 内部の処理状況 |
| archive `logs.jsonl` | 配信単位の成果物として残す処理履歴 |
| audit log | 誰が何を操作したかの証跡 |
| Observability signal | rule detection と diagnostics のためのイベント |

audit log は sensitive action の証跡です。service debug log の代替ではありません。

## ログ共有

外部に共有する場合は、先に secret masking を行います。共有してよい代表値は `stream_id`、`service_id`、`request_id`、`incident_id`、masked URL です。

共有前の確認では、`docs:check-secrets` と同等の pattern に加え、provider 固有の token prefix、credentialed URL、OAuth code、session cookie、SMTP password、webhook path を目視で確認します。PowerShell で日本語が崩れて見える場合は、まず UTF-8 表示の問題を疑い、Node などで source bytes を読んでから修正します。

## 保持と削除

通常の service log は調査期間に合わせて rotation し、archive `logs.jsonl` は stream artifact と同じ保持期間に揃えます。incident 調査で長期保存する場合も、raw credential が含まれていないことを `docs:check-secrets` 相当の pattern で確認してから共有します。誤って secret が出た log は、mask 後の再共有ではなく、元 artifact の削除、credential rotation、影響範囲の audit を先に行います。

rotation は service ごとに分けます。Control Panel は audit retention、Encoder/Recorder は archive retention、Observability は incident retention、Discord Bot / Worker は short-lived service log を基本にします。長期保管が必要な場合は、raw log ではなく redacted summary と evidence file を残し、元 log の保管先と削除期限を audit に記録します。
