# Reverse Proxy

Control Panel は operator が直接触る管理画面です。production では HTTPS reverse proxy の背後に置き、Secure cookie と trusted proxy を正しく設定します。

reverse proxy は単なる TLS 終端ではなく、OAuth callback、session cookie、service dispatch の信頼境界です。`AUTOSTREAM_PUBLIC_URL` と provider 側 redirect URI が一致しない場合、login は成功しても connected account callback や no-store header の検証が失敗します。設定変更時は Control Panel UI、OAuth provider、service public URL allowlist を同じ変更単位で確認します。

## Control Panel

```text
AUTOSTREAM_PUBLIC_URL=https://control.example.com
AUTOSTREAM_TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
```

reverse proxy は次の header を付与します。

```text
X-Forwarded-Proto: https
X-Forwarded-Host: control.example.com
X-Forwarded-For: <CLIENT_IP>
```

`AUTOSTREAM_PUBLIC_URL` は OAuth callback URL、audit context、Control Panel UI の link 生成に使います。

`X-Forwarded-For` は `AUTOSTREAM_TRUSTED_PROXIES` に含めた proxy から来た場合だけ client IP として扱います。proxy を追加したときは、Control Panel の audit log に operator の実 client IP が残ること、未信頼 proxy からの forwarded header が無視されることを確認します。

nginx では `proxy_set_header X-Forwarded-Proto https`、`proxy_set_header X-Forwarded-Host $host`、`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` を明示します。Traefik や Cloudflare Tunnel を使う場合も、Control Panel へ渡る最終 header が同じ意味になるようにし、provider callback URL は tunnel の preview URL ではなく production hostname に固定します。

## Service endpoints

Discord Bot、Encoder/Recorder、Worker、Observability を public HTTPS に出す場合は、Control Panel からの dispatch だけを受ける設計にしてください。

- request body に raw token を含めない
- Authorization header を access log に出さない
- request timeout を設定する
- upload body size を必要最小限にする
- `SERVICE_PUBLIC_URL` は Control Panel の allowlist に登録する

## OAuth callback

OAuth login provider と Google connected account は redirect URI を厳密に一致させます。

```text
https://control.example.com/auth/oauth/callback
```

provider ごとに state / nonce を検証し、callback failure は audit log に残します。OAuth token や authorization code は docs、logs、screenshots に残しません。

callback 障害は provider 設定、proxy header、Control Panel session/CSRF のどこで失敗したかを分けます。`invalid_state` や CSRF failure は callback body を保存せず、status code、provider ID、masked redirect host、audit event ID だけを記録します。Google Drive / YouTube connected account の callback も同じ no-store 方針で扱います。

## 運用確認

proxy 設定を変えた後は、Control Panel の login、connected-account callback、service dispatch の 3 系統を分けて確認します。login cookie が Secure / HttpOnly / SameSite を維持していること、callback response が no-store で返ること、service URL allowlist 外の host へ dispatch しないことを確認します。access log に `Authorization`、session cookie、OAuth code、webhook URL が出る場合は、masking を入れてから再開してください。

Before production use, verify `SERVICE_PUBLIC_URL`, reverse proxy allowlists, TLS, and firewall rules against the deployed service endpoints.
