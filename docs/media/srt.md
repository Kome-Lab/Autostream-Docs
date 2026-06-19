# SRT 入力

SRT は外部映像ソースを Encoder/Recorder に渡すための入力候補です。production では Control Panel の runtime config から配布し、E2E では `AUTOSTREAM_E2E_ENCODER_INPUT_URL` に一時設定します。

## 設定

```text
AUTOSTREAM_INPUT_ALLOWED_HOSTS=media.example.com,*.trusted-video.example.com
AUTOSTREAM_E2E_ENCODER_INPUT_URL=srt://source.example.com:9000
```

allowed hosts に一致しない入力は拒否します。credential を URL に含める場合は evidence、logs、screenshots に raw URL を残さず、host/path と masked credential だけを記録します。

## Control Panel での扱い

SRT source は permanent secret ではなく、Control Panel の stream profile が参照する input endpoint として扱います。operator は source profile、allowed host、caller/listener mode、latency、passphrase の有無を Control Panel で管理し、Encoder/Recorder は runtime config version と stream assignment に結び付いた値だけを受け取ります。`AUTOSTREAM_E2E_ENCODER_INPUT_URL` は外部確認runner に入力を渡すための local-only override であり、production service の恒久設定や docs の例外経路にはしません。

passphrase や署名付き path を使う場合は Control Panel encrypted secret storage に保存し、runtime secret lease で解決します。read API、UI、diagnostic report、archive metadata には raw URL を返さず、source profile ID、masked host、mode、runtime config version、lease ID、packet delta だけを残します。複数 source を切り替える場合は、古い source profile が active assignment に残っていないことも readiness の一部として扱います。

## 検証

Production readiness checks should reject placeholders and unsafe hosts. Media probes should store packet, audio, and archive summaries without writing the raw input URL into evidence.

外部確認のpass は、SRT socket が開いたことだけでは判断しません。Discord audio、SRT input、FFmpeg output、RTMPS、archive の各段階が同じ stream ID と runtime config version に紐づいていることを確認します。映像 source が SRT の場合は、probe summary に input packet delta、FFmpeg running state、YouTube received video/audio、`final.mkv` byte growth、`final.mp4` remux proof が揃う必要があります。SRT source を使わない E2E では、test video source を使った理由を evidence に残し、SRT URL の placeholder を pass 条件に混ぜません。

## 失敗時の確認

接続できない場合は、source host が allowlist に含まれているか、firewall と NAT が SRT の待受/発信方向に合っているか、Encoder/Recorder host から名前解決できるかを確認します。認証情報付き URL を一時的に使う場合でも、PowerShell history、process list、FFmpeg log、Markdown evidence に raw credential が残らない渡し方にしてください。

caller/listener mode の食い違いは、port open に見えても media packet delta が増えない原因になります。復旧時は source 側の mode、Encoder/Recorder の mode、NAT の向き、UDP timeout、latency 設定、allowed host の順に確認します。credential-bearing URL を再入力する前に、Control Panel 上の source profile と runtime config version が stream start 時に配布された version と一致しているかを確認してください。

## Production 方針

本番 stream では operator が SRT URL を直接 service env に固定するのではなく、Control Panel の stream profile または start request で対象 source を選びます。`AUTOSTREAM_E2E_ENCODER_INPUT_URL` は外部確認の一時入力だけに使い、実運用の恒久設定にはしません。複数 source を切り替える場合は、allowed host と assignment を Control Panel 側で同期し、古い credential-bearing URL が archive metadata や diagnostic report に残っていないことを確認します。

## 証跡に残す項目

SRT 検証では host の到達性、接続方向、packet が media probe に反映されたこと、FFmpeg が timeout せずに RTMPS と archive へ出力したことを残します。URL の userinfo、query token、署名付き path は記録せず、必要なら masked host と source profile 名だけを残します。
