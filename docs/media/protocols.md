# Media Protocols

AutoStream は用途ごとに protocol を分けます。control API と media transport を混ぜないことで、secret 境界と障害切り分けを単純にします。

## Protocol 一覧

- HTTPS: Control Panel API、service registration、runtime config dispatch、Observability ingest。
- Discord Voice: Discord Bot の VC 接続と Opus packet 受信。
- HTTP audio ingest: Discord Bot から Encoder/Recorder への Opus packet forward。
- RTP/SDP local bridge: Encoder/Recorder 内部で FFmpeg に Discord audio を渡す経路。
- SRT/RTSP/HTTP: 外部映像入力候補。allowed host で制限します。
- RTMPS: YouTube Live への出力。

各 protocol は owner と failure mode を分けます。HTTPS の 401/403 は token scope、binding、session policy の問題として扱い、Discord Voice の join failure は guild/channel permission、voice region、bot token の問題として扱います。RTP/SDP bridge の failure は Encoder/Recorder host 内の media handoff、RTMPS の failure は YouTube output、relay、network、stream key resolution を確認します。

## Evidence

protocol 検証では endpoint の存在、status、packet delta、received_video/audio、archive byte size を記録します。credential-bearing URL は host/path 以外を mask します。

本番 evidence は、protocol ごとの「到達」と「受信」を分けます。HTTPS は status code と request ID、Discord Voice は VC join と packet delta、HTTP audio ingest は accepted packet count、RTP/SDP bridge は FFmpeg input health、RTMPS は YouTube provider の private/test receipt、Drive upload は configured destination と uploaded artifact fingerprint を記録します。secret を含む URL、stream key、OAuth token、Drive folder ID の raw value は evidence に含めません。

## 運用境界

Control API の HTTPS endpoint は operator/session/service token の境界を扱い、media transport は packet と artifact の健全性だけを扱います。Discord Voice や RTMPS の provider credential は media evidence に含めず、Control Panel の configured state または fingerprint で確認します。障害時は protocol ごとに owner を分け、Control Panel dispatch、Discord Bot audio receive、Encoder ingest、FFmpeg、YouTube RTMPS、Drive upload を混ぜて再試行しません。

## 監視対象

外部確認では `discord.audio_packets_total`、`audio-status.rtp_forwarded`、`encoder.rtmp_reconnect_count`、`archive.final_mp4_exists`、`gdrive.upload_status` を protocol 横断の主要 signal として扱います。どの protocol で止まったかを metric 名から判断できるよう、service は同じ stream ID を signal に含めます。

同じ障害で複数 protocol が同時に赤くなる場合は、上流から順に切り分けます。Discord packet delta が増えていなければ VC 側、packet は増えて audio ingest が増えなければ Bot から Encoder/Recorder、audio ingest は増えて RTMPS が不安定なら FFmpeg/output relay/YouTube、archive は成功して Drive upload だけ失敗するなら Drive destination または OAuth account を確認します。

protocol 変更を入れる場合は、docs と evidence gate も同時に更新します。新しい input scheme、output provider、upload destination を追加しただけでは pass 条件は増えません。operator が見るべき metric、secret を出さない proof 形式、Control Panel の source of truth、rollback 手順が揃ってから本番運用対象にします。
