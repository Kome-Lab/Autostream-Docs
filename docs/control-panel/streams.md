# 配信画面

Streams は、配信を作成し、設定を選び、サービスを割り当て、開始・停止する画面です。AutoStream の日常運用で一番よく使います。

## 画面の役割

Streams では、次の作業を行います。

- 新しい配信を作る
- 既存配信を選ぶ
- Discord、YouTube、Encoder、録画プロファイルなどの設定を配信に紐づける
- Discord guild / voice channel / chat channel を配信ごとに指定する
- 配信枠を待機状態にし、Discord VC参加を開始条件にする
- 必要サービスを primary / standby として割り当てる
- 開始前チェックを実行する
- Start、Stop、Retry Upload、Retry YouTube Complete を実行する
- 配信中のEncoder出力を画面内またはVLCなどで確認する
- 音声、Worker event、録画、upload の状態を見る

## 配信を新規作成する

一覧の`配信枠を作成`を押すと、画面全体を使う作成画面が開きます。入力途中で`戻る / キャンセル`や別画面への移動を選ぶと、未保存の変更を破棄するか確認します。入力エラーを解消して保存すると一覧へ戻るので、追加された待機枠を確認してください。

1. `配信枠名` に番組名や案件名を入れます。
2. Discord VC参加で自動開始する場合は、`Discord VC参加で自動開始` をONにし、`Discord BOT設定`と既存のDiscord配信先を指定します。
3. `YouTube出力`、エンコード設定、必要な映像・音声設定を選びます。
4. 録画する場合は、先に[録画・アーカイブ](/control-panel/page-usage#archive-settings)で保存先、録画形式、保持日数を準備し、作成フォームでは`録画プロファイル`を選びます。録画しない場合は`録画しない`を選びます。
5. 必要なら`YouTube開始予定`の`開始予定（任意）`をブラウザのタイムゾーンで入力します。空欄なら、配信開始時にYouTubeの枠をすぐ開始します。日時を指定した場合だけYouTubeの予定配信になります。
6. 作成画面で`担当Worker Node`と`担当Encoder Node`を明示的に選択します。両方の選択が必要です。
7. 不足項目と選択したNodeを確認して`配信枠を作成`を押し、一覧に待機状態の枠が追加されたことから作成成功を確認します。
8. 対象枠の実際のprimary assignment、service readiness、開始条件を確認し、`Check Readiness`（`開始準備を再確認`）を実行します。
9. 開始前の不足を解消してから、手動の`Start`または既存のDiscord VC参加トリガーによる開始へ進みます。

標準作成フォームでは担当Worker Nodeと担当Encoder Nodeの両方が必須です。未選択のNodeを自動選択しません。選択したNodeについて配信枠とprimary assignmentをまとめて保存し、他枠で使用中のNodeを勝手に移しません。Discord BOT設定を指定した場合は、選択済みBotも同じ保存処理でprimaryに割り当てます。作成には`streams.create`に加え、Encoderの`services.assign`とWorkerの`workers.assign`が必要です。作成成功だけで開始可能とは判断しません。割当権限がない場合は、権限のある管理者・担当者へ依頼してください。

YouTube予定とAutoStreamの開始トリガーは別です。予定時刻だけでAutoStreamのStartを自動実行する機能ではありません。既存の予定を空欄にして保存すると、次回の配信開始時はYouTube枠を即時開始します。

配信名は、あとから監査ログや通知にも出ます。日付だけではなく、用途が分かる名前にしておくと後で探しやすくなります。

### 作成エラーと結果確認 {#create-errors}

作成に必要な入力が不足している場合は、フォーム先頭の要約と該当項目の案内を確認します。要約から該当セクションへ移動できます。配信枠名は1〜255文字で入力してください。入力中の名前、選択した設定、処理済みの画像候補は、エラー後も保持します。

| 案内の分類 | 確認するもの | 次の操作 |
| --- | --- | --- |
| 必須項目・形式の不備 | 配信枠名、予定日時、担当Encoder・Worker、画像の設定 | 指摘された欄を修正し、改めて保存します |
| 担当NodeやBotの割当競合 | 選択したNode・Botが別の配信枠で使われていないか | 最新の割当を確認します。使用中のNodeを自動移管しません |
| 設定やプリセットの変更 | 選択した認証設定、配信先、各プロファイルや画像プリセット | 最新の内容を確認し、必要な選択をやり直します |
| 画像の処理待ち | 各画像カードの処理段階 | 処理完了を待ちます。変換中の画像を保存済み候補として扱いません |
| アップロードの期限・所有先に関する拒否 | 画像の結果確認と、既に保存した枠の有無 | 表示された案内に従います。結果不明の画像を重ねてアップロードしません |
| 保存結果が不明 | 配信枠一覧、対象枠の設定・担当Node、監査ログ | 作成を再送せず、結果を照合します |

結果不明の表示は「作成されなかった」という意味ではありません。一覧を確認する前の再作成や、応答がないままの連打は避けてください。同じ名前の枠が見つかった場合も、対象の設定と担当Nodeまで確認します。画面に診断用のエラー分類コードが表示された場合は、操作時刻とともに運用担当者へ伝えます。Token、Cookie、秘密入力の内容は共有しません。

編集中の定期更新と、保存直前の確認については[共通操作](/control-panel/page-usage#editing-and-save)を参照してください。

APIで競合確認付きの配信設定更新を行う場合は、Drive保存先と録画プロファイルをそれぞれの編集開始時点の値で更新し、その後、配信枠が参照するプロファイルを更新します。`expected_settings_revision` と旧方式の録画設定直接生成を一度の要求で送ると、変更前に `stream_settings_archive_revision_unsupported` で拒否されます。既存の直接生成APIをrevisionなしで使う場合の動作は維持されます。通常の作成・編集フォームは、準備済みの録画プロファイルを選択します。

## 配信設定の項目

| 項目 | 入れるもの | 空欄にした場合 | よくある使い方 |
| --- | --- | --- | --- |
| 配信枠名 | 番組名、案件名、イベント名 | 作成できません | Streams、通知、監査ログで探しやすい名前にします |
| Discord Config | Discord Bot 設定 | Discord 連携なし、または開始前チェックで不足になります | 通常は必須です |
| Discord Guild ID | Bot が入る Discord server の ID | Discord 音声なし、または readiness 不足 | 配信枠ごとに必ず指定します |
| VC Channel ID | Bot が参加する voice channel の ID | Discord 音声なし、または readiness 不足 | VC参加auto-startの判定にも使います |
| Chat Channel ID | chat描画とYouTube開始通知に使うtext channelのID | chat表示と開始通知なし | 配信開始後の新規messageをWorkerへ送り、配信開始時は視聴URLを通知します |
| Discord VC参加で自動開始 | 対象VCへの参加を開始条件にするか | 手動開始だけ | 待機枠として自動運用する配信だけONにします |
| Encoder Profile | 解像度、fps、bitrate などの profile | 既定または未指定扱い | 配信品質を変える時に使います |
| Caption Profile | 字幕/STT の profile | 字幕なし | 字幕を使う配信だけ選びます |
| Watermark Profile | 配信映像へ載せる画像の profile | ウォーターマークなし | ロゴ画像を配信枠ごとにON/OFFする時に選びます |
| 担当Encoder Node（作成時必須） | 配信と録画を担当する Encoder Recorder | 未選択では作成できません | 作成画面で明示的に選び、`services.assign`の権限で枠と一緒に保存します。変更時は待機中・終了済み枠を編集します |
| 担当Worker Node（作成時必須） | caption、chat、参加者状態 event を担当する Worker | 未選択では作成できません | 作成画面で明示的に選び、`workers.assign`の権限で枠と一緒に保存します。変更時は待機中・終了済み枠を編集します |
| 録画プロファイル | 録画形式、保持日数、Drive保存先をまとめた設定 | 録画しません | Archive画面で事前作成した設定から選びます |
| YouTube開始予定 / 開始予定（任意） | ブラウザのタイムゾーンで入力するYouTube予定 | 配信開始時にYouTube枠をすぐ開始します | AutoStreamの手動Start・Discord VC参加トリガーとは別の設定です |
| YouTube Output | 配信先 | 外部配信なし、または開始前チェックで不足 | 本番配信では通常選びます |
| RTMP URL | start 時に直接渡す RTMP/RTMPS URL | YouTube Output の設定を使います | 通常は YouTube Output 側で管理します |

## Discord channel 指定の考え方

Discord Settings は Bot token と登録済み Discord Bot Node だけを持ちます。実際に入る guild / voice / chat channel は Streams の配信枠へ保存します。

`Discord BOT設定`は接続に使うBotの認証設定、`Discord配信先`はGuild / VC / Chatのプリセットです。別々に選んで保存してください。配信先の選択肢にはプリセット名を表示します。

| 運用 | Streams に保存する値 | 補足 |
| --- | --- | --- |
| いつも同じ voice channel | すべての配信枠に同じ Guild ID / VC Channel ID | 誤配信を避けるため配信枠ごとに明示します |
| テスト配信だけ別 channel | テスト用 Guild ID / VC Channel ID | 本番枠とは別の配信枠にします |
| 配信ごとに告知先だけ変える | Chat Channel ID だけ配信枠ごとに変える | voice channel は通常の接続先を指定します |
| 別 guild で検証する | Guild ID、VC Channel ID、必要なら Chat Channel ID | Bot が招待済みか確認します |

空欄は「元の config を使う」ではありません。Discord 音声やVC参加auto-startを使う配信枠では、Guild ID と VC Channel ID を明示してください。VC参加で開始する枠は、配信枠の `Discord VC参加で自動開始` もONにします。

## 蓋画像の候補と開始時の画像

作成・編集画面の`蓋画像（Video Cover）`には、保存した全候補をサムネイル付きカードで表示します。開始時に選んでいない画像も残り、保存後に編集画面を開き直しても確認できます。ファイル名と操作ボタンは別の領域にあり、長い名前は`ファイル名をすべて表示`で確認できます。スマートフォンではカードを縦に並べて操作できます。

候補名は255文字まで保存でき、保存・再読込後も全文を確認できます。上限を超えるファイル名は短くして選び直してください。名前を自動で切り詰めて保存することはありません。

候補を追加しただけでは開始時の画像は増えません。開始時に使用する画像は候補から1枚だけ選び、設定を保存してください。配信中に別候補へ切り替える場合は、その枠の詳細画面で操作します。

枠専用にアップロードできる蓋画像は、処理中の予約を含めて1枠あたり4枚までです。背景画像、共有プリセット、表示用に生成したvariantはこの枚数に含みません。作成・編集画面と直接APIで同じ上限が適用され、同時にアップロードしても上限を超えて追加できません。既に5枚以上ある枠は既存画像を保持し、上限を超える追加を拒否します。

配信枠を正常に削除すると、その枠専用のアップロード蓋画像と派生画像も自動削除します。共有プリセット、他の配信枠の画像、録画ファイルは削除しません。画像ファイルの削除が一時的に失敗した場合は再試行し、Control Panelの再起動後も残りの削除を再開します。

### 画像の処理段階と失敗時の操作 {#image-processing}

背景画像と蓋画像は、ファイルを選ぶとその画像のカードに処理状態を表示します。2〜4枚目の処理中も、既存候補とほかの入力はそのまま確認できます。処理件数の要約と、保存を待つ理由も確認してください。

| 段階 | 状態の意味 |
| --- | --- |
| 準備中 | 選択したファイルとアップロードの準備をしています |
| アップロード中 | 画像をサーバーへ送信しています |
| 画像を変換中 | 表示用画像を作成しています。進捗率が返らない処理に、推定のパーセントは表示しません |
| 画像の状態を確認中 | 応答を受け取れなかった処理などについて、現在の保存・変換状態を照合しています |
| 一時画像を取り消し中 | 対象の一時画像の取り消しが終わるまで待っています |
| 利用可能（枠は未保存） | 画像の処理が完了し、候補として選べます。配信枠への保存は別途必要です |
| 失敗 | 表示された理由と、利用可能な再試行・取り消し操作を確認します |
| 結果不明 | アップロードや変換の成否をまだ確認できていません。先に結果確認を行います |

処理中・失敗・結果不明の画像は、利用可能な候補へ混ぜません。保存できる状態になるまで、画面に出た理由を解消してください。2枚目が失敗しても1枚目を選び直す必要はありません。再試行は、その画像の処理結果と一時画像の扱いを確認した後に行います。

結果不明の場合は`画像の状態を確認`を選びます。確認後に`画像変換を再開`が表示された場合は、保存済みの画像を使って変換を再開できます。失敗した画像では、表示された`この画像を再試行`または`この画像を取り消す`を使います。

通信を中断したことや、照合で画像が見つからないことだけでは、サーバー側にも画像が作成されなかったとは判断できません。結果不明のまま同じファイルを新しく追加し続けず、画像カードの状態確認を使ってください。別の配信枠へ移動した後に前の処理が完了しても、新しい枠の候補へは追加しません。

## 外部入力URLの互換性

通常の配信枠作成画面はDiscord音声と生成映像を入力に使うため、外部入力URLを表示しません。既存データと外部連携APIの互換性のため`encoder_input_url`自体は残っており、SRTやRTSPなどを使う専用連携からのみ指定します。

| 入力したいもの | 例 | 注意 |
| --- | --- | --- |
| Discord 音声だけで配信する | 空欄 | Worker や Encoder 側の既定映像を使います |
| SRT 入力 | `<SRT_INPUT_URL>` | firewall と ingest 側の待受を確認します |
| RTSP カメラ | `<RTSP_INPUT_URL>` | 認証情報を URL に直接含めない運用を推奨します |
| ローカル relay | `<LOCAL_RELAY_URL>` | Encoder Recorder から到達できる host を指定します |

## サービス割り当て

配信を開始するには、基本的に次の primary service が必要です。

| サービス種別 | 役割 | 不足時に起きること |
| --- | --- | --- |
| `discord_bot` | voice channel 参加、音声取得、音声転送 | Discord 音声が使えません |
| `worker` | caption、chat、参加者状態などの event 生成 | 映像生成イベントや字幕が流れません |
| `encoder_recorder` | FFmpeg、配信、録画、upload | 配信と録画ができません |

Worker/Encoderは、新規枠の作成画面で`担当Worker Node`と`担当Encoder Node`を明示的に選択し、枠とprimary assignmentを一括保存します。作成成功後は対象枠の実際のprimary assignmentを確認し、`Check Readiness`を実行します。割当の不足や変更がある既存枠だけ、待機中または終了済みの枠を編集して設定を保存し直します。配信中のライブ調整は通常のNode割当変更には使いません。

設定保存とサービス割当は既存の権限に従います。割当権限がない場合は、権限のある管理者・担当者へ依頼してください。Service Health、Worker Management、`Stream assignment planner`から割り当てる場合も、Encoderには`services.assign`、Workerには`workers.assign`の権限が必要です。`primary`は実際のdispatch対象、`standby`は予備です。

他の配信枠で使用中・保護中のNodeの所有権や競合保護を回避しないでください。競合が表示されたら一覧を更新して現在の割当を再確認し、使用中の処理が完了してから、権限のある担当者が通常の割当操作を行います。

Discord VC参加で自動開始する待機枠では、Control Panelが選択済み`Discord BOT設定`のNodeをprimary Discord Bot assignmentとして確保し、current bindingを通して開始前の監視に必要な設定を配布します。新規作成では、選択したWorker/Encoderと同じ保存処理で確保します。選択していないBotや別枠で使用中のNodeへ切り替えず、明示的に別Botがprimaryの枠は上書きしません。

更新前に作成し、選択済みBotがまだprimary未割当の枠は、`streams.update`と`services.assign`を持つ担当者が待機中または終了済みの枠を編集し、Discord BOT設定を確認して設定を再保存してください。保存に成功したら、primary assignmentとcurrent binding、Gatewayの接続状態を再確認します。Botが別枠へ割当済みの場合、再保存だけでは所有権を移しません。権限のある担当者が既存の処理と保護状態を確認し、通常の割当画面で明示的に解除・移管してから保存し直してください。

## Start前チェック

`Check Readiness` は、Start 前に不足を集めて表示するためのボタンです。Start の前に毎回実行してください。

| チェック | 見る内容 | 対応 |
| --- | --- | --- |
| Service assignment | 必要な service type が primary に割り当て済みか | 権限のある担当者が作成済み枠の編集などで割当・保存し、実際の割当とReadinessを再確認します |
| Service heartbeat | 割り当て済みサービスが warning / offline ではないか | 対象サービスを起動または再起動します |
| 外部入力URL | API連携で保存済みの場合にURL形式が妥当か | 通常のDiscord配信では空欄にします |
| YouTube Output | stream key または OAuth account が ready か | YouTube Outputs と Integrations を見直します |
| Archive 保存先 | 選択した録画プロファイルとDrive保存先が ready か | Archive画面の録画プロファイルとDrive保存先を見直します |
| Runtime config | 対象サービスが Control Panel 配布 config を読めるか | Node ID、capability、Node Runtime Token を確認します |

## Start / Stop / Retry の使い方

| ボタン | 何をするか | 使う場面 |
| --- | --- | --- |
| Save Settings | 選択中配信の設定を保存 | 設定だけ変えてまだ開始しない時 |
| Check Readiness | Start 前の不足確認 | 配信前の通常確認 |
| Start | Discord Bot、Worker、Encoder Recorder へ開始指示を送る | readiness が通った後 |
| Stop | 配信停止を各サービスへ送る | 配信終了時 |
| Retry Upload | 録画済みファイルの保存先 upload を再試行 | 配信は終わったが upload が失敗した時 |
| Retry YouTube Complete | YouTube Live API の終了処理を再試行 | Stop 後に complete 処理だけ失敗した時 |
| View Stream Audit | 対象 stream の操作履歴を開く | 誰が開始・停止・変更したか見たい時 |

自動運用では、対象 Discord VC へのユーザー参加が開始トリガーです。配信枠で `Discord VC参加で自動開始` をONにし、`created`、`draft`、`ready` の待機状態にしておきます。選択済みBotがGatewayで参加イベントと既に在席しているユーザーを確認し、Control Panelのservice-auth endpointへ開始を要求します。Control Panelはcurrent binding、primary assignment、`streams.start` scope、保存済みのauto-start triggerを確認してから、通常の`jobs/start`をBot、Worker、Encoder Recorderへ送ります。BotのVoice接続と音声取得は、この開始指示に従って行います。日時による予約実行は行いません。

YouTubeの自動開始はYouTube Outputのmodeに従います。`Live API`と`Live API dry-run`は明示的な`direct` Encoderで使い、固定relayは両側の`live_api_relay_static`と同じbinding IDがreadyな場合だけ使います。raw-key requestや互換modeへのfallbackはありません。

Chat Channel IDが設定され、有効なYouTube視聴URLがある本番配信では、すべてのservice startが成功して状態が`live`になった後、Discord Botがそのchannelへ視聴URLを投稿します。`stream_key`ではYouTube Outputに保存したURLを使い、`Live API`と`live_api_relay_static`ではControl Panelがbroadcastから生成したpublic runtime URLを使います。固定Relay profileに`watch_url`を入力する必要はありません。`Live API dry-run`では投稿しません。投稿失敗は配信を停止またはrollbackしないため、Streamsの開始結果とDiscord Bot logで通知結果を別に確認してください。

## Encoderプレビュー

`starting`、`live`、`stopping` の配信枠では、詳細画面に `Encoderプレビュー` が表示されます。プレビューはEncoder RecorderがYouTube出力と録画と同じencodeから作るHLSで、約2秒segmentを6個保持します。preview側の遅延や切断は本配信と録画から分離されているため、previewだけが一時的に乱れても配信停止とは限りません。

画面内previewはログイン中の `streams.read` 権限でControl Panelがproxyします。VLCなどで見る場合は `ネットワーク再生URLを発行` を押し、VLCの `メディア` -> `ネットワークストリームを開く` へURLを入力します。

署名付きURLは最大12時間有効ですが、配信枠が`starting`、`live`、`stopping`以外になった時点で無効です。URLはbearer credentialとして扱い、チケット、Discord、メール、スクリーンショット、監査metadataへ貼らないでください。reverse proxy、CDN、WAFでも `/stream-previews/` のtoken付きpathをaccess logへ保存しない設定にします。Node tokenはブラウザやVLCへ渡りません。

playlistとsegmentはすべてControl Panel proxyを通るため、同時preview数と映像bitrateに比例してControl Panelの転送帯域が増えます。多数の常時監視用途では、Control Panelの帯域と接続数を監視してください。

## Stream Operations の見方

| 行 | 正常の目安 | 問題がある時 |
| --- | --- | --- |
| Stream operation overview | stream が expected status で進んでいる | starting / stopping が長く残る場合は dispatch と各サービス log を確認 |
| Start preflight | ready | warning / critical の項目を先に解消 |
| Encoder host preflight | ffmpeg、archive dir、output が ready | Encoder Recorder host の dependency、権限、設定を確認 |
| Discord audio | receiving / forwarded が増える | Bot の voice 接続、権限、音声転送先を確認 |
| Encoder audio bridge | packets が届き、last packet age が短い | Bot から Encoder Recorder への到達性を確認 |
| Worker events | event が流れている | Worker assignment と Worker event sidecar を確認 |
| Archive / upload | final MKV / MP4 と upload status が ok | 配信枠のArchive保存先、Drive権限、disk を確認 |
| Last dispatch | 各サービスへの start / stop が success | 失敗した service type と message を確認 |

## Worker event test

Streams には Worker event を試すための操作があります。

| 操作 | 目的 | 確認先 |
| --- | --- | --- |
| current_time event | Worker から Encoder Recorder へ軽い event が届くか確認する | Worker Event Sidecar |
| caption event | 字幕/テロップ系 event が届くか確認する | Worker Events、Encoder Recorder |

これは本番配信中にむやみに使うものではなく、配信前の接続確認やテスト stream で使います。

## よくあるエラー

| 表示 | 意味 | 対応 |
| --- | --- | --- |
| Missing stream assignments | 必須 service type が割り当てられていない | planner か Service Health で primary を割り当てます |
| Start readiness failed | 設定、service、外部連携のどれかが不足 | Readiness Issues の action hint を順番に解消します |
| selected YouTube output stream key is not configured | YouTube Output に stream key が保存されていない | YouTube Outputs で stream key を保存します |
| selected YouTube OAuth connected account is not ready | Live API 用の OAuth account が使えない | Integrations で接続し直します |
| YouTube watch URL is required for Discord notification | Chat Channel IDがあるstream key配信に視聴URLがない | YouTube Outputsで視聴URLを保存します |
| Encoderプレビューが準備中のまま | HLS segmentがまだ作られていない、またはEncoderへ到達できない | 配信状態、Encoder assignment、Encoder logを確認します |
| selected Drive destination folder ID is not configured | 録画プロファイルの保存先folder IDが未保存 | Archive画面で録画プロファイルのDrive保存先を修正します |
| assigned service is warning/offline | heartbeat が古い | 対象サービスの systemd/Docker 状態と network を確認します |
