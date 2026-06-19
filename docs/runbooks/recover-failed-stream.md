# 失敗した配信の復旧

この Runbook は、配信開始、ライブ中、停止、archive package、Google Drive upload のどこかで失敗した場合に、証跡を残しながら復旧するための手順です。

## 最初に守ること

- `tmp/{stream_id}` と `final/{stream_id}` のファイルを削除しない。
- `final.mkv` が残っている場合は、先に保全してから remux / package を再実行する。
- live 中の配信停止、YouTube broadcast の作り直し、credential rotation は原因切り分け前に実行しない。
- Slack / Discord / チケットにログを貼る場合は、stream key、service token、webhook URL、認証情報付き URL を必ず mask する。

## 1. Control Panel で状態を確認する

Control Panel の `Streams` で対象 stream を選び、`Stream Operations` を確認します。

| 項目 | 確認内容 |
| --- | --- |
| Stream | status が `starting` / `live` / `stopping` / `failed` のどれか |
| Service assignment | Discord Bot、Worker、Encoder/Recorder が割り当て済みか |
| Start preflight | public URL、offline、stale heartbeat、Discord audio capability |
| Discord audio | Bot が VC audio を受信し、Encoder/Recorder へ forward しているか |
| Encoder audio bridge | Encoder/Recorder が Discord packet を受け取っているか |
| Worker events | Worker event が archive sidecar に保存されているか |
| Archive / upload | package、`final.mp4`、Google Drive upload、retry count |
| Last dispatch | start / stop / retry-upload の service 別結果 |

同じ画面の `Stream incident / remediation` では、対象 stream に紐づく active incident と remediation action を確認できます。

`Audit Logs` では、誰が `streams.start`、`streams.stop`、`streams.retry_upload`、`remediation.approve`、`remediation.execute` を実行したか確認します。

## 2. Observability で診断を見る

`Incidents` と `Diagnostics` を確認し、次の rule が発火していないか見ます。

- heartbeat timeout
- encoder process exited during live stream
- RTMPS reconnect loop
- audio silence
- recorder not writing
- disk low
- Google Drive upload failed
- stream start timeout
- stream stop timeout
- unexpected stopped
- Discord audio forward inactive / stale

診断レポートでは、`summary`、`likely cause`、`evidence`、`recommended actions` を優先して読みます。`safe_auto_remediation_candidates` に出ている操作だけが自動実行候補です。

## 3. status 別の確認ポイント

| status | 優先確認 |
| --- | --- |
| `starting` | service assignment、`SERVICE_CALL_TOKEN`、各 service の `SERVICE_CONTROL_TOKEN_SHA256`、public URL、firewall / reverse proxy |
| `live` | Encoder/Recorder の process alive、RTMPS reconnect、recorder write bitrate、disk free、Discord audio bridge、Worker event path |
| `stopping` | FFmpeg stop 完了、`final.mkv` の存在、remux log、archive directory の write permission |
| `failed` | 直近 incident、`logs.jsonl`、`metadata.json`、Control Panel の dispatch error |

## 4. Encoder/Recorder host で archive を確認する

Direct host の標準パスは次の通りです。

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

`tmp/{stream_id}/final.mkv` が存在し、サイズが増えていた場合は、source file が intact である可能性があります。破損が疑われる場合でも削除せず、コピーを保全します。

## 5. package / upload を再実行する

`final.mkv` または `final.mp4` が残っている場合は、Control Panel の `Streams` で `Retry Upload` を実行します。

Control Panel は対象 stream に割り当て済みの Encoder/Recorder の `POST /streams/package` へ dispatch し、次の流れを再実行します。

```text
final.mkv
  -> final.mp4
  -> metadata.json update
  -> Google Drive upload
```

`encoder_recorder` が未割り当ての場合は `409 missing_stream_assignments` になります。`Service Health` で Encoder/Recorder を割り当ててから再実行します。

`final/{stream_id}/final.mp4` が既に存在し、Google Drive upload だけが失敗している場合も `Retry Upload` を使います。成功後は `metadata.json` に Drive folder/file ID の fingerprint と file count が記録されていることを確認します。raw Drive ID は残しません。

## 6. Remediation の扱い

Remediation action は incident と diagnostic report から生成されます。

| 種別 | 操作 |
| --- | --- |
| safe auto candidate | Google Drive upload retry、service status refresh、diagnostics rerun、source file が intact な場合の package / remux retry |
| manual approval | Discord Bot restart、Encoder/Recorder restart、Worker restart、Discord voice reconnect、RTMPS output restart、別 Encoder/Recorder への再割り当て |
| never auto | archive delete、credential rotation、role 変更、live stream stop、YouTube broadcast recreate、service token revoke |

`manual approval` が必要な操作は、live stream への影響と rollback を確認してから承認します。

Control Panel から remediation を実行する場合、Observability は Control Panel の service-token endpoint を呼びます。Control Panel は stream assignment を確認し、割り当て済み service にだけ dispatch します。

## 7. 復旧後の確認

- Stream status が `completed` または期待する状態になっている。
- `final.mp4` が final archive directory に存在する。
- Google Drive の `AutoStream/{stream_name}/{started_at_jst}_{stream_id}/` に expected files がある。
- `metadata.json` に archive path、Drive ID fingerprint、file count が残っている。
- Observability incident が `resolved` または `mitigated` になっている。
- Audit Logs に retry / remediation 操作が記録されている。
- raw secret、stream key、webhook URL、認証情報付き URL が logs や diagnostic に出ていない。
