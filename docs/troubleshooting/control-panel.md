# Control Panel Troubleshooting

Control Panel は AutoStream の control plane です。ユーザー、RBAC、監査ログ、stream lifecycle、service registry、profile、secret status、Observability 表示を扱います。重い media 処理は直接実行しません。

## まず確認すること

| 項目 | 確認内容 |
| --- | --- |
| health | `GET /health` が成功するか |
| database | MariaDB に接続できるか |
| migrations | migration が適用済みか |
| session | cookie が HttpOnly / Secure / SameSite で発行されているか |
| CSRF | unsafe method に `X-CSRF-Token` が付いているか |
| RBAC | 操作ユーザーに必要な permission があるか |
| audit | sensitive action が audit log に残るか |

## Login できない

1. user status が `active` か確認します。
2. account lockout が発生していないか確認します。
3. temporary password / force password change の状態を確認します。
4. session secret が再起動のたびに変わっていないか確認します。
5. reverse proxy 経由の場合、Secure cookie と HTTPS 設定を確認します。

初回 admin 作成に `AUTOSTREAM_SETUP_TOKEN` を使う場合、一度作成した後は token を無効化、または安全に保管します。

## API が 401 / 403 を返す

| status | 主な原因 |
| --- | --- |
| 401 | 未ログイン、session expired、service token 不正、Authorization header 欠落 |
| 403 | RBAC permission 不足、disabled user、locked user、service scope 不一致 |

frontend でボタンを非表示にしていても、server-side authorization は必須です。Permission check は fail closed で行います。

## CSRF error になる

cookie-based session で `POST`、`PUT`、`DELETE` を実行する場合、CSRF token が必要です。

確認すること:

- login 後に CSRF token を取得している。
- request header に `X-CSRF-Token` が付いている。
- reverse proxy が header を落としていない。
- session cookie と CSRF token の対応が崩れていない。

## start が dispatch 前に失敗する

Control Panel は start 前に assignment と readiness を検証します。

| code | 確認内容 |
| --- | --- |
| `missing_stream_assignments` | `discord_bot`、`worker`、`encoder_recorder` が対象 stream に割り当て済みか |
| `stream_start_not_ready` | response の `issues` を確認する |
| `service_call_token_missing` | Control Panel の `SERVICE_CALL_TOKEN` が設定済みか |
| `service_public_url_invalid` | service registry の `public_url` が absolute HTTP(S) URL か |
| `encoder_public_url_invalid` | Encoder/Recorder の `public_url` が Discord Bot / Worker から使える absolute HTTP(S) URL か |
| `service_offline` | Service Health で対象 service が offline ではないか |
| `service_heartbeat_stale` | heartbeat が古くなっていないか |

この段階の失敗では stream status は変更されず、service へ request も送られません。

## service dispatch が失敗する

Control Panel から Encoder/Recorder、Discord Bot、Worker へ start / stop / package / restart を dispatch する場合、次を確認します。

- service registry の `public_url` が Control Panel から到達可能。
- `public_url` が `http` または `https` の absolute URL。
- service が対象 stream に assigned されている。
- Control Panel の `SERVICE_CALL_TOKEN` と service 側 `SERVICE_CONTROL_TOKEN_SHA256` が対応している。
- reverse proxy が `Authorization` header を保持している。
- service 側 endpoint が `2xx` を返している。

分散配置では、同じ Docker network にいる前提で URL を設定しないでください。Control Panel が別 host にいる場合、`localhost` や compose service name は到達できません。

## secret status が不自然

Control Panel は raw secret を frontend に返しません。`configured` / `missing` の状態だけを表示します。

secret update 後に確認すること:

- response に raw secret が含まれていない。
- audit log に `secrets.update` が残る。
- service restart が必要な secret か確認する。
- old secret が不要なら revoke する。

## Observability 表示が失敗する

Control Panel が Observability API を参照できない場合は、次を確認します。

- `OBSERVABILITY_URL` が absolute HTTP(S) URL。
- `OBSERVABILITY_TOKEN` が設定済み。
- Observability 側の service token / hash が一致している。
- firewall / reverse proxy が通信を許可している。
- response body に raw webhook URL や raw token が含まれていない。

Control Panel は detection / diagnosis を直接実装せず、Observability の結果を表示します。

## 切り分け結果の記録

Control Panel の troubleshooting では、UI 上の error message だけを残さず、server-side の `code`、request ID、対象 stream ID、service assignment、runtime config version、operator action を記録します。`service_dispatch_failed` の場合は upstream service の sanitized `failure_phase` と `error_class` を残し、raw upstream body、token、provider URL、credential path は保存しません。

UI 表示と API response が矛盾する場合は、まず API response と audit log を source of truth として確認します。frontend cache、stale session、CSRF token mismatch、RBAC permission の問題は、service 側の障害とは分けて扱います。operator が browser screenshot を evidence に残す場合も、secret status は configured / missing / masked の表示だけを含め、password field や storage state は保存しません。

復旧後は Control Panel の画面が緑になったことだけで完了にしません。service heartbeat が新しく、assignment が intended primary / standby と一致し、runtime config export が同じ stream ID を指し、external verification の readiness / readiness check が必要な proof を受け入れていることを確認します。Control Panel が正常でも Discord、YouTube、Drive の provider verification record が古い場合は、残タスクとして切り分けます。
