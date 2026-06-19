# Deepgram

Deepgram は caption / transcript を外部 STT provider で生成する場合の候補です。AutoStream v1 の必須経路ではありませんが、Worker が caption event を生成する構成では Control Panel managed integration として扱います。

このページは provider 採用時の所有境界を固定するためのものです。Deepgram を使わない構成でも Worker の caption event、`caption.final`、`captions.vtt` の archive sidecar は AutoStream の contract として残ります。provider の API key や model selection は stream 実行時の runtime config から解決し、Worker repository の固定 env に埋め込まない方針です。

## 所有境界

Deepgram API key は docs、evidence、screenshot、runtime JSON に raw 値で残しません。bootstrap env に固定配置するのではなく、Control Panel の encrypted secret storage に保存し、Worker が runtime secret lease を通じて必要な stream の間だけ解決します。

## 設定項目

| 項目 | 所有者 | 備考 |
| --- | --- | --- |
| API key | Control Panel encrypted secret | UI では configured/missing のみ表示 |
| language | Control Panel integration profile | 例: `ja`, `en-US` |
| model | Control Panel integration profile | provider 側の有効 model 名 |
| captions enabled | stream runtime config | stream ごとに有効化 |
| transcript archive | archive config | sidecar に保存するかを制御 |

## Runtime flow

1. operator が Control Panel で Deepgram connected integration を作成する。
2. stream assignment で Worker に caption generation を割り当てる。
3. stream start 時に Worker が non-secret profile と secret reference を受け取る。
4. Worker が runtime secret lease で API key を解決し、caption event を生成する。
5. Encoder/Recorder は `caption.final` と `captions.vtt` を archive sidecar に保存する。

caption generation が失敗しても media pipeline 全体を即停止するかどうかは stream profile の方針で決めます。既定では配信と録画を優先し、Observability signal に caption failure、retry count、provider mode を記録して operator が判断できるようにします。

Deepgram を使わない stream でも、caption pipeline を未実装として扱いません。Worker が manual caption、local transcript source、または caption disabled の runtime config を受け取った場合は、その mode を event metadata と archive sidecar に残します。これにより、Deepgram API key がないことと caption feature の欠落を混同せず、外部 provider verification record 待ちの状態を production 実装未完了と誤判定しないようにします。

## Failure policy

Deepgram failure は authentication、quota/rate limit、network timeout、audio format mismatch、provider response validation に分けます。authentication と quota は operator action が必要な readiness issue とし、network timeout は retry policy、audio format mismatch は media pipeline、response validation は redaction/privacy guardrail の問題として扱います。Worker は provider response body をそのまま log に出さず、status code、error category、retryable flag、caption event count、redacted sample availability だけを Observability に送ります。

caption が E2E の必須条件になる stream では、`caption.final` event と `captions.vtt` sidecar の両方を確認します。caption が任意の stream では、caption failure を media verification pass の blocker にしない代わりに、runtime config 上の `captions enabled=false` または provider 未使用の理由を evidence に残します。

## Evidence

外部確認で Deepgram を使う場合も、API key、request URL の credential、provider response の個人情報は記録しません。証跡には caption event count、`captions.vtt` byte size、provider mode、redaction 済み sample のみを残します。

provider response の生 transcript をそのまま docs に貼りません。必要な場合は短い redacted sample、event count、language/model、archive artifact の fingerprint を使い、個人情報や Discord user identifier が含まれる可能性のある内容は evidence checker の対象外に逃がさないようにします。

provider verification record と caption evidence は別物です。provider verification record は外部サービス上で観測した fresh な状態を示し、caption evidence は Worker と Encoder/Recorder が生成した AutoStream 内部 artifact を示します。どちらも同じ stream ID と runtime config version に紐づいている必要があり、古い transcript や別 stream の VTT file を使って完了扱いにしません。
