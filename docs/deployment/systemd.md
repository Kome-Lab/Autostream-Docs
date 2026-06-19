# systemd

direct host では systemd unit に hardening を設定し、service ごとに bootstrap env file を分けます。運用 secret は Control Panel で管理し、systemd env file には置きません。

systemd は process supervisor であり、stream 設定の source of truth ではありません。unit には binary、実行 user、bind address、Control Panel への接続情報、data directory だけを持たせます。Discord routing、YouTube output、Drive destination、notification webhook、SMTP password、caption/STT provider、archive profile は Control Panel の Integration Registry、profile、stream assignment から runtime config として配布します。

direct host 構成では、Control Panel と各 service を別 unit、別 Linux user、別 data directory にします。同じ host で動かす場合も、Encoder/Recorder だけが archive directory へ書き込み、Discord Bot と Worker は runtime API 経由で必要な状態だけを送ります。standby service は heartbeat と readiness を出せますが、primary assignment を受けるまで stream-scoped secret や archive write path を使わせません。

## Unit の例

```ini
[Unit]
Description=AutoStream Encoder Recorder
After=network-online.target
Wants=network-online.target

[Service]
User=autostream
Group=autostream
EnvironmentFile=/etc/autostream/encoder-recorder.env
ExecStart=/usr/local/bin/autostream-encoder-recorder
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectProc=invisible
ProcSubset=pid
ReadWritePaths=/var/lib/autostream
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
```

`ProtectProc=invisible` と `ProcSubset=pid` は、同一 host 上の別 user から service process の argv を見えにくくするための短期対策です。systemd が対応していない環境では、`/proc` を `hidepid=2` で mount するか、container の PID namespace を分離してください。

## Env File の中身

```text
SERVICE_ID=encoder-recorder-01
SERVICE_NAME=Encoder Recorder 01
SERVICE_PUBLIC_URL=https://encoder.example.com
CONTROL_PANEL_URL=https://control.example.com
CONTROL_PANEL_TOKEN=<SERVICE_TOKEN>
SERVICE_CONTROL_TOKEN_SHA256=<SHA256_OF_CONTROL_PANEL_TO_SERVICE_TOKEN>
AUTOSTREAM_DATA_DIR=/var/lib/autostream/encoder-recorder
TZ=Asia/Tokyo
```

`DISCORD_BOT_TOKEN`、`YOUTUBE_STREAM_KEY`、`GOOGLE_OAUTH_REFRESH_TOKEN`、`GOOGLE_DRIVE_FOLDER_ID`、Webhook URL、SMTP password は env file に置かず、Control Panel の Integration Registry と profile で管理します。

## Service 別 env file

| Unit | Env file | 置く値 | 置かない値 |
| --- | --- | --- | --- |
| `autostream-control-panel.service` | `/etc/autostream/control-panel.env` | `DATABASE_URL`、session secret、secret encryption key、setup token、service dispatch token | Discord Bot token、YouTube stream key、OAuth refresh token、Drive folder ID、webhook URL、SMTP password |
| `autostream-discord-bot.service` | `/etc/autostream/discord-bot.env` | `SERVICE_ID`、`CONTROL_PANEL_URL`、service token、Control Panel inbound token hash、bind address | Bot token、guild/channel override、caption provider secret |
| `autostream-encoder-recorder.service` | `/etc/autostream/encoder-recorder.env` | `SERVICE_ID`、Control Panel 接続、archive/data directory、output relay URL、FFmpeg binary path | YouTube stream key、RTMPS upstream URL、Drive credential、Drive folder ID |
| `autostream-worker.service` | `/etc/autostream/worker.env` | `SERVICE_ID`、Control Panel 接続、local bind address、compatibility fallback を使う場合の明示 flag | Encoder static token、本番用 direct Encoder route、STT/API provider secret |
| `autostream-observability.service` | `/etc/autostream/observability.env` | ingest/admin token hash、secret encryption key、Control Panel 接続、notification encryption settings | raw ingest/admin token、webhook URL、SMTP password |

`CONTROL_PANEL_TOKEN` は service が Control Panel へ register / heartbeat / runtime config / runtime secret resolve を呼ぶための outbound token です。`SERVICE_CONTROL_TOKEN_SHA256` は Control Panel からその service へ dispatch する inbound token の hash です。2 つを同じ値として扱うと、片方向の漏えいがもう片方向の実行権限に広がるため、生成、保管、rotation を分けてください。

Control Panel env file だけは DB 接続と secret encryption key を持ちます。この file の permission は他 service user から読めないようにし、backup するときは encrypted backup または secret manager で扱います。service 側 env file は bootstrap token を含むため root 所有、対象 service group read-only にし、unit reload のたびに owner と ACL を確認します。

## 操作

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-encoder-recorder
sudo systemctl status autostream-encoder-recorder
```

log を確認する場合も raw secret が出ていないことを前提にします。service client は runtime secret の response body をそのまま log に出してはいけません。

## Readiness と rollout

unit を起動しただけでは production ready とは見なしません。Control Panel の service registry で `service_id`、`service_type`、public URL、heartbeat freshness、primary/standby assignment が一致していることを確認します。Encoder/Recorder は output relay readiness、archive directory permission、runtime config version を確認し、Discord Bot は VC join 前に stream assignment と Bot Config の configured/fingerprint state を確認します。

rollout は Control Panel から事前登録した standby service を先に起動し、heartbeat が fresh になってから primary assignment を切り替えます。古い primary は新しい primary の heartbeat と runtime config version が安定するまで停止せず、停止後は runtime secret lease が古い service で解決できないことを確認します。Worker と Encoder/Recorder の間に互換 env fallback が残っている場合でも、本番 rollout の成功条件には含めません。

rollback は binary を戻すだけでは完了しません。Control Panel の assignment、runtime config schema version、service token binding、archive write path、notification delivery policy を元の組み合わせに戻したかを確認します。rollback 後の evidence には service ID、runtime config version、heartbeat status、error code だけを残し、token や provider credential は記録しません。

## 更新と rollback

unit 変更時は `systemctl daemon-reload` の前に env file の permission と owner を確認します。service token rotation や Control Panel URL 変更は、対象 service の heartbeat が新しい設定で fresh になったことを確認してから古い token を無効化します。起動に失敗した場合は journal の error category、exit code、last heartbeat を確認し、secret 値を journal に貼り付けて調査しません。

## 権限

env file は root 所有、対象 service group 読み取りに限定します。archive directory は Encoder/Recorder だけが書き込み、Control Panel や Worker には直接書き込み権限を与えません。`ReadWritePaths` を増やす場合は、upload 一時領域、archive 領域、runtime socket のどれが必要かを分けて記録し、credential file や `/etc/autostream` 全体を広く書き込み可能にしないでください。

`ReadWritePaths` に `/etc/autostream` を入れないでください。env file や relay 設定を書き換える必要がある場合は deploy step で root が配置し、service process 自身には読み取りだけを許可します。Google Service Account 互換 mode を使う host でも credential JSON は `/etc/autostream/google-service-account.json` のような固定 path に置き、Encoder/Recorder user から読み取りだけにします。OAuth connected account を使う標準運用では、この credential file は不要です。

## 検証 checklist

- `systemctl show <unit> -p User -p Group -p EnvironmentFiles -p ReadWritePaths` で user と書き込み path が想定どおりである。
- `namei -l /etc/autostream/*.env` と `icacls` 相当の host policy で、対象 service 以外が env file を読めない。
- Control Panel の service registry で heartbeat が fresh、service type と assignment role が一致している。
- `AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true` の service が、runtime config 欠落時に fail closed する。
- Encoder/Recorder production unit は output relay を要求し、FFmpeg argv に upstream RTMPS URL や stream key を渡さない。
- Observability notification channel は webhook URL / SMTP password を ciphertext と nonce で保存し、delivery history には masked target だけを残す。
- 変更後の the private evidence archive には secret 値ではなく、unit name、service ID、masked/fingerprint、error code、command status だけを残す。
