# Encoder Recorderを導入する

Encoder Recorder は、AutoStream の中で最もサーバー資源を使うサービスです。Discord Bot から音声を受け、Worker からイベントを受け、FFmpeg で配信と録画を行います。host直接起動では、FFmpeg は同梱しないためサーバー側に入れてください。

## 導入前に用意するもの

| 用意するもの | どこで使うか |
| --- | --- |
| `ffmpeg` | host側の実行ファイル |
| 録画保存ディレクトリ | `AUTOSTREAM_ARCHIVE_DIR` |
| 作業ディレクトリ | `AUTOSTREAM_DATA_DIR` |
| Encoder Recorder Node Agent `config.yml` | `/etc/autostream-node/config.yml` |
| stream ingest signing key | `AUTOSTREAM_STREAM_INGEST_SIGNING_KEY` |
| output relay | 本番配信先への中継 |
| Observability ingest token | `OBSERVABILITY_TOKEN` |

YouTube stream key、Drive folder ID、OAuth refresh token などは、標準運用では Control Panel からruntime configとして受け取ります。

## host直接起動

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
AUTOSTREAM_VERSION=v1.0.0
AUTOSTREAM_ARCH=amd64   # arm64 server では arm64 に変更
cd "/opt/autostream/releases/autostream-encoder-recorder_${AUTOSTREAM_VERSION}_linux_${AUTOSTREAM_ARCH}"
sudo install -o root -g root -m 0755 bin/encoder-recorder /usr/local/bin/encoder-recorder
sudo install -d -o autostream -g autostream /var/lib/autostream/encoder-recorder /var/lib/autostream/archives
sudo install -o root -g root -m 0644 systemd/autostream-encoder-recorder.service.example /etc/systemd/system/autostream-encoder-recorder.service
sudo install -d -o root -g root -m 0750 /etc/autostream
sudo install -o root -g root -m 0640 .env.example /etc/autostream/encoder-recorder.env
```

`/etc/autostream/encoder-recorder.env` を編集します。

```text
AUTOSTREAM_NODE_CONFIG=/etc/autostream-node/config.yml
AUTOSTREAM_ENV=production
AUTOSTREAM_REQUIRE_CONTROL_PANEL_RUNTIME_CONFIG=true
AUTOSTREAM_REQUIRE_OUTPUT_RELAY=true
AUTOSTREAM_OUTPUT_RELAY_URL=rtmp://127.0.0.1/autostream/{stream_id}
AUTOSTREAM_STREAM_INGEST_SIGNING_KEY=<STREAM_INGEST_SIGNING_KEY>
AUTOSTREAM_REQUIRE_SIGNED_INGEST_TOKENS=true
AUTOSTREAM_DATA_DIR=/var/lib/autostream/encoder-recorder
AUTOSTREAM_ARCHIVE_DIR=/var/lib/autostream/archives
FFMPEG_BIN=ffmpeg
OBSERVABILITY_URL=https://<OBSERVABILITY_HOST>
OBSERVABILITY_TOKEN=<OBSERVABILITY_INGEST_TOKEN>
TZ=Asia/Tokyo
```

起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autostream-encoder-recorder
sudo systemctl status autostream-encoder-recorder
```

## FFmpegとディスクを確認する

```bash
ffmpeg -version
sudo -u autostream test -w /var/lib/autostream/archives
df -h /var/lib/autostream/archives
```

録画は一時的に大きくなります。配信時間、bitrate、保存日数に合わせてディスク容量を見積もってください。

## output relay の考え方

本番では FFmpeg の引数に外部配信先のstream keyを直接出さず、同じhost上の relay にだけ出力する構成を推奨します。

1. nginx-rtmp、SRS などの relay を `127.0.0.1` で待ち受けさせます。
2. Encoder Recorder の `AUTOSTREAM_OUTPUT_RELAY_URL` を loopback relay にします。
3. relay 側の非公開設定で YouTube など外部配信先へ push します。
4. relay 設定ファイルはGit管理せず、権限を絞ります。

Docker構成では output relay sidecar を使う形でも同じ考え方です。

## Control Panelで登録する

1. Node登録で `encoder_recorder` を選び、Node名、Host、Port、SSL、説明を入力します。
2. Configuration から `config.yml` または Auto Configure コマンドを取得します。
3. `config.yml` を `/etc/autostream-node/config.yml` に配置して Encoder Recorder を起動します。
4. Service Health で online、報告バージョン、Capability を確認します。
5. Encoder Profiles を作ります。
6. YouTube Outputs を作ります。
7. Drive destination と Archive Settings を作ります。
8. Streams で Encoder Profile、YouTube Output、Archive Profile を選びます。
9. Start前に preflight を確認します。

## Google Drive保存

Google Drive へ保存する場合は、Control Panel の Integrations と Archive Settings で保存先を作ります。

service account を使う場合、hostには credential JSON を `/etc/autostream/google-service-account.json` のようなGit管理外の場所に置きます。env fallbackを使う移行期間だけ、`GOOGLE_APPLICATION_CREDENTIALS` にそのパスを入れます。標準運用では Control Panel のDrive destinationとruntime secret参照を使います。

共有ドライブを使う場合は、Drive destinationで共有ドライブ用設定を有効にし、対象folderへservice accountまたは接続済みOAuth accountを参加させます。

## 確認ポイント

| 確認 | 正常な状態 |
| --- | --- |
| Preflight | ffmpeg、archive dir、output relay がok |
| Audio Bridge | Discord Bot からpacketが届く |
| Worker Event Sidecar | Worker eventが保存される |
| 録画 | `final.mkv` 作成後、停止時に `final.mp4` が作られる |
| Upload | Archive / upload が completed |
| Metrics | fps、bitrate、dropped frames、disk free を確認できる |

## Dockerで起動する場合

Docker image には FFmpeg を含める構成にできますが、release artifact のhost直接起動では含めません。compose では archive dir を volume として永続化し、Panelが生成した `config.yml` を `/etc/autostream-node/config.yml` へ read-only mount します。

## よくあるトラブル

| 症状 | 確認する場所 |
| --- | --- |
| preflightでffmpeg missing | `FFMPEG_BIN` と `ffmpeg -version` |
| archive root missing | `AUTOSTREAM_ARCHIVE_DIR` の存在、owner、空き容量 |
| 本番でstream key付きrequestが拒否される | YouTube Output とruntime secret参照を使う |
| 配信はできるが録画がない | archive profile、ディスク権限、stop時のpackaging |
| upload失敗 | Drive destination、OAuth/account権限、folder ID、Retry Upload |
| fpsが低い | CPU/GPU負荷、encoder preset、入力jitter、bitrate |

## 次に読むページ

- [プロファイル設定](/control-panel/profiles)
- [OAuthとDrive保存先](/control-panel/integrations-drive)
- [録画と保存](/operations/archive-flow)
