# Archive Flow

AutoStream は live 中に `final.mkv` を安全に録画し、配信停止後に `final.mp4` へ remux して Google Drive API へ upload します。live 中に MP4 だけへ直接録画する運用は標準にしません。

## Local Layout

```text
/var/lib/autostream/archives/
  tmp/
    {stream_id}/
      final.mkv
      captions.vtt
      transcript.json
      metadata.json
      logs.jsonl
  final/
    {stream_id}/
      final.mp4
      captions.vtt
      transcript.json
      metadata.json
      logs.jsonl
```

`tmp/` は live 中と package 中に使います。package が成功したら `final/` に成果物を集約します。

## Stream 中

Encoder/Recorder は FFmpeg を引数配列で起動し、MKV 録画と live output を同時に行います。本番では FFmpeg の出力先は `rtmp://127.0.0.1/autostream/{stream_id}` のような loopback relay URL です。YouTube RTMPS URL と stream key は FFmpeg argv に出しません。

主要成果物:

- `final.mkv`
- `logs.jsonl`
- `captions.vtt`
- `transcript.json`
- `metadata.json`

## Stop 後の Package

配信停止後は次の順に処理します。

1. `final.mkv` の存在確認
2. FFmpeg remux による `final.mp4` 作成
3. `logs.jsonl`、`captions.vtt`、`transcript.json` の `final/` へのコピー
4. `metadata.json` 作成
5. archive files upload
6. Drive folder / file ID の fingerprint と file count を `metadata.json` に追記
7. Control Panel の `POST /services/stream-artifacts` に成果物を報告

`metadata.json` に FFmpeg command を保存する場合、stream key は `<REDACTED>` に置換します。本番構成ではそもそも FFmpeg argv に stream key を渡しません。

Control Panel artifact report へ報告するのは `kind`、`name`、`relative_path`、`size_bytes` などの論理情報だけです。host の絶対path、Drive raw file ID、Drive raw folder ID は送信しません。

## Google Drive

新規運用では Drive destination を Control Panel で管理します。Encoder/Recorder の env に `GOOGLE_DRIVE_FOLDER_ID` や OAuth refresh token を置かず、stream job の `archive_config` と runtime secret API で解決します。

Service Account mode を使う場合は、対象 Drive folder を Service Account の `client_email` に共有してください。OAuth destination と共有ドライブを使う場合は、Drive destination で `shared_drive=true` を設定し、uploader は `supportsAllDrives=true` を使います。

## Retry

upload 失敗時は Control Panel の `Streams` から `retry-upload` を実行します。Control Panel は割当済み primary Encoder/Recorder の `POST /streams/package` を呼び、既存 source file を使って再 package / upload します。

retry 時も stream に保存された archive profile と Drive destination を使います。Drive folder ID、OAuth client secret、refresh token は runtime secret reference として Encoder/Recorder へ渡します。

retry が成功した場合も artifact report を再送し、同じ stream、kind、name の既存情報を更新します。`metadata.json` には `upload.attempts`、`folder_id_fingerprint`、`file_count`、`file_fingerprints` を残し、raw Drive folder/file ID は残しません。

実 upload 前には次を実行して、archive directory、credential shape、folder設定、外部接続に必要な前提を secret-safe に確認します。

```powershell
Control Panel readiness and archive write probe
```

This check verifies archive root, write permission, runtime config, Drive destination configured state, and secret-safe status.

## 失敗時の確認

- `archive.package.failed` incident が出ていないか。
- `recorder.disk_free_bytes` が不足していないか。
- `tmp/{stream_id}/final.mkv` が存在するか。
- `final/{stream_id}/final.mp4` が作成されているか。
- Drive destination が configured になっているか。
- Service Account mode なら folder が Service Account email に共有されているか。
- OAuth / shared drive mode なら connected account、scope、`shared_drive=true` が正しいか。
