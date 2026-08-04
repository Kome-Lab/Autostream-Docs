# 安全に公開する

AutoStream をインターネットから使えるようにする場合の基本方針です。細かい攻撃手順ではなく、公開前に確認する運用上のポイントだけをまとめます。

## 公開前の確認

- Control Panel は HTTPS で公開する
- reverse proxy の後ろに置く
- 不要なポートを外部公開しない
- 管理画面へアクセスできる人を制限する
- サーバーの firewall を有効にする
- OS と Docker image を定期的に更新する
- Control Panel、Host Agent、配信serviceへDocker socketをmountせず、物理ホストごとの非root `autostream-host-agent`とroot Local Executorを固定Unix socket境界で分離する

## 運用中に続けること

- 管理者アカウントを定期的に見直す
- 使っていない配信先や通知先を削除する
- token を入れ替えたら古い値を無効化する
- ログやスクリーンショットに secret が出ていないか確認する
- `/stream-previews/` の署名token付きpathをreverse proxy、CDN、WAF、APMのaccess logへ残さない
- バックアップの保存先にもアクセス制限をかける
- `/etc/autostream-host-agent/identity.json`は`panel_url`、`node_id`、`runtime_token`、`service_name`だけを保存し、`root:autostream-host-agent 0640`にする
- `/etc/autostream`は通常serviceのsecret境界として`root:root 0750`を維持する。Host Agent向けに`chmod 0751`、`chgrp`、group追加を行わない
- legacy `/etc/autostream/host-agent.json`はcanonical identityがない場合のread-only fallbackだけに使う。非root Agentはcanonicalを安全に読み終えた後のlegacy `EACCES`だけを許容し、canonical不在時のunreachable legacy、visible dual identity、予期しないprobe errorはfail closedにする
- root writerのAuto ConfigureとRuntime Token rotation/recoveryは書き込み前後にlegacyの不在とdangling symlink不在を検証する。書き込みやrotationの前にlegacyをmanaged migrationする
- affected `v1.9.9` hostの`user:autostream-host-agent:--x` ACLはcandidate rollbackで旧Agentを再起動するため、matching `v1.9.11` upgrade完了まで保持する。upgrade前にexact access/default ACLとcanonical/legacy/parentを検査し、完了後に同じ条件を再assertしてそのaccess entryだけを削除する。`setfacl -b`で他のACLまで消さない
- Host Agent / Local Executorを更新するときはControl Panel `v1.9.11`を先に稼働させる。通常は`--upgrade`を使い、`--recover-active-job`は同じexact `v1.9.9` pairまたは同じexact `v1.9.10` pairとexact active jobがあるhostだけに限定する。rescue modeは再stage・再applyしません。Configure Tokenを発行しない
- Host Agentのjournal clear marker、journal、Local Executor ledger、target checkpoint、systemd restart guard、A/B stateはinstallerとrecovery codeだけに管理させる。照合不能時はAgent restartをfenceしたままfail closedにする。journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。systemd conditionを回避しないでください。
- `execution_host_id`と`ownership_epoch`はserver-ownedとし、Host Agent config、CLI、heartbeatから変更させない
- Host AgentはControl Panelへoutbound HTTPSだけを使い、受信TCP、`8090`、SSH設定を追加しない
- Local Executor policyとsystemd/Docker port sidecarをroot所有にし、`/etc/autostream`をexecutorから不可視にする。Docker published hostは`127.0.0.1`固定とし、固定policyと承認済みCompose baselineがなければfail closedにする。公開`v1.9.11`のAttestationだけでownershipを切り替えず、実host canaryも確認する

Bridge期間のlegacy `ssh_v1`では、中央`updater.json`、host別SSH鍵、root `update-host.json`、forced command、exact sudoersを既存の境界で維持します。これらを新しい`pull_v2` configへコピーせず、全hostの移行、release/canary、rollback gateが完了するまで削除しません。更新の権限境界は[Host Agent Bridgeでサービスを更新する](/operations/system-updates)を参照してください。

## 公開しない情報

- 実際の secret
- VLC等へ発行した配信preview URL
- 内部監査ログ
- 脆弱性の詳しい再現手順
- 実運用のスクリーンショットや検証証跡

配信preview URLは最大12時間の期限がありますが、期限内はURLを知る人がactive streamを再生できるbearer credentialです。チケット、チャット、メール、監査metadataへ貼らず、漏えいした場合は配信停止で直ちに無効化し、再開後に新しいURLを発行します。preview trafficはControl Panel proxyを通るため、帯域制限やDDoS対策もControl Panelの公開経路に適用してください。
