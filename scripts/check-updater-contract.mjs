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

const documentation = markdownFiles(resolve('docs')).map((path) => [
  path,
  readFileSync(path, 'utf8'),
]);

const managedGuidePaths = [
  'docs/control-panel/node-agent-registration.md',
  'docs/control-panel/page-usage.md',
  'docs/operations/system-updates.md',
];
const managedGuides = managedGuidePaths.map((path) => [
  path,
  readFileSync(resolve(path), 'utf8'),
]);

const requiredAcrossManagedGuides = [
  'システム更新',
  'GitHub Release Token',
  'repositoryの公開状態にかかわらず',
  'Managed更新では必須',
  '書き込み専用',
  '保存後は画面へ再表示しません',
  '更新jobを取得した中央Updaterへだけ一度限り',
  'SSHホスト公開鍵',
  'Configure Token',
  '標準入力',
  '/etc/autostream/updater.json',
  '自動生成',
  '保存',
  '自動',
  '再起動は不要',
  '反映済み',
  '反映待ち',
  '反映失敗',
];

for (const [path, contents] of managedGuides) {
  for (const marker of requiredAcrossManagedGuides) {
    if (!contents.includes(marker)) {
      throw new Error(`${path} is missing managed updater marker: ${marker}`);
    }
  }
}

const operationsGuide =
  managedGuides.find(([path]) => path === 'docs/operations/system-updates.md')?.[1] ?? '';
const operationsOrderedMarkers = [
  'sudo /usr/local/bin/autostream-updater configure',
  'sudo systemctl enable --now autostream-updater',
  '### システム更新でhostを保存する',
  'SSH接続とは独立した経路',
  '**保存** を押すと',
  '**SSHクライアント公開鍵**',
  '## managed hostへ一度だけinstallする',
  '## 保存した設定が反映されたことを確認する',
  '**反映済み** | 保存したrevisionをUpdaterが受理',
];

let previousIndex = -1;
for (const marker of operationsOrderedMarkers) {
  const index = operationsGuide.indexOf(marker);
  if (index < 0) {
    throw new Error(`docs/operations/system-updates.md is missing ordered marker: ${marker}`);
  }
  if (index <= previousIndex) {
    throw new Error(`docs/operations/system-updates.md has an out-of-order marker: ${marker}`);
  }
  previousIndex = index;
}

const requiredOperationsMarkers = [
  'sudo /usr/local/bin/autostream-updater configure --panel-url "https://control.example.com" --node "central-updater"',
  'sudo install -d -o root -g root -m 0755 /etc/autostream',
  'sudo -u autostream-updater test -r /etc/autostream/updater.json',
  'ホストごとのEd25519鍵を生成',
  '更新jobの実行中は反映を保留',
  'APIポート',
  '更新確認間隔',
  'Heartbeat間隔',
  'SSHユーザー',
  '`updater.json`を手で編集しません',
  '`ssh-keyscan`の出力だけを信用しない',
  '**反映済み** | 保存したrevisionをUpdaterが受理',
  '設定の反映状態とhostの到達状態は別',
  'helper未導入',
  '**接続不可**',
  '中央Updaterを導入するだけなら既存の直接配置を変えません',
  'Control Panel自身をこの例の自動更新targetに追加する場合',
  '中央UpdaterのNode登録、Configure Token / Runtime Tokenの再生成',
  '`system_updates.execute`と`secrets.update`の両方が必要',
  '## managed hostを削除する',
  '中央Updaterは削除したhostのSSH秘密鍵を自動廃棄',
  '同じhost IDを再追加して保存すると新しいSSH鍵',
];
for (const marker of requiredOperationsMarkers) {
  if (!operationsGuide.includes(marker)) {
    throw new Error(`docs/operations/system-updates.md is missing updater operations marker: ${marker}`);
  }
}

const forbiddenMarkers = [
  'known_hosts',
  '--init-from',
  'autostream-updater.json.example',
  'sudoedit /etc/autostream/updater.json',
  'local inventory',
  'local policy',
  'GitHub tokenを中央の`updater.json`',
  'GitHub Tokenを中央の`updater.json`',
  'GitHub token、API、host/target inventory',
  'GitHub Token、API、host/target inventory',
  '同じtoken-free commandを再実行',
  '同じtoken-free Auto Configure command',
  '安全チェックポイントとして意図的に非ゼロ終了',
  'Configure Tokenを要求・消費せず',
  'validate-config`後に再起動',
  'activation成功と`validate-config`を確認した後に中央Updaterを再起動',
  'strict `known_hosts`',
  '**反映済み** | 保存したrevisionで全hostのrestricted probeが成功',
  'SSHクライアント公開鍵のinstall待ち',
  'sudo install -d -o root -g root -m 0750 /etc/autostream',
  'private release用GitHub Token',
  'private release用GitHub token',
  'private releaseを読むGitHub Token',
  'private GitHub Releasesを読むGitHub Token',
  'private release credential',
  'private release read token',
];

for (const [path, contents] of documentation) {
  for (const marker of forbiddenMarkers) {
    if (contents.includes(marker)) {
      throw new Error(`${path} contains obsolete updater guidance: ${marker}`);
    }
  }
}

const securityGuide = readFileSync(resolve('docs/security/tokens.md'), 'utf8');
for (const marker of [
  'GitHub Release Tokenはrepositoryの公開状態にかかわらずManaged更新では必須',
  'GitHub Release TokenはControl Panelの暗号化済みsecretとして保存',
  '画面へ再表示しません',
  '更新jobを取得した中央Updaterへだけ一度限りで渡します',
  'updater.json',
  '接続identity',
]) {
  if (!securityGuide.includes(marker)) {
    throw new Error(`docs/security/tokens.md is missing updater secret marker: ${marker}`);
  }
}

const controlPanelInstallGuide = readFileSync(
  resolve('docs/services/control-panel-install.md'),
  'utf8',
);
for (const marker of [
  'Control Panel自身を自動更新targetにする場合',
  '/opt/autostream/control-panel/current',
  '中央Updaterを追加するだけなら',
  '/usr/local/bin/control-panel',
  '/usr/share/autostream-control-panel',
  '移行する必要はありません',
]) {
  if (!controlPanelInstallGuide.includes(marker)) {
    throw new Error(
      `docs/services/control-panel-install.md is missing install-mode marker: ${marker}`,
    );
  }
}

const nodeRegistrationGuide = readFileSync(
  resolve('docs/control-panel/node-agent-registration.md'),
  'utf8',
);
if (
  !nodeRegistrationGuide.includes(
    'Node作成には`api_tokens.create`、`system_updates.execute`、`secrets.update`が必要',
  )
) {
  throw new Error(
    'docs/control-panel/node-agent-registration.md is missing the Update Agent credential permission boundary',
  );
}

const rolesGuide = readFileSync(resolve('docs/control-panel/users-roles-security.md'), 'utf8');
for (const marker of [
  'host・SSH鍵・targetを含むUpdater設定の保存',
  '`system_updates.execute`と`secrets.update`の両方を要求',
]) {
  if (!rolesGuide.includes(marker)) {
    throw new Error(
      `docs/control-panel/users-roles-security.md is missing updater permission marker: ${marker}`,
    );
  }
}

console.log('Managed central Updater documentation contract passed.');
