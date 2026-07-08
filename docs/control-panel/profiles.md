# プロファイル設定

プロファイルは、配信で使う設定の部品です。Streams 画面では、作成済みのプロファイルを選んで配信に紐づけます。

## プロファイルの種類

| 画面 | 役割 | 主に使うサービス |
| --- | --- | --- |
| Encoder Profiles | 画質、fps、bitrate、FFmpeg に渡す設定 | Encoder Recorder |
| Caption/STT Settings | 字幕、文字起こし、テロップ連携の設定 | Worker、Discord Bot、Encoder Recorder |
| Watermark Settings | 配信映像へ載せるロゴ画像、位置、不透明度の設定 | Encoder Recorder |
| Archive Settings | 録画保存、Google Drive upload、保持期間の設定 | Encoder Recorder |

## 共通の Profile Manager

Encoder Profiles、Caption/STT Settings、Watermark Settings、Archive Settings は、通常操作ではフォーム入力で作成します。一覧では JSON ではなく、解像度、字幕言語、ウォーターマーク画像、保存形式などの要約を確認します。

| 項目 | 使い方 |
| --- | --- |
| Name | 一覧や Streams で選びやすい名前を入れます |
| 設定項目 | 画面上の入力欄、選択肢、toggle で設定します |
| 設定内容 | 一覧で profile の主要値を要約表示します |
| Create | 新規作成します |
| Delete | 参照されていない profile を削除します |

内部的には profile config として保存されますが、日常運用では JSON を直接編集しません。

## Encoder Profiles

Encoder Profile は、Encoder Recorder が FFmpeg 処理を行う時の設定です。

主な入力項目です。

| 項目 | 意味 | 目安 |
| --- | --- | --- |
| 横解像度 / 縦解像度 | 出力サイズ | 1920x1080 または 1280x720 |
| フレームレート | 1秒あたりの frame 数 | 30 または 60 |
| 映像ビットレート | 映像 bitrate | 1080p60 なら 6000 以上を目安 |
| 音声ビットレート | 音声 bitrate | 128 から 192 を目安 |

## Caption/STT Settings

Caption/STT Settings は、字幕や文字起こしを使う場合に作ります。使わない場合は Streams で未選択のままで問題ありません。

| 項目 | 意味 |
| --- | --- |
| 言語 | 主な音声言語 |
| プロバイダ | STT provider または手動字幕 |
| 遅延補正 | 音声と字幕のずれを調整する ms |

字幕は配信に直接出るため、最初は test stream で確認してください。

## Watermark Settings

Watermark Settings は、配信映像に合成するロゴ画像と表示ルールを管理します。字幕やDiscord chatの描画は、この設定ではなく映像生成側の処理として扱います。

| 項目 | 意味 |
| --- | --- |
| 画像 | PNG / JPEG / WebP のウォーターマーク画像 |
| 表示位置 | watermark の表示位置 |
| 不透明度 | watermark の濃さ |
| 幅 | 画面幅に対する watermark の大きさ |

watermark は配信画面に出るため、画像が切れていないか、背景と重なって読みにくくないかを preview と test stream で確認します。

## Archive Settings

Archive Settings は互換用の録画 profile です。標準運用では Streams の配信枠作成時に、ローカル保持日数、OAuth account、Drive Folder ID、共有ドライブID、保存ファイル名を指定します。

| 項目 | 説明 | 推奨 |
| --- | --- | --- |
| Name | profile 名 | `Main Archive`、`Dry Run Archive` など |
| 録画形式 | MP4 / MKV | 通常は MP4 |
| Retention days | ローカル録画の保持日数 | disk 容量に合わせる |
| Drive destination | 互換profileで使う保存先 | 新規運用では Streams 側の保存先設定を優先 |
| Upload final archive | upload を有効にするか | 本番保存するなら on |

## Archive Settings の作成手順

1. 標準運用では Streams で配信枠を作る時にローカル保持日数、Archive OAuth account、Drive Folder ID を入力します。
2. 互換profileが必要な場合だけ Archive Settings を開きます。
3. `Name`、録画形式、保持日数、Drive destination、upload有無を入力します。
4. テスト配信で録画と upload の流れを確認します。

## Streamsでの選び方

| 配信タイプ | Encoder Profile | Archive Profile | Caption / Watermark |
| --- | --- | --- | --- |
| 短いテスト | 軽めの 720p profile | dry-run archive | 必要なら最小構成 |
| 通常配信 | 本番画質 profile | 本番 archive | 本番 watermark / caption |
| 録画だけ重視 | bitrate を安定重視 | upload enabled | watermark は必要に応じて |
| 外部映像入力 | 入力に合わせた fps / bitrate | 本番 archive | 文字が映像に重ならない設定 |

## 削除するときの注意

削除前に Streams で使っていないか確認してください。Control Panel は、配信枠が参照しているエンコーダープロファイル、字幕プロファイル、ウォーターマーク設定、録画プロファイル、Discord BOT設定、YouTube出力の削除を拒否します。

削除したい場合は、先に Streams で対象配信枠を別の設定へ変更するか、未選択に戻します。削除エラーには raw secret や token は表示されず、参照中であることだけが表示されます。
