# 録画と保存先の設定

録画と保存先は、配信後に必ず確認する重要な設定です。まず local に録画できることを確認し、その後で Google Drive など外部保存先を追加してください。

## 設定するもの

| 項目 | 説明 |
| --- | --- |
| `AUTOSTREAM_ARCHIVE_DIR` | 録画ファイルを置く場所 |
| archive profile | 保存形式や保存先の指定 |
| Drive destination | Google Drive など外部保存先 |
| upload retry | upload 失敗時の再試行 |
| retention | 古い録画をどのくらい残すか |
| local archive管理 | Control Panel からの download、rename、delete |

## 推奨手順

1. まず local archive directory を作ります。
2. Encoder Recorder が書き込める権限にします。
3. 短い配信で `final.mkv` が作られるか確認します。
4. 停止後に `final.mp4` が作られるか確認します。
5. その後で Google Drive destination を追加します。
6. upload 成功後、Control Panel と Observability で結果を確認します。
7. Control Panel の Archive で local artifact を download、rename、delete できるか確認します。

## Control Panel からの local archive管理

Encoder Recorder は `AUTOSTREAM_ARCHIVE_DIR/final/<stream_id>/` に final artifact を保持します。Control Panel の Archive では、対象配信枠の local artifact を選んで download、rename、delete できます。

rename は安全な basename のみ許可されます。`/`、`\`、`..` を含む名前、archive root 外を指す path、symlink、想定外の拡張子は拒否されます。運用上の対象は `.mp4`、`.mkv`、`.json`、`.jsonl`、`.vtt` です。

Streamsで選択した録画プロファイルの `retention_days` は Encoder Recorder へ配布されます。Encoder Recorder は package 完了後、現在処理中の配信枠を除き、`AUTOSTREAM_ARCHIVE_DIR/final/<stream_id>/` 配下の安全な stream ID ディレクトリだけを対象に期限切れ artifact を整理します。

## ディスク容量

録画は想定より大きくなることがあります。長時間配信の前には、空き容量と古い録画の整理ルールを確認してください。

Google Drive へ upload 済みでも、retention 期間中は Encoder Recorder の local archive に残る場合があります。disk 容量が厳しい場合は、Archive 画面から不要な local artifact を削除するか、録画プロファイルの保持日数を短くしてください。

## 失敗時の切り分け

- MKV がない: 配信開始または FFmpeg を確認します。
- MP4 がない: remux 処理を確認します。
- upload だけ失敗: Drive 認証、folder、ネットワークを確認します。
- 容量不足: archive directory と一時ディレクトリを確認します。
- download / rename / delete が失敗: 対象 stream の primary encoder、service token、artifact の存在、ファイル名の安全性を確認します。
