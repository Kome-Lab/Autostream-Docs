# FFmpeg

Encoder/Recorder は FFmpeg を stream ごとに起動し、YouTube RTMPS 出力と local archive を同時に処理します。start/stop は Control Panel から dispatch され、二重起動を避けるため stream status を `starting`、`running`、`stopping`、`stopped` で管理します。

## 主な責務

- Discord audio bridge から RTP/SDP input を受ける。
- 必要に応じて test video を生成する。
- RTMPS へ配信する。
- `final.mkv` を作成する。
- stop 後に `final.mp4` へ remux する。
- audio level、silence、clipping、process health を Observability に送る。

## 失敗時の見方

FFmpeg 起動失敗は `service_dispatch_failed`、入力が取れない場合は `archive_input_unavailable`、remux 失敗は archive/remux metric を確認します。command line に secret が含まれないよう、stream key や credential 付き URL は log redaction 対象です。

FFmpeg の失敗は start、live、stop、package で扱いが変わります。start 直後の失敗は runtime config、input allowlist、output relay、binary path を確認します。live 中の失敗は `encoder.process_alive`、RTMPS reconnect、recorder write bitrate を見ます。stop 後の失敗は `final.mkv` が存在するか、remux が失敗したか、Drive upload だけが失敗したかを分けます。

## Command guardrail

FFmpeg args は Encoder/Recorder が組み立て、operator が raw command を evidence に貼り付ける運用にはしません。YouTube stream key は relay config または runtime secret 経由で扱い、process list に残る形で渡さないことを優先します。credential 付き input URL を使う場合も、allowed host 検査、DNS rebind 検査、unsafe private address 拒否を通し、ログには host と scheme だけを残します。

debug で command を確認する場合も、argument 全体ではなく sanitized plan を残します。input scheme、allowed host result、output relay enabled、archive logical path、redaction status が分かれば十分です。process list に stream key や credential URL が見えた場合は、配信成功ではなく secret exposure risk として扱います。

## Archive metrics

外部確認では FFmpeg が起動したことだけでなく、`final.mkv` の byte delta、stop 後の `final.mp4` 作成、`recorder.remux_duration_ms`、artifact report の logical relative path を確認します。absolute host path は証跡に残さず、`final/<STREAM_ID>/final.mp4` のような logical path だけを記録します。Google Drive upload は `final.mp4` と metadata の fingerprint を使って確認します。

## 復旧

入力 timeout、RTMPS reconnect、remux 失敗は原因が異なるため、同じ retry でまとめて扱いません。入力 timeout は source URL と allowlist、RTMPS reconnect は YouTube output と network、remux 失敗は local disk と FFmpeg binary を確認します。自動 remediation を行う場合でも、再起動や retry-upload は Control Panel の stream state と assignment が一致していることを確認してから実行します。

## 設定の所有者

FFmpeg の実行 plan は Encoder/Recorder が所有しますが、YouTube output、input profile、archive profile、Drive destination は Control Panel managed config から来ます。operator が host 上で raw FFmpeg command を手修正した場合、その変更は本番設定として扱わず、Control Panel の profile と Encoder/Recorder repo の command builder に戻してから証跡化します。これにより、stream key が process list や docs に出る事故を避けます。
