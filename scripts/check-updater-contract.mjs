import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const guidePath = resolve('docs/control-panel/node-agent-registration.md');
const guide = readFileSync(guidePath, 'utf8');
const relatedGuidePaths = [
  'docs/control-panel/node-agent-registration.md',
  'docs/control-panel/audit-tokens.md',
  'docs/control-panel/page-usage.md',
  'docs/operations/system-updates.md',
];
const relatedGuides = relatedGuidePaths.map((path) => [path, readFileSync(resolve(path), 'utf8')]);
const updaterDocumentationPaths = [
  ...relatedGuidePaths,
  'docs/runbooks/first-install.md',
  'docs/security/tokens.md',
  'docs/services/control-panel-install.md',
];
const updaterDocumentation = updaterDocumentationPaths.map((path) => [path, readFileSync(resolve(path), 'utf8')]);

const flowStart = guide.indexOf('Auto Configureの通信とRuntime Token rotationはNode typeによって異なります。');
const flowEnd = guide.indexOf('## 中央Update Agentのlocal inventoryとAuto Configure');
if (flowStart < 0 || flowEnd <= flowStart) {
  throw new Error('node-agent-registration.md is missing the separated Auto Configure flow section');
}

const flow = guide.slice(flowStart, flowEnd);
const orderedMarkers = [
  '通常Nodeでは次の順序です。',
  '`POST /api/node-agent/configure`',
  '新しいRuntime Tokenを直ちに有効化して旧Runtime Tokenを無効化',
  'Update Agentでは、通常Nodeの即時rotation endpointを使わず',
  '`POST /api/node-agent/configure/stage`',
  '新しくstageされたRuntime Tokenはまだinactiveで、旧Runtime Tokenは引き続きactive',
  '原子的にcommitして、設定をreload・validation',
  '`POST /api/node-agent/configure/activate`',
  'activation成功後にだけ旧Runtime Tokenを無効化し、stageしたRuntime Tokenをactive',
];

let previousIndex = -1;
for (const marker of orderedMarkers) {
  const index = flow.indexOf(marker);
  if (index < 0) {
    throw new Error(`node-agent-registration.md is missing updater configure contract marker: ${marker}`);
  }
  if (index <= previousIndex) {
    throw new Error(`node-agent-registration.md has an out-of-order updater configure contract marker: ${marker}`);
  }
  previousIndex = index;
}

const requiredMarkers = [
  'legacyの`POST /api/node-agent/configure`を呼び出した場合、PanelはHTTP `409`で拒否',
  'CLIはactivation用のTokenやstateを永続化しない',
  'Configurationで必ず新しいConfigure Tokenを発行',
  '| `POST /api/node-agent/configure/stage` |',
  '| `POST /api/node-agent/configure/activate` |',
];
for (const marker of requiredMarkers) {
  if (!guide.includes(marker)) {
    throw new Error(`node-agent-registration.md is missing updater safety marker: ${marker}`);
  }
}

const forbiddenMarkers = [
  'Update Agentを1つ作成したら、作成直後に一度だけ表示されるNode Runtime Token',
  '`autostream-updater`には`configure`サブコマンドがなく',
  '新しいTokenを発行せず同じcommandを再実行',
  'root管理のactivation stateから反映を再開',
];
for (const marker of forbiddenMarkers) {
  if (guide.includes(marker)) {
    throw new Error(`node-agent-registration.md contains obsolete updater guidance: ${marker}`);
  }
}

const failureContractMarkers = [
  'activationの応答を受け取れず結果不確定',
  'CLIだけではどちらのRuntime Tokenがactiveか判断できません',
  'disk上の`updater.json`にはstage済みidentityが残ることがあります',
  'CLIはactivation用のTokenやstateを永続化しない',
  'Updaterを再起動せず',
  '新しいConfigure Token',
  '同じtoken-free command形',
];
const staleFailureMarkers = [
  '失敗または結果不確定の場合も旧Runtime Tokenは維持',
  '設定処理が失敗または結果不確定の場合も旧Runtime Tokenは維持',
  '失敗した場合や結果不確定の場合も、旧Runtime Tokenと既存設定は維持',
  '同じコマンドで再開',
  '再生成を求められた場合だけ',
  '新しいAuto Configure command',
];

const initializationContractMarkers = [
  '`updater.json`が存在しない場合',
  'Updater本体に内蔵された初期設定から自動生成',
  'サンプルファイルの配置や`--init-from`指定は不要',
  '`root:autostream-updater`、mode `0640`',
  'Configure Tokenを要求・消費せず',
  '非ゼロ',
  '同じControl Panel release同梱の`autostream-updater` binary',
  '旧Updaterは`updater.json`を自動生成しません',
  '`--init-from PATH`は互換用の明示的なoverride',
  '内蔵設定へfallbackせず失敗',
  'local policyを完成させ',
  '同じtoken-free command',
  '既存の`updater.json`は上書きしません',
];

const obsoleteManualInitializationMarkers = [
  'sudo test -e /etc/autostream/updater.json',
  'if ! sudo test -e /etc/autostream/updater.json; then',
  '"$RELEASE_DIR/autostream-updater.json.example" /etc/autostream/updater.json',
  'sampleを中央`/etc/autostream/updater.json`へinstall',
  'release同梱の`autostream-updater.json.example`から自動生成',
  'release同梱のsampleから安全に自動生成',
  'release sampleから自動生成',
  '/usr/local/share/autostream-updater/autostream-updater.json.example',
  '/opt/autostream/control-panel/current/autostream-updater.json.example',
];

for (const [path, contents] of relatedGuides) {
  for (const marker of failureContractMarkers) {
    if (!contents.includes(marker)) {
      throw new Error(`${path} is missing updater failure contract marker: ${marker}`);
    }
  }
  for (const marker of staleFailureMarkers) {
    if (contents.includes(marker)) {
      throw new Error(`${path} contains obsolete updater failure guidance: ${marker}`);
    }
  }
  for (const marker of initializationContractMarkers) {
    if (!contents.includes(marker)) {
      throw new Error(`${path} is missing updater initialization contract marker: ${marker}`);
    }
  }
}

for (const [path, contents] of updaterDocumentation) {
  for (const marker of staleFailureMarkers) {
    if (contents.includes(marker)) {
      throw new Error(`${path} contains obsolete updater failure guidance: ${marker}`);
    }
  }
  for (const marker of obsoleteManualInitializationMarkers) {
    if (contents.includes(marker)) {
      throw new Error(`${path} contains obsolete manual updater initialization guidance: ${marker}`);
    }
  }
}

const pageUsage = relatedGuides.find(([path]) => path === 'docs/control-panel/page-usage.md')?.[1] ?? '';
const initialSuccessMarker = 'activation成功を確認した後に`validate-config`を実行し、成功後にだけ中央Updaterを起動または再起動します';
if (!pageUsage.includes(initialSuccessMarker)) {
  throw new Error(`docs/control-panel/page-usage.md is missing the initial updater success contract marker: ${initialSuccessMarker}`);
}

console.log('Updater Node registration documentation contract passed.');
