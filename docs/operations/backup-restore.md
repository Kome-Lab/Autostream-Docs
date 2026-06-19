# Backup / Restore

AutoStream の backup は、Control Panel の database、service 設定、archive files、Observability history を分けて考えます。実 secret は backup artifact に平文で残さないでください。

## backup 対象

| 対象 | 内容 |
| --- | --- |
| MariaDB | users、roles、permissions、stream jobs、profiles、service registry、audit logs |
| env files | `/etc/autostream/*.env` |
| archive | `/var/lib/autostream/archives/final/{stream_id}` |
| Observability | incidents、diagnostics、remediation history、notification delivery history |
| docs / configs | deployment docs、systemd unit、reverse proxy config |

## backup 前の注意

- password manager に入れるべき secret を Git や通常 backup に混ぜない。
- env file を backup する場合は保管先を暗号化する。
- Google Service Account JSON は通常のログ保管場所に置かない。
- archive backup は `tmp/` と `final/` を区別する。

backup は「取れている」だけでは不十分です。MariaDB dump、archive artifact、Observability history、env file、systemd/reverse proxy config が同じ時点を指しているかを記録します。Control Panel の integration registry には encrypted secret と runtime profile が含まれるため、DB dump を別環境に復元すると connected account、notification channel、service registry の trust boundary も一緒に移動します。

## MariaDB backup

maintenance window 中に database dump を取得します。

```bash
mysqldump --single-transaction --routines --triggers autostream > autostream-db.sql
```

dump file は暗号化して保管し、アクセス権を制限します。

dump を evidence、issue、chat に添付しません。復元確認で共有する値は、row count、migration version、stream ID の masked form、secret record の fingerprint、notification channel の configured state に変換します。notification channel や OAuth account の ciphertext/nonce があることは確認しますが、復号結果を backup report に書きません。

## archive backup

archive の標準パス:

```text
/var/lib/autostream/archives/
  tmp/
  final/
```

通常 backup 対象は `final/` です。障害調査中は `tmp/{stream_id}/final.mkv` も保全します。

## restore 手順

1. service を停止します。
2. MariaDB を restore します。
3. env file と systemd unit を戻します。
4. archive directory を戻します。
5. file owner と permission を `autostream` user に合わせます。
6. Control Panel を起動します。
7. Service Health と Audit Logs を確認します。
8. 各 service を 1 台ずつ起動します。

復元先が別 host、別 domain、別 provider project の場合は、復元直後に外部 provider へ接続しません。まず `AUTOSTREAM_ENV`、reverse proxy origin、WebAuthn RP、service public URL allowlist、OAuth redirect URI、Drive destination、YouTube output、notification channel を復元先に合わせて確認します。旧環境の session、service token、runtime secret lease が使えない状態になっていることを確認してから service を online にします。

## restore 後の確認

- `GET /health` が成功する。
- login できる。
- stream 一覧と profiles が復元されている。
- service registry は期待通り、または再登録できる。
- archive artifacts が Control Panel から参照できる。
- Observability incident history が参照できる。

restore 完了の判断には、Control Panel UI での閲覧だけでなく、start readiness、service heartbeat freshness、runtime config distribution、archive read/write probe、notification test、external verification preflight を含めます。外部確認は provider 値の再確認が終わるまで completion pass にしません。

## secret rotation が必要な場合

backup の漏えいや restore 先の trust boundary 変更がある場合は、[Secret rotation](../runbooks/rotate-secrets.md) を実行します。ただし live stream 中に credential rotation を自動実行しないでください。

rotation 対象は Control Panel session secret、service token、stream ingest signing key、OAuth connected account、Discord Bot token、YouTube output、Drive Service Account JSON、webhook URL、SMTP password を分けて判断します。どれを rotate したかは secret value ではなく secret name、fingerprint、audit ID、provider-side timestamp で記録します。
