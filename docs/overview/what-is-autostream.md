# AutoStream とは

AutoStream は Discord VC を入力にして、YouTube Live への配信、録画、MP4 化、Google Drive へのアーカイブ、監視通知までを自動化する分散システムです。Control Panel は操作面と設定管理を担当し、実際の音声接続、映像処理、イベント生成、監視は独立 service が担当します。

目標は dry-run の手順集ではなく、実 provider を使う本番相当の運用面を Control Panel から完結させることです。operator は Discord、YouTube、Drive、notification の接続先を Control Panel に登録し、service pre-registration と primary/standby assignment を確認してから stream を開始します。各 service は runtime config を取得し、実行中の状態を heartbeat と metrics で返します。

## 何を管理するか

- Discord Bot の VC 接続先、guild/channel、音声 packet forward。
- Encoder/Recorder の YouTube RTMPS 出力、`final.mkv` 録画、`final.mp4` remux、Drive upload。
- Worker の overlay、caption、participant、active speaker、current time event。
- Observability の signal ingest、incident、diagnostic、remediation、notification。
- Control Panel の service registry、primary/standby assignment、runtime config 配布、connected account。

## 運用の基本方針

bootstrap env には起動に必要な最小値だけを置きます。stream ごとの出力先、Discord routing、Drive destination、YouTube Live API output、OAuth account、通知 channel は Control Panel 管理へ寄せます。ドキュメント、ログ、証跡には placeholder、masked value、fingerprint だけを残し、実 token や credential 付き URL は保存しません。

service の責務は意図的に分割します。Discord Bot は VC と音声 packet、Encoder/Recorder は media pipeline と archive、Worker は overlay/caption event、Observability は incident と notification、Control Panel は設定と dispatch の所有者です。障害調査では、まずどの境界で止まったかを service health、runtime config export、probe summary から切り分けます。

本番運用では、operator が service host に直接 stream 設定を配布し続ける状態を完成形としません。外部 provider 値は Control Panel の integration record、connected account、destination、output、profile として登録し、service 側は割り当てられた stream の runtime config だけを読む設計にします。これにより、primary/standby 切替、token rotation、Drive destination 変更、YouTube output 変更を UI/API の監査対象にできます。

repository 境界も運用境界として扱います。Control Panel repo は設定と dispatch contract、Discord Bot repo は VC/audio、Encoder/Recorder repo は media/archive/upload、Worker repo は event generation、Observability repo は incident/notification を所有します。docs repo はそれらを 1 つの運用手順に束ねますが、実 secret や provider 実値の保管場所にはしません。

## 完了判定

本番運用の完了条件は、UI/API で stream を開始し、Discord VC から audio packet が増え、YouTube private/test broadcast が video/audio を受け取り、`final.mkv` から `final.mp4` が生成され、Google Drive へ OAuth または Service Account 経由で upload されることです。外部確認の記録は [外部確認](../runbooks/private E2E validation runbook) に従って作成します。

完了証跡は単一の成功ログではなく、Control Panel config confirmation、provider verification record、probe summary、readiness check を結びます。どれかが placeholder、dry-run、古い proof、別 stream ID の証跡であれば pass としません。

完成後の通常運用では、同じ stream ID に対して service registration、assignment、start request、provider verification record、archive artifact、Drive upload proof が結びついていることを継続的に確認します。途中で service を再起動した場合も、新しい heartbeat と runtime config version が Control Panel の割当と一致してから verification record に進みます。
