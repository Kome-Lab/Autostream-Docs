# Troubleshooting

AutoStream の障害調査は、Control Panel、対象 service、Observability、archive artifact の順に確認します。原因が分からない段階で archive 削除、credential rotation、role 変更、service token 失効を行わないでください。

## 確認順序

1. Control Panel の `Dashboard`、`Streams`、`Service Health` を確認します。
2. stream の service assignment が primary / standby の意図通りか確認します。
3. `Start readiness` の issue code と message を確認します。
4. Observability の `Incidents`、`Diagnostics`、`Remediation Actions`、`Metrics` を確認します。
5. 対象 service の `GET /health` と `GET /status` を確認します。
6. systemd または Docker の service logs を確認します。
7. Encoder/Recorder の `metadata.json`、`logs.jsonl`、`final.mkv`、`final.mp4` を確認します。
8. Control Panel の `Audit Logs` で誰がどの操作を実行したか確認します。

## よくある症状

| 症状 | 主な確認先 |
| --- | --- |
| service が offline | `CONTROL_PANEL_URL`、service token、service type、firewall、reverse proxy |
| heartbeat が 401 / 403 | token revoke、token hash mismatch、service type mismatch、事前登録した service ID との不一致 |
| start が 409 になる | missing assignment、readiness issue、Discord config / YouTube output / archive profile の不足 |
| standby だけ登録されている | primary assignment が必要。start dispatch は primary のみに送られる |
| Discord Bot が VC に入らない | Discord config、guild ID、voice channel ID、bot token secret、service assignment |
| Encoder/Recorder が開始しない | FFmpeg path、input URL、YouTube runtime config、archive directory permission |
| archive upload が失敗する | Drive destination、OAuth connected account、Service Account share、`final.mp4` の存在 |
| YouTube broadcast が完了しない | YouTube output mode、OAuth account scope、`complete_on_stop`、auto retry / manual complete retry |
| notification が届かない | notification channel、severity/event filter、webhook URL、SMTP 設定、delivery history |
| Control Panel UI が 401 / 403 を返す | session timeout、CSRF token、RBAC permission、disabled / locked user |

## env と Control Panel 管理の切り分け

新規運用では、Discord bot token、YouTube stream key、Google Drive folder ID、OAuth refresh token、webhook URL、SMTP password を env に置きません。これらは Control Panel の encrypted secret / integration registry で管理します。

env に残すものは bootstrap 用です。

- `CONTROL_PANEL_URL`
- service identity token
- `DATABASE_URL`
- `AUTOSTREAM_SECRET_ENCRYPTION_KEY`
- service bind address
- data directory

互換用 env fallback が残る service でも、stream job に Control Panel-managed runtime config が含まれる場合は runtime config を優先します。不足している secret を env から暗黙補完する運用にはしません。

## service token の切り分け

AutoStream には inbound と outbound の token があります。混同しないでください。

```text
Service -> Control Panel:
  CONTROL_PANEL_TOKEN

Control Panel -> Service:
  SERVICE_CALL_TOKEN
  SERVICE_CONTROL_TOKEN_SHA256
```

`CONTROL_PANEL_TOKEN` は service が登録、heartbeat、runtime config 取得、runtime secret 解決に使います。`SERVICE_CALL_TOKEN` は Control Panel が service の start / stop / retry API を呼ぶための token です。

## secret を含む情報の扱い

障害調査でログやスクリーンショットを共有する場合、次は必ず mask してください。

- Discord bot token
- Deepgram API key
- YouTube stream key
- OAuth refresh token
- Google credential JSON
- Google Drive folder ID
- service token
- webhook URL
- SMTP password
- session secret
- database password
- credential 付き stream URL

`request_id`、`stream_id`、service ID、incident ID は secret ではないため、調査用に共有できます。

## 個別ページ

- [Control Panel](./control-panel.md)
- [Discord Bot](./discord-bot.md)
- [Encoder/Recorder](./encoder-recorder.md)
- [Google Drive upload](./google-drive-upload.md)
- [YouTube RTMPS](./youtube-rtmps.md)
- [Worker](./worker.md)
- [Observability](./observability.md)
- [Network](./network.md)
- [Mojibake / PowerShell display](./mojibake.md)

## 調査結果の残し方

troubleshooting の結果は、単なる作業メモではなく次の operator が同じ boundary を追える evidence として残します。最低限、対象 stream ID、service ID、runtime config version、確認した provider verification record、実行した command、safe output path、修正した repository、rollback 判断を記録します。raw token、webhook URL、SMTP password、Drive raw ID、YouTube stream key、credential 付き URL は残しません。

複数の症状が同時に出ている場合は、Control Panel readiness、service heartbeat、media packet、archive artifact、upload provider、notification delivery を別々に扱います。たとえば start が 409 で失敗している段階では、Encoder retry や Drive upload retry へ進まず、assignment と runtime config の不足を先に直します。archive は成功して upload だけ失敗している場合は、録画を取り直すのではなく Drive destination、OAuth account、shared drive permission、quota を確認します。

復旧後は the private evidence archive に pass と書く前に、readiness check が同じ stream ID の evidence を受け入れていることを確認します。途中の partial evidence は残してよいですが、dry-run、古い proof、別 stream ID、local-only fallback を MVP verification pass と混同しません。外部 provider 値が必要な確認は、実装完了と provider 実行待ちを分けて残します。
