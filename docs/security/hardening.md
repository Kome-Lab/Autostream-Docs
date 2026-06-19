# ハードニング

AutoStream の hardening は、OS、reverse proxy、Control Panel、service token、runtime secret、observability の各境界で fail closed に寄せます。ここでは production host に入れる最低限の運用設定をまとめます。

## OS / systemd

各 service は専用 Linux user `autostream` で実行し、root 実行を避けます。systemd では互換性がある範囲で次を有効化します。

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/autostream
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
```

archive path、runtime env、credential file は必要な service user だけが読める permission にします。Google Service Account JSON は path 参照に限定し、docs や UI に中身を貼りません。

## Network

reverse proxy では TLS、`Secure` cookie、`SameSite=Lax`、HSTS、clickjacking 防止、CORS の origin 固定を有効にします。service-to-service の public URL は allowlist で制限し、Control Panel runtime config が想定外 host を配らないようにします。

remote host の service URL は HTTPS を標準とし、local development の `http://127.0.0.1` 例外を本番 env に持ち込みません。Discord Bot から Encoder/Recorder への audio ingest、Worker から Encoder/Recorder への event publish、Control Panel から service への dispatch は bearer token を扱うため、redirect、query string token、fragment を禁止します。

## Application

- setup token は初回 admin 作成後に削除する。
- service token は registration/heartbeat 用と dispatch 用を混同しない。
- runtime secret lease は primary assignment と stream scope に縛る。
- OAuth refresh token、SMTP password、webhook URL は encrypted storage に保存する。
- UI/API/log/evidence は configured/missing/masked/fingerprint だけを表示する。

## Secret boundary check

本番投入前に、Control Panel UI、API response、Observability notification history、external verification record を見て raw secret が出ていないことを確認します。Google Service Account は file path 所有、OAuth refresh token は connected account 所有、YouTube stream key / RTMPS URL は runtime config 所有、webhook URL / SMTP password は Observability encrypted channel 所有として扱います。境界をまたぐ値は ciphertext/nonce、fingerprint、configured flag、short-lived runtime lease のいずれかに限定します。

## Break-glass

緊急時にだけ、super_admin が短時間の break-glass 操作を行えます。対象は stream stop、service assignment 変更、token rotation、notification channel disable までに限定し、OAuth token 表示、secret export、archive deletion は break-glass でも許可しません。操作後は session revoke、audit review、affected stream/provider の evidence 再生成を行います。

## Verification

hardening 後は `npm run docs:check`、各 repository の unit/integration test、Control Panel UI smoke、外部確認 readiness を実行します。実providerを使う検証では raw secret を command-line argument に渡さず、環境変数または provider UI の local-only 操作で扱います。

verification は 1 回で終わりではありません。reverse proxy、session policy、service token scope、runtime config schema、notification provider、Drive/YouTube OAuth scope を変更したときは、該当 repository の tests と docs guardrail を同じ変更として通します。外部確認 が provider 値待ちの場合でも、preflight と completion strict の失敗理由が secret-safe に説明されることを確認します。
