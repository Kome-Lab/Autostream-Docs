# YouTube RTMPS

AutoStream の YouTube 出力は Control Panel の YouTube Output で管理します。通常の本番運用では `YOUTUBE_RTMP_URL` や `YOUTUBE_STREAM_KEY` を Encoder/Recorder の環境変数へ直接置きません。

## 出力モード

| mode | 用途 |
| --- | --- |
| `stream_key` | 既存の YouTube stream key を Control Panel に暗号化保存して使う互換 mode。 |
| `live_api_dry_run` | YouTube Live API の作成/停止を mock する検証 mode。実際の broadcast は作成しません。 |
| `live_api` | Google OAuth connected account を使い、YouTube broadcast / live stream を自動作成して開始/停止する mode。 |

## RTMPS 要件

Encoder/Recorder へ渡す YouTube ingest URL は `rtmps://` のみです。`rtmp://` は downgrade とみなし、Control Panel の作成 API と stream start runtime の両方で拒否します。

YouTube Live API mode では Control Panel が YouTube API から返る `rtmpsIngestionAddress` を使います。RTMPS ingest URL が返らない場合、通常の `ingestionAddress` へ fallback せず start を失敗させます。

## Stream Key Mode

```json
{
  "name": "Main existing key",
  "mode": "stream_key",
  "rtmp_url": "rtmps://a.rtmps.youtube.com/live2",
  "stream_key": "<YOUTUBE_STREAM_KEY>"
}
```

`stream_key` は encrypted secret として保存されます。UI/API は `stream_key_configured` と `stream_key_fingerprint` だけを返し、raw key は返しません。開始時も Encoder/Recorder には raw key ではなく `stream_key_secret_name` を渡します。

## Live API Mode

`live_api` と `live_api_dry_run` は Control Panel の Integration Registry に登録した Google OAuth provider と OAuth account を使います。YouTube upload / Live API 用 account と Control Panel login 用 OAuth provider は分けて管理します。

```json
{
  "name": "Main Live API",
  "mode": "live_api",
  "oauth_account_id": "oauth-account-01",
  "privacy_status": "private",
  "latency_preference": "low",
  "enable_auto_start": true,
  "enable_auto_stop": true,
  "complete_on_stop": true,
  "broadcast_title_template": "{{stream_name}}",
  "broadcast_description": "AutoStream managed broadcast"
}
```

`enable_auto_start` と `enable_auto_stop` は YouTube broadcast の `contentDetails` に渡します。通常 stop 時に YouTube broadcast を complete するかどうかは `complete_on_stop` で制御します。省略時は `true` です。

## Start Flow

1. Control Panel が stream assignment と readiness を確認します。
2. `live_api` の場合、Google OAuth account の refresh token と provider client secret を server-side で解決します。
3. YouTube Live API で broadcast / live stream を作成し、RTMPS URL と runtime stream key を取得します。
4. RTMPS URL が `rtmps://` でない場合、start を失敗させます。
5. runtime stream key は短命 secret として保存し、Encoder/Recorder へは `stream_key_secret_name` だけを dispatch します。
6. Control Panel は `stream_youtube_runtimes` に broadcast ID / live stream ID / `rtmp_url` / `complete_on_stop` / runtime secret reference を保存します。runtime config 再取得や recovery では `rtmp_url` と `stream_key_secret_name` を返し、raw stream key は返しません。

start dispatch が失敗した場合、Control Panel は作成済み YouTube runtime の complete を試みます。これも失敗した場合は runtime を保持し、backoff 付きの自動 retry 対象にします。手動では `POST /streams/{id}/youtube/complete` で complete だけを再実行できます。

## Stop Flow

1. Control Panel が primary Discord Bot、Worker、Encoder/Recorder へ stop を dispatch します。
2. dispatch 成功後、YouTube runtime が `live_api` かつ `complete_on_stop=true` の場合、YouTube Live API で broadcast を complete します。
3. `complete_on_stop=false` の場合、通常 stop では YouTube complete を呼ばず、runtime だけを削除します。
4. Encoder/Recorder は `final.mkv -> final.mp4 -> archive upload` を進めます。

YouTube complete が失敗した場合、stream は `failed` になり runtime は削除されません。Control Panel は `complete_retry_count`、`complete_next_retry_at`、`complete_last_error` を保存し、background retry loop で due runtime を再試行します。原因を直した後、次の API で complete だけを手動再実行できます。

```http
POST /streams/{id}/youtube/complete
```

この API は manual retry なので `complete_on_stop=false` の runtime でも YouTube complete を強制実行します。raw OAuth token や stream key は返しません。

retry loop の既定 interval は 60 秒です。必要に応じて Control Panel の runtime env で変更できます。

```text
AUTOSTREAM_YOUTUBE_COMPLETE_RETRY_INTERVAL=60s
```

## Secret Handling

- stream key、OAuth refresh token、OAuth client secret は raw 値で返しません。
- audit metadata には mode、output ID、OAuth account ID、broadcast ID など運用に必要な非 secret 情報だけを残します。
- Encoder/Recorder logs に stream key を出してはいけません。
- docs、issue、screenshots には `<YOUTUBE_STREAM_KEY>` などの placeholder だけを使います。

## Env Fallback

古い検証や単体起動では次の fallback を使えます。

```text
YOUTUBE_RTMP_URL=rtmps://a.rtmps.youtube.com/live2
YOUTUBE_STREAM_KEY=<YOUTUBE_STREAM_KEY>
```

production では YouTube Output を Control Panel で作成し、stream ごとに割り当てます。fallback でも `rtmp://` は使えません。
