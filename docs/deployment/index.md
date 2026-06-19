# Deployment

AutoStream は Control Panel、Discord Bot、Encoder/Recorder、Worker、Observability を別 host に置ける分散システムです。運用 secret と destination は Control Panel で管理し、env は起動と Control Panel 接続に必要な bootstrap 値へ限定します。

## 導入前の方針

- Control Panel は MariaDB と secret encryption key を持つ中央 control plane です。
- 各 service は `SERVICE_ID`、`CONTROL_PANEL_URL`、`CONTROL_PANEL_TOKEN` で登録と heartbeat を行います。
- Discord Bot token、YouTube stream key、Google OAuth refresh token、Drive folder ID、webhook URL、SMTP password は Control Panel に登録します。
- Encoder/Recorder、Worker、Discord Bot は複数登録し、stream ごとに `primary` / `standby` assignment を設定します。
- start / stop / retry-upload は primary service のみに dispatch します。

## 導入方法

- [Docker](./docker.md): Docker / Compose で service を起動する。
- Local Docker validation: use service repository Compose files without real provider secrets.
- [Host](./host.md): Linux host に直接インストールする。
- [systemd](./systemd.md): direct host の service unit と hardening。
- [Multi-server](./multi-server.md): service を別サーバーに配置する。
- [Reverse Proxy](./reverse-proxy.md): TLS、trusted proxy、secure cookie。
- [Firewall](./firewall.md): inbound / outbound の最小許可。

## 構成選択

本番は、Control Panel と MariaDB を最初に安定させ、次に Discord Bot、Encoder/Recorder、Worker、Observability を登録します。単一 host に Docker Compose で置く場合でも、service token、public URL、runtime config、secret storage の境界は multi-server と同じにします。host 直導入を選ぶ場合は systemd sandboxing、reverse proxy、firewall、log retention を先に決めます。

| 構成 | 使う場面 | 必須の追加確認 |
| --- | --- | --- |
| Docker Desktop local stack | 開発と smoke。実 provider secret は入れない。 | service health check, UI redaction review, secret scan |
| single-host Docker Compose | 小規模本番または staging。 | TLS、MariaDB backup、service URL allowlist、volume backup |
| direct host + systemd | 長期稼働本番。 | unit hardening、least privilege user、journal retention、token rotation |
| multi-server | Encoder/Recorder や Discord Bot を別 host に分ける。 | firewall、public URL reachability、primary/standby assignment、heartbeat freshness |

## 本番投入前 checklist

- `AUTOSTREAM_SESSION_SECRET`、`AUTOSTREAM_SECRET_ENCRYPTION_KEY`、DB password は bootstrap secret として secret manager から渡す。
- Discord Bot token、YouTube Live API output、Drive destination、OAuth connected account、notification channel は Control Panel UI/API で登録する。
- `SERVICE_ID` は service 種別と環境が分かる名前にし、token scope は `service.register`、`service.heartbeat`、必要な runtime config/secret scope に限定する。
- `AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS` は Control Panel から dispatch する service host だけを許可する。
- Observability notification の webhook URL と SMTP password は DB 上で ciphertext/nonce のみ保存され、UI/API/evidence には masked target だけが出ることを確認する。

## 最初に検証すること

deployment 後は、service が起動しているかだけでなく、Control Panel への登録、heartbeat freshness、primary/standby assignment、runtime config fetch、secret-safe evidence gate が揃っているかを確認します。外部 provider 値をまだ入れていない場合は、本番運用実装済みと provider verification record 待ちを分けて記録します。

## Operator Notes

Deployment ページは、各 host の手順を 1 つにまとめるためではなく、どの runbook を選ぶかを決める入口です。single host、multi-server、Docker Desktop、systemd、reverse proxy のどれを選んでも、Control Panel 管理の runtime config と encrypted secret store を標準にし、service env は bootstrap 値に限定します。

本番投入前は、健康状態だけでなく assignment、runtime config version、public URL allowlist、archive directory permission、notification secret storage、external verification preflight を同じ stream plan で確認します。実 provider 値は docs に残さず、必要な値を operator が Control Panel UI/API か a local ignored runtime directory に入れてから evidence checker を実行します。

```bash
curl -fsS https://control.example.com/health
```

Control Panel 起動後、[初回 admin 作成](../runbooks/create-first-admin.md) に従って `super_admin` を作成し、MFA を登録します。その後、API Tokens から各 service token を発行します。raw token は一度だけ表示されるため、password manager または secret manager に保存し、docs、ticket、PowerShell transcript には残しません。

本番投入の完了判断は `/health` ではなく、Service Health、start readiness、runtime config fetch、Observability ingest、external verification preflight、readiness check を順に見ます。実 provider 値が未投入でも、実装と local-generated secret の準備が済んでいる場合は provider verification record 待ちとして扱い、未確認の Discord / YouTube / Drive 成功を docs に書きません。
