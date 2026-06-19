# データフロー

AutoStream のデータフローは、設定データ、media packet、control event、observability signal を分けて扱います。secret を含む可能性がある値は flow の途中で raw 表示しません。

Control Panel が正とするデータは、integration record、stream assignment、runtime config、service registry です。media packet や provider credential は Control Panel の audit/evidence に直接流さず、service が必要最小限の状態、count、fingerprint に変換して返します。

## 配信開始

1. Control Panel が stream assignment を解決する。
2. YouTube output、Drive destination、Discord Bot config、Encoder/Recorder service を stream に束ねる。
3. Control Panel が Encoder/Recorder と Discord Bot に runtime config を dispatch する。
4. Discord Bot が VC に参加し、Encoder/Recorder の audio ingest endpoint へ Opus packet を送る。
5. Encoder/Recorder が FFmpeg を起動し、YouTube RTMPS と local archive へ同時出力する。

start request は Control Panel 内部 ID だけを受け取り、raw Discord guild/channel ID、Drive folder ID、RTMPS URL、stream key は受け付けません。外部確認では `control-panel-config.json` が保存済み runtime config と service assignment を確認し、`start-request.json` は空 `{}` または非 secret ID のみにします。

## 停止とアーカイブ

1. Control Panel が stop を dispatch する。
2. Encoder/Recorder が FFmpeg を停止し、`final.mkv` を確定する。
3. remux に成功した場合は `final.mp4` を作る。
4. archive metadata と sidecar を生成する。
5. Drive destination が有効なら Google Drive に upload し、file ID は fingerprint に変換して証跡へ残す。

## 観測データ

Observability は packet delta、audio freshness、FFmpeg health、archive result、upload attempts、notification delivery を集約します。diagnostic や evidence に残す値は status、count、timestamp、fingerprint に限定します。

Discord VC、Encoder audio ingest、Worker event publish、YouTube RTMPS、Drive upload は別々の失敗境界です。verification record では各境界を 1 つの pass/fail に丸めず、packet 増加、forward freshness、RTMPS receipt、remux duration、upload fingerprints を個別に残します。

## Secret の流れ

bootstrap env は service が Control Panel に接続するための最小値だけです。Discord token、YouTube output、Drive destination、OAuth refresh token、notification channel は Control Panel の管理データとして保存し、service には runtime config と短命 lease として渡します。service が失敗した場合も raw secret を diagnostic に戻さず、lease state、scope mismatch、assignment mismatch、configured/missing の状態で切り分けます。

## 更新時の確認

data flow を変更した場合は、値の移動だけでなく所有 repo と証跡形式を更新します。新しい provider 値が Control Panel に入るなら encrypted secret storage、UI write-only 表示、runtime config distribution、service 消費、evidence fingerprint までを 1 つの流れとして確認します。service が直接 env fallback を読むだけの変更は本番完成形ではなく、Control Panel 管理へ戻す task として残します。
