# RTMPS 出力

YouTube Live への配信は Encoder/Recorder が RTMPS で行います。YouTube stream key は secret として扱い、docs、logs、evidence、UI の read view には表示しません。

## Control Panel 管理

YouTube output は Control Panel の integration として管理します。operator は broadcast/live stream を選び、Encoder/Recorder には stream start 時の runtime config として配布されます。

production では YouTube stream key を `.env`、start request、operator handoff、Markdown evidence に戻しません。Control Panel は connected account、YouTube output ID、broadcast policy、privacy status、archive profile との対応を DB に保存し、secret material は encrypted secret storage または YouTube Live API の write-only 経路で解決します。Encoder/Recorder は assignment された stream の runtime config version と short-lived lease だけを受け取り、status API では configured/missing、target host、retry count、last error category だけを返します。

`control-panel-config.json` の confirmation は raw YouTube ID や URL の転記ではありません。外部確認の前に Control Panel から export した non-secret confirmation として、YouTube output、Drive destination、Discord config、encoder/archive profile、primary assignment、runtime config distribution が同じ stream に紐づくことを確認します。この file が placeholder、手書きの推測、別 stream の export であれば RTMPS の verification pass には使いません。

## 外部確認

private/test broadcast を作成し、provider verification record には次だけを残します。

- `broadcast_id`
- `live_stream_id`
- `received_video=true`
- `received_audio=true`
- `dry_run=false`

stream key、RTMPS URL、OAuth token は provider verification record に書きません。

## Runtime と retry

`live_api` mode では Control Panel が OAuth connected account と YouTube output を関連付け、start 時に broadcast / live stream の runtime 情報を作ります。Encoder/Recorder は write-only stream key または Live API から得た output を runtime config として受け取り、command line や status API に raw key を出しません。RTMPS reconnect が発生した場合は `encoder.rtmp_reconnect_count` と media timeout を Observability に送り、外部確認のpass では reconnect count が 0 であることを確認します。

retry は無制限に回しません。startup phase の認証失敗、live phase の一時切断、stop/complete phase の API 失敗を分け、Observability には phase、attempt、last error category、next retry delay、stream ID を送ります。stream key invalid、OAuth scope missing、broadcast not bound など operator action が必要な error は自動再試行に埋もれさせず、Control Panel の readiness issue として出します。

## 完了条件

YouTube output は broadcast を作成できただけでは完了扱いにしません。private/test broadcast で video/audio の受信が確認でき、`recorder.write_bitrate_kbps` が正の値を持ち、`media.input_timeout_sec=0` であることを証跡に残します。stop 時は Live API 側の complete/stop 処理も確認し、失敗した場合は retry interval と最終 error category を記録します。

completion record では provider verification record、probe summary、Control Panel config confirmation、runner command が同じ `stream_id` を指している必要があります。YouTube 側の proof は `received_video=true` と `received_audio=true` に加え、dry-run ではない private/test broadcast、fresh `observed_at`、masked または non-secret ID だけを含めます。古い successful broadcast の screenshot、別 stream の Live API response、stream key fallback の存在は pass 証跡になりません。

## 失敗時の確認

RTMPS へ接続できない場合は、YouTube output の mode、OAuth account の scope、Control Panel の prepared runtime、Encoder/Recorder の FFmpeg args、firewall の outbound 443 を順に確認します。stream key fallback を使う場合でも key は Control Panel の write-only secret に残し、`.env` や docs に戻しません。

YouTube が映像を受信しているのに audio proof が欠ける場合は Discord packet delta、RTP forwarded count、FFmpeg audio mapping を見ます。video proof だけが欠ける場合は SRT/test video source、FFmpeg filter graph、RTMPS muxer を見ます。broadcast complete だけが失敗する場合は media path ではなく Live API permission、broadcast state transition、Control Panel retry worker を切り分けます。
