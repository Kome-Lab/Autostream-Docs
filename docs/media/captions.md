# Captions

Captions は Worker が生成する stream event の一種です。v1 では `caption.final` event と archive sidecar の `captions.vtt` を主対象にします。

## Flow

1. Worker が caption source から text event を受け取る。
2. Control Panel contract に沿って `caption.final` を発行する。
3. Encoder/Recorder が archive sidecar に `captions.vtt` を保存する。
4. Evidence では caption file の存在、byte size、timestamp を記録する。

caption source は audio receive / STT / manual event のどこから来たかを分けます。Discord audio packet が止まっている場合は caption pipeline ではなく media input の問題です。STT provider が失敗している場合は provider status category と retry count を残し、request body、audio sample、API token は evidence に含めません。

## 境界

STT provider token や transcript provider credential は docs に書きません。caption content を共有する場合も、個人情報や未公開情報を含む stream では redaction してから evidence 化します。

caption は media pipeline の補助 signal であり、Discord audio、Encoder ingest、archive sidecar の代替証跡にはしません。caption provider が成功していても audio packet delta が 0 の場合は、stream は media complete と扱いません。逆に caption provider が停止していても、録画、RTMPS、archive、Drive upload が正常な場合は media E2E の失敗理由と caption failure を分けて記録します。

## Runtime config

caption の provider、language、保存有無、archive sidecar 名は Control Panel managed config として扱います。Worker は自分に割り当てられた stream の設定だけを読み、他 stream の transcript credential を参照しません。production では provider token を service env に戻さず、runtime secret lease で必要な service だけが短時間解決します。

## Evidence

外部確認では caption 本文の完全な転記を pass 条件にしません。確認するのは `caption.final` event が対象 stream ID で発行されたこと、Encoder/Recorder が `captions.vtt` または同等の sidecar を保存したこと、byte size と timestamp が archive metadata に残ることです。本文を証跡に残す場合は短い redacted sample に限定し、参加者名、未公開発言、provider request ID、token を含めません。

## 失敗時の確認

caption が欠落する場合は、Worker の provider 接続、Control Panel の runtime config、Worker event publish、Encoder/Recorder sidecar ingest を分けて確認します。音声 packet が届いていない場合は captions ではなく Discord audio/Encoder ingest の問題として扱います。provider 側 rate limit や timeout がある場合は Observability incident に provider 名と status category だけを残し、request body や token は残しません。

復旧後は `caption.final` の再発行だけで終えず、archive package に `captions.vtt` が含まれること、metadata に byte size と timestamp が残ること、completion record が本文の全文ではなく redacted sample または file proof を使っていることを確認します。

本番 incident では、caption failure の所有者を Worker と provider account に分けます。Worker が `caption.final` を発行していない場合は runtime config、event publish token、service assignment を確認します。provider が transcript を返していない場合は provider status、quota、language setting、retry backoff を確認し、request body や raw audio sample は incident evidence に残しません。Encoder/Recorder が sidecar を保存していない場合は archive package の責務として扱い、Worker 側の再試行だけで完了にしません。
