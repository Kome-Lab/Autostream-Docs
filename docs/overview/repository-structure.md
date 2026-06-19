# Repository 構成

AutoStream workspace は意図的に複数 repository に分かれています。各 repository は自分の責務だけを実装し、共有 contract と docs で境界を同期します。

## 主要 repository

- `autostream-control-panel`: operator UI、Control API、MariaDB persistence、service registry、assignment、integration registry。
- `autostream-discord-bot`: Discord gateway/voice adapter、VC join、audio packet forward。
- `autostream-encoder-recorder`: FFmpeg orchestration、recording、remux、archive、Google Drive upload。
- `autostream-worker`: overlay/caption/participant event worker。
- `autostream-observability`: signal ingest、incident、notification、remediation。
- `autostream-contracts`: schema、permission、API/event examples。
- `autostream-docs`: deployment、runbook、security report、verification record、operator-facing docs。

## 変更時の原則

設定や secret の所有者を変更する場合は、実装 repository、contract、docs、runbook、verification checker を同時に更新します。docs repository は実値を持たず、外部 provider の proof も a local ignored runtime path と the private evidence archive の secret-free artifact に限定します。

## 代表的な所有境界

| 項目 | 所有 repository | docs に残す内容 |
| --- | --- | --- |
| service registry、heartbeat、primary/standby assignment | `autostream-control-panel` | service type、scope、public URL、assignment の操作手順 |
| Discord guild/channel routing、VC reconnect policy | `autostream-control-panel` と `autostream-discord-bot` | config ID、masked guild/channel、reconnect metric |
| Discord bot token と audio forward secret | `autostream-control-panel` の encrypted secret、消費は `autostream-discord-bot` | configured/missing、lease state、fingerprint だけ |
| YouTube Live API output | `autostream-control-panel`、送信は `autostream-encoder-recorder` | output ID、broadcast/live stream ID、received audio/video status |
| Drive destination と OAuth connected account | `autostream-control-panel`、upload は `autostream-encoder-recorder` | destination ID、shared drive flag、folder/file fingerprint |
| overlay/caption/participant/current time event | `autostream-worker`、contract は `autostream-contracts` | event type、sidecar artifact、send failure metric |
| notification channel webhook/SMTP secret | `autostream-observability` と `autostream-control-panel` proxy | masked target、ciphertext/nonce storage result |
| schema、permission、write-only secret fields | `autostream-contracts` | generated schema path、writeOnly boundary、consumer repo |

## 変更の流し方

変更は、所有 repo で実装と test を先に揃え、その後 docs repo で operator 手順、secret boundary、evidence gate を更新します。docs だけを先に本番完了のように書かず、contracts / service behavior / UI / audit のどれが根拠かを明記します。

## Operator Notes

Repository 構成の目的は、責務を分けたまま本番運用できるようにすることです。Control Panel の UI/API 変更、contracts の schema 変更、service の runtime behavior、docs の operator guidance を 1 つの repo に寄せず、それぞれの所有者に置いたうえで docs consistency checks と native tests で同期を確認します。

実 provider 値が必要な作業でも、repository boundary は変えません。Discord Bot token、YouTube stream key、Drive folder ID、OAuth refresh token、webhook URL、SMTP password は docs repo に移さず、Control Panel encrypted store、operator local runtime、または provider UI に残します。docs は値そのものではなく、取得元、設定先、確認コマンド、safe evidence の形だけを所有します。

Control Panel の API や schema を変えた場合は `autostream-contracts` を先に同期し、各 service repo は自分が消費する field だけを実装します。Encoder/Recorder の archive や Drive upload の変更は `autostream-encoder-recorder` が所有し、Discord VC 接続や audio forwarding は `autostream-discord-bot` が所有します。docs はその境界を operator に見える形で説明し、repo をまたいだ secret の置き場所を曖昧にしません。

例として Drive upload の仕様を変える場合、`autostream-control-panel` は destination / connected account / secret storage、`autostream-contracts` は request/response schema、`autostream-encoder-recorder` は upload 実装と metadata redaction、`autostream-docs` は operator 手順と evidence check を更新します。Discord VC の仕様を変える場合は `autostream-discord-bot` が gateway/voice と packet forward を所有し、Control Panel は routing config と assignment だけを所有します。この分離を崩して、docs repo に実 secret や service 固有 fallback を持ち込まないでください。
