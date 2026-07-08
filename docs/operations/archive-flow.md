# 録画と保存

配信を停止したあと、録画ファイルが作られ、必要に応じて保存先へ送られるまでの確認手順です。

## 配信前に確認すること

- 録画を有効にしている
- 保存先ディレクトリに書き込みできる
- サーバーの空き容量が十分にある
- Google Drive など外部保存先を使う場合、認証情報が登録されている
- ファイル名に日付や配信名が入る設定になっている

## 配信後の確認手順

1. Control Panel で配信状態が stopped になっていることを確認します。
2. 録画一覧、または保存先ディレクトリを開きます。
3. 録画ファイルのサイズが 0 ではないことを確認します。
4. 短く再生して、映像と音声が入っているか確認します。
5. 外部保存先を使う場合は、アップロード完了の表示を確認します。
6. 必要に応じて Control Panel の Archive から local artifact を download、rename、delete します。
7. 失敗している場合は、保存先の容量、権限、認証を確認します。

## local archive管理

Archive 画面では、配信枠を選ぶと Encoder Recorder に残っている artifact を確認できます。download は primary encoder から Control Panel 経由で取得し、rename と delete は対象 stream の `final/<stream_id>/` 配下に限定されます。

ファイル名は `.mp4`、`.mkv`、`.json`、`.jsonl`、`.vtt` の安全な basename にしてください。path 区切り、`..`、symlink、archive root 外を指す操作は拒否されます。

Streamsで設定したローカル保持日数を過ぎた artifact は、Encoder Recorder の package 完了後に整理されます。現在処理中の配信枠は cleanup 対象から除外されるため、進行中の録画を保持期間だけで削除することはありません。

## よくある問題

- 録画がない: 録画設定と Encoder Recorder の状態を確認します。
- ファイルが小さい: 配信がすぐ止まっていないか確認します。
- アップロードできない: 保存先の認証、容量、ネットワークを確認します。
- Archive 画面で操作できない: primary encoder の割り当て、service token、local artifact の残存、権限を確認します。

録画が作られない場合は [状態を確認する](/operations/monitoring) も確認してください。
