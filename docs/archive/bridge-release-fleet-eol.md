# Bridge移行証拠の保管境界

旧・新transportの並行運用手順と実行可能fleet gateは、v2の運用手順として使用しません。
移行証拠は完了した移行のimmutable evidence setで保持します。ここは運用runbookではなく、
過去のtransport、helper、listener、credential経路を再有効化する根拠にはなりません。

復旧は対応するrelease全体とdata snapshotを復元するwhole-release rollbackだけです。
v2 release内へ互換surfaceを部分的に戻しません。現在の手順は
[システム更新](/operations/system-updates)を参照してください。
