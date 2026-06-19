# Update

AutoStream の各 repository は独立して build、test、deploy できます。すべての service を同時に更新する必要はありません。

更新作業の単位は repository ではなく、Control Panel contract、runtime config、service process、provider integration のどこに影響するかで決めます。実provider確認 に影響する変更では、dry-run の green だけで完了にせず、対象 stream の heartbeat、runtime config export、provider verification record、readiness check を更新後に確認します。

## 基本方針

- contracts の破壊的変更は先に移行期間を設ける。
- Control Panel と service の API compatibility を確認する。
- 1 service ずつ更新し、heartbeat と health を確認する。
- live stream 中の Encoder/Recorder 更新は避ける。
- `.env.example` と実 env の差分を確認する。

## 更新前チェック

1. 対象 repository の release note / changelog を確認します。
2. `go test ./...`、`go build ./...`、`npm run build` など対象 repo の検証を実行します。
3. migration がある場合は backup を取得します。
4. env variable の追加・変更を確認します。
5. rollback 用の binary / image を保持します。

Control Panel migration がある場合は、migration 実行前の MariaDB backup、migration version、rollback 可能な application binary を同時に記録します。secret schema や encrypted column が変わる更新では、dump や migration log に ciphertext/nonce 以外の値が出ていないことを確認します。

## 更新順序

推奨順序:

1. `autostream-contracts`
2. `autostream-control-panel`
3. `autostream-observability`
4. `autostream-encoder-recorder`
5. `autostream-worker`
6. `autostream-discord-bot`
7. `autostream-docs`

ただし、変更が 1 service に閉じている場合は対象 service だけを更新します。

互換 window が必要な場合は、先に Control Panel / contracts が旧 service と新 service の両方を受けられる状態を作ります。runtime config field を追加するときは、旧 service が unknown field を無視できるか、新 service が missing field を既定値で扱えるかを確認してから primary assignment を切り替えます。

## systemd 更新

```bash
sudo systemctl stop autostream-encoder-recorder
sudo install -o root -g root -m 0755 autostream-encoder-recorder /usr/local/bin/
sudo systemctl start autostream-encoder-recorder
sudo systemctl status autostream-encoder-recorder
```

起動後に `GET /health`、Control Panel の Service Health、Observability heartbeat を確認します。

## Docker 更新

```bash
docker compose pull
docker compose up -d
docker compose ps
```

image tag を固定し、rollback 可能にします。

production compose は `latest` ではなく release tag または digest を使います。Encoder/Recorder は output relay、archive volume、ffmpeg availability、service user permission を更新後に確認します。Observability は MariaDB backend と notification delivery、Control Panel は login / CSRF / service dispatch、Discord Bot と Worker は runtime config fetch と heartbeat freshness を確認します。

## 更新後チェック

- service heartbeat が正常。
- Control Panel から service dispatch が成功。
- Observability signal が届いている。
- Audit Logs に管理操作が残る。
- archive flow に影響がない。

canary は primary/standby assignment を使って 1 stream または 1 service から始めます。heartbeat が新 version で安定し、Observability に新しい error class が増えず、Control Panel dispatch が成功してから primary を広げます。異常時は同じ stream ID の audit log、service log、Observability incident、archive artifact を束ねて判断し、原因が migration か runtime config か process binary かを切り分けます。

rollback は「前の binary に戻す」だけでは完了しません。migration が不可逆でないか、service token / runtime secret lease / assignment が新旧どちらを指しているか、external verification の provider verification record が古くなっていないかを確認します。rollback 後も the private evidence archive には raw secret を残さず、更新 ID、version、stream ID、pass/fail だけを記録します。

## contracts 変更時

OpenAPI や event schema を変更した場合は、旧 version の service がどの期間動作できるかを明記します。breaking change は Control Panel と service を同時に切り替える計画を作ります。
