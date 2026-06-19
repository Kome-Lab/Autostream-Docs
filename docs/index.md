# AutoStream Docs

AutoStream は、Discord VC を起点にした自動ライブ配信、録画、アーカイブ、監視、復旧支援のための分散システムです。

Control Panel は操作、認証、権限、監査、stream lifecycle、service assignment を担当します。Discord Bot、Worker、Encoder/Recorder、Observability はそれぞれ独立した service として別サーバー、VM、コンテナで動作できます。

## 主要な読み順

1. [AutoStream とは](./overview/what-is-autostream.md)
2. [アーキテクチャ](./overview/architecture.md)
3. [初回インストール](./runbooks/first-install.md)
4. [Service の登録](./runbooks/register-service.md)
5. [初回配信開始](./runbooks/start-first-stream.md)
6. [初回配信](./runbooks/start-first-stream.md)
7. [外部確認](./runbooks/private E2E validation runbook)
8. [アーカイブフロー](./operations/archive-flow.md)
9. [セキュリティ](./security/index.md)

## システム境界

AutoStream は 1 つの monolith ではありません。

- `autostream-control-panel`: Control API、Web UI、認証、RBAC、監査、service registry、stream lifecycle。
- `autostream-discord-bot`: Discord 接続、VC 参加、音声 packet forward、参加者/話者状態。
- `autostream-worker`: overlay、caption、participant、active speaker、current time event 生成。
- `autostream-encoder-recorder`: FFmpeg 配信、MKV 録画、MP4 remux、Google Drive upload、sidecar 保存。
- `autostream-observability`: signal ingest、incident、diagnostic、remediation、notification。
- `autostream-contracts`: API / event schema、permission、共通 error format。

## シークレットの扱い

このドキュメントでは実シークレットを掲載しません。例では次のような placeholder だけを使います。

```text
<SERVICE_TOKEN>
<CONTROL_PANEL_TO_SERVICE_TOKEN>
<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
<YOUTUBE_STREAM_KEY>
<DISCORD_BOT_TOKEN>
<WEBHOOK_URL>
```

ログ、スクリーンショット、診断レポート、metadata を共有する場合も、token、stream key、webhook URL、credential 付き URL は必ず mask してください。

## 完了判定

完了判定は、docs が build できることだけではなく、Control Panel managed config、service assignment、runtime config distribution、secret-safe evidence、external provider verification record が同じ運用前提で説明されていることです。実 provider 値が必要な箇所は、本番実装済みと運用確認待ちを分けて残します。

## Operator Notes

この docs site の目的は、実装済みの repository 境界と operator 手順を同期することです。概要ページで pass と書く前に、該当 runbook、security page、configuration page、evidence checker が同じ条件を示しているか確認します。特に外部確認は handoff や readiness では完了扱いにせず、同一 `stream_id` の provider verification record と readiness check が通った証跡だけを pass とします。

実 secret や provider 値は docs に保存しません。operator が取得する値、local で生成できる値、Control Panel export から出る non-secret confirmation を分け、README と各 runbook で同じ所有者を指すようにします。PowerShell 表示が崩れた場合も、Node UTF-8 と `docs:check-mojibake` で実ファイルを確認してから修正してください。

この docs site の完了判定は、ページ数やリンク数ではなく、実装 repo の責務境界と operator 手順が一致していることです。Control Panel 管理の設定、service runtime config、secret storage、external verification record が変わった場合は、該当 repo のテストだけでなく、この docs repo の `docs:check`、`docs:build`、docs consistency checks を通します。

実 provider 値が必要な検証は、docs に実値を書いて完了扱いにしません。operator が a local ignored runtime directory に実値を置き、Control Panel から secret-safe config confirmation を export し、同じ stream ID の readiness check を通した証跡だけを pass として扱います。
