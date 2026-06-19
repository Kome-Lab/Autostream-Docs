# Notification Channels

AutoStream Observability は incident、diagnostic、remediation、archive upload event を複数の通知先へ送信できます。新規運用では notification channel を Control Panel または Observability API で管理し、通常の service env に webhook URL や SMTP password を置きません。

## 対応チャンネル

- Discord Webhook
- Slack Webhook
- Generic Webhook
- Email / SMTP

## Webhook Channel

Webhook URL は secret です。作成・更新 request では raw URL を送りますが、response、delivery history、logs では `masked_webhook_url` だけを返します。

```json
{
  "name": "Discord critical",
  "type": "discord",
  "enabled": true,
  "webhook_url": "https://discord.com/api/webhooks/<WEBHOOK_ID>/<WEBHOOK_TOKEN>",
  "severity_filter": ["critical", "error"],
  "event_type_filter": ["incident.opened"]
}
```

本番では HTTPS の webhook URL を使います。loopback、private、link-local、userinfo 付き URL は既定で拒否します。

## Email Channel

Email channel は SMTP 設定を Control Panel で管理します。SMTP password は encrypted secret として保存し、API/UI response では `smtp_password_configured` と `masked_email_target` だけを返します。raw recipient list、SMTP host、SMTP from、SMTP username、SMTP password は response に返しません。

作成 request の例:

```json
{
  "name": "Ops email",
  "type": "email",
  "enabled": true,
  "email_recipients": ["ops@example.com"],
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_tls": true,
  "smtp_from": "autostream@example.com",
  "smtp_username": "autostream",
  "smtp_password": "<SMTP_PASSWORD>",
  "severity_filter": ["critical", "error"],
  "event_type_filter": ["incident.opened", "incident.resolved"]
}
```

response の例:

```json
{
  "id": "ntc_01",
  "name": "Ops email",
  "type": "email",
  "enabled": true,
  "smtp_password_configured": true,
  "masked_email_target": "o***s@<EMAIL_DOMAIN>",
  "severity_filter": ["critical", "error"],
  "event_type_filter": ["incident.opened", "incident.resolved"],
  "created_at": "2026-06-10T00:00:00Z",
  "updated_at": "2026-06-10T00:00:00Z"
}
```

SMTP 認証を使う場合は `smtp_tls=true` が必要です。private network 宛て SMTP host は既定で拒否されます。local 検証で必要な場合だけ、明示的な開発用設定で許可してください。本番環境では `OBSERVABILITY_ALLOW_PRIVATE_SMTP=true` を設定しても private SMTP は許可されません。

## Filters

`severity_filter` と `event_type_filter` で送信対象を絞ります。空配列または未指定の場合は全対象です。

代表 event:

- `incident.opened`
- `incident.updated`
- `incident.resolved`
- `diagnostic.created`
- `remediation.pending_approval`
- `remediation.executed`
- `archive.upload.completed`
- `archive.upload.failed`
- `service.offline`
- `service.recovered`

## 運用ルール

- webhook URL、SMTP password、OAuth token は raw 値で docs、issue、chat、screenshots に残さないでください。
- delivery history の `target` は masked value のみにします。
- channel test は実送信されます。検証用 channel を用意してから実行してください。
- transient failure は retry され、失敗結果は delivery history に保存されます。

## Evidence

notification evidence は delivery status、attempt count、masked target、provider type、failure class を中心に残します。webhook URL、SMTP password、OAuth token、recipient list の raw value は docs や screenshot に残さず、DB では ciphertext/nonce、UI では masked value だけを確認します。

## Operator Notes

Notification channel は env fallback ではなく、Control Panel / Observability の managed record と encrypted secret を標準にします。Webhook URL、SMTP password、OAuth token を docs、logs、browser screenshot、delivery history に raw で残さず、configured flag、masked target、channel ID、delivery status、ciphertext/nonce regression result だけを共有します。

外部 provider 値を入れる場合は operator が UI/API で登録し、preflight は raw 値を読まずに configured/missing と delivery readiness を確認します。通知失敗の triage では DNS/SSRF rejection、TLS failure、provider rate limit、credential rotation、retry exhaustion を分け、incident の recovery signal が出るまで verification record へ昇格しません。

通知 channel の readiness 証跡では、channel ID、provider 種別、enabled 状態、masked target、last delivery status、attempt count だけを残します。webhook URL、SMTP password、SMTP username、OAuth token、送信先 email address の raw 値は evidence、diagnostic、スクリーンショットに残しません。

本番では notification channel の作成直後に、DB が plaintext ではなく ciphertext/nonce のみを保持していることを regression test で確認します。外部確認の Notifications phase は、送信成功だけでなく、失敗時の error category が secret-safe に返ることも確認対象にします。
