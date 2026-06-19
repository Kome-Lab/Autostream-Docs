# Incidents

Incident は Observability が signal や metric から検知した異常です。Control Panel では incident の確認、acknowledge、resolve、diagnostic / remediation の確認を行います。

## Severity

| severity | 用途 |
| --- | --- |
| `info` | 回復通知や軽微な状態変化 |
| `warning` | 配信品質や archive に影響する可能性がある状態 |
| `error` | 配信、録画、upload の一部に失敗している状態 |
| `critical` | live stream 継続や archive 保存に重大な影響がある状態 |

## Status

| status | 意味 |
| --- | --- |
| `open` | 未対応または新規 incident |
| `acknowledged` | 担当者が確認済み |
| `investigating` | 原因調査中 |
| `mitigated` | 暫定対処済み |
| `resolved` | 解決済み |
| `ignored` | 意図的に無視 |

## Required Rules

AutoStream MVP では、少なくとも次の rule を扱います。

- heartbeat timeout
- encoder process exited during live stream
- high packet loss
- RTMPS reconnect loop
- audio silence
- recorder not writing
- disk low
- Google Drive upload failed
- stream start timeout
- stream stop timeout
- unexpected stopped
- Discord audio not receiving / forward failed / forward stale
- Worker event send failed

## Dedupe

同じ `rule + service_id + stream_id` に対する active incident は重複作成せず、既存 incident を更新します。`resolved` または `ignored` の後に同じ異常が再発した場合は、新しい incident として扱います。

dedupe key は operational owner を失わない粒度にします。Discord Bot の VC disconnect、Worker event publish failure、Encoder/Recorder remux failure、Drive upload failure、notification delivery failure は同じ stream でも owner が異なるため、単一の generic stream incident に潰しません。逆に同じ service / rule / stream の retry noise は 1 つの active incident に集約し、severity、latest evidence、retry count を更新します。

## 対応フロー

1. `open` incident を確認する。
2. 誤検知でなければ `acknowledged` にする。
3. `Diagnostics` の summary、likely cause、evidence を確認する。
4. 推奨 action が safe か manual approval か確認する。
5. 必要に応じて remediation action を承認・実行する。
6. 根本原因が解消したら `resolved` にする。

archive 削除、credential rotation、live stream stop、role 変更、service token revoke は incident 画面から自動実行しません。

`critical` incident であっても、live stream stop と credential rotation は別の承認境界です。Encoder process が落ちた、archive write が止まった、YouTube RTMPS が継続失敗した場合は stream safety を優先しますが、Drive upload failure や notification delivery failure だけで live stream を止めません。operator は diagnostic evidence、current stream status、archive artifact 状態を見て action を選びます。

## Notification

incident lifecycle では主に次の notification event を使います。

- `incident.opened`
- `incident.updated`
- `incident.resolved`
- `diagnostic.created`
- `remediation.pending_approval`
- `remediation.executed`

notification には Control Panel の incident URL を含められますが、webhook URL や token は本文に含めません。

## 運用判断

incident は単独の alert として閉じず、stream ID、service ID、assignment、runtime config version、直近の deploy / token rotation と合わせて判断します。Discord audio incident では gateway 接続、voice 接続、packet delta、Encoder RTP forwarded count を順に見ます。archive / upload incident では `final.mkv`、remux、Drive permission、quota、retry count を分けます。

通知が届かない場合でも、notification channel の raw webhook URL や SMTP password を incident comment に貼り付けません。delivery history の masked target、provider type、attempt count、error category を使って切り分け、credential を疑う場合は Control Panel の secret status と rotation audit を確認します。

## 事後確認

incident を `resolved` にする前に、recovery signal が入っていることを確認します。Discord audio は packet delta と last packet age、Worker event は event path と sidecar、Encoder/Recorder は process / bitrate / archive metric、Drive upload は per-file fingerprint、notification は masked delivery success を見るのが標準です。復旧手順を runbook に反映した場合は、docs consistency check に代表フレーズを追加して再発時に退行を検知します。
