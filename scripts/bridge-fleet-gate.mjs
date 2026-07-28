import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';

const phaseOrder = [
  'release',
  'systemd-canary',
  'docker-canary',
  'fleet-non-control',
  'fleet-control',
  'legacy-removal',
];
const receiptOrder = phaseOrder.slice(0, -1);
const phaseRanks = new Map(
  phaseOrder.map((phase, index) => [phase, index]),
);
const releaseComponents = [
  'contracts',
  'control_panel',
  'worker',
  'encoder_recorder',
  'discord_bot',
  'observability',
  'docker',
  'docs',
];
const nodeReleaseComponents = [
  'worker',
  'encoder_recorder',
  'discord_bot',
  'observability',
];
const dockerServices = [
  'control-panel',
  'discord-bot',
  'encoder-recorder',
  'observability',
  'worker',
];
const genericCanaryProofs = [
  'ssh_free_update',
  'forced_software_rollback',
  'port_change',
  'control_panel_outage_recovery',
  'agent_restart_recovery',
  'host_agent_self_update',
  'local_executor_self_update',
  'runtime_token_rotation',
  'process_kill_recovery',
  'host_reboot_recovery',
];
const dockerSourceComponents = {
  'control-panel': 'control_panel',
  'discord-bot': 'discord_bot',
  'encoder-recorder': 'encoder_recorder',
  observability: 'observability',
  worker: 'worker',
};
const minimumBakeHours = 24;
const repoRoot = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..'),
);

const commitPattern = /^[0-9a-f]{40}$/i;
const rawSha256Pattern = /^[0-9a-f]{64}$/i;
const digestPattern = /^sha256:[0-9a-f]{64}$/i;
const versionPattern = /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const identifierPattern = /^[a-z0-9][a-z0-9._-]*$/i;
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalSha256(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function isPlaceholderSha256(value) {
  return /^([0-9a-f])\1{63}$/i.test(value);
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function requireObject(value, path, errors) {
  if (!isObject(value)) {
    addError(errors, path, 'must be an object');
    return false;
  }
  return true;
}

function requireArray(value, path, errors, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    addError(errors, path, 'must be an array');
    return false;
  }
  if (nonEmpty && value.length === 0) {
    addError(errors, path, 'must not be empty');
    return false;
  }
  return true;
}

function requireString(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(errors, path, 'must be a non-empty string');
    return false;
  }
  return true;
}

function requireEvidence(value, path, errors) {
  if (typeof value !== 'string' || !digestPattern.test(value)) {
    addError(
      errors,
      path,
      'must be a sha256:<64-hex> evidence bundle reference',
    );
    return false;
  }
  if (isPlaceholderSha256(value.slice('sha256:'.length))) {
    addError(errors, path, 'placeholder SHA-256 is forbidden');
    return false;
  }
  return true;
}

function requireRawSha256(value, path, errors) {
  if (typeof value !== 'string' || !rawSha256Pattern.test(value)) {
    addError(errors, path, 'must be a 64-hex SHA-256');
    return false;
  }
  if (isPlaceholderSha256(value)) {
    addError(errors, path, 'placeholder SHA-256 is forbidden');
    return false;
  }
  return true;
}

function requireDigest(value, path, errors) {
  if (typeof value !== 'string' || !digestPattern.test(value)) {
    addError(errors, path, 'must be a sha256:<64-hex> digest');
    return false;
  }
  if (isPlaceholderSha256(value.slice('sha256:'.length))) {
    addError(errors, path, 'placeholder SHA-256 is forbidden');
    return false;
  }
  return true;
}

function requireEnum(value, allowed, path, errors) {
  if (!allowed.includes(value)) {
    addError(errors, path, `must be one of: ${allowed.join(', ')}`);
    return false;
  }
  return true;
}

function requireInteger(value, minimum, maximum, path, errors) {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    addError(errors, path, `must be an integer in ${minimum}..${maximum}`);
    return false;
  }
  return true;
}

function parseTimestamp(
  value,
  path,
  errors,
  { rejectFuture = true } = {},
) {
  const match =
    typeof value === 'string' ? timestampPattern.exec(value) : null;
  let calendarValid = false;
  if (match !== null) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const offsetHour = match[8] === 'Z' ? 0 : Number(match[10]);
    const offsetMinute = match[8] === 'Z' ? 0 : Number(match[11]);
    const leapYear =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [
      31,
      leapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    calendarValid =
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= monthDays[month - 1] &&
      hour <= 23 &&
      minute <= 59 &&
      second <= 59 &&
      offsetHour <= 23 &&
      offsetMinute <= 59;
  }
  if (
    match === null ||
    !calendarValid ||
    Number.isNaN(Date.parse(value))
  ) {
    addError(errors, path, 'must be an RFC 3339 timestamp with timezone');
    return null;
  }
  const timestamp = Date.parse(value);
  if (rejectFuture && timestamp > Date.now()) {
    addError(errors, path, 'must not be in the future');
  }
  return timestamp;
}

function normalizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-.\s]+/g, '_')
    .toLowerCase();
}

function isSecretLikeKey(key, parentPath) {
  const normalized = normalizeKey(key);
  if (
    normalized === 'runtime_token_rotation' &&
    /^\$\.hosts\[\d+\]\.canary\.proofs$/.test(parentPath)
  ) {
    return false;
  }
  return /(?:^|_)(?:token|secret|password|passwd|credential|credentials|private_key|api_key|authorization|auth_header|cookie|bearer|identity)(?:_|$)/.test(
    normalized,
  );
}

const secretValuePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~-]{16,}\b/i,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /\b(?:https?|mysql|postgres|postgresql):\/\/[^\s<>"']+:[^\s<>"']+@[^\s<>"']+/i,
  /\bautostream_session\s*=\s*[A-Za-z0-9._-]{12,}/i,
];

function scanSecrets(value, path, errors) {
  if (typeof value === 'string') {
    if (secretValuePatterns.some((pattern) => pattern.test(value))) {
      addError(errors, path, 'secret-like value is forbidden');
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      scanSecrets(entry, `${path}[${index}]`, errors);
    });
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSecretLikeKey(key, path)) {
      addError(errors, childPath, 'secret-like key is forbidden');
    }
    scanSecrets(child, childPath, errors);
  }
}

function validateWindow(operation, errors) {
  if (!requireObject(operation, '$.operation', errors)) return null;
  requireString(operation.operator, '$.operation.operator', errors);
  if (!requireObject(operation.window, '$.operation.window', errors)) {
    return null;
  }
  requireString(operation.window.id, '$.operation.window.id', errors);
  const startsAt = parseTimestamp(
    operation.window.starts_at,
    '$.operation.window.starts_at',
    errors,
    { rejectFuture: false },
  );
  const endsAt = parseTimestamp(
    operation.window.ends_at,
    '$.operation.window.ends_at',
    errors,
    { rejectFuture: false },
  );
  if (startsAt !== null && endsAt !== null && endsAt <= startsAt) {
    addError(
      errors,
      '$.operation.window.ends_at',
      'must be after starts_at',
    );
  }
  return { endsAt, startsAt };
}

function expectedAssetNames(component, version) {
  const hostPrefix = {
    worker: 'autostream-worker',
    encoder_recorder: 'autostream-encoder-recorder',
    discord_bot: 'autostream-discord-bot',
    observability: 'autostream-observability',
  }[component];
  if (hostPrefix) {
    return [
      `${hostPrefix}_${version}_linux_amd64.tar.gz`,
      `${hostPrefix}_${version}_linux_amd64.tar.gz.sha256`,
      `${hostPrefix}_${version}_linux_arm64.tar.gz`,
      `${hostPrefix}_${version}_linux_arm64.tar.gz.sha256`,
      'release-manifest.json',
      'release-manifest.json.sha256',
    ].sort();
  }
  if (component === 'contracts') {
    return [
      `autostream-contracts_${version}.tar.gz`,
      `autostream-contracts_${version}.tar.gz.sha256`,
    ].sort();
  }
  if (component === 'docs') {
    return [
      `autostream-docs_${version}_static.tar.gz`,
      `autostream-docs_${version}_static.tar.gz.sha256`,
    ].sort();
  }
  if (component === 'docker') {
    return ['release-manifest.json', 'release-manifest.json.sha256'];
  }
  return [
    `autostream-control-panel_${version}_linux_amd64.tar.gz`,
    `autostream-control-panel_${version}_linux_amd64.tar.gz.sha256`,
    `autostream-control-panel_${version}_linux_arm64.tar.gz`,
    `autostream-control-panel_${version}_linux_arm64.tar.gz.sha256`,
    `autostream-update-host_${version}_linux_amd64.tar.gz`,
    `autostream-update-host_${version}_linux_amd64.tar.gz.sha256`,
    `autostream-update-host_${version}_linux_arm64.tar.gz`,
    `autostream-update-host_${version}_linux_arm64.tar.gz.sha256`,
    `autostream-host-agent_${version}_linux_amd64.tar.gz`,
    `autostream-host-agent_${version}_linux_amd64.tar.gz.sha256`,
    `autostream-host-agent_${version}_linux_arm64.tar.gz`,
    `autostream-host-agent_${version}_linux_arm64.tar.gz.sha256`,
    'host-agent-manifest.json',
    'host-agent-manifest.json.sha256',
    'release-manifest.json',
    'release-manifest.json.sha256',
    'update-host-bootstrap-manifest.json',
    'update-host-bootstrap-manifest.json.sha256',
  ].sort();
}

function validateAssetSet(component, version, assetSet, path, errors) {
  if (!requireObject(assetSet, path, errors)) return;
  if (requireArray(assetSet.names, `${path}.names`, errors, { nonEmpty: true })) {
    const actual = assetSet.names.filter((name) => typeof name === 'string');
    assetSet.names.forEach((name, index) => {
      if (typeof name !== 'string' || name.trim() === '') {
        addError(errors, `${path}.names[${index}]`, 'must be an asset name');
      } else if (name.includes('/') || name.includes('\\')) {
        addError(errors, `${path}.names[${index}]`, 'must be a basename');
      }
    });
    const expected = expectedAssetNames(component, version);
    if (
      actual.length !== assetSet.names.length ||
      JSON.stringify([...actual].sort()) !== JSON.stringify(expected)
    ) {
      addError(
        errors,
        `${path}.names`,
        `must equal the exact ${expected.length}-asset ${component} set`,
      );
    }
  }
  requireRawSha256(
    assetSet.metadata_sha256,
    `${path}.metadata_sha256`,
    errors,
  );
  requireEvidence(
    assetSet.checksum_evidence,
    `${path}.checksum_evidence`,
    errors,
  );
  requireEvidence(
    assetSet.attestation_evidence,
    `${path}.attestation_evidence`,
    errors,
  );
}

function validateDockerImages(images, path, errors) {
  if (!requireArray(images, path, errors, { nonEmpty: true })) return;
  const services = [];
  images.forEach((image, index) => {
    const imagePath = `${path}[${index}]`;
    if (!requireObject(image, imagePath, errors)) return;
    if (
      requireEnum(
        image.service,
        dockerServices,
        `${imagePath}.service`,
        errors,
      )
    ) {
      services.push(image.service);
    }
    requireDigest(
      image.manifest_digest,
      `${imagePath}.manifest_digest`,
      errors,
    );
    requireEvidence(
      image.manifest_attestation_evidence,
      `${imagePath}.manifest_attestation_evidence`,
      errors,
    );
    if (
      requireObject(
        image.platforms,
        `${imagePath}.platforms`,
        errors,
      )
    ) {
      requireDigest(
        image.platforms.amd64,
        `${imagePath}.platforms.amd64`,
        errors,
      );
      requireDigest(
        image.platforms.arm64,
        `${imagePath}.platforms.arm64`,
        errors,
      );
      const platformKeys = Object.keys(image.platforms).sort();
      if (
        JSON.stringify(platformKeys) !==
        JSON.stringify(['amd64', 'arm64'])
      ) {
        addError(
          errors,
          `${imagePath}.platforms`,
          'must contain exactly amd64 and arm64',
        );
      }
    }
  });
  if (
    JSON.stringify([...services].sort()) !==
    JSON.stringify([...dockerServices].sort())
  ) {
    addError(
      errors,
      path,
      'must contain exactly the five AutoStream image services',
    );
  }
}

function validateDockerSourceVersions(sourceVersions, releases, path, errors) {
  if (!requireObject(sourceVersions, path, errors)) return;
  const expectedServices = Object.keys(dockerSourceComponents).sort();
  if (
    JSON.stringify(Object.keys(sourceVersions).sort()) !==
    JSON.stringify(expectedServices)
  ) {
    addError(
      errors,
      path,
      'must contain exactly the five Docker source services',
    );
  }
  for (const service of expectedServices) {
    const sourcePath = `${path}.${service}`;
    const source = sourceVersions[service];
    if (!requireObject(source, sourcePath, errors)) continue;
    const release = releases[dockerSourceComponents[service]];
    if (source.version !== release.version) {
      addError(
        errors,
        `${sourcePath}.version`,
        `must equal release_matrix.${dockerSourceComponents[service]}.version`,
      );
    }
    if (source.commit !== release.commit) {
      addError(
        errors,
        `${sourcePath}.commit`,
        `must equal release_matrix.${dockerSourceComponents[service]}.commit`,
      );
    }
  }
}

function validateRelease(component, release, errors) {
  const path = `$.release_matrix.${component}`;
  if (!requireObject(release, path, errors)) {
    return { commit: null, releasedAt: null, version: null };
  }
  let version = null;
  if (
    requireString(release.version, `${path}.version`, errors) &&
    versionPattern.test(release.version)
  ) {
    version = release.version;
  } else if (typeof release.version === 'string') {
    addError(errors, `${path}.version`, 'must be a v-prefixed semver');
  }
  let commit = null;
  if (
    typeof release.commit === 'string' &&
    commitPattern.test(release.commit)
  ) {
    commit = release.commit;
  } else {
    addError(errors, `${path}.commit`, 'must be a 40-hex commit');
  }
  const releasedAt = parseTimestamp(
    release.released_at,
    `${path}.released_at`,
    errors,
  );
  if (release.immutable !== true) {
    addError(errors, `${path}.immutable`, 'must be true');
  }
  requireEvidence(
    release.release_evidence,
    `${path}.release_evidence`,
    errors,
  );
  requireEvidence(
    release.tag_commit_evidence,
    `${path}.tag_commit_evidence`,
    errors,
  );
  if (version !== null) {
    validateAssetSet(
      component,
      version,
      release.asset_set,
      `${path}.asset_set`,
      errors,
    );
  } else {
    requireObject(release.asset_set, `${path}.asset_set`, errors);
  }
  if (component === 'docker') {
    validateDockerImages(release.images, `${path}.images`, errors);
  }
  return { commit, releasedAt, version };
}

function validateReleaseMatrix(matrix, errors) {
  const releases = {};
  if (!requireObject(matrix, '$.release_matrix', errors)) {
    return { latestReleasedAt: null, releases };
  }
  for (const component of releaseComponents) {
    releases[component] = validateRelease(
      component,
      matrix[component],
      errors,
    );
  }
  validateDockerSourceVersions(
    matrix.docker?.source_versions,
    releases,
    '$.release_matrix.docker.source_versions',
    errors,
  );
  const extra = Object.keys(matrix).filter(
    (component) => !releaseComponents.includes(component),
  );
  if (extra.length > 0) {
    addError(
      errors,
      '$.release_matrix',
      `contains unknown components: ${extra.sort().join(', ')}`,
    );
  }

  const contracts = releases.contracts.releasedAt;
  const controlPanel = releases.control_panel.releasedAt;
  const docker = releases.docker.releasedAt;
  const docs = releases.docs.releasedAt;
  const nodes = nodeReleaseComponents.map(
    (component) => releases[component].releasedAt,
  );
  if (
    contracts !== null &&
    controlPanel !== null &&
    contracts >= controlPanel
  ) {
    addError(
      errors,
      '$.release_matrix',
      'Contracts must be released before Control Panel',
    );
  }
  if (
    controlPanel !== null &&
    nodes.some(
      (timestamp) =>
        timestamp !== null && timestamp <= controlPanel,
    )
  ) {
    addError(
      errors,
      '$.release_matrix',
      'all Node releases must follow Control Panel',
    );
  }
  if (
    docker !== null &&
    nodes.some(
      (timestamp) => timestamp !== null && timestamp >= docker,
    )
  ) {
    addError(
      errors,
      '$.release_matrix',
      'all Node releases must precede Docker',
    );
  }
  if (docker !== null && docs !== null && docker >= docs) {
    addError(
      errors,
      '$.release_matrix',
      'Docker must be released before Docs',
    );
  }
  const timestamps = Object.values(releases)
    .map((release) => release.releasedAt)
    .filter((timestamp) => timestamp !== null);
  return {
    latestReleasedAt:
      timestamps.length === releaseComponents.length
        ? Math.max(...timestamps)
        : null,
    releases,
  };
}

function validatePortSet(ports, runtime, path, errors) {
  if (!requireObject(ports, path, errors)) return;
  if (runtime === 'systemd') {
    requireInteger(ports.advertised, 1024, 65535, `${path}.advertised`, errors);
    requireInteger(ports.listen, 1024, 65535, `${path}.listen`, errors);
    return;
  }
  requireInteger(ports.advertised, 1, 65535, `${path}.advertised`, errors);
  requireInteger(ports.published, 1024, 65535, `${path}.published`, errors);
  requireInteger(ports.container, 1024, 65535, `${path}.container`, errors);
}

function validateTargets(targets, runtime, path, errors) {
  const services = new Set();
  if (!requireArray(targets, path, errors, { nonEmpty: true })) {
    return services;
  }
  targets.forEach((target, index) => {
    const targetPath = `${path}[${index}]`;
    if (!requireObject(target, targetPath, errors)) return;
    if (
      requireString(target.service, `${targetPath}.service`, errors)
    ) {
      if (!identifierPattern.test(target.service)) {
        addError(
          errors,
          `${targetPath}.service`,
          'must be a stable service identifier',
        );
      }
      if (services.has(target.service)) {
        addError(errors, `${targetPath}.service`, 'must be unique');
      }
      services.add(target.service);
    }
    validatePortSet(
      target.current_ports,
      runtime,
      `${targetPath}.current_ports`,
      errors,
    );
  });
  return services;
}

function validateRollback(rollback, runtime, currentServices, path, errors) {
  if (!requireObject(rollback, path, errors)) return;
  if (
    requireString(rollback.version, `${path}.version`, errors) &&
    !versionPattern.test(rollback.version)
  ) {
    addError(errors, `${path}.version`, 'must be a v-prefixed semver');
  }
  if (
    typeof rollback.commit !== 'string' ||
    !commitPattern.test(rollback.commit)
  ) {
    addError(errors, `${path}.commit`, 'must be a 40-hex commit');
  }
  if (rollback.verified !== true) {
    addError(errors, `${path}.verified`, 'must be true');
  }
  requireEvidence(rollback.evidence, `${path}.evidence`, errors);
  const baselineServices = validateTargets(
    rollback.targets,
    runtime,
    `${path}.targets`,
    errors,
  );
  if (
    JSON.stringify([...currentServices].sort()) !==
    JSON.stringify([...baselineServices].sort())
  ) {
    addError(
      errors,
      `${path}.targets`,
      'must cover exactly the current target services',
    );
  }
}

function validateTransportAndAgent(host, path, status, errors) {
  if (!requireObject(host.transport, `${path}.transport`, errors)) return;
  const transportValid = requireEnum(
    host.transport.type,
    ['ssh_v1', 'pull_v2'],
    `${path}.transport.type`,
    errors,
  );
  const epochValid = requireInteger(
    host.transport.ownership_epoch,
    0,
    Number.MAX_SAFE_INTEGER,
    `${path}.transport.ownership_epoch`,
    errors,
  );
  if (!requireObject(host.agent, `${path}.agent`, errors)) return;
  const modeValid = requireEnum(
    host.agent.mode,
    ['observer', 'active'],
    `${path}.agent.mode`,
    errors,
  );
  const reportedValid = requireInteger(
    host.agent.reported_epoch,
    0,
    Number.MAX_SAFE_INTEGER,
    `${path}.agent.reported_epoch`,
    errors,
  );
  if (requireObject(host.agent.probe, `${path}.agent.probe`, errors)) {
    if (host.agent.probe.passed !== true) {
      addError(errors, `${path}.agent.probe.passed`, 'must be true');
    }
    requireEvidence(
      host.agent.probe.evidence,
      `${path}.agent.probe.evidence`,
      errors,
    );
  }

  if (
    status === 'unmigrated' &&
    transportValid &&
    modeValid &&
    reportedValid
  ) {
    if (host.transport.type !== 'ssh_v1') {
      addError(
        errors,
        `${path}.transport.type`,
        'unmigrated host must remain ssh_v1',
      );
    }
    if (host.agent.mode !== 'observer') {
      addError(
        errors,
        `${path}.agent.mode`,
        'unmigrated Host Agent must remain observer',
      );
    }
    if (host.agent.reported_epoch !== 0) {
      addError(
        errors,
        `${path}.agent.reported_epoch`,
        'observer must report epoch 0',
      );
    }
  }
  if (
    status === 'migrated' &&
    transportValid &&
    epochValid &&
    modeValid &&
    reportedValid
  ) {
    if (host.transport.type !== 'pull_v2') {
      addError(
        errors,
        `${path}.transport.type`,
        'migrated host must use pull_v2',
      );
    }
    if (host.transport.ownership_epoch < 1) {
      addError(
        errors,
        `${path}.transport.ownership_epoch`,
        'pull_v2 epoch must be positive',
      );
    }
    if (host.agent.mode !== 'active') {
      addError(
        errors,
        `${path}.agent.mode`,
        'migrated Host Agent must be active',
      );
    }
    if (host.agent.reported_epoch !== host.transport.ownership_epoch) {
      addError(
        errors,
        `${path}.agent.reported_epoch`,
        'must equal the pull_v2 ownership epoch',
      );
    }
  }
}

function validateMigrationActivation(host, path, migrated, errors) {
  if (!migrated) return;
  const migrationPath = `${path}.migration`;
  requireEvidence(
    host.migration.evidence,
    `${migrationPath}.evidence`,
    errors,
  );
  const activationPath = `${migrationPath}.activation`;
  if (!requireObject(host.migration.activation, activationPath, errors)) {
    return;
  }
  const activation = host.migration.activation;
  if (
    activation.owner !== 'pull_v2' ||
    activation.owner !== host.transport?.type
  ) {
    addError(
      errors,
      `${activationPath}.owner`,
      'must equal the activated pull_v2 transport owner',
    );
  }
  const serverEpochValid = requireInteger(
    activation.server_epoch,
    1,
    Number.MAX_SAFE_INTEGER,
    `${activationPath}.server_epoch`,
    errors,
  );
  if (
    serverEpochValid &&
    activation.server_epoch !== host.transport?.ownership_epoch
  ) {
    addError(
      errors,
      `${activationPath}.server_epoch`,
      'must equal transport.ownership_epoch',
    );
  }
  const agentEpochValid = requireInteger(
    activation.agent_reported_epoch,
    1,
    Number.MAX_SAFE_INTEGER,
    `${activationPath}.agent_reported_epoch`,
    errors,
  );
  if (
    agentEpochValid &&
    activation.agent_reported_epoch !== host.agent?.reported_epoch
  ) {
    addError(
      errors,
      `${activationPath}.agent_reported_epoch`,
      'must equal agent.reported_epoch',
    );
  }
}

function validateNetwork(network, path, migrated, errors) {
  if (!requireObject(network, path, errors)) return;

  const listenerPath = `${path}.listener_snapshot`;
  if (migrated) {
    if (requireObject(network.listener_snapshot, listenerPath, errors)) {
      for (const field of ['tcp_22_state', 'tcp_8090_state']) {
        if (network.listener_snapshot[field] !== 'absent') {
          addError(
            errors,
            `${listenerPath}.${field}`,
            'must equal absent for a migrated host',
          );
        }
      }
      requireEvidence(
        network.listener_snapshot.evidence,
        `${listenerPath}.evidence`,
        errors,
      );
    }
  } else if (network.listener_snapshot !== null) {
    addError(errors, listenerPath, 'must be null for an unmigrated host');
  }

  const firewallPath = `${path}.firewall_snapshot`;
  if (!requireObject(network.firewall_snapshot, firewallPath, errors)) return;
  for (const flag of [
    'external_tcp_22_blocked',
    'external_tcp_8090_blocked',
  ]) {
    if (typeof network.firewall_snapshot[flag] !== 'boolean') {
      addError(errors, `${firewallPath}.${flag}`, 'must be a boolean');
    } else if (migrated && network.firewall_snapshot[flag] !== true) {
      addError(
        errors,
        `${firewallPath}.${flag}`,
        'must be true for a migrated host',
      );
    }
  }
  if (migrated) {
    requireEvidence(
      network.firewall_snapshot.evidence,
      `${firewallPath}.evidence`,
      errors,
    );
  } else if (
    network.firewall_snapshot.evidence !== null &&
    network.firewall_snapshot.evidence !== undefined
  ) {
    requireEvidence(
      network.firewall_snapshot.evidence,
      `${firewallPath}.evidence`,
      errors,
    );
  }
}

function validatePassedProof(proof, path, errors) {
  if (!requireObject(proof, path, errors)) return;
  if (proof.passed !== true) {
    addError(errors, `${path}.passed`, 'must be true');
  }
  requireEvidence(proof.evidence, `${path}.evidence`, errors);
}

function validateCanary(
  canary,
  host,
  path,
  migrationCompletedAt,
  controlPanelRelease,
  errors,
) {
  if (canary === null || canary === undefined) {
    return { completedAt: null, present: false };
  }
  if (!requireObject(canary, path, errors)) {
    return { completedAt: null, present: false };
  }
  if (host.role !== 'non_control') {
    addError(errors, path, 'canary host must have role non_control');
  }
  if (canary.runtime !== host.runtime) {
    addError(errors, `${path}.runtime`, 'must equal the host runtime');
  }
  if (canary.passed !== true) {
    addError(errors, `${path}.passed`, 'must be true');
  }
  const completedAt = parseTimestamp(
    canary.completed_at,
    `${path}.completed_at`,
    errors,
  );
  if (
    completedAt !== null &&
    migrationCompletedAt !== null &&
    completedAt < migrationCompletedAt
  ) {
    addError(
      errors,
      `${path}.completed_at`,
      'must not precede migration completion',
    );
  }
  if (!requireObject(canary.proofs, `${path}.proofs`, errors)) {
    return { completedAt, present: true };
  }
  for (const key of genericCanaryProofs) {
    validatePassedProof(
      canary.proofs[key],
      `${path}.proofs.${key}`,
      errors,
    );
  }

  const outboundPath =
    `${path}.proofs.outbound_https_with_22_8090_blocked`;
  const outbound =
    canary.proofs.outbound_https_with_22_8090_blocked;
  if (requireObject(outbound, outboundPath, errors)) {
    if (outbound.passed !== true) {
      addError(errors, `${outboundPath}.passed`, 'must be true');
    }
    if (outbound.heartbeat_accepted !== true) {
      addError(
        errors,
        `${outboundPath}.heartbeat_accepted`,
        'must be true',
      );
    }
    requireEvidence(
      outbound.heartbeat_evidence,
      `${outboundPath}.heartbeat_evidence`,
      errors,
    );
    if (outbound.job_completed !== true) {
      addError(errors, `${outboundPath}.job_completed`, 'must be true');
    }
    requireEvidence(
      outbound.job_evidence,
      `${outboundPath}.job_evidence`,
      errors,
    );
  }

  const ownershipPath = `${path}.proofs.ownership_reverse_cas`;
  const ownership = canary.proofs.ownership_reverse_cas;
  if (requireObject(ownership, ownershipPath, errors)) {
    if (ownership.passed !== true) {
      addError(errors, `${ownershipPath}.passed`, 'must be true');
    }
    const startingValid = requireInteger(
      ownership.starting_pull_epoch,
      1,
      Number.MAX_SAFE_INTEGER - 2,
      `${ownershipPath}.starting_pull_epoch`,
      errors,
    );
    const restoredValid = requireInteger(
      ownership.restored_ssh_epoch,
      2,
      Number.MAX_SAFE_INTEGER - 1,
      `${ownershipPath}.restored_ssh_epoch`,
      errors,
    );
    const resumedValid = requireInteger(
      ownership.resumed_pull_epoch,
      3,
      Number.MAX_SAFE_INTEGER,
      `${ownershipPath}.resumed_pull_epoch`,
      errors,
    );
    if (
      startingValid &&
      restoredValid &&
      ownership.restored_ssh_epoch !== ownership.starting_pull_epoch + 1
    ) {
      addError(
        errors,
        `${ownershipPath}.restored_ssh_epoch`,
        'must be the next epoch after starting_pull_epoch',
      );
    }
    if (
      restoredValid &&
      resumedValid &&
      ownership.resumed_pull_epoch !== ownership.restored_ssh_epoch + 1
    ) {
      addError(
        errors,
        `${ownershipPath}.resumed_pull_epoch`,
        'must be the next epoch after restored_ssh_epoch',
      );
    }
    if (
      resumedValid &&
      ownership.resumed_pull_epoch !== host.transport.ownership_epoch
    ) {
      addError(
        errors,
        `${ownershipPath}.resumed_pull_epoch`,
        'must equal the host current pull_v2 epoch',
      );
    }
    if (ownership.bridge_version !== controlPanelRelease.version) {
      addError(
        errors,
        `${ownershipPath}.bridge_version`,
        'must bind the Control Panel Bridge release',
      );
    }
    if (ownership.bridge_commit !== controlPanelRelease.commit) {
      addError(
        errors,
        `${ownershipPath}.bridge_commit`,
        'must bind the Control Panel Bridge commit',
      );
    }
    requireEvidence(
      ownership.evidence,
      `${ownershipPath}.evidence`,
      errors,
    );
  }

  const oldAgentPath =
    `${path}.proofs.old_agent_minimum_protocol_rejection`;
  const oldAgent = canary.proofs.old_agent_minimum_protocol_rejection;
  if (requireObject(oldAgent, oldAgentPath, errors)) {
    if (oldAgent.passed !== true) {
      addError(errors, `${oldAgentPath}.passed`, 'must be true');
    }
    if (oldAgent.reason !== 'minimum_protocol') {
      addError(
        errors,
        `${oldAgentPath}.reason`,
        'must equal minimum_protocol',
      );
    }
    if (oldAgent.minimum_recovery_protocol !== 2) {
      addError(
        errors,
        `${oldAgentPath}.minimum_recovery_protocol`,
        'must equal 2',
      );
    }
    requireEvidence(
      oldAgent.evidence,
      `${oldAgentPath}.evidence`,
      errors,
    );
  }

  const grantPath =
    `${path}.proofs.stage_grant_terminal_convergence`;
  const grant = canary.proofs.stage_grant_terminal_convergence;
  if (requireObject(grant, grantPath, errors)) {
    if (grant.passed !== true) {
      addError(errors, `${grantPath}.passed`, 'must be true');
    }
    if (grant.terminal_phase !== 'failed') {
      addError(
        errors,
        `${grantPath}.terminal_phase`,
        'must equal failed',
      );
    }
    if (grant.receipt_present !== false) {
      addError(
        errors,
        `${grantPath}.receipt_present`,
        'must be false',
      );
    }
    if (grant.replay_result !== 'no_op_success') {
      addError(
        errors,
        `${grantPath}.replay_result`,
        'must equal no_op_success',
      );
    }
    if (grant.mismatched_binding_rejected !== true) {
      addError(
        errors,
        `${grantPath}.mismatched_binding_rejected`,
        'must be true',
      );
    }
    requireEvidence(grant.evidence, `${grantPath}.evidence`, errors);
  }

  return { completedAt, present: true };
}

function validateHost(host, index, controlPanelRelease, errors) {
  const path = `$.hosts[${index}]`;
  const empty = {
    architecture: null,
    canary: false,
    canaryCompletedAt: null,
    id: null,
    index,
    migrated: false,
    migrationCompletedAt: null,
    role: null,
    runtime: null,
  };
  if (!requireObject(host, path, errors)) return empty;

  const id = requireString(
    host.execution_host_id,
    `${path}.execution_host_id`,
    errors,
  )
    ? host.execution_host_id
    : null;
  const roleValid = requireEnum(
    host.role,
    ['control_panel', 'non_control'],
    `${path}.role`,
    errors,
  );
  const runtimeValid = requireEnum(
    host.runtime,
    ['systemd', 'docker'],
    `${path}.runtime`,
    errors,
  );
  const architectureValid = requireEnum(
    host.architecture,
    ['amd64', 'arm64'],
    `${path}.architecture`,
    errors,
  );
  const services = runtimeValid
    ? validateTargets(host.targets, host.runtime, `${path}.targets`, errors)
    : new Set();
  if (runtimeValid) {
    validateRollback(
      host.rollback_baseline,
      host.runtime,
      services,
      `${path}.rollback_baseline`,
      errors,
    );
  }
  if (host.active_job !== false) {
    addError(errors, `${path}.active_job`, 'must be false');
  }
  if (host.recovery !== false) {
    addError(errors, `${path}.recovery`, 'must be false');
  }

  let status = null;
  let migrationCompletedAt = null;
  if (requireObject(host.migration, `${path}.migration`, errors)) {
    if (
      requireEnum(
        host.migration.status,
        ['unmigrated', 'migrated'],
        `${path}.migration.status`,
        errors,
      )
    ) {
      status = host.migration.status;
    }
    if (status === 'unmigrated') {
      requireString(
        host.migration.reason,
        `${path}.migration.reason`,
        errors,
      );
    }
    if (status === 'migrated') {
      migrationCompletedAt = parseTimestamp(
        host.migration.completed_at,
        `${path}.migration.completed_at`,
        errors,
      );
    }
  }
  validateTransportAndAgent(host, path, status, errors);
  const migrated = status === 'migrated';
  validateMigrationActivation(host, path, migrated, errors);
  validateNetwork(host.network, `${path}.network`, migrated, errors);
  const canary = validateCanary(
    host.canary,
    host,
    `${path}.canary`,
    migrationCompletedAt,
    controlPanelRelease,
    errors,
  );
  if (canary.present && !migrated) {
    addError(errors, `${path}.canary`, 'canary host must be migrated');
  }
  return {
    architecture: architectureValid ? host.architecture : null,
    canary: canary.present,
    canaryCompletedAt: canary.completedAt,
    id,
    index,
    migrated,
    migrationCompletedAt,
    role: roleValid ? host.role : null,
    runtime: runtimeValid ? host.runtime : null,
  };
}

function validateHosts(hosts, controlPanelRelease, errors) {
  if (!requireArray(hosts, '$.hosts', errors, { nonEmpty: true })) {
    return [];
  }
  const summaries = hosts.map((host, index) =>
    validateHost(host, index, controlPanelRelease, errors),
  );
  const seen = new Set();
  summaries.forEach((host, index) => {
    if (host.id === null) return;
    if (seen.has(host.id)) {
      addError(
        errors,
        `$.hosts[${index}].execution_host_id`,
        'must be unique',
      );
    }
    seen.add(host.id);
  });
  if (!summaries.some((host) => host.role === 'control_panel')) {
    addError(errors, '$.hosts', 'must include a control_panel host');
  }
  if (!summaries.some((host) => host.role === 'non_control')) {
    addError(errors, '$.hosts', 'must include a non_control host');
  }
  const nonControl = summaries.filter(
    (host) => host.role === 'non_control',
  );
  const control = summaries.filter(
    (host) => host.role === 'control_panel',
  );
  if (
    nonControl.some((host) => !host.migrated) &&
    control.some((host) => host.migrated)
  ) {
    addError(
      errors,
      '$.hosts',
      'Control Panel host migrated before all non-control hosts',
    );
  }
  const nonControlTimes = nonControl
    .map((host) => host.migrationCompletedAt)
    .filter((time) => time !== null);
  if (
    nonControlTimes.length === nonControl.length &&
    nonControl.length > 0
  ) {
    const latest = Math.max(...nonControlTimes);
    if (
      control.some(
        (host) =>
          host.migrated &&
          host.migrationCompletedAt !== null &&
          host.migrationCompletedAt <= latest,
      )
    ) {
      addError(
        errors,
        '$.hosts',
        'Control Panel host must migrate after every non-control host',
      );
    }
  }
  return summaries;
}

function validateRoster(roster, hosts, latestReleaseAt, errors) {
  const path = '$.control_plane_roster';
  if (!requireObject(roster, path, errors)) {
    return { exportSha256: null, exportedAt: null };
  }
  requireInteger(
    roster.revision,
    1,
    Number.MAX_SAFE_INTEGER,
    `${path}.revision`,
    errors,
  );
  const exportedAt = parseTimestamp(
    roster.exported_at,
    `${path}.exported_at`,
    errors,
  );
  if (
    exportedAt !== null &&
    latestReleaseAt !== null &&
    exportedAt <= latestReleaseAt
  ) {
    addError(
      errors,
      `${path}.exported_at`,
      'must follow the completed release matrix',
    );
  }
  const exportShaValid = requireRawSha256(
    roster.export_sha256,
    `${path}.export_sha256`,
    errors,
  );
  requireEvidence(roster.evidence, `${path}.evidence`, errors);
  if (
    requireArray(
      roster.execution_host_ids,
      `${path}.execution_host_ids`,
      errors,
      { nonEmpty: true },
    )
  ) {
    const rosterIds = roster.execution_host_ids.filter(
      (id) => typeof id === 'string' && id.trim() !== '',
    );
    roster.execution_host_ids.forEach((id, index) => {
      if (typeof id !== 'string' || id.trim() === '') {
        addError(
          errors,
          `${path}.execution_host_ids[${index}]`,
          'must be a non-empty host ID',
        );
      }
    });
    const actualIds = hosts.map((host) => host.id).filter(Boolean);
    if (
      JSON.stringify([...rosterIds].sort()) !==
      JSON.stringify([...actualIds].sort())
    ) {
      addError(
        errors,
        `${path}.execution_host_ids`,
        'must exactly match the inventory host IDs',
      );
    }
  }
  return {
    exportSha256: exportShaValid ? roster.export_sha256 : null,
    exportedAt,
  };
}

function validateReceipts(
  receipts,
  phase,
  latestReleaseAt,
  rosterExportedAt,
  releaseMatrixSha256,
  rosterExportSha256,
  errors,
) {
  const path = '$.phase_receipts';
  if (!requireObject(receipts, path, errors)) return new Map();
  const requiredCount = phaseRanks.get(phase);
  const required = receiptOrder.slice(0, requiredCount);
  for (const receiptPhase of required) {
    if (!isObject(receipts[receiptPhase])) {
      addError(
        errors,
        `${path}.${receiptPhase}`,
        'prior phase receipt is required',
      );
    }
  }
  const extras = Object.keys(receipts).filter(
    (receiptPhase) => !required.includes(receiptPhase),
  );
  if (extras.length > 0) {
    addError(
      errors,
      path,
      `must contain only prior phase receipts; unexpected: ${extras
        .sort()
        .join(', ')}`,
    );
  }

  const result = new Map();
  const seenInventorySha256 = new Set();
  let prior = null;
  for (const receiptPhase of required) {
    const receipt = receipts[receiptPhase];
    if (!requireObject(receipt, `${path}.${receiptPhase}`, errors)) {
      continue;
    }
    const completedAt = parseTimestamp(
      receipt.completed_at,
      `${path}.${receiptPhase}.completed_at`,
      errors,
    );
    const inventoryShaValid = requireRawSha256(
      receipt.inventory_sha256,
      `${path}.${receiptPhase}.inventory_sha256`,
      errors,
    );
    if (
      inventoryShaValid &&
      seenInventorySha256.has(receipt.inventory_sha256)
    ) {
      addError(
        errors,
        `${path}.${receiptPhase}.inventory_sha256`,
        'must be unique across phase receipts',
      );
    } else if (inventoryShaValid) {
      seenInventorySha256.add(receipt.inventory_sha256);
    }
    requireRawSha256(
      receipt.gate_output_sha256,
      `${path}.${receiptPhase}.gate_output_sha256`,
      errors,
    );
    const releaseBindingValid = requireRawSha256(
      receipt.release_matrix_sha256,
      `${path}.${receiptPhase}.release_matrix_sha256`,
      errors,
    );
    if (
      releaseBindingValid &&
      releaseMatrixSha256 !== null &&
      receipt.release_matrix_sha256 !== releaseMatrixSha256
    ) {
      addError(
        errors,
        `${path}.${receiptPhase}.release_matrix_sha256`,
        'must equal the current canonical release_matrix SHA-256',
      );
    }
    const rosterBindingValid = requireRawSha256(
      receipt.roster_export_sha256,
      `${path}.${receiptPhase}.roster_export_sha256`,
      errors,
    );
    if (
      rosterBindingValid &&
      rosterExportSha256 !== null &&
      receipt.roster_export_sha256 !== rosterExportSha256
    ) {
      addError(
        errors,
        `${path}.${receiptPhase}.roster_export_sha256`,
        'must equal the current Control Panel roster export SHA-256',
      );
    }
    if (prior === null) {
      if (receipt.previous_inventory_sha256 !== null) {
        addError(
          errors,
          `${path}.${receiptPhase}.previous_inventory_sha256`,
          'first receipt must use null',
        );
      }
    } else {
      requireRawSha256(
        receipt.previous_inventory_sha256,
        `${path}.${receiptPhase}.previous_inventory_sha256`,
        errors,
      );
      if (
        receipt.previous_inventory_sha256 !== prior.inventorySha256
      ) {
        addError(
          errors,
          `${path}.${receiptPhase}.previous_inventory_sha256`,
          'must equal the prior receipt inventory_sha256',
        );
      }
      if (
        completedAt !== null &&
        prior.completedAt !== null &&
        completedAt <= prior.completedAt
      ) {
        addError(
          errors,
          `${path}.${receiptPhase}.completed_at`,
          'must follow the prior phase receipt',
        );
      }
    }
    if (
      receiptPhase === 'release' &&
      completedAt !== null &&
      latestReleaseAt !== null &&
      completedAt <= latestReleaseAt
    ) {
      addError(
        errors,
        `${path}.release.completed_at`,
        'must follow the completed release matrix',
      );
    }
    if (
      receiptPhase === 'release' &&
      completedAt !== null &&
      rosterExportedAt !== null &&
      completedAt <= rosterExportedAt
    ) {
      addError(
        errors,
        `${path}.release.completed_at`,
        'must follow the Control Panel roster export',
      );
    }
    const summary = {
      completedAt,
      inventorySha256: receipt.inventory_sha256,
    };
    result.set(receiptPhase, summary);
    prior = summary;
  }
  return result;
}

function requireAfter(value, boundary, path, description, errors) {
  if (value !== null && boundary !== null && value <= boundary) {
    addError(errors, path, `must follow ${description}`);
  }
}

function requireBefore(value, boundary, path, description, errors) {
  if (value !== null && boundary !== null && value >= boundary) {
    addError(errors, path, `must precede ${description}`);
  }
}

function validatePhase(phase, hosts, receipts, errors) {
  const rank = phaseRanks.get(phase);
  const systemdCanaries = hosts.filter(
    (host) =>
      host.canary &&
      host.migrated &&
      host.role === 'non_control' &&
      host.runtime === 'systemd',
  );
  const dockerCanaries = hosts.filter(
    (host) =>
      host.canary &&
      host.migrated &&
      host.role === 'non_control' &&
      host.runtime === 'docker',
  );
  const migrated = hosts.filter((host) => host.migrated);
  const control = hosts.filter(
    (host) => host.role === 'control_panel',
  );
  const nonControl = hosts.filter(
    (host) => host.role === 'non_control',
  );

  if (phase === 'release') {
    if (migrated.length > 0 || hosts.some((host) => host.canary)) {
      addError(
        errors,
        '$.hosts',
        'release inventory must precede all migration and canary state',
      );
    }
  }
  if (rank >= phaseRanks.get('systemd-canary')) {
    if (systemdCanaries.length === 0) {
      addError(
        errors,
        '$.hosts',
        'at least one migrated non-control systemd canary is required',
      );
    }
  }
  if (phase === 'systemd-canary') {
    for (const host of dockerCanaries) {
      addError(
        errors,
        `$.hosts[${host.index}].canary`,
        'Docker canary must not precede the systemd-canary receipt',
      );
    }
  }
  if (rank >= phaseRanks.get('docker-canary')) {
    if (dockerCanaries.length === 0) {
      addError(
        errors,
        '$.hosts',
        'at least one migrated non-control Docker canary is required',
      );
    }
    const covered = new Set(
      [...systemdCanaries, ...dockerCanaries].map(
        (host) => host.architecture,
      ),
    );
    for (const architecture of new Set(
      hosts.map((host) => host.architecture).filter(Boolean),
    )) {
      if (!covered.has(architecture)) {
        addError(
          errors,
          '$.hosts',
          `canary evidence must cover fleet architecture ${architecture}`,
        );
      }
    }
  }

  const releaseReceipt = receipts.get('release')?.completedAt ?? null;
  const systemdReceipt =
    receipts.get('systemd-canary')?.completedAt ?? null;
  const dockerReceipt =
    receipts.get('docker-canary')?.completedAt ?? null;
  const nonControlReceipt =
    receipts.get('fleet-non-control')?.completedAt ?? null;
  const fleetControlReceipt =
    receipts.get('fleet-control')?.completedAt ?? null;

  for (const host of systemdCanaries) {
    requireAfter(
      host.canaryCompletedAt,
      releaseReceipt,
      `$.hosts[${host.index}].canary.completed_at`,
      'the release receipt',
      errors,
    );
    if (rank >= phaseRanks.get('docker-canary')) {
      requireBefore(
        host.canaryCompletedAt,
        systemdReceipt,
        `$.hosts[${host.index}].canary.completed_at`,
        'the systemd-canary receipt',
        errors,
      );
    }
  }
  for (const host of dockerCanaries) {
    requireAfter(
      host.canaryCompletedAt,
      systemdReceipt,
      `$.hosts[${host.index}].canary.completed_at`,
      'the systemd-canary receipt',
      errors,
    );
    if (rank >= phaseRanks.get('fleet-non-control')) {
      requireBefore(
        host.canaryCompletedAt,
        dockerReceipt,
        `$.hosts[${host.index}].canary.completed_at`,
        'the docker-canary receipt',
        errors,
      );
    }
  }

  if (
    rank >= phaseRanks.get('systemd-canary') &&
    rank <= phaseRanks.get('docker-canary')
  ) {
    if (migrated.some((host) => !host.canary)) {
      addError(
        errors,
        '$.hosts',
        'fleet hosts may not migrate before both canary phases complete',
      );
    }
  }
  if (
    rank >= phaseRanks.get('systemd-canary') &&
    rank <= phaseRanks.get('fleet-non-control') &&
    control.some((host) => host.migrated)
  ) {
    addError(
      errors,
      '$.hosts',
      'Control Panel hosts must remain unmigrated until fleet-control',
    );
  }
  if (rank >= phaseRanks.get('fleet-non-control')) {
    nonControl.forEach((host) => {
      if (!host.migrated) {
        addError(
          errors,
          `$.hosts[${host.index}].migration.status`,
          'must be migrated before fleet-non-control passes',
        );
      } else if (!host.canary) {
        requireAfter(
          host.migrationCompletedAt,
          dockerReceipt,
          `$.hosts[${host.index}].migration.completed_at`,
          'the docker-canary receipt',
          errors,
        );
      }
      if (rank >= phaseRanks.get('fleet-control')) {
        requireBefore(
          host.migrationCompletedAt,
          nonControlReceipt,
          `$.hosts[${host.index}].migration.completed_at`,
          'the fleet-non-control receipt',
          errors,
        );
      }
    });
  }
  if (rank >= phaseRanks.get('fleet-control')) {
    hosts.forEach((host) => {
      if (!host.migrated) {
        addError(
          errors,
          `$.hosts[${host.index}].migration.status`,
          'must be migrated before fleet-control passes',
        );
      }
    });
    control.forEach((host) => {
      requireAfter(
        host.migrationCompletedAt,
        nonControlReceipt,
        `$.hosts[${host.index}].migration.completed_at`,
        'the fleet-non-control receipt',
        errors,
      );
      requireBefore(
        host.migrationCompletedAt,
        fleetControlReceipt,
        `$.hosts[${host.index}].migration.completed_at`,
        'the fleet-control receipt',
        errors,
      );
    });
  }
  return {
    dockerCanaries: dockerCanaries.length,
    systemdCanaries: systemdCanaries.length,
  };
}

function validateBakeAndRemoval(
  inventory,
  window,
  receipts,
  controlPanelRelease,
  errors,
) {
  if (!requireObject(inventory.bake, '$.bake', errors)) return;
  const startedAt = parseTimestamp(
    inventory.bake.started_at,
    '$.bake.started_at',
    errors,
  );
  const completedAt = parseTimestamp(
    inventory.bake.completed_at,
    '$.bake.completed_at',
    errors,
  );
  const minimumValid = requireInteger(
    inventory.bake.minimum_hours,
    minimumBakeHours,
    8760,
    '$.bake.minimum_hours',
    errors,
  );
  if (inventory.bake.incident_free !== true) {
    addError(errors, '$.bake.incident_free', 'must be true');
  }
  requireEvidence(inventory.bake.evidence, '$.bake.evidence', errors);
  const fleetControlAt =
    receipts.get('fleet-control')?.completedAt ?? null;
  requireAfter(
    startedAt,
    fleetControlAt,
    '$.bake.started_at',
    'the fleet-control receipt',
    errors,
  );
  if (
    startedAt !== null &&
    completedAt !== null &&
    minimumValid &&
    completedAt - startedAt <
      inventory.bake.minimum_hours * 60 * 60 * 1000
  ) {
    addError(
      errors,
      '$.bake.completed_at',
      'does not satisfy minimum_hours',
    );
  }
  if (
    window?.startsAt !== null &&
    completedAt !== null &&
    window.startsAt <= completedAt
  ) {
    addError(
      errors,
      '$.operation.window.starts_at',
      'legacy removal window must start after bake completion',
    );
  }

  if (
    !requireObject(
      inventory.legacy_removal,
      '$.legacy_removal',
      errors,
    )
  ) {
    return;
  }
  if (inventory.legacy_removal.separate_release !== true) {
    addError(
      errors,
      '$.legacy_removal.separate_release',
      'must be true',
    );
  }
  if (
    requireString(
      inventory.legacy_removal.version,
      '$.legacy_removal.version',
      errors,
    )
  ) {
    if (!versionPattern.test(inventory.legacy_removal.version)) {
      addError(
        errors,
        '$.legacy_removal.version',
        'must be a v-prefixed semver',
      );
    }
    if (
      inventory.legacy_removal.version === controlPanelRelease.version
    ) {
      addError(
        errors,
        '$.legacy_removal.version',
        'must differ from the Bridge Control Panel version',
      );
    }
  }
  if (
    typeof inventory.legacy_removal.commit !== 'string' ||
    !commitPattern.test(inventory.legacy_removal.commit)
  ) {
    addError(
      errors,
      '$.legacy_removal.commit',
      'must be a 40-hex commit',
    );
  } else if (
    inventory.legacy_removal.commit === controlPanelRelease.commit
  ) {
    addError(
      errors,
      '$.legacy_removal.commit',
      'must differ from the Bridge Control Panel commit',
    );
  }
  requireEvidence(
    inventory.legacy_removal.change_evidence,
    '$.legacy_removal.change_evidence',
    errors,
  );
}

function validateInventory(phase, inventory) {
  const errors = [];
  scanSecrets(inventory, '$', errors);
  if (!requireObject(inventory, '$', errors)) {
    return { errors, summary: null };
  }
  if (inventory.schema_version !== 1) {
    addError(errors, '$.schema_version', 'must equal 1');
  }
  const window = validateWindow(inventory.operation, errors);
  const matrix = validateReleaseMatrix(inventory.release_matrix, errors);
  const controlPanelRelease =
    matrix.releases.control_panel ?? {
      commit: null,
      releasedAt: null,
      version: null,
    };
  const hosts = validateHosts(
    inventory.hosts,
    controlPanelRelease,
    errors,
  );
  const roster = validateRoster(
    inventory.control_plane_roster,
    hosts,
    matrix.latestReleasedAt,
    errors,
  );
  const receipts = validateReceipts(
    inventory.phase_receipts,
    phase,
    matrix.latestReleasedAt,
    roster.exportedAt,
    isObject(inventory.release_matrix)
      ? canonicalSha256(inventory.release_matrix)
      : null,
    roster.exportSha256,
    errors,
  );
  const canaries = validatePhase(phase, hosts, receipts, errors);
  if (phase === 'legacy-removal') {
    validateBakeAndRemoval(
      inventory,
      window,
      receipts,
      controlPanelRelease,
      errors,
    );
  } else {
    if (inventory.bake !== null) {
      addError(errors, '$.bake', 'must remain null before legacy-removal');
    }
    if (inventory.legacy_removal !== null) {
      addError(
        errors,
        '$.legacy_removal',
        'must remain null before legacy-removal',
      );
    }
  }

  return {
    errors: [...new Set(errors)].sort(),
    summary: {
      dockerCanaries: canaries.dockerCanaries,
      hosts: hosts.length,
      migrated: hosts.filter((host) => host.migrated).length,
      systemdCanaries: canaries.systemdCanaries,
    },
  };
}

function failInput(message) {
  process.stderr.write(`ERROR ${message}\n`);
  process.exitCode = 2;
}

function isInsideRepository(path) {
  const pathRelative = relative(repoRoot, path);
  return (
    pathRelative === '' ||
    (!pathRelative.startsWith(`..${sep}`) &&
      pathRelative !== '..' &&
      !isAbsolute(pathRelative))
  );
}

function main() {
  const [phase, inventoryPath, ...extra] = process.argv.slice(2);
  if (phase === undefined || inventoryPath === undefined || extra.length > 0) {
    failInput(
      'usage: node scripts/bridge-fleet-gate.mjs <phase> <inventory.json>',
    );
    return;
  }
  if (!phaseRanks.has(phase)) {
    failInput(`unknown phase: ${phase}`);
    return;
  }

  let realInventoryPath;
  try {
    realInventoryPath = realpathSync(inventoryPath);
  } catch {
    failInput(`inventory is unreadable: ${basename(inventoryPath)}`);
    return;
  }
  if (isInsideRepository(realInventoryPath)) {
    failInput(
      `inventory must be outside the repository: ${basename(inventoryPath)}`,
    );
    return;
  }

  let inventory;
  try {
    inventory = JSON.parse(readFileSync(realInventoryPath, 'utf8'));
  } catch {
    failInput(`invalid JSON inventory: ${basename(inventoryPath)}`);
    return;
  }

  const { errors, summary } = validateInventory(phase, inventory);
  if (errors.length > 0) {
    process.stderr.write(`FAIL phase=${phase} errors=${errors.length}\n`);
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `PASS phase=${phase} hosts=${summary.hosts} migrated=${summary.migrated} ` +
      `systemd_canaries=${summary.systemdCanaries} ` +
      `docker_canaries=${summary.dockerCanaries}\n`,
  );
}

main();
