# セキュリティ概要

AutoStream は Discord VC、Encoder/Recorder、Worker、Observability、Google Drive、YouTube Live API をまたぐ分散システムです。Control Panel は認証、認可、service assignment、runtime secret 配送、audit log の中心として動作します。

この概要は、実装済み機能の一覧だけではなく、運用時にどの境界を壊してはいけないかを確認する入口です。個別 service の env に provider secret を戻す、standby service に primary secret を読ませる、diagnostic に raw credential を出す、といった回避策は短期復旧に見えても本番境界を崩します。

## 基本方針

- raw secret は UI、API response、audit log、diagnostic report、docs、screenshots に出しません。
- Discord Bot token、YouTube stream key、OAuth refresh token、Drive folder ID、webhook URL、SMTP password は Control Panel の encrypted secret / Integration Registry で管理します。
- service は Control Panel への接続に必要な最小 bootstrap env だけを持ち、運用設定は runtime config として取得します。
- stream-scoped secret は primary assignment service だけが解決できます。standby service は failover 候補ですが、primary へ昇格するまで Drive / YouTube などの stream-scoped secret を取得できません。
- cookie session、CSRF、RBAC、audit log、rate limit を server-side で強制します。

## 現在の実装状態

- Password login、OAuth login、TOTP MFA、Passkey / WebAuthn passwordless login を実装済みです。
- Passkey を MFA 必須 policy として強制できます。対象ユーザーは password / OAuth login では session を受け取れず、登録済み WebAuthn credential でログインします。
- Google Drive は Service Account mode と OAuth2 connected account mode の両方を扱います。OAuth2 mode では refresh token、client secret、folder ID を runtime secret reference として Encoder/Recorder へ渡します。
- YouTube output は stream key mode と Live API mode を扱います。Live API mode では Control Panel が broadcast / live stream を準備し、RTMPS URL と stream key を Encoder/Recorder へ短命に渡します。
- Notification は Discord / Slack / generic webhook と Email / SMTP channel を扱います。

実 provider 値が必要な箇所は、実装完了と外部 proof 完了を分けて管理します。UI/API/schema/test が write-only、masked、fingerprint、runtime lease を満たしていても、Discord VC、YouTube RTMPS、Drive upload、notification delivery の provider verification record が古い場合は「実装済み、外部確認待ち」です。

## 関連ページ

- [アカウント](./accounts.md)
- [ロールと権限](./roles-and-permissions.md)
- [MFA](./mfa.md)
- [セッション](./sessions.md)
- [サービス token](./service-tokens.md)
- [secret 管理](./secrets.md)
- [audit log](./audit-logs.md)
- [hardening](./hardening.md)

外部確認ではこの方針を、secret-free provider verification record、runtime secret lease、Control Panel audit、UI の configured/masked 表示で確認します。verification record に raw token、webhook URL、OAuth refresh token、Drive folder/file ID が含まれる場合は、外部確認成功ではなく証跡作成の失敗として扱います。

新しい integration を追加するときは、まず contract に write-only field と read response の mask 表現を定義します。
Control Panel 側では encrypted secret reference、audit event、runtime config の非 secret 表現、runtime secret lease の対象可否を同時に更新します。
service repo は bootstrap env に provider secret を追加せず、自 service に配布された runtime config と許可された runtime secret reference だけを消費します。
最後に docs、docs consistency check、verification checker に、実値ではなく configured state、fingerprint、provider verification record を残す条件を追加します。

security review では、機能ごとに「どの repository が secret を所有するか」「どの API が write-only か」「read response は何を返すか」「runtime secret lease は誰に出るか」「evidence は何を保存するか」を確認します。どれか 1 つでも曖昧なままなら、便利な env fallback や screenshot 証跡で代替しません。
