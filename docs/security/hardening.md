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
- `/etc/autostream/updater/agent.yaml`は`panel_url`、`node_id`、`runtime_token`、`service_name`だけを保存し、`root:autostream-host-agent 0640`にする
- `/etc/autostream`は通常serviceのsecret境界として`root:root 0750`を維持する。Host Agent向けに`chmod 0751`、`chgrp`、group追加を行わない
- Agent identityはcanonical YAMLだけを使い、fallbackは設けない。root-owned file、bounded size、exact field set、safe parent layoutを検証する
- Auto Configureとcredential rotationは固定canonical pathだけをatomicに更新し、symlinkやowner/modeの変化をfail closedで拒否する
- Host Agent / Local Executorは独立Updaterの検証済みreleaseで更新する。通常は`--upgrade`を使い、`--recover-active-job`はそのreleaseが認めるexact pairとexact active jobに限定する。rescue modeは再stage・再applyしません。Configure Tokenを発行しない
- Host Agentのjournal clear marker、journal、Local Executor ledger、target checkpoint、systemd restart guard、A/B stateはinstallerとrecovery codeだけに管理させる。照合不能時はAgent restartをfenceしたままfail closedにする。journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。systemd conditionを回避しないでください。
- `execution_host_id`と`ownership_epoch`はserver-ownedとし、Host Agent config、CLI、heartbeatから変更させない
- Host AgentはControl Panelへoutbound HTTPSだけを使い、受信TCP、`8090`、SSH設定を追加しない
- Local Executorは固定managed Updater pathだけを使い、通常serviceのsecret fileへのアクセスを許可しない。policy、systemd listener JSON、Docker Compose補間用port設定はroot所有にする。4種類のapplication unitへはprivate `0700` directory内の非secret JSONを`LoadCredential`で渡し、元fileは`0600`を維持する。Docker published hostは`127.0.0.1`固定とし、固定policyと承認済みCompose baselineがなければfail closedにする。公開archiveのAttestationだけでownershipを切り替えず、実host canaryも確認する

更新の権限境界は[システム更新](/operations/system-updates)を参照してください。v2のhost実行は独立Updaterだけに限定します。

## 公開しない情報

- 実際の secret
- VLC等へ発行した配信preview URL
- 内部監査ログ
- 脆弱性の詳しい再現手順
- 実運用のスクリーンショットや検証証跡

配信preview URLは最大12時間の期限がありますが、期限内はURLを知る人がactive streamを再生できるbearer credentialです。チケット、チャット、メール、監査metadataへ貼らず、漏えいした場合は配信停止で直ちに無効化し、再開後に新しいURLを発行します。preview trafficはControl Panel proxyを通るため、帯域制限やDDoS対策もControl Panelの公開経路に適用してください。
