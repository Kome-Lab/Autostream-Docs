# プロファイル設定

プロファイルは、配信で使う設定の部品です。Streams 画面では、作成済みのプロファイルを選んで配信に紐づけます。

## プロファイルの種類

| 画面 | 役割 | 主に使うサービス |
| --- | --- | --- |
| Encoder Profiles | 画質、fps、bitrate、FFmpeg に渡す設定 | Encoder Recorder |
| Caption/STT Settings | 字幕、文字起こし、テロップ連携の設定 | Worker、Discord Bot、Encoder Recorder |
| Overlay Settings | 画面表示、参加者表示、イベント表示の設定 | Worker、Encoder Recorder |
| Archive Settings | 録画保存、Google Drive upload、保持期間の設定 | Encoder Recorder |

## 共通の Profile Manager

Encoder Profiles、Caption/STT Settings、Overlay Settings は共通の編集形式です。

| 項目 | 使い方 |
| --- | --- |
| Name | 一覧や Streams で選びやすい名前を入れます |
| Existing record | 編集したい既存 profile を選びます。空欄なら新規作成です |
| Config JSON | profile の詳細設定を JSON object で入れます |
| Create / Update | 新規作成または更新します |
| Delete | 選択中 profile を削除します |

`Config JSON` は必ず JSON object にします。配列、文字列、コメント付き JSON は保存できません。

## Encoder Profiles

Encoder Profile は、Encoder Recorder が FFmpeg 処理を行う時の設定です。

よく入れる項目の例です。

| 項目 | 意味 | 目安 |
| --- | --- | --- |
| `width` | 出力横幅 | 1920 または 1280 |
| `height` | 出力縦幅 | 1080 または 720 |
| `fps` | フレームレート | 30 または 60 |
| `video_bitrate_kbps` | 映像 bitrate | 1080p60 なら 6000 以上を目安 |
| `audio_bitrate_kbps` | 音声 bitrate | 128 から 192 を目安 |
| `preset` | FFmpeg encoder preset | host 負荷に合わせます |

例:

```json
{
  "width": 1920,
  "height": 1080,
  "fps": 60,
  "video_bitrate_kbps": 7800,
  "audio_bitrate_kbps": 160,
  "preset": "veryfast"
}
```

## Caption/STT Settings

Caption/STT Settings は、字幕や文字起こしを使う場合に作ります。使わない場合は Streams で未選択のままで問題ありません。

| 項目例 | 意味 |
| --- | --- |
| `enabled` | 字幕処理を有効にするか |
| `language` | 主な音声言語 |
| `display_mode` | overlay に出すか、ログだけにするか |
| `max_line_chars` | 1 行あたりの文字数目安 |
| `speaker_label` | 話者名表示を使うか |

字幕は配信に直接出るため、最初は test stream で確認してください。

## Overlay Settings

Overlay Settings は、Worker が作る表示イベントや Encoder Recorder 側の描画に渡す設定です。

| 項目例 | 意味 |
| --- | --- |
| `layout` | 表示レイアウトの名前 |
| `show_clock` | 時刻表示 |
| `show_participants` | 参加者表示 |
| `theme` | overlay theme |
| `safe_area` | 端に寄りすぎないための余白 |

overlay は配信画面に出るため、文字が切れていないか、背景と重なって読みにくくないかを test stream で確認します。

## Archive Settings

Archive Settings は専用フォームがあります。JSON だけではなく、よく使う項目が入力欄になっています。

| 項目 | 説明 | 推奨 |
| --- | --- | --- |
| Existing record | 編集対象 | 既存を編集する時だけ選びます |
| Name | profile 名 | `Main Archive`、`Dry Run Archive` など |
| Drive destination | Integrations で作った保存先 | Google Drive upload するなら選択 |
| Base path | 保存先のベースフォルダ名 | `AutoStream` など |
| Service Account credential secret | service account 方式で使う credentials secret 名 | OAuth 方式なら空欄 |
| Upload retry max | upload retry 回数 | 3 から 5 を目安 |
| Retention days | ローカル録画の保持日数 | disk 容量に合わせる |
| Upload final archive | upload を有効にするか | 本番保存するなら on |
| Dry-run upload until external verification is approved | upload を本番実行せず検証扱いにするか | 初回は on、確認後に off |
| Advanced JSON | 追加の設定 | 必要な時だけ |

## Archive Settings の作成手順

1. 先に [OAuthとDrive保存先](/control-panel/integrations-drive) で Drive destination を作ります。
2. Archive Settings を開きます。
3. `Name` に分かりやすい名前を入れます。
4. Google Drive に保存する場合は `Drive destination` を選びます。
5. `Base path` を決めます。
6. 初回は `Dry-run upload` を on にして保存します。
7. テスト配信で録画と upload の流れを確認します。
8. 本番保存してよい状態になったら `Dry-run upload` を off にします。

## Streamsでの選び方

| 配信タイプ | Encoder Profile | Archive Profile | Caption / Overlay |
| --- | --- | --- | --- |
| 短いテスト | 軽めの 720p profile | dry-run archive | 必要なら最小構成 |
| 通常配信 | 本番画質 profile | 本番 archive | 本番 overlay / caption |
| 録画だけ重視 | bitrate を安定重視 | upload enabled | overlay は必要に応じて |
| 外部映像入力 | 入力に合わせた fps / bitrate | 本番 archive | 文字が映像に重ならない設定 |

## 削除するときの注意

削除前に Streams で使っていないか確認してください。使っている profile を削除すると、次の開始前チェックや配信開始で不足として扱われます。
