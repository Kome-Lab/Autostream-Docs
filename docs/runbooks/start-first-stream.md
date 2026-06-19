# 初回配信を開始する

この Runbook は、Control Panel から最初の stream job を作成し、Discord Bot、Worker、Encoder/Recorder を割り当てて配信を開始し、停止後の archive まで確認する手順です。

実 token、stream key、OAuth refresh token、Drive folder ID、webhook URL、SMTP password、service token は画面共有、ログ、スクリーンショット、証跡に残さないでください。UI/API では `configured`、`masked`、`fingerprint`、または runtime secret reference だけを扱います。

## 前提

- Control Panel に admin として login できる。
- MariaDB と Control Panel が起動している。
- Discord Bot、Worker、Encoder/Recorder、Observability が `Service Health` に登録され、heartbeat が stale ではない。
- `SERVICE_CALL_TOKEN` と各 service の `SERVICE_CONTROL_TOKEN_SHA256` が対応している。
- Control Panel の `AUTOSTREAM_SECRET_ENCRYPTION_KEY` が設定済みで、stored secret を暗号化できる。
- YouTube、Google Drive、Discord Bot token、notification channel は通常運用では service env に置かず、Control Panel で管理する。

## 1. Integration を登録する

`Integrations` 画面で、配信に必要な接続先を作成します。

### Google OAuth Provider

YouTube Live API と Google Drive OAuth upload を使う場合は、Google OAuth provider を作成します。

- Provider type: `google`
- Redirect URI: `https://control.example.com/integrations/oauth-accounts/callback`
- Scope:
  - Drive: `https://www.googleapis.com/auth/drive.file`
  - YouTube: `https://www.googleapis.com/auth/youtube`

OAuth client secret は write-only secret です。response、audit log、diagnostic report には raw 値を残しません。

### OAuth Connected Account

`Connect with OAuth` で、Drive / YouTube に使う Google account を connected account として登録します。Control Panel login 用 OAuth provider と、YouTube / Drive 用 connected account は分けて管理します。

### Drive Destination

`Archive Settings` または `Integrations` で Drive destination を作成します。

| 項目 | 推奨値 |
| --- | --- |
| Auth mode | `oauth2` |
| OAuth account | Drive scope を持つ Google connected account |
| Folder ID | `<DRIVE_FOLDER_ID>` |
| Base path | `AutoStream` |
| Shared drive | 共有ドライブの folder ID を使う場合は enabled |

共有ドライブを使う場合、Uploader は Drive API に `supportsAllDrives=true` を付けます。folder ID は secret 扱いで、UI には masked / fingerprint だけを表示します。

### YouTube Output

`YouTube Outputs` で出力先を作成します。

| Mode | 用途 |
| --- | --- |
| `live_api_dry_run` | YouTube API の lifecycle を mock し、外部配信なしで Control Panel の動作を確認する |
| `live_api` | Google OAuth account で broadcast / live stream を作成し、自動開始・停止する |
| `stream_key` | 既存 RTMPS URL と stream key を write-only secret として登録する互換 mode |

新規運用では `live_api_dry_run` で dry-run を通してから、`live_api` に切り替えます。`stream_key` mode を使う場合でも、stream key は Encoder/Recorder env ではなく Control Panel の write-only secret として保存します。

### Discord Bot Config

`Discord Settings` で、Bot token、guild、voice channel、text channel を登録します。

Discord Bot が複数台ある場合は、Bot service ごとに config を分けます。Bot service は自分に紐づく config だけを runtime config として取得できます。

## 2. Service を事前登録する

`Service Health` または `API Tokens` から、次の service を事前作成します。

- `discord_bot`
- `worker`
- `encoder_recorder`
- `observability`

service token は作成時に一度だけ表示します。保存する場合は password manager に入れ、docs、issue、chat、スクリーンショットには残しません。token を再発行した場合は、古い service runtime を再起動し、新 token を読み直してください。

複数台の Encoder/Recorder や Worker を登録できます。stream assignment では `primary` と `standby` を使い分けます。stream start で dispatch されるのは `primary` だけです。

## 3. Profile を作成する

`Encoder Profiles`、`Caption/STT Settings`、`Overlay Settings`、`Archive Settings` を作成します。

Encoder profile の例:

```json
{
  "width": 1920,
  "height": 1080,
  "fps": 60,
  "video_bitrate_kbps": 8000,
  "audio_bitrate_kbps": 160,
  "audio_sample_rate_hz": 48000,
  "keyframe_interval_sec": 2
}
```

Archive profile は Drive destination を参照します。Google credential file path や folder ID を service env に置く運用は互換 fallback としてだけ使います。

## 4. Stream job を作成する

`Streams` 画面で stream job を作成します。

設定する主な項目:

- Stream name
- Encoder profile
- Archive profile / Drive destination
- Discord Bot config
- YouTube output
- 必要に応じて stream-specific guild / voice channel / text channel override

作成直後の status は `created` です。

## 5. Stream に service を割り当てる

`Service Health` または `Streams` の assignment planner で、対象 stream に service を割り当てます。

必須 primary assignment:

- Discord Bot
- Worker
- Encoder/Recorder

任意 standby assignment:

- 予備 Encoder/Recorder
- 予備 Worker

standby service は failover 候補として表示しますが、MVP では自動起動しません。Drive folder ID、OAuth refresh token、YouTube stream key などの stream-scoped secret は primary assignment の service だけが解決できます。

## 6. Readiness を確認する

`Streams` 画面で `Check Readiness` を実行します。この操作は stream status を変更せず、service へ dispatch もしません。

主な確認項目:

- 必須 service が primary assignment 済み。
- assigned service が offline / stale ではない。
- service `public_url` が Control Panel から到達可能な HTTP(S) URL。
- `SERVICE_CALL_TOKEN` が設定済み。
- Discord audio bridge mode の場合、Discord Bot と Encoder/Recorder の audio forward 設定が有効。
- YouTube output が `live_api` / `live_api_dry_run` の場合、Google OAuth account に YouTube scope がある。
- Drive destination が `oauth2` の場合、Google OAuth account に Drive scope がある。

`ready=false` の場合は `issues` を解消してから Start します。

## 7. 配信を開始する

`Streams` 画面で `Start` を実行します。

Control Panel は次の順で処理します。

1. YouTube output が `live_api` の場合、YouTube broadcast / live stream を準備する。
2. RTMPS URL / stream key を短命 runtime secret として Encoder/Recorder へ渡す。
3. Discord Bot に job start を dispatch する。
4. Worker に job start を dispatch する。
5. Encoder/Recorder に stream start を dispatch する。
6. dispatch 結果を audit log と stream dispatch history に記録する。

service call は `Authorization: Bearer <SERVICE_CALL_TOKEN>` で行います。raw token は UI、logs、audit metadata に残しません。

## 8. Live 状態を確認する

`Dashboard`、`Streams`、`Monitoring Dashboard` で次を確認します。

- stream status が `live`。
- Discord Bot が voice connected。
- `discord.audio_receiving=1`。
- `discord.audio_forward_active=1`。
- Encoder/Recorder の audio bridge で packet が増える。
- Worker heartbeat が stale ではない。
- Worker event sidecar に overlay / caption / participant event が保存される。
- Encoder process が alive。
- `recorder.write_bitrate_kbps > 0`。
- `media.input_timeout_sec=0`。
- 重要な Observability incident が open になっていない。

Discord audio bridge mode では、Control Panel または Encoder/Recorder の audio status で `packets_total` と `last_packet_age_sec` を確認します。

## 9. 配信を停止する

`Streams` 画面で `Stop` を実行します。

Control Panel は次を行います。

1. Discord Bot / Worker / Encoder/Recorder に stop を dispatch する。
2. Encoder/Recorder が FFmpeg を停止する。
3. `tmp/{stream_id}/final.mkv` を `final/{stream_id}/final.mp4` へ remux する。
4. Google Drive API で archive directory を upload する。
5. YouTube output が `live_api` の場合、YouTube broadcast を complete する。
6. metadata、logs、Observability signal、audit log を更新する。

期待される archive:

```text
final.mp4
captions.vtt
transcript.json
metadata.json
logs.jsonl
```

upload に失敗した場合は `Retry Upload` を実行します。Control Panel は primary Encoder/Recorder の package API へ安全に dispatch します。

## よくある失敗

| 症状 | 確認 |
| --- | --- |
| `missing_stream_assignments` | Discord Bot / Worker / Encoder/Recorder の primary assignment を確認する |
| `stream_start_not_ready` | readiness の `issues`、service stale、public URL、OAuth scope を確認する |
| Encoder が開始しない | Encoder profile、FFmpeg binary、YouTube output、short-lived runtime secret を確認する |
| Discord 音声が届かない | VC 接続、Discord Bot config、audio forward capability、Encoder audio status を確認する |
| Worker event が届かない | Worker assignment、Encoder/Recorder URL、worker event token、sidecar を確認する |
| Google Drive upload が失敗 | Drive destination、OAuth account scope、shared drive flag、folder permission、`final.mp4` を確認する |
| YouTube 自動停止に失敗 | YouTube runtime metadata、OAuth account、broadcast ID、dispatch history を確認する |

詳細は [Troubleshooting](../troubleshooting/) と [失敗した配信の復旧](./recover-failed-stream.md) を参照してください。
