# Observability のセキュリティ

Observability は各 service から token 付きで signal を受け取り、incident、diagnostic、remediation、notification delivery を管理します。ingest token は raw 値を永続化せず、SHA-256 hash として照合します。

Observability は「検知結果を保存する場所」であって、raw secret の退避場所ではありません。Control Panel から参照される incident、diagnostic、delivery history、remediation status は operator が読む前提なので、保存時と read 時の両方で redaction します。MariaDB backend を使う場合も、webhook URL、SMTP password、provider credential は ciphertext と nonce の組で扱います。

## Ingest

- `POST /signals` は service token がない場合 fail closed です。
- signal payload に raw token、webhook URL、Google credential、YouTube stream key を含めてはいけません。
- token mismatch の error response は token や request body を echo しません。
- service ごとの `OBSERVABILITY_URL` は `http` または `https` の absolute URL のみ有効です。

## Notification

- notification channel の raw webhook URL は encrypted secret として保存し、API response では `masked_webhook_url` のみ返します。
- webhook URL は `http` または `https` の absolute URL のみ登録できます。
- delivery history には masked target と delivery status だけを保存し、raw webhook path や token は保存しません。
- test notification の response も raw webhook URL を返しません。

notification の疎通確認では、送信可否、status code class、retry count、last error の redacted summary だけを証跡に残します。Slack/Discord webhook URL や SMTP password は config dump、delivery history、test response、diagnostic evidence に出しません。

production では private host の webhook / SMTP を env で許可しても fail closed にします。検証で private endpoint を使う場合は local environment に限定し、本番の notification channel へ昇格しません。delivery failure の調査では、masked target、provider response code、retry exhaustion、rate limit だけを使い、raw URL をログから探す運用をしません。

## Remediation

- remediation mode の既定値は `suggest_only` です。
- safe auto action は retry upload、status refresh、diagnostics rerun などに限定します。
- archive 削除、credential rotate、role 変更、live stream 停止、service token revoke は自動実行しません。

Control Panel は Observability の結果を表示しますが、検知、診断、remediation 判定の責務は Observability 側にあります。

自動 remediation は incident と stream の境界を確認してから実行します。dangerous action は approval record と operator identity がない限り dispatch せず、Control Panel には「提案」「承認待ち」「実行済み」「拒否」の状態だけを返します。

## DB 境界

MariaDB backend では webhook URL、SMTP password、notification provider credential を plaintext column に保存しません。integration test では ciphertext と nonce が存在し、masked target だけが API response に出ることを確認します。復旧や migration のために dump を扱う場合も、dump を evidence や issue に添付せず、必要な確認値を fingerprint と record count に変換して共有します。

DB migration や backup restore の後は、notification channel の復号可否だけでなく、plaintext column が増えていないこと、API response が masked target のままであること、delivery history が raw provider path を保持していないことを確認します。暗号化鍵を rotate する場合は、old key と new key の併用 window、再暗号化 job、失敗 record の扱い、roll back 可否を maintenance note に残します。
