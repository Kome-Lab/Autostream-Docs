# 初回インストール

この Runbook は、AutoStream を初めて導入し、Control Panel を起動して各 service を登録できる状態にするまでの手順です。

## Source / ownership

`<DB_PASSWORD>` は MariaDB operator が generated / issued する database credential です。`<SETUP_TOKEN>`、`<SESSION_SECRET>`、`<SECRET_ENCRYPTION_KEY>`、`<CONTROL_PANEL_TO_SERVICE_TOKEN>` は Control Panel bootstrap 用に generated し、password manager / secret manager と `/etc/autostream/control-panel.env` だけに保存します。Discord token、YouTube output、Drive destination、webhook URL、SMTP password は初回起動後に Control Panel の Integration Registry / notification channel へ登録し、host env へ固定しません。

## 前提

- Control Panel、Discord Bot、Encoder/Recorder、Worker、Observability は別サーバーに配置できます。
- すべての service URL は環境変数で明示します。
- server-side service は Docker と direct host / systemd の両方を想定します。
- 実 secret は `.env`、env file、password manager、secret manager に保存し、Git に commit しません。
- direct host では `autostream` user での実行を推奨します。

## 1. MariaDB を用意する

Control Panel 用の MariaDB を用意し、接続 URL を作成します。

```text
DATABASE_URL=mysql://autostream:<DB_PASSWORD>@db.example.com:3306/autostream
```

`<DB_PASSWORD>` は placeholder です。実値をドキュメント、チャット、スクリーンショットに残さないでください。

## 2. Control Panel の env を設定する

direct host の標準 env file は次です。

```text
/etc/autostream/control-panel.env
```

最小構成例:

```text
AUTOSTREAM_DATA_DIR=/var/lib/autostream/control-panel
AUTOSTREAM_BIND_ADDR=127.0.0.1
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
DATABASE_URL=mysql://autostream:<DB_PASSWORD>@db.example.com:3306/autostream
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
SERVICE_CALL_TOKEN=<CONTROL_PANEL_TO_SERVICE_TOKEN>
TZ=Asia/Tokyo
```

reverse proxy を使う場合は HTTPS、Secure cookie、trusted proxy の設定を確認します。

`SERVICE_CALL_TOKEN` は Control Panel から Discord Bot、Worker、Encoder/Recorder などの service endpoint を呼ぶために使います。各 service 側には raw token ではなく、対応する `SERVICE_CONTROL_TOKEN_SHA256` を設定します。

`AUTOSTREAM_SECRET_ENCRYPTION_KEY` と `AUTOSTREAM_SESSION_SECRET` はこの時点で生成する local bootstrap secret です。Discord Bot token、YouTube output、Drive destination、OAuth login provider、notification webhook / SMTP はまだ env に置かず、初期 admin 作成後に Control Panel UI/API で登録します。初回構築の途中で provider secret を env に戻すと、後続の runtime config / encrypted secret 境界の検証が弱くなります。

## 3. Control Panel を起動する

Docker:

```bash
docker compose up -d
```

direct host / systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-control-panel
```

起動後に health check を確認します。

```bash
curl -fsS https://control.example.com/health
```

## 4. 初期 admin を作成する

Control Panel の初期 setup API または UI から `super_admin` を作成します。作成には `AUTOSTREAM_SETUP_TOKEN` を使います。

初期 admin 作成後は次を確認します。

- setup token が不要になったら無効化または保護する。
- password は 12 文字以上にする。
- temporary password を共有した場合は、初回ログイン後に変更する。
- audit log に初期 admin 作成が残っている。

## 5. service token を作成する

Control Panel の `API Tokens` で、各 service 用 token を作成します。

対象:

- Discord Bot
- Encoder/Recorder
- Worker
- Observability

raw token は作成直後に一度だけ表示されます。password manager に保存し、`.env.example` や docs には書かないでください。

代表的な scope は [Service の登録](./register-service.md) を参照してください。

## 6. 各 service を起動する

各 service には共通して次の env を設定します。

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
TZ=Asia/Tokyo
```

`SERVICE_PUBLIC_URL` は Control Panel から到達できる absolute HTTP(S) URL にします。分散配置では `localhost` や Docker 内部 DNS 名だけに依存しないでください。

## 7. Service Health を確認する

Control Panel の `Service Health` で次を確認します。

- service ID
- service type
- public URL
- status
- last heartbeat
- current stream
- capabilities
- heartbeat metrics

online にならない場合は、[Service の登録](./register-service.md) と [Network troubleshooting](../troubleshooting/network.md) を確認します。

Service Health が online でも、start readiness が通るとは限りません。初回 install では service heartbeat、capabilities、runtime config fetch、service public URL allowlist、assignment role、Observability ingest を別々に確認します。特に distributed host では `SERVICE_PUBLIC_URL` が Control Panel から到達できる URL であることを実際の dispatch で確認します。

## 8. dry-run 検証に進む

実 Discord token、YouTube stream key、Google credential を使う前に、Control Panel の readiness、service heartbeat、secret-safe config 表示を確認します。内部 dry-run / E2E 証跡手順は公開 repository には含めません。

dry-run では次を確認します。

- service registration / heartbeat
- stream assignment planner
- Encoder/Recorder `/streams/dry-run`
- Worker event test
- Observability signal / incident / remediation
- secret redaction

## 次に行うこと

1. [Service の登録](./register-service.md) で token と assignment を確認する。
2. Control Panel の readiness、service heartbeat、secret-safe config 表示を確認する。
3. [初回配信](./start-first-stream.md) に進む。

外部 provider を使う段階では、a local ignored runtime directory の operator-managed 値、Control Panel config export、provider verification record を順に埋めます。local-generated secret と provider 値を混ぜて扱わず、readiness check が pass するまでは「本番相当の外部確認完了」と記録しません。
