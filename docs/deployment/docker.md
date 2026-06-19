# Docker

Docker / Compose は AutoStream の各 server-side repository でサポートします。Docker を使う場合も、すべての service が同じ Docker network にいる前提にはしません。Control Panel から見える `SERVICE_PUBLIC_URL` を明示してください。

## Compose に置く値

Compose env には bootstrap 値だけを置きます。

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
AUTOSTREAM_DATA_DIR=/var/lib/autostream/encoder-recorder
TZ=Asia/Tokyo
```

Control Panel container には MariaDB DSN と暗号化鍵を渡します。

```text
DATABASE_URL=<MARIADB_DSN>
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
```

## Compose に置かない値

次の値は Control Panel の Integration Registry、profile、notification channel で管理します。

- Discord Bot token
- YouTube stream key
- YouTube / Google OAuth refresh token
- Google Drive folder ID
- webhook URL
- SMTP password
- STT API key

local dry-run で互換 env を使う場合も、`.env.example` には placeholder だけを書き、実値は commit しません。

## 起動順

1. MariaDB
2. Control Panel
3. 初期 admin 作成
4. service token 作成
5. Discord Bot / Encoder/Recorder / Worker / Observability
6. Service Health で heartbeat 確認
7. stream assignment と dry-run smoke

For local Docker validation, use the service repository Compose files and keep real provider secrets out of local logs and screenshots.

## network / volume 境界

Compose project を 1 つにまとめても、service discovery を Docker 内部名だけに依存しないでください。本番では Control Panel が登録済み `SERVICE_PUBLIC_URL` へ dispatch し、各 service は Control Panel から runtime config を取得します。`localhost`、container name、temporary port mapping を runtime config に保存すると、別 host、reverse proxy、external verification で失敗します。

volume は service ごとに分け、archive volume と database volume を同じ backup policy にしません。Encoder/Recorder の `tmp/` は stream 復旧に必要な場合だけ保全し、通常の long-term backup は `final/`、metadata、logs、sidecar を対象にします。MariaDB volume を複製して別環境で起動する場合は、Control Panel の session、service token、OAuth account、notification channel の trust boundary が変わるため、復元後に token rotation と connected account review を実施します。

## 更新と切り戻し

image 更新時は Control Panel を先に migration 済みにし、service 側は heartbeat が fresh になってから古い container を落とします。service token を rotation する場合は、新旧 token の hash が混在する時間を短くし、`SERVICE_CONTROL_TOKEN_SHA256` と Control Panel の service registry が同じ token 世代を指すことを確認してください。rollback 時も provider secret を Compose env に戻さず、Control Panel の integration/profile 設定を維持します。

rollback 後は `docker compose ps` だけではなく、Control Panel の Service Health、Last service dispatch、runtime config version、Observability ingest、archive package dry-run を確認します。image tag を戻しても database migration、integration record、runtime config schema が進んだままなら完全な rollback ではありません。互換性がない場合は、古い binary に戻す前に Control Panel 側の migration rollback または forward-fix を選びます。
