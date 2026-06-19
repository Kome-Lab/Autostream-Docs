# Mojibake / PowerShell display

AutoStream の日本語 Markdown、PowerShell script、Go / JavaScript の診断文が文字化けして見えた場合は、最初に source corruption と PowerShell display issue を分けます。Windows PowerShell 5.1 の `Get-Content` は UTF-8 BOM なしの file を既定 code page で表示することがあり、file 自体が正常な UTF-8 でも日本語だけが崩れて見えます。見た目だけで本文を置換すると、正常な source を本物の mojibake へ壊すため、編集前に UTF-8 strict read と repository gate を通します。

このページは、docs、evidence、VitePress config、Control Panel frontend、Go diagnostics、PowerShell helper を同じ判断基準で扱うための troubleshooting 手順です。operator evidence に raw secret、provider ID、credential URL を貼らない方針と同じく、文字化け調査でも PowerShell output をそのまま docs に転記しません。

## 最初に検証すること

PowerShell 表示だけが疑わしい場合は、対象 file を UTF-8 指定で読み直します。`Get-Content -Encoding UTF8` または Node の `fs.readFileSync(path, 'utf8')` で正常に読めるなら、source は壊れていません。その場合は file を編集せず、terminal 表示問題として扱います。

```powershell
Get-Content -Path the private evidence archive20260612-external-e2e-handoff-status.md -Encoding UTF8
node -e "const fs=require('fs'); console.log(fs.readFileSync('the private evidence archive20260612-external-e2e-handoff-status.md','utf8').slice(0,240))"
npm run docs:check-mojibake
```

`docs:check-mojibake` は Markdown だけでなく、Go、PowerShell、JavaScript、TypeScript、JSON、YAML、VitePress config も走査します。generated log や a local ignored runtime directory は local artifact なので対象外ですが、committed the private evidence archive と scripts は gate の対象です。UTF-8 BOM も拒否します。

PowerShell 表示が崩れているかを調べるときは、`rg` や Node の UTF-8 read で実ファイル内の mojibake fragment を確認します。具体的な検出 fragment は `scripts/check-mojibake.mjs` の `mojibakeFragments` に code point として定義し、docs 本文には直接書きません。`rg -n "<MOJIBAKE_FRAGMENT>" docs README.md AGENTS.md` のような調査で一致せず、Node の `readFileSync(..., 'utf8')` で日本語が読めるなら、`Get-Content` の表示だけを根拠に修復しません。この確認は、本文が壊れていないことを示すためのものであり、外部確認のverification record にはなりません。

## 判定

| 状態 | 扱い |
| --- | --- |
| PowerShell の `Get-Content` だけが崩れる | 編集しない。`Get-Content -Encoding UTF8` または Node UTF-8 read の結果を採用する。 |
| Node UTF-8 read でも崩れている | source corruption として扱い、該当段落を意味が通る日本語へ手修復する。 |
| `docs:check-mojibake` が失敗する | detector の finding 行を起点に、対象 file 全体の文脈を読み直して修復する。 |
| evidence だけが崩れて見える | まず UTF-8 read で file 実体を確認し、pass / fail の evidence 判定と文字表示を混同しない。 |
| detector が通るが reviewer が読めない | file path、read command、terminal 種別を残し、source と display のどちらが原因かを再確認する。 |

判定結果は the private evidence archive に raw terminal output として貼りません。必要なら、どの command で source が正常と確認できたか、またはどの detector finding を直したかだけを secret-safe に残します。

## 修復手順

本物の mojibake と確認できた場合は、小さな文字置換ではなく、該当 section または page 全体を読み直して意味が通る日本語へ書き直します。自動変換は使わず、source of truth、repo ownership、operator action、failure mode、evidence boundary が残るように文章を復元します。

1. `npm run docs:check-mojibake` で対象 file と行を確認する。
2. `Get-Content -Encoding UTF8` または Node UTF-8 read で file 全体を読み、壊れている範囲を確認する。
3. 近い runbook、service docs、README、implementation code を見て、失われた意味を復元する。
4. raw secret、webhook URL、SMTP password、Drive raw ID、YouTube stream key、Discord raw ID を書かずに修復する。
5. `npm run docs:check`、`npm run docs:build`、`npm run docs:check` を通す。

修復中に PowerShell output を参考にする場合も、出力をそのまま貼らず、UTF-8 で再入力します。特に evidence file は readiness check の判定材料になるため、表示崩れと external verification の pass/fail を混同しないでください。

## 失敗時の扱い

`docs:check-mojibake` が失敗したままの場合は、docs 公開や security report 更新を止めます。文字化けした診断文は incident triage、readiness issue、remediation action、external verification handoff の意味を壊すため、production-ready docs として扱いません。

detector が false positive に見える場合でも、まず `Get-Content -Encoding UTF8` と Node UTF-8 read の結果を比較します。source が正常で detector だけが過剰に落ちているなら、該当 pattern を緩める前に fixture を追加し、`scripts/test-mojibake-detector.mjs` で PowerShell 表示問題と本物の mojibake を両方再現します。source が壊れているなら detector は緩めず、本文を直します。

## Evidence boundary

文字化け対応の evidence に必要なのは、対象 file、確認 command、detector 結果、修復後に通した gate です。不要なのは、raw provider credential、terminal transcript 全文、secret を含む env dump、provider ID の生値、PowerShell が壊して表示した本文の丸ごと貼り付けです。

If external provider verification notes look corrupted in PowerShell but read correctly as UTF-8, treat it as a display issue. Provider pass status must be based on the same `stream_id`, provider verification record, probe summary, Control Panel config confirmation, and operator verification record.
