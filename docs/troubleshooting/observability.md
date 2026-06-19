# Observability のトラブルシュート

Observability は health signal、metric、log、event、incident、diagnostic report、remediation、notification delivery を集約します。Control Panel は表示と操作の入口であり、検知と診断の主体は Observability service です。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| ingest token | `OBSERVABILITY_INGEST_TOKEN_SHA256` が設定されているか |
| sender token | 各 service の `OBSERVABILITY_TOKEN` が hash と対応しているか |
| health | `GET /health` が成功するか |
| ingest | `/signals` が `202 Accepted` を返すか |
| storage | incident / diagnostic / notification history が保存されているか |
| Control Panel | Observability API URL と token が Control Panel 側に設定されているか |

token 未設定または mismatch の場合、ingest API は fail closed で拒否します。

## signal が届かない

1. 送信元 service の `OBSERVABILITY_URL` を確認します。
2. `OBSERVABILITY_TOKEN` と Observability 側 hash が対応しているか確認します。
3. firewall / reverse proxy が `/signals` を通しているか確認します。
4. request body が signal schema に合っているか確認します。
5. Observability service log で validation error を確認します。

raw token を curl examples やログに残さないでください。検証時は `<OBSERVABILITY_TOKEN>` のような placeholder を使います。

service 側が healthy でも signal が届かない場合は、Control Panel の service heartbeat と Observability ingest を分けて確認します。heartbeat は Control Panel の registry token、signal ingest は Observability token を使います。片方だけ成功している場合は URL、token hash、reverse proxy route、service env の所有 repository を取り違えている可能性があります。

## incident が作られない

required rules の coverage を確認します。

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

metric name、stream ID、service ID、timestamp が欠けていると rule が評価できない場合があります。送信元 service の signal payload を schema と照合します。

## incident が重複する

Observability は同じ dedupe key の active incident を再利用します。次を確認します。

- dedupe key が service ID / stream ID / rule name を含んでいるか
- `resolved` / `ignored` 後の再発を新規 incident として扱っているか
- severity escalation の場合だけ update notification を出しているか
- recovery signal で incident status を更新しているか

同じ警告が短時間で大量に出る場合は、rule interval、notification rate limit、dedupe key を確認します。

## diagnostic report が薄い

診断レポートは日本語で、次を含めます。

- summary
- likely cause
- confidence
- evidence
- impact
- recommended actions
- safe auto-remediation candidates
- actions requiring approval

evidence が不足する場合は、送信元 service から required metrics が届いているか確認します。

## remediation が実行されない

remediation mode を確認します。

```text
disabled
suggest_only
safe_auto
manual_approval
```

既定は `suggest_only` です。`safe_auto` でも、archive delete、credential rotation、role 変更、live stream stop、YouTube broadcast recreate、service token revoke は自動実行しません。

## notification が届かない

1. notification channel が enabled か確認します。
2. severity filter と event type filter を確認します。
3. webhook URL が configured になっているか確認します。
4. delivery history で response code と retry count を確認します。
5. rate limit に達していないか確認します。

delivery history には masked target のみ保存します。raw webhook URL を保存しないでください。

MariaDB に保存された notification channel は webhook URL / SMTP password の ciphertext と nonce だけを保持します。UI、API response、diagnostic report、delivery history に raw target が出る場合は incident として扱い、channel を disable して credential rotation と audit review を行います。private host webhook / SMTP は production では fail closed で拒否されるため、許可が必要な検証は local environment に限定します。

delivery が失敗した場合は、provider response code、retry count、rate limit、severity filter、event type filter を確認します。notification の再送は channel secret を再入力せずに実行し、secret 更新が必要な場合は Control Panel の write-only form から更新します。

## 復旧後の確認

Observability の復旧後は、signal ingest が戻ったことと、incident / diagnostic / notification の各段階が secret-safe に動いていることを分けて確認します。webhook URL、SMTP password、provider token は表示せず、masked target、ciphertext/nonce storage、delivery status、failure class だけを evidence に残します。

- `heartbeat` と `metric` signal が継続して ingest されている。
- incident が期待通り open / resolved になる。
- diagnostic report が日本語で生成される。
- remediation history が残る。
- notification delivery history に raw secret が含まれない。
- notification channel storage に ciphertext/nonce があり raw webhook URL / SMTP password が残っていない。
- external verification の Notifications phase readiness が secret-safe な blocker だけを返す。
