import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return resolve(path) === resolve('docs/archive') ? [] : markdownFiles(path);
    }
    return extname(entry.name) === '.md' ? [path] : [];
  });
}

function readDocument(path) {
  return readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n');
}

// The integration-owner gate remains in docs:check. Only retired bridge
// requirements are replaced; recovery, identity, release and token checks stay.
export function checkUpdaterDocumentation(read = readDocument) {
  function requireMarkers(path, markers) {
    const contents = read(path);
    for (const marker of markers) {
      if (!contents.includes(marker)) {
        throw new Error(path + ' is missing Updater v2 marker: ' + marker);
      }
    }
    return contents;
  }

  const exactRecoverySafetyMarkers = [
    'rescue modeは再stage・再applyしません。',
    'journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。',
    'systemd conditionを回避しないでください。',
  ];

  const forbiddenRecoverySafetyMarkers = [
    'rescue modeは再stage・再applyします',
    'rescue modeは再stage・再applyしてください',
    'rescue modeは再stage・再applyしてよい',
    'journal、ledger、checkpoint、marker、guardを手動削除・編集します',
    'journal、ledger、checkpoint、marker、guardを手動削除・編集してください',
    'journal、ledger、checkpoint、marker、guardを手動削除・編集してよい',
    'systemd conditionを回避します',
    'systemd conditionを回避してください',
    'systemd conditionを回避してよい',
  ];

  function requireExactRecoverySafetyContract(path) {
    const contents = read(path);
    for (const marker of exactRecoverySafetyMarkers) {
      if (!contents.includes(marker)) {
        throw new Error(`${path} is missing exact negative recovery safety marker: ${marker}`);
      }
    }
    for (const marker of forbiddenRecoverySafetyMarkers) {
      if (contents.includes(marker)) {
        throw new Error(`${path} contains forbidden affirmative recovery safety marker: ${marker}`);
      }
    }
  }

  const operationsPath = 'docs/operations/system-updates.md';
  const registrationPath = 'docs/control-panel/node-agent-registration.md';
  const dockerPath = 'docs/deployment/docker.md';
  const hostDeploymentPath = 'docs/deployment/host.md';
  const firstInstallPath = 'docs/runbooks/first-install.md';
  const hostOperationsPath = 'docs/services/host-operations.md';
  const controlPanelInstallPath = 'docs/services/control-panel-install.md';
  const tokensPath = 'docs/security/tokens.md';
  const hardeningPath = 'docs/security/hardening.md';

  for (const path of [
    operationsPath,
    registrationPath,
    hostDeploymentPath,
    firstInstallPath,
    hostOperationsPath,
    controlPanelInstallPath,
    tokensPath,
    hardeningPath,
  ]) {
    requireExactRecoverySafetyContract(path);
  }


  const operations = requireMarkers(operationsPath, [
    "protocol major 2",
    "Control Panelはorchestration",
    "outbound polling",
    "root Local Executor",
    "5つのApplication Runtime Identity Probes",
    "listener.credential",
    "node-listener.json",
    "LoadCredential",
    "/etc/autostream/updater/agent.yaml",
    "/etc/autostream/updater/executor-policy.json",
    "root:autostream-host-agent 0640",
    "root:root 0600",
    "source/CIとは別",
    "短命・single-use grant",
    "whole-releaseだけ",
    "専用directiveとgrant",
    "/opt/autostream/host-agent/slots/{a,b}",
    "prepare、stage、proof、activate、finalize",
    "/etc/autostream/updater/agent.staged.yaml",
    "local purgeだけではControl Panel",
    "物理消去も保証しません"
  ]);

  const registration = requireMarkers(registrationPath, [
    "endpointless",
    "outbound HTTPS",
    "固定Unix socket",
    "受信TCP listenerは開きません",
    "/etc/autostream/updater/agent.yaml",
    "/etc/autostream/updater/executor-policy.json",
    "YAML専用",
    "JSON入力",
    "server-owned",
    "protocol major 2",
    "single-use",
    "/run/autostream-local-executor/executor.sock",
    "5つのApplication Runtime Identity Probes",
    "listener.credential",
    "CREDENTIALS_DIRECTORY",
    "LoadCredential",
    "local fileの削除はserver側revokeの証拠にはなりません"
  ]);

  const docker = requireMarkers(dockerPath, [
    "protocol major 2",
    "`autostream-host-agent`",
    "outbound HTTPS",
    "受信TCP",
    "Unix socket",
    "container listen port",
    "host published port",
    "reverse proxy public port",
    "`port_reconfigure`",
    "`127.0.0.1`固定",
    "/opt/autostream/local-executor/docker/ports/<service>.env",
    "approved frozen Compose baseline",
    "configs:",
    "content: |",
    "/run/autostream-credentials/node-listener.json",
    "CREDENTIALS_DIRECTORY",
    "reverse proxy設定は自動変更しない"
  ]);

  const hostDeployment = requireMarkers(hostDeploymentPath, [
    "runtime serviceを1つずつ明示的にrestartします",
    "各commandの直後",
    "成功してから次へ進みます",
    "Control Panelを最後に",
    "componentごとにrepositoryとtagを一致",
    "/operations/system-updates",
    "listener.credential: node-listener.json",
    "LoadCredential",
    "api.host"
  ]);

  const firstInstall = requireMarkers(firstInstallPath, [
    "4つのruntime serviceが`v1.3.1`",
    "古いreleaseへ読み替えず",
    "`autostream-contracts`",
    "単独導入するdaemonやrelease archiveはありません",
    "/etc/autostream/updater/agent.yaml",
    "/operations/system-updates"
  ]);

  const hostOperations = requireMarkers(hostOperationsPath, [
    "autostream-control-panel_v1.9.11_linux_amd64/",
    "/operations/system-updates",
    "Configure Tokenは不要",
    "必ず読みます"
  ]);

  requireMarkers(tokensPath, ["/etc/autostream/updater/agent.yaml","独立Updater"]);

  requireMarkers(hardeningPath, ["/etc/autostream/updater/agent.yaml","独立Updater"]);

  requireMarkers(controlPanelInstallPath, ['/operations/system-updates', 'protocol major 2']);

  requireMarkers('docs/configuration/environment-variables.md', [
    'listener:',
    '  credential: node-listener.json',
    'schema_version: 2',
    'service_type',
    'bind_address',
    'config_revision',
    'CREDENTIALS_DIRECTORY',
    'LoadCredential',
    'fail closed',
  ]);
  requireMarkers('docs/services/runtime-usage.md', [
    'listener.credential',
    'node-listener.json',
    'assignment-scoped secret reference',
    'Application Runtime Identity Probes',
    'fail closed',
  ]);

  const literalServiceGuides = [
    [
      'docs/services/control-panel-install.md',
      'v1.9.11',
      'gh release download v1.9.11 --repo Kome-Lab/Autostream-ControlPanel',
      'autostream-control-panel_v1.9.11_linux_amd64.tar.gz',
      'install-autostream-control-panel',
    ],
    [
      'docs/services/encoder-recorder-install.md',
      'v1.3.1',
      'gh release download v1.3.1 --repo Kome-Lab/Autostream-Encoder-Recorder',
      'autostream-encoder-recorder_v1.3.1_linux_amd64.tar.gz',
      'install-autostream-encoder-recorder',
    ],
    [
      'docs/services/worker-install.md',
      'v1.3.1',
      'gh release download v1.3.1 --repo Kome-Lab/Autostream-Worker',
      'autostream-worker_v1.3.1_linux_amd64.tar.gz',
      'install-autostream-worker',
    ],
    [
      'docs/services/discord-bot-install.md',
      'v1.3.1',
      'gh release download v1.3.1 --repo Kome-Lab/Autostream-DiscordBot',
      'autostream-discord-bot_v1.3.1_linux_amd64.tar.gz',
      'install-autostream-discord-bot',
    ],
    [
      'docs/services/observability-install.md',
      'v1.3.1',
      'gh release download v1.3.1 --repo Kome-Lab/Autostream-Observability',
      'autostream-observability_v1.3.1_linux_amd64.tar.gz',
      'install-autostream-observability',
    ],
  ];
  const literalServiceContents = literalServiceGuides.map(
    ([path, releaseTag, download, archive, installer]) => [
      path,
      requireMarkers(path, [
        `公開\`${releaseTag}\``,
        download,
        archive,
        installer,
      ]),
    ],
  );

  const literalArchiveGuides = [
    [firstInstallPath, firstInstall],
    [hostDeploymentPath, hostDeployment],
    [hostOperationsPath, hostOperations],
    [operationsPath, operations],
    [registrationPath, registration],
    ...literalServiceContents,
  ];
  const staleReleaseClaims = [
    '`v1.9.11`は未公開',
    '`v1.3.1`は未公開',
    '`v1.9.11` / `v1.3.1`は未公開',
    '未公開のarchive-only候補',
    '現在は未公開',
  ];
  for (const [path, contents] of literalArchiveGuides) {
    if (contents.includes('vX.Y.Z')) {
      throw new Error(`${path} contains a forbidden archive version placeholder`);
    }
    if (
      /(?:^|\n)\s*(?:export\s+)?(?:VERSION|TAG|RELEASE_TAG|RELEASE_VERSION)=/.test(
        contents,
      ) ||
      /\$(?:\{(?:VERSION|TAG|RELEASE_TAG|RELEASE_VERSION)\}|VERSION|TAG|RELEASE_TAG|RELEASE_VERSION)\b/.test(
        contents,
      )
    ) {
      throw new Error(`${path} contains a forbidden shell release-version variable`);
    }
    if (/--pattern[^\n]*(?:sha256|release-manifest)/.test(contents)) {
      throw new Error(`${path} downloads a manual-install sidecar`);
    }
    for (const claim of staleReleaseClaims) {
      if (contents.includes(claim)) {
        throw new Error(`${path} contains a stale release claim: ${claim}`);
      }
    }
  }

  const upgradeSectionStart = hostDeployment.indexOf('## 既存環境を更新するとき');
  if (upgradeSectionStart < 0) {
    throw new Error(`${hostDeploymentPath} is missing the existing-environment upgrade section`);
  }
  const upgradeSection = hostDeployment.slice(upgradeSectionStart);
  const orderedUpgradeInstalls = [
    'sudo ./autostream-encoder-recorder_v1.3.1_linux_amd64/install-autostream-encoder-recorder',
    'sudo ./autostream-worker_v1.3.1_linux_amd64/install-autostream-worker',
    'sudo ./autostream-discord-bot_v1.3.1_linux_amd64/install-autostream-discord-bot',
    'sudo ./autostream-observability_v1.3.1_linux_amd64/install-autostream-observability',
    'sudo ./autostream-control-panel_v1.9.11_linux_amd64/install-autostream-control-panel',
  ];
  let previousUpgradeInstall = -1;
  for (const marker of orderedUpgradeInstalls) {
    const index = upgradeSection.indexOf(marker);
    if (index < 0) {
      throw new Error(`${hostDeploymentPath} is missing upgrade install marker: ${marker}`);
    }
    if (index <= previousUpgradeInstall) {
      throw new Error(`${hostDeploymentPath} has an unsafe upgrade install order at: ${marker}`);
    }
    previousUpgradeInstall = index;
  }
  const orderedUpgradeRestarts = [
    'sudo systemctl restart autostream-encoder-recorder',
    'sudo systemctl restart autostream-worker',
    'sudo systemctl restart autostream-discord-bot',
    'sudo systemctl restart autostream-observability',
    'sudo systemctl restart autostream-control-panel',
  ];
  let previousUpgradeRestart = -1;
  for (const marker of orderedUpgradeRestarts) {
    const index = upgradeSection.indexOf(marker);
    if (index < 0) {
      throw new Error(`${hostDeploymentPath} is missing upgrade restart marker: ${marker}`);
    }
    if (index <= previousUpgradeRestart) {
      throw new Error(`${hostDeploymentPath} has an unsafe upgrade restart order at: ${marker}`);
    }
    previousUpgradeRestart = index;
  }


  const exactIdentityKeys = ['panel_url', 'node_id', 'runtime_token', 'service_name'];
  for (const [path, contents] of [[operationsPath, operations], [registrationPath, registration]]) {
    const identityBlock = contents.match(/\x60\x60\x60yaml\s*\n(panel_url:[\s\S]*?)\n\x60\x60\x60/);
    if (!identityBlock) throw new Error(path + ' is missing the four-field Agent identity YAML');
    // This is deliberately a narrow example grammar, not a permissive YAML parser.
    const fields = identityBlock[1].split('\n').filter((line) => line.trim() !== '');
    const keys = fields.map((line) => {
      const field = line.match(/^([a-z_]+): "[^"\r\n]+"$/);
      if (!field) throw new Error(path + ' has an invalid Agent identity example');
      return field[1];
    }).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...exactIdentityKeys].sort())) {
      throw new Error(path + ' Agent identity must have exactly: ' + exactIdentityKeys.join(', '));
    }
  }

  const orderedOperationsMarkers = [
    "## 新規installとconfigure",
    "## 更新jobの実行",
    "## 結果、recovery、rollback",
    "## Host Agent / Local Executorの自己更新",
    "## Runtime Token rotation",
    "## 撤去"
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
    [
      "docs/index.md",
      "物理ホスト単位のHost Agent"
    ],
    [
      "docs/control-panel/index.md",
      "protocol major 2"
    ],
    [
      "docs/.vitepress/config.ts",
      "独立Updaterとシステム更新"
    ],
    [
      "docs/control-panel/page-usage.md",
      "`emergency-revoke`"
    ],
    [
      "docs/services/control-panel-install.md",
      "generic再生成してはいけません"
    ]
  ];

  for (const [path, marker] of navigationMarkers) {
    if (!read(path).includes(marker)) {
      throw new Error(`${path} is missing Updater navigation marker: ${marker}`);
    }
  }


  const documentation = markdownFiles(resolve('docs')).map((path) => [path, read(path)]);
  const unsafeTokenGuidance = [
    'Host Agentは\x60panel_url\x60、\x60node_id\x60、\x60runtime_token\x60、\x60service_name\x60だけのidentityを更新してください',
    '漏えいの疑いがある場合は Node登録の Configuration で再生成します',
  ];
  for (const [path, contents] of documentation) {
    for (const guidance of unsafeTokenGuidance) {
      if (contents.includes(guidance)) {
        throw new Error(path + ' contains unsafe generic Runtime Token guidance: ' + guidance);
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkUpdaterDocumentation();
  console.log('Updater v2 documentation contract passed.');
}
