# Secret Rotation

この runbook は、AutoStream の secret を安全に交換するための手順です。実 secret は docs、チャット、Issue、Pull Request、ログ、スクリーンショットに書き込まないでください。

## 対象

代表的な rotation 対象:

- Discord Bot token
- Deepgram API key
- YouTube stream key
- YouTube / Google Drive OAuth refresh token
- Google Service Account JSON
- Control Panel OAuth client secret
- Control Panel API token
- service registration / heartbeat token
- `SERVICE_CALL_TOKEN`
- `SERVICE_CONTROL_TOKEN_SHA256`
- `OBSERVABILITY_TOKEN`
- webhook URL
- SMTP password
- session secret
- secret encryption key

## 事前準備

1. maintenance window を決める。
2. Control Panel に admin 権限を持つユーザーでログインできることを確認する。
3. 現在の env file、systemd unit、Docker Compose override、Control Panel integration 設定を確認する。
4. rollback 用に、現行 secret を安全な password manager 内で一時的に保持する。
5. 関係する service の restart 順序を決める。

旧 secret は復旧確認後に password manager から削除または無効化します。

## Control Panel の write-only secret を更新する

Control Panel UI の `Security Settings`、`Secrets`、各 integration 設定画面で更新する場合、raw secret は保存時だけ送信します。画面には `configured`、`missing`、`masked`、`fingerprint` だけを表示します。

更新後に確認すること:

- API response に raw secret が含まれない。
- Audit Logs に更新操作が記録される。
- audit metadata に raw secret が含まれない。
- 関係する service が runtime config または runtime secret resolve で新しい値を利用できる。

## Service registration token を再発行する

Control Panel に登録する分散 service の token は、`API Tokens` の `Rotate` を使って再発行します。

1. `API Tokens` で対象 token の `Rotate` を押す。
2. 表示された新 raw token を password manager に保存する。表示は一度だけです。
3. 対象 service の `CONTROL_PANEL_TOKEN` を新 token に更新する。
4. 対象 service を restart する。
5. `Service Health` で registration / heartbeat が回復したことを確認する。
6. 旧 token が `401` で拒否されることを確認する。

`Rotate` は旧 token を revoke し、同じ service type / scope の新 token を作成します。旧 token に紐づく service registry entry は新 token に付け替えられるため、同じ `service_id` を継続利用できます。

この操作には `api_tokens.create` と `api_tokens.revoke` の両方が必要です。raw token は audit log、docs、diagnostic report、service log に出してはいけません。

## Control Panel から service へ dispatch する token を交換する

Control Panel が Encoder/Recorder、Worker、Discord Bot へ start / stop / package などを dispatch する場合は、次の対応関係を維持します。

```text
Control Panel:
  SERVICE_CALL_TOKEN=<NEW_TOKEN>

Target service:
  SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_NEW_TOKEN>
```

手順:

1. 新しい dispatch token を生成する。
2. SHA-256 hash を計算し、対象 service の `SERVICE_CONTROL_TOKEN_SHA256` に設定する。
3. Control Panel の `SERVICE_CALL_TOKEN` を新 token に設定する。
4. 対象 service と Control Panel を restart する。
5. dry-run start / stop / retry-upload で dispatch が成功することを確認する。

`SERVICE_CALL_TOKEN` と `SERVICE_CONTROL_TOKEN_SHA256` は同じ値ではありません。片方は raw token、片方は hash です。

## YouTube / Drive / Discord integration secret を交換する

追加要件では、Discord Bot token、YouTube output、Google Drive destination、OAuth refresh token、webhook URL、SMTP password は Control Panel 管理へ移します。env は bootstrap と接続情報に限定します。

更新後に確認すること:

- UI/API に raw token、stream key、refresh token、folder ID、webhook URL、SMTP password が返らない。
- stream job payload には raw secret ではなく runtime secret reference または短命 runtime secret だけが含まれる。
- Encoder/Recorder、Discord Bot、Observability が自分に許可された secret だけを取得できる。
- 別 service の runtime secret resolve は `403` になる。

## Google Service Account key を交換する

Service Account mode を使う場合:

1. Google Cloud で新しい service account key を作成する。
2. key file を Encoder/Recorder host の安全な場所に配置する。

```text
/etc/autostream/google-service-account.json
```

3. file permission を `autostream` user だけが読める状態にする。
4. 対象 Drive folder を service account email に共有する。
5. `GOOGLE_APPLICATION_CREDENTIALS` を新 key path に更新する。
6. Encoder/Recorder を restart する。
7. dry-run または小さい archive upload で確認する。
8. 旧 key を Google Cloud 側で revoke する。

共有ドライブの folder ID を使う場合は、Drive destination 側で shared drive 対応を有効にし、Drive API upload が `supportsAllDrives=true` で実行されることを確認します。

## Webhook / Email 通知先を交換する

Observability の notification channel で webhook URL または SMTP credential を更新します。

- Discord Webhook
- Slack Webhook
- Generic Webhook
- Email / SMTP

更新後に test notification を実行し、delivery history を確認します。delivery history、logs、diagnostic report に raw webhook URL や SMTP password が残らないことを確認します。

## session secret / encryption key の注意

`AUTOSTREAM_SESSION_SECRET` を交換すると、既存 session は無効になります。maintenance window 中に実施してください。

`AUTOSTREAM_SECRET_ENCRYPTION_KEY` は保存済み secret の復号に関わります。rotation には再暗号化手順が必要です。再暗号化機能が未整備の場合は安全に変更せず、保存済み secret をすべて再投入できる状態を確認してから実施します。

## 完了確認

- 各 service の heartbeat が正常。
- Control Panel から start / stop / retry-upload を dispatch できる。
- Observability への ingest が成功している。
- notification test が成功している。
- Audit Logs に rotation 操作が残っている。
- 旧 token / key / webhook URL / SMTP password が無効化されている。
- docs、logs、metadata、diagnostic report に raw secret が残っていない。
