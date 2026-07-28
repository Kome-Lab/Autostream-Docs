import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(path);
    }
    return extname(entry.name) === '.md' ? [path] : [];
  });
}

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

function requireMarkers(path, markers) {
  const contents = read(path);
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      throw new Error(`${path} is missing Host Agent Bridge marker: ${marker}`);
    }
  }
  return contents;
}

const operationsPath = 'docs/operations/system-updates.md';
const registrationPath = 'docs/control-panel/node-agent-registration.md';
const dockerPath = 'docs/deployment/docker.md';

const bridgeMarkers = [
  '`pull_v2`',
  '`ssh_v1`',
  '`autostream-host-agent`',
  '物理ホスト',
  '非root',
  'outbound HTTPS',
  '受信TCP',
  '`8090`',
  'Unix socket',
  '`execution_host_id`',
  '`ownership_epoch`',
  '`desired`',
  '`applied`',
  '`reported`',
  '`1024..65535`',
  'observer',
  'Local Executor',
];

const operations = requireMarkers(operationsPath, [
  ...bridgeMarkers,
  'availability gate',
  '公開release',
  'canary',
  'root Local Executor',
  'systemd',
  'Docker',
  'reverse proxy',
  'Host AgentからControl Panelへの通信だけ',
  '`ownership_epoch=0`',
  '`eligible_operations`',
  '`port_reconfigure`',
  '`rollback_failed`',
  '`staged_runtime_token_rotation_required`',
  '/run/autostream-local-executor/executor.sock',
  '/etc/autostream-local-executor/policy.json',
  '/etc/autostream-host-agent/identity.json',
  '/etc/autostream-host-agent/identity.staged.json',
  '/etc/autostream/host-agent.json',
  '/opt/autostream/local-executor/ports',
  '公開immutable releaseを匿名HTTPS',
  '/opt/autostream/local-executor/docker/ports/<service>.env',
  '`127.0.0.1`固定',
  '承認済みfrozen Compose baseline',
  'reverse proxyの自動書き換えはこのreleaseの対象外',
  'local-stage receipt',
  '`cancel_requested`',
  '`emergency-revoke`',
  'recover-runtime-credential',
  '`manual_recovered`',
  'dedicated directive',
  '/opt/autostream/host-agent/slots/{a,b}',
  'root recovery timer/supervisor',
  '`recovery_protocol_version=2`',
  '`failed_generation`',
  '`token_sha256`',
  '`phase=failed`',
  'receiptを持たないcredential-free terminal',
  '同一IPC request',
  'no-op success',
  '異なるbinding',
  '`root-only watchdog status`',
  '2秒timeout',
  'fresh-process reconcile',
  'ローカル検証をproduction proofと読み替えず',
  'local purgeだけではControl Panel側のRuntime Tokenは失効しません',
  'SSD、copy-on-write filesystem、snapshot、backup上の物理消去は保証しません',
  'identityが残ればpurgeは失敗します',
  '`api_tokens.create`',
  '`api_tokens.revoke`',
  '`secrets.update`',
  '`system_updates.execute`',
]);

const registration = requireMarkers(registrationPath, [
  ...bridgeMarkers,
  'endpointless',
  'Host、Port、SSLを入力しません',
  'server-owned',
  'API port、SSH設定、GitHub Release Token、target policy、任意command',
  '`ownership_epoch=0`',
  '`eligible_operations`',
  '/etc/autostream-local-executor/policy.json',
  '/etc/autostream-host-agent/identity.json',
  '/opt/autostream/local-executor/ports',
  '`staged_runtime_token_rotation_required`',
  'generic再生成ではなく',
  '`recovery_protocol_version=2`',
  '`root-only watchdog status`',
  '2秒timeout',
  '`failed_generation`',
  '`token_sha256`',
  '`phase=failed`',
  'receiptなし',
  '同一IPC replay',
  'no-op success',
  '異binding拒否',
  '`127.0.0.1` published',
  '承認済みfrozen Compose baseline',
  '`api_tokens.create`',
  '`api_tokens.revoke`',
  '`secrets.update`',
  '`system_updates.execute`',
]);

const docker = requireMarkers(dockerPath, [
  '`pull_v2`',
  '`ssh_v1`',
  '`autostream-host-agent`',
  '物理Docker hostごと',
  'outbound HTTPS',
  '受信TCP',
  '`8090`',
  'Unix socket',
  '`desired`',
  '`applied`',
  '`reported`',
  '`1024..65535`',
  'container listen port',
  'host published port',
  'reverse proxy public port',
  '`port_reconfigure`',
  '`127.0.0.1`固定',
  '/opt/autostream/local-executor/docker/ports/<service>.env',
  'approved frozen Compose baseline',
  'reverse proxy設定は自動変更しない',
  'Docker 29.6.2 / Compose 5.3.1',
  'fresh-process reconcile',
  'grant二重消費なし',
  'unhealthy mapping',
  'grant前拒否',
  'ローカル実daemonのPASS',
  '全5image build',
]);

const exactIdentityKeys = ['panel_url', 'node_id', 'runtime_token', 'service_name'];
for (const [path, contents] of [
  [operationsPath, operations],
  [registrationPath, registration],
]) {
  const identityBlock = contents.match(
    /```json\s*\n(\{\s*\n\s*"panel_url"[\s\S]*?\n\})\s*\n```/,
  );
  if (!identityBlock) {
    throw new Error(`${path} is missing the four-field Host Agent identity JSON`);
  }
  const parsed = JSON.parse(identityBlock[1]);
  const keys = Object.keys(parsed).sort();
  const expected = [...exactIdentityKeys].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new Error(
      `${path} Host Agent identity must have exactly: ${exactIdentityKeys.join(', ')}`,
    );
  }
}

const orderedOperationsMarkers = [
  '## 移行後の構成',
  '## Bridge期間のtransport',
  '## `pull_v2` Host Agentを登録する',
  '## Nodeポートの契約',
  '## endpointの意味',
  '## availability gateと移行順',
  '## ownershipを切り替える',
  '## 更新jobとrollback',
  '## Runtime Token rotation',
  '## Host Agent / Local Executorの自己更新',
  '## 既存`ssh_v1`環境',
  '## Host Agentを撤去する',
  '## 運用確認',
];
let previousIndex = -1;
for (const marker of orderedOperationsMarkers) {
  const index = operations.indexOf(marker);
  if (index < 0) {
    throw new Error(`${operationsPath} is missing ordered marker: ${marker}`);
  }
  if (index <= previousIndex) {
    throw new Error(`${operationsPath} has an out-of-order marker: ${marker}`);
  }
  previousIndex = index;
}

const primaryGuides = [
  [operationsPath, operations],
  [registrationPath, registration],
  [dockerPath, docker],
];
const obsoleteClaims = [
  '中央Update Agentの既定portは`8090`です',
  'Update Agent は中央管理ホストで常駐する `autostream-updater` 1つだけを登録します',
  '新規構成では、サービス登録は Node登録から始めます。通常serviceではNode登録のConfigurationで`config.yml`を取得し、各serviceの`AUTOSTREAM_NODE_CONFIG`で読ませます。Update AgentはこのYAML方式を使わず、中央管理ホストに1つだけ登録します',
  '各hostの非常駐`autostream-update-host` helperだけがrootとしてDocker CLIを使います',
  '現在のHost Agentはobserve-only',
  '現在のobserve-only Host Agent',
  'probe-only sourceはあるが、mutation operationと配布・起動経路は未実装',
  'root local executorは将来のUnix socket境界',
  'root mutation executorの配布・起動経路、job apply、port変更は未実装',
  'Docker mapping専用の`port_reconfigure` job/grant/Local Executor operationはまだ利用できません',
  'Docker/reverse proxyはまだ自動ポート変更の対象外です',
  'Dockerのport mapping専用`port_reconfigure` job/grant/Local Executor operationはまだ未実装です',
  'HTTP API、Host Agent配線、mixed-version/E2Eは未実装',
  'Control Panelから`runtime_requirement`とself-update directiveを発行・保存するbackend',
  '自己更新にはreleaseをblockする未解決',
  'healthy Executorのrestart/verify',
  'queued cancel対consumed stage grant',
  '自己更新は現在release blockerです',
  '修正後のfresh-process reconcile、unhealthy rollback、foreign-port拒否は未再実行',
  '修正後の実daemon reconcile',
  '上記の未完了DIND再検証',
  'grantだけを削除',
  'grantだけをcleanup',
  'terminal replay 拒否',
];
for (const [path, contents] of primaryGuides) {
  for (const claim of obsoleteClaims) {
    if (contents.includes(claim)) {
      throw new Error(`${path} contains obsolete unqualified updater guidance: ${claim}`);
    }
  }
}

const navigationMarkers = [
  ['docs/index.md', '物理ホスト単位のHost Agent'],
  ['docs/control-panel/index.md', '`pull_v2` Host Agent'],
  ['docs/.vitepress/config.ts', 'Host Agent Bridgeとシステム更新'],
  ['docs/control-panel/page-usage.md', '`emergency-revoke`'],
  ['docs/services/control-panel-install.md', 'generic再生成してはいけません'],
];
for (const [path, marker] of navigationMarkers) {
  if (!read(path).includes(marker)) {
    throw new Error(`${path} is missing Host Agent navigation marker: ${marker}`);
  }
}

const documentation = markdownFiles(resolve('docs')).map((path) => [
  path,
  readFileSync(path, 'utf8'),
]);
const unsafeTokenGuidance = [
  'Host Agentは`panel_url`、`node_id`、`runtime_token`、`service_name`だけのidentityを更新してください',
  '漏えいの疑いがある場合は Node登録の Configuration で再生成します',
];
for (const [path, contents] of documentation) {
  if (
    contents.includes('/etc/autostream/host-agent.json') &&
    (!contents.includes('legacy') ||
      !contents.includes('read-only fallback') ||
      !contents.includes('/etc/autostream-host-agent/identity.json'))
  ) {
    throw new Error(
      `${path} mentions the legacy Host Agent identity without the canonical read-only fallback boundary`,
    );
  }
  for (const guidance of unsafeTokenGuidance) {
    if (contents.includes(guidance)) {
      throw new Error(
        `${path} contains unsafe generic Runtime Token guidance for an active pull_v2 Host Agent: ${guidance}`,
      );
    }
  }
}

console.log('Host Agent Bridge documentation contract passed.');
