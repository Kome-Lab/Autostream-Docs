# Control Panelを導入する

Control Panel は最初に起動するサービスです。ユーザー、権限、配信設定、外部連携、サービス登録、監視画面の入口になるため、ほかのサービスより先に database、公開URL、session secret、暗号化keyを整えます。

## 導入前に決めること

| 決めるもの | 例 | メモ |
| --- | --- | --- |
| 公開URL | `https://<CONTROL_PANEL_HOST>` | OAuth callback と cookie に関係します |
| database | MariaDB | `DATABASE_URL` に入れます |
| session secret | `<SESSION_SECRET>` | 長くランダムな値にします |
| secret encryption key | `<SECRET_ENCRYPTION_KEY>` | 保存 secret の暗号化に使います |
| Node Runtime Token暗号化 | `AUTOSTREAM_SECRET_ENCRYPTION_KEY` | Node登録で生成した runtime token の暗号化保存に使います |
| stream ingest signing key | `<STREAM_INGEST_SIGNING_KEY>` | Control Panel が stream scoped ingest token を発行するために使います |
| Observability admin token | `<OBSERVABILITY_ADMIN_TOKEN>` | Control Panel が Observability API を読む/操作するために使います |
| allowed service hosts | `<SERVICE_HOSTS>` | 各サービスの公開URLを許可します |

Discord token、YouTube stream key、Google OAuth secret、通知Webhook URLは、Control Panel起動用envではなく、画面から登録する運用値です。

secret と token の生成方法は [秘密情報とtoken生成](/security/tokens) を参照してください。`OBSERVABILITY_ADMIN_TOKEN` は Control Panel 側では `OBSERVABILITY_TOKEN` という env 名で入れます。

## host直接起動

release archive を展開したら、次の順で配置します。

```bash
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
cd "/opt/autostream/releases/autostream-control-panel_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
sudo install -o root -g root -m 0755 bin/control-panel /usr/local/bin/control-panel
sudo install -d -o autostream -g autostream /var/lib/autostream/control-panel
sudo install -d -o root -g root /usr/share/autostream-control-panel
sudo cp -a share/autostream-control-panel/. /usr/share/autostream-control-panel/
sudo install -o root -g root -m 0644 systemd/autostream-control-panel.service.example /etc/systemd/system/autostream-control-panel.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/control-panel.env
```

`/etc/autostream/control-panel.env` を編集します。

```text
AUTOSTREAM_BIND_ADDR=127.0.0.1:8080
AUTOSTREAM_PUBLIC_URL=https://<CONTROL_PANEL_HOST>
AUTOSTREAM_WEB_DIR=/usr/share/autostream-control-panel
DATABASE_URL=mysql://<DB_USER>:<DB_PASSWORD>@tcp(<DB_HOST>:3306)/autostream_control_panel?parseTime=true
AUTOSTREAM_SESSION_SECRET=<SESSION_SECRET>
AUTOSTREAM_SECRET_ENCRYPTION_KEY=<SECRET_ENCRYPTION_KEY>
AUTOSTREAM_SETUP_TOKEN=<SETUP_TOKEN>
# 既存構成からの移行中だけ使う fallback。新規 Node は config.yml の Node Runtime Token を使います。
SERVICE_CALL_TOKEN=
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
OBSERVABILITY_URL=https://<OBSERVABILITY_HOST>
OBSERVABILITY_TOKEN=<OBSERVABILITY_ADMIN_TOKEN>
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=<SERVICE_HOSTS>
AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-control-panel
sudo systemctl status autostream-control-panel
```

## Dockerで起動する場合

compose を使う場合も、考え方は同じです。

1. MariaDB を先に起動します。
2. Control Panel の env を作ります。
3. Control Panel container を起動します。
4. reverse proxy から HTTPS で公開します。
5. `AUTOSTREAM_PUBLIC_URL` が実際にブラウザで開くURLと一致することを確認します。

`AUTOSTREAM_BIND_ADDR` は container 内では `0.0.0.0:<PORT>`、host直接起動でreverse proxyの後ろに置く場合は `127.0.0.1:<PORT>` が扱いやすいです。

## 初回ログインまで

1. database migration が成功していることをログで確認します。
2. ブラウザで `AUTOSTREAM_PUBLIC_URL` を開きます。
3. [初回管理者を作る](/runbooks/create-first-admin) の手順で管理者を作ります。
4. Security Settings で password policy、session、MFA方針を確認します。
5. Users / Roles で運用担当者の権限を分けます。
6. Node登録で各サービス用 Node を作り、Configuration から `config.yml` を取得します。

## Nodeを作る

Control Panel の [Node Agent登録](/control-panel/node-agent-registration) で、サービスごとに Node を分けて作ります。

| サービス | Node type | Configurationで取得するもの |
| --- | --- | --- |
| Discord Bot | `discord_bot` | `config.yml`、Configure Token、Node Runtime Token |
| Worker | `worker` | `config.yml`、Configure Token、Node Runtime Token |
| Encoder Recorder | `encoder_recorder` | `config.yml`、Configure Token、Node Runtime Token |
| Observability | `observability` | `config.yml`、Configure Token、Node Runtime Token |

Configure Token と Node Runtime Token は作成時だけ表示されます。紛失した場合は Configuration から再生成し、対象サービスの `config.yml` を更新してください。

## 他サービスを許可する

`AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS` には、Control Panel が到達してよいサービスの host を入れます。

```text
AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS=<ENCODER_HOST>,<WORKER_HOST>,<BOT_HOST>,<OBSERVABILITY_HOST>
```

本番では `AUTOSTREAM_REQUIRE_SERVICE_PUBLIC_ALLOWED_HOSTS=true` を維持します。新しいサービスhostを増やしたら env を更新して Control Panel を再起動してください。

## 起動確認

| 確認 | 正常な状態 |
| --- | --- |
| `/` を開く | login画面またはdashboardが表示される |
| `journalctl` | database接続、migration、static file のエラーがない |
| Security Settings | 本番向けのsession、MFA方針が設定できる |
| Node登録 | サービス用Nodeを作成し、`config.yml` を取得できる |
| Service Health | 後続サービスが起動後にonlineになる |

## よくあるトラブル

| 症状 | 対応 |
| --- | --- |
| ログイン後に戻される | `AUTOSTREAM_PUBLIC_URL`、cookie secure、reverse proxy の `X-Forwarded-Proto` を確認 |
| OAuth callback が失敗する | provider側のcallback URLと `AUTOSTREAM_PUBLIC_URL` を合わせる |
| サービスURLが拒否される | `AUTOSTREAM_SERVICE_PUBLIC_ALLOWED_HOSTS` にhostを追加 |
| secret更新後も反映されない | 対象サービスのruntime config更新、service再起動、Service Healthを確認 |
| 画面が真っ白 | web assets の配置先と `AUTOSTREAM_WEB_DIR` を確認 |

## 次にやること

- [DiscordとYouTube](/control-panel/discord-youtube) を設定する
- [OAuthとDrive保存先](/control-panel/integrations-drive) を設定する
- [サービス割り当て](/control-panel/services-workers) で各サービスの online を確認する
- [最初の配信を始める](/runbooks/start-first-stream) に進む
