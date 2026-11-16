# v3 操作結果と証拠の確認

この手順は、通知Effect、Release／Return要件評価、配信画面の限定接続を対象とします。共有契約はAutostream-Contractsの`v3lifecycle`、Commit `d32ea3514b1c1010391caae0348b0ff9e751f447`、LogicalRevision 1、`G0-LOGICAL-20261115-R1`です。

初回v3の予定機能はすべて実装・統合・検証・受入する方針です。この内部工程の合成結果で、全通知、全UI、実Recovery、実環境資格が完成したとは判定しません。実Provider、D4、実Store、独立freshness、実復帰演習は初回リリース前の残件です。

| 表示する事実 | 読み方 |
| --- | --- |
| desired | 要求した状態。実際の映像・音声を示すものではありません。 |
| accepted | その境界で要求を受け付けたこと。適用・配送・Remote受信を含みません。 |
| applied | 応答が証明する対象・Revision・境界での適用。別sinkやProviderの成功を含みません。 |
| remote proof | 明示されたRemote境界の証拠がある範囲だけ。HTTP 2xx、local ready、meter、queue 0から推定しません。 |
| UNKNOWN | 元の作用・Commit・応答の一部が不明。元の識別子で照会し、変更要求を自動再送しません。 |
| 未接続・未資格 | 必要なBackend、認証済owner、Provider、Profile、環境証拠が成立していません。fixtureの成功で置き換えません。 |

共有CC07／CC08はProvider、local保存、projectionを別の観測として扱います。Provider受理が既知でもlocal保存がUNKNOWNなら、既知の受理を残したままlocal側の不明を表示します。履歴があるだけで利用者への配送完了にはしません。

## cover

対応：`IU-WS7-01`、`V3-TR-035`、`V3-TR-036`、`V3-TR-037`、`V3-MD-029`。Scenario：`SC-UI-COV-01`、`SC-UI-COV-02`、`SC-UI-COV-03`。

目的は対象StreamのCover表示要求と、その要求に対応する結果確認です。既存の`streams.show_cover`／`streams.hide_cover`と照会用`streams.read`、Scope／Subject／Delegation、`super_admin`特例を維持します。両方向を持つ利用者と片方向だけの利用者を分け、UI表示だけでserver認可を代替しません。

確認画面で固定したStream、操作方向、Run／世代、Cover Revision、権限を、確定直前の状態と照合します。確認中のcache更新や対象変更があれば再確認し、古いIntentを送信しません。同じIntentの送信回数を増やしません。

`confirming`を受領した状態と、要求の応答を失ったUNKNOWNは区別します。確認状態を解消するには元のStream・世代・要求Revisionとの一致が必要です。別Streamや新しいCover状態を、元の要求の完了へ流用しません。

照会先は既存`GET /streams/{id}/video-cover-state?lifecycle_outcome=1`です。共有CC08は`X-AutoStream-Lifecycle-Outcome`等の型付き応答headerで扱います。このGETは外部観測後に限定的なrecord／critical audit更新を行うWriterを含みます。すべてのGETがpure Inspectであるとは扱いません。元PUTの再送、UNKNOWNの成功化、隔離・手動自動開始保留の解除は行いません。

証拠は元Intent、実Controller、WS2のHTTP契約、同じ対象への照会結果です。Coverが全Audio／Video sinkを抑制したという実Remote証拠とは別です。実Codec／Mux／Remote、全sink、DP-06故障時動作の未採用部分は未資格を維持します。

## visual

対応：`IU-WS7-01`、`V3-TR-035`、`V3-TR-036`、`V3-TR-037`、`V3-MD-029`。Scenario：`SC-UI-VIS-01`。

既存の`streams.update`、照会用`streams.read`、server認可を使用します。編集開始時のdraft Revisionと要求Fieldを固定し、確認後の権限・対象・Revisionを再評価します。既知の409と、作用が起きた可能性のある応答喪失を分けます。

応答のStream、元draft、適用後の新Revision、要求Fieldが対応するときだけ、その範囲の適用を表示します。一般的な成功応答や別のpolling更新で、元の変更が成功したことにしません。

照会先は既存`GET /streams/{id}/visual-settings`です。元Stream・draft Revision・要求Fieldとの相関を保持し、結果不明からPUTを自動再送しません。表示上の適用とRemote映像の証明は別です。全Visual機能と実Remote受入は未完了です。

## stop

対応：`IU-WS7-01`、`V3-TR-035`、`V3-TR-037`。Scenario：`SC-UI-STOP-01`。

停止要求には既存`streams.stop`、結果照会には既存`streams.read`を使用し、対象Scopeを維持します。最初の停止要求が固定したStreamと`source-version`を保持します。確認中に対象や権限が変わったら古い要求を送信しません。

停止POSTの`expected_updated_at`に固定したStreamの元`updated_at`を使います。応答喪失後は、同じ値を`GET /streams/{id}/stop-outcome?expected_updated_at=<元updated_at>&lifecycle_outcome=1`へ渡し、同じStopを照会します。この`source-version`は既存RFC3339Nanoの識別子であり、Qualified Clockの証明へ読み替えません。不正version、別Stream、receipt未実装、照会不能は不明・拒否として表示します。

現在の`stopping`／`completed`だけで、自分の元Stopの成功としません。新しいStop、force-stop、Recovery、予約解放を自動実行しません。Stop coreの整合SELECTと、HTTP全middlewareを含む作用範囲は分けます。実Completion Proof、全member Drain、READY Seal、Final Fence、配信・録画の正常終端資格は別の初回リリース要件です。

## preview

対応：`IU-WS7-01`、`V3-TR-035`、`V3-MD-029`、`OP-RL-024`、`OP-RL-025`。Scenario：`SC-UI-PREV-01`、`SC-UI-PREV-02`、`SC-UI-PREV-03`、`SC-OPS-008`。

既存`streams.read`と対象ScopeでPreviewを利用します。`url`／`playback_url`／`player_url`互換、初期mute、play／pause、seek ±10秒、native-HLS fallbackを維持します。

再生retryでは旧Player、timer、listener、Promise callbackをcleanupし、Stream・URL・再生世代が変わった後の古いcallbackを無効にします。再生の再試行は元Cover／Visual／Stop Mutationの再送ではありません。

missing key、不活性、不在、403、期限、Range／Segment、409／410／404等は既存HTTP境界の意味で扱います。local readyやmeterはRemote受信・全sinkの安全性を証明しません。再生URLやTokenを一般ログ、診断、画面証拠へ複写しません。

Controller／DOM／HTTP fixtureの試験、実ブラウザーでの描画・操作、native音声、実Remote再生は別の証拠です。Runbook参照検査や文書Buildで未実施の段階をPASSにしません。

同じ画面へ渡すMedia境界結果も、Raw書込み、Sync／Close観測、Queue受理、Queue終端を分けます。固定Encoder fixtureの正常Feedでは、最初の3境界が既知成功でも、Queue終端境界は`KNOWN / PENDING`、物理Queue義務は`UNKNOWN / UNAVAILABLE`、Gateは`HELD`です。同じQueueの重複参照は1つの未解決義務として数え、返却済FDを残件へ含めません。queue 0やLocal成功でRemote受信・実Codecの安全性へ昇格しません。通知・Release・Mediaの画面portは、通常構成でBackendが未接続なら未接続を表示します。

## notification

対応：`IU-WS5-01`、`V3-MD-024`、`V3-MD-025`、`V3-MD-026`、`V3-MD-027`、`OP-MD-017`、`OP-MD-018`、`OP-MD-019`、`OP-MD-020`、`OP-MD-021`、`OP-RL-029`。Scenario：`SC-OPS-006`、`SC-CC-07`、`SC-CC-08`。

通知要求は既存`notifications.manage`、照会は既存`notifications.read`の認証済scopeを使い、通知対象・目的を維持します。明示的な新経路では別途、信頼されたowner adapterが元のimmutable tupleと現在性を確認します。任意のJSON、URL、履歴、process-local dedupeから通知権限や永続Intentを作りません。

通知本文、送信先URL、Webhook URL、Credentialはjournalに保存しません。Effect／Attempt、対象、世代、非秘密metadata参照をIntentとして記録し、dispatch可能性のCASとlocal Transaction終了を確認してからProvider adapterを呼びます。

Provider結果、local結果保存、projection、利用者への配送は別の事実です。Provider受理後のACK喪失、journal Commit不明、履歴保存失敗を一つの失敗booleanに潰しません。元のEffectID／AttemptID／Correlation／対象を保ち、明示的な`GET /v3/notification-effects/{effect}/{attempt}`で照会します。元の非秘密CC07 recordを`X-Autostream-Lifecycle`へ対応付けます。Inspectでは通知、別Attempt再送、hold解除を起動しません。

合成の正常経路は実製品Callerから明示fixture Storeとfake Providerへ接続する範囲です。通常startupで必要adapterが未接続なら、新経路は未接続として拒否し、legacy配送へfallbackしません。実SMTP／Webhook、実通知、実CP remediation、実Storeの耐久性資格、全通知方式の完成は今回の証拠に含めません。

## release-return

対応：`IU-WS6-01`、`OP-RL-001`、`OP-RL-005`、`OP-RL-014`、`OP-RL-015`、`OP-RL-018`、`OP-RL-019`、`OP-RL-020`、`OP-RL-021`、`OP-RL-022`、`OP-RL-023`、`OP-RL-026`。Scenario：`SC-OPS-004`、`SC-OPS-005`、`SC-OPS-007`、`SC-CC-10`。

方式中立のDescriptorをUpdaterの内部readiness Callerへ渡し、Docker側も同じ固定Sourceの評価器・Profile・Vectorで検査します。既存manifest generatorのv2互換宣言を、v3の資格証明へ上書きしません。

| 結果 | 操作上の意味 |
| --- | --- |
| StructurallyCoherent | 入力と参照が構造的に整合する範囲です。更新・復元・旧v2起動・Recoveryの許可はありません。 |
| NeedsEvidence | 原本、capture、qualification、attestation、現在性等の必要証拠が不足しています。 |
| NeedsDecision | 未採用の方式・運用判断が残っています。F5案B、固定A/B、Root、Clock、人数、保存先、D4を自動採用しません。 |
| Contradiction | tuple、世代、対象、証拠参照、条件に矛盾があります。 |

Artifact／Config／Schema／Source、原本と取得時点のCapture Vector、現在Membership／Revision、証拠参照、業務開始前後の復帰条件を分けます。`AuthorizesMutation=false`／`ReusableForCommit=false`を保持します。Backupがある、hashが合う、互換booleanがtrueである、という宣言だけでは正式v2復帰資格になりません。

`first_new_business_effect_marker`がUNKNOWNなら`RET-S3`として保全し、旧v2の起動・再起動を許可しません。POST-businessではPOST-business V2ReturnPoint、全新規業務data、Provider結果、起動前fenceとRG-A〜H等の証拠が必要です。元の業務Effectが不明な場合に新しいAttemptやrealmで回避しません。

CP・台帳・比較根拠が同じ過去へ戻った共通restoreは、値の一致だけでは検出・鮮度証明できません。実Independent freshness、実Root／clock、実Store、実Backup／Restore、正式v2復帰演習の未完了を残します。switch／Apply／Restore／旧v2起動／実Recovery／旧Execution Authority再利用はこのRunbookから実行しません。

## 証拠と受入の境界

`implementation-unit-register.json`は27 Featureと対象Scenario、操作、Source、証拠状態の機械可読対応表です。固定Sourceを読んだ状態、製品接続、合成試験、環境資格、実運用演習を分けます。各PRとCIの最終Commit／tree照合はMasterの実装記録へ保存します。

文書checkerの成功は参照と危険な完了表記の検査です。実Provider配送、実DB／VPS、実Credential、実Migration、Bootstrap／Recovery／実Evidence、配信・録画・実音声Remote、Deployを実施した証拠ではありません。製品全体受入は`NOT_RUN`、L2配置は`NOT_QUALIFIED`、正式v2復帰は`NOT_CERTIFIED`を維持します。
