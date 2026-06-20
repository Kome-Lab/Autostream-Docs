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

## 推奨手順

1. まず local archive directory を作ります。
2. Encoder Recorder が書き込める権限にします。
3. 短い配信で `final.mkv` が作られるか確認します。
4. 停止後に `final.mp4` が作られるか確認します。
5. その後で Google Drive destination を追加します。
6. upload 成功後、Control Panel と Observability で結果を確認します。

## ディスク容量

録画は想定より大きくなることがあります。長時間配信の前には、空き容量と古い録画の整理ルールを確認してください。

## 失敗時の切り分け

- MKV がない: 配信開始または FFmpeg を確認します。
- MP4 がない: remux 処理を確認します。
- upload だけ失敗: Drive 認証、folder、ネットワークを確認します。
- 容量不足: archive directory と一時ディレクトリを確認します。
