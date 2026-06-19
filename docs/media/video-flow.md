# 映像フロー

Encoder/Recorder は stream start を受けると FFmpeg pipeline を構成します。映像入力がある場合は許可 host の URL を使い、Discord 音声のみの検証では黒背景の生成映像を使って YouTube RTMPS と archive を成立させます。

映像フローの責務は Encoder/Recorder に閉じます。Control Panel は YouTube output、archive profile、input policy を runtime config として渡しますが、FFmpeg argv、temporary file、remux、upload sidecar の詳細は Encoder/Recorder が所有します。Worker や Discord Bot が stream key、RTMPS URL、archive path を直接扱う構成にはしません。

## 入力

- `AUTOSTREAM_E2E_ENCODER_INPUT_URL`: 外部確認用の安全な test input URL。command-line argument では渡しません。
- Control Panel managed runtime config: production の input/output assignment。
- Discord audio bridge: `encoder_input_url` が空でも音声付き test broadcast を成立させるための Opus/RTP bridge。

## 出力

- YouTube RTMPS: private/test broadcast で video/audio を確認します。
- `final.mkv`: FFmpeg の主録画 artifact。
- `final.mp4`: stop 後の remux artifact。Drive upload は通常こちらを優先します。
- sidecar metadata: duration、byte size、upload attempts、fingerprint を記録します。

`final.mkv` は録画の一次成果物、`final.mp4` は共有・Drive upload 向けの成果物として扱います。stop 後の package phase では同一 stream の再 package と auto package が競合しないように lock し、symlink や想定外 path を追わず、metadata には fingerprint と count だけを残します。

## Guardrail

credential 付き input URL、YouTube stream key、signed URL は the private evidence archive に raw 値で残しません。証跡では configured/masked/fingerprint と byte delta だけを使います。

production では output relay を既定の境界にします。互換 direct RTMPS mode は local/dev の切り分け用に残しますが、本番 evidence では relay-required preflight、FFmpeg argv redaction、YouTube media receipt、RTMPS reconnect count を確認します。

## 実運用の確認順

video flow の実運用確認は、input profile、allowed host、FFmpeg process、RTMPS receipt、archive byte delta、Drive upload fingerprint の順で行います。credential-bearing input URL や YouTube stream key は evidence に残さず、Control Panel output ID、masked host、provider verification record、artifact fingerprint へ変換します。

## Operator Notes

映像フローの証跡は、YouTube に映像が見えたという目視だけでは完了扱いにしません。Control Panel output config、Encoder/Recorder の FFmpeg start、RTMPS reconnect count、provider verification record の received audio/video、archive package の byte delta が同じ `stream_id` に結びついている必要があります。

入力 URL や stream key は operator-managed secret なので、the private evidence archive には raw 値を保存しません。問題が起きた場合は、allowlist rejection、FFmpeg input failure、RTMPS authentication failure、provider receipt failure、archive/remux failure を分け、masked destination と failure phase だけを残します。

外部確認では、まず start-readiness で入力 URL の allowlist、YouTube output、archive directory、service heartbeat を確認します。start 後は stop 前に Encoder audio packet と RTMPS media receipt を見て、stop 後に `final.mkv` の byte delta、`final.mp4` の remux duration、Drive upload fingerprints を確認します。どれか 1 つでも dry-run や placeholder のままなら、MVP verification の pass 証跡にはしません。
