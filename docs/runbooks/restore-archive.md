# アーカイブ復元

Archive restore は Google Drive 側の欠損、metadata 破損、または operator の再 upload 要求に対応する手順です。復元作業でも raw Drive folder/file ID や credential を evidence に残しません。

## Archive layout

ローカル archive は次の構造を前提にします。

```text
/var/lib/autostream/archives/final/{stream_id}/
  final.mkv
  final.mp4
  captions.vtt
  transcript.json
  metadata.json
  logs.jsonl
```

`final.mkv` は録画の一次 artifact、`final.mp4` は配布/upload 向け remux artifact です。`metadata.json` には stream ID、duration、byte size、upload attempts、fingerprint を保存できますが、raw Drive ID や credential は含めません。

## 復元手順

1. Control Panel で対象 stream の archive status と assigned Encoder/Recorder を確認します。
2. Encoder/Recorder host で archive directory の存在、owner、read permission を確認します。
3. `final.mkv` と `final.mp4` の byte size が 0 より大きいことを確認します。
4. `final.mp4` がない場合は remux を再実行します。
5. Drive destination が有効なら retry upload を実行します。
6. upload result の file count、attempt count、fingerprint を Control Panel / Observability / evidence に記録します。

復元は Control Panel の stream record と Encoder/Recorder の archive artifact を突き合わせてから実行します。別 stream の archive directory を手動で流用したり、Drive 側の folder ID だけを見て upload 済みと判断したりしません。Control Panel の archive profile、Drive destination、runtime config distribution が現在の stream と一致していることを確認してから retry upload へ進みます。

## 失敗時

`archive_input_unavailable` は source artifact の欠損、`package_failed` は remux または sidecar 作成失敗、upload failure は OAuth/Service Account permission、shared drive、folder ID、quota を確認します。Drive folder/file ID は operator の local shell で扱い、共有する証跡では `sha256:<FINGERPRINT>` に変換します。

## 復元後の確認

復元後は Control Panel の artifact 一覧、Observability の upload signal、Drive 側の file count を同じ stream ID で突き合わせます。`final.mp4` を再生成した場合は remux duration と byte size を更新し、古い fingerprint と新しい fingerprint が混在しないように metadata を再生成します。復元作業を evidence に残す場合も host absolute path は避け、logical relative path と fingerprint だけを使います。

復元後の external completion を pass に戻す場合は、新しい provider verification record または復元専用 evidence を作ります。古い Drive proof や古い `observed_at` を再利用せず、upload attempt、per-file fingerprint、metadata fingerprint、Control Panel audit ID、operator approval を同じ stream ID で記録します。

## rollback と再実行

復元に失敗した場合は、Drive 側だけを再試行する前に archive source、remux artifact、metadata、runtime Drive destination を分けて確認します。`final.mkv` が破損している場合は再 upload では直らず、録画 source の欠損として扱います。`final.mp4` だけが欠けている場合は remux を再実行し、Drive upload だけが失敗している場合は OAuth account、shared drive permission、quota、folder fingerprint を確認します。どの再実行でも raw file ID や credential は docs に残しません。
