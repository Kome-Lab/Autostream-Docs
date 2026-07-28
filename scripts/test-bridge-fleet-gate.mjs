import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const gatePath = resolve('scripts/bridge-fleet-gate.mjs');
const testRoot = mkdtempSync(join(tmpdir(), 'autostream-bridge-fleet-gate-'));
let fixtureSequence = 0;

test.after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

function digest(label) {
  return createHash('sha256').update(label).digest('hex');
}

function evidence(label) {
  return `sha256:${digest(label)}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
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

function canonicalDigest(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
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
  if (component === 'control_panel') {
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
  throw new Error(`unknown release component fixture: ${component}`);
}

function releaseRecord(component, version, commitCharacter, releasedAt) {
  return {
    version,
    commit: commitCharacter.repeat(40),
    released_at: releasedAt,
    immutable: true,
    release_evidence: evidence(`${component}-immutable-release`),
    tag_commit_evidence: evidence(`${component}-tag-commit`),
    asset_set: {
      names: expectedAssetNames(component, version),
      metadata_sha256: digest(`${component}-asset-metadata`),
      checksum_evidence: evidence(`${component}-checksums`),
      attestation_evidence: evidence(`${component}-attestations`),
    },
  };
}

function releaseMatrix() {
  const releases = {
    contracts: releaseRecord(
      'contracts',
      'v1.2.0',
      'a',
      '2026-01-01T00:00:00Z',
    ),
    control_panel: releaseRecord(
      'control_panel',
      'v1.8.0',
      'b',
      '2026-01-01T01:00:00Z',
    ),
    worker: releaseRecord(
      'worker',
      'v1.2.0',
      'c',
      '2026-01-01T02:00:00Z',
    ),
    encoder_recorder: releaseRecord(
      'encoder_recorder',
      'v1.2.0',
      'd',
      '2026-01-01T02:00:00Z',
    ),
    discord_bot: releaseRecord(
      'discord_bot',
      'v1.2.0',
      'e',
      '2026-01-01T02:00:00Z',
    ),
    observability: releaseRecord(
      'observability',
      'v1.2.0',
      'f',
      '2026-01-01T02:00:00Z',
    ),
    docker: releaseRecord(
      'docker',
      'v1.4.0',
      '1',
      '2026-01-01T03:00:00Z',
    ),
    docs: releaseRecord(
      'docs',
      'v1.0.0',
      '2',
      '2026-01-01T04:00:00Z',
    ),
  };
  releases.docker.images = [
    'control-panel',
    'discord-bot',
    'encoder-recorder',
    'observability',
    'worker',
  ].map((service) => ({
    service,
    manifest_digest: `sha256:${digest(`${service}-manifest`)}`,
    manifest_attestation_evidence: evidence(
      `${service}-manifest-attestation`,
    ),
    platforms: {
      amd64: `sha256:${digest(`${service}-amd64`)}`,
      arm64: `sha256:${digest(`${service}-arm64`)}`,
    },
  }));
  releases.docker.source_versions = {
    'control-panel': {
      version: releases.control_panel.version,
      commit: releases.control_panel.commit,
    },
    worker: {
      version: releases.worker.version,
      commit: releases.worker.commit,
    },
    'encoder-recorder': {
      version: releases.encoder_recorder.version,
      commit: releases.encoder_recorder.commit,
    },
    'discord-bot': {
      version: releases.discord_bot.version,
      commit: releases.discord_bot.commit,
    },
    observability: {
      version: releases.observability.version,
      commit: releases.observability.commit,
    },
  };
  return releases;
}

function systemdTarget(service, port) {
  return {
    service,
    current_ports: {
      advertised: port,
      listen: port,
    },
  };
}

function dockerTarget(service, advertised, published, container) {
  return {
    service,
    current_ports: {
      advertised,
      published,
      container,
    },
  };
}

function rollbackBaseline(version, commitCharacter, targets) {
  return {
    version,
    commit: commitCharacter.repeat(40),
    verified: true,
    evidence: evidence(`rollback-${version}`),
    targets: structuredClone(targets),
  };
}

function unmigratedHost({
  executionHostId,
  role,
  runtime,
  architecture,
  targets,
  ownershipEpoch,
}) {
  return {
    execution_host_id: executionHostId,
    role,
    runtime,
    architecture,
    targets,
    rollback_baseline: rollbackBaseline('v1.1.1', 'b', targets),
    transport: {
      type: 'ssh_v1',
      ownership_epoch: ownershipEpoch,
    },
    agent: {
      mode: 'observer',
      reported_epoch: 0,
      probe: {
        passed: true,
        evidence: evidence(`${executionHostId}-probe`),
      },
    },
    active_job: false,
    recovery: false,
    migration: {
      status: 'unmigrated',
      reason: 'scheduled after canary evidence is accepted',
    },
    network: {
      listener_snapshot: null,
      firewall_snapshot: {
        external_tcp_22_blocked: false,
        external_tcp_8090_blocked: false,
        evidence: null,
      },
    },
    canary: null,
  };
}

function baseInventory() {
  const systemdTargets = [systemdTarget('worker', 8082)];
  const dockerTargets = [dockerTarget('encoder-recorder', 8083, 18083, 8083)];
  const controlPanelTargets = [systemdTarget('control-panel', 8080)];

  const inventory = {
    schema_version: 1,
    operation: {
      operator: 'operator-example',
      window: {
        id: 'maintenance-window-example',
        starts_at: '2026-01-01T05:00:00Z',
        ends_at: '2026-01-01T15:00:00Z',
      },
    },
    release_matrix: releaseMatrix(),
    hosts: [
      unmigratedHost({
        executionHostId: 'host-non-control-systemd-example',
        role: 'non_control',
        runtime: 'systemd',
        architecture: 'amd64',
        targets: systemdTargets,
        ownershipEpoch: 4,
      }),
      unmigratedHost({
        executionHostId: 'host-non-control-docker-example',
        role: 'non_control',
        runtime: 'docker',
        architecture: 'arm64',
        targets: dockerTargets,
        ownershipEpoch: 6,
      }),
      unmigratedHost({
        executionHostId: 'host-control-panel-example',
        role: 'control_panel',
        runtime: 'systemd',
        architecture: 'amd64',
        targets: controlPanelTargets,
        ownershipEpoch: 8,
      }),
    ],
    control_plane_roster: null,
    phase_receipts: {},
    bake: null,
    legacy_removal: null,
  };
  inventory.control_plane_roster = {
    revision: 57,
    exported_at: '2026-01-01T05:00:00Z',
    export_sha256: digest('control-plane-roster-export'),
    evidence: evidence('control-plane-roster'),
    execution_host_ids: inventory.hosts.map(
      (host) => host.execution_host_id,
    ),
  };
  return inventory;
}

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

const requiredCanaryProofs = [
  ...genericCanaryProofs,
  'outbound_https_with_22_8090_blocked',
  'ownership_reverse_cas',
  'old_agent_minimum_protocol_rejection',
  'stage_grant_terminal_convergence',
];

function proof(label) {
  return {
    passed: true,
    evidence: evidence(label),
  };
}

function migrateHost(host, releases, completedAt, withCanary = false) {
  const startingPullEpoch = host.transport.ownership_epoch + 1;
  host.transport.type = 'pull_v2';
  host.transport.ownership_epoch = withCanary
    ? startingPullEpoch + 2
    : startingPullEpoch;
  host.agent.mode = 'active';
  host.agent.reported_epoch = host.transport.ownership_epoch;
  host.migration = {
    status: 'migrated',
    completed_at: completedAt,
    evidence: evidence(`${host.execution_host_id}-migration-activation`),
    activation: {
      owner: 'pull_v2',
      server_epoch: host.transport.ownership_epoch,
      agent_reported_epoch: host.agent.reported_epoch,
    },
  };
  host.network = {
    listener_snapshot: {
      tcp_22_state: 'absent',
      tcp_8090_state: 'absent',
      evidence: evidence(`${host.execution_host_id}-listener-snapshot`),
    },
    firewall_snapshot: {
      external_tcp_22_blocked: true,
      external_tcp_8090_blocked: true,
      evidence: evidence(`${host.execution_host_id}-firewall-snapshot`),
    },
  };

  if (withCanary) {
    host.canary = {
      runtime: host.runtime,
      passed: true,
      completed_at: completedAt,
      proofs: {
        ...Object.fromEntries(
          genericCanaryProofs.map((key) => [
            key,
            proof(`${host.execution_host_id}-${key}`),
          ]),
        ),
        outbound_https_with_22_8090_blocked: {
          passed: true,
          heartbeat_accepted: true,
          heartbeat_evidence: evidence(
            `${host.execution_host_id}-outbound-heartbeat`,
          ),
          job_completed: true,
          job_evidence: evidence(
            `${host.execution_host_id}-outbound-job`,
          ),
        },
        ownership_reverse_cas: {
          passed: true,
          starting_pull_epoch: startingPullEpoch,
          restored_ssh_epoch: startingPullEpoch + 1,
          resumed_pull_epoch: startingPullEpoch + 2,
          bridge_version: releases.control_panel.version,
          bridge_commit: releases.control_panel.commit,
          evidence: evidence(
            `${host.execution_host_id}-ownership-reverse-cas`,
          ),
        },
        old_agent_minimum_protocol_rejection: {
          passed: true,
          reason: 'minimum_protocol',
          minimum_recovery_protocol: 2,
          evidence: evidence(`${host.execution_host_id}-old-agent-rejection`),
        },
        stage_grant_terminal_convergence: {
          passed: true,
          terminal_phase: 'failed',
          receipt_present: false,
          replay_result: 'no_op_success',
          mismatched_binding_rejected: true,
          evidence: evidence(`${host.execution_host_id}-grant-convergence`),
        },
      },
    };
  }
}

function addReceipt(inventory, phase, completedAt) {
  const order = [
    'release',
    'systemd-canary',
    'docker-canary',
    'fleet-non-control',
    'fleet-control',
  ];
  const index = order.indexOf(phase);
  const prior =
    index > 0 ? inventory.phase_receipts[order[index - 1]] : null;
  inventory.phase_receipts[phase] = {
    completed_at: completedAt,
    inventory_sha256: digest(`${phase}-inventory`),
    previous_inventory_sha256:
      prior === null ? null : prior.inventory_sha256,
    gate_output_sha256: digest(`${phase}-gate-output`),
    release_matrix_sha256: canonicalDigest(inventory.release_matrix),
    roster_export_sha256: inventory.control_plane_roster.export_sha256,
  };
}

function systemdCanaryInventory() {
  const inventory = baseInventory();
  addReceipt(inventory, 'release', '2026-01-01T06:00:00Z');
  migrateHost(
    inventory.hosts[0],
    inventory.release_matrix,
    '2026-01-01T07:00:00Z',
    true,
  );
  return inventory;
}

function dockerCanaryInventory() {
  const inventory = systemdCanaryInventory();
  addReceipt(inventory, 'systemd-canary', '2026-01-01T08:00:00Z');
  migrateHost(
    inventory.hosts[1],
    inventory.release_matrix,
    '2026-01-01T09:00:00Z',
    true,
  );
  return inventory;
}

function nonControlFleetInventory() {
  const inventory = dockerCanaryInventory();
  addReceipt(inventory, 'docker-canary', '2026-01-01T10:00:00Z');
  return inventory;
}

function controlFleetInventory() {
  const inventory = nonControlFleetInventory();
  addReceipt(inventory, 'fleet-non-control', '2026-01-01T11:00:00Z');
  migrateHost(
    inventory.hosts[2],
    inventory.release_matrix,
    '2026-01-01T12:00:00Z',
  );
  return inventory;
}

function legacyRemovalInventory() {
  const inventory = controlFleetInventory();
  addReceipt(inventory, 'fleet-control', '2026-01-01T13:00:00Z');
  inventory.operation.window = {
    id: 'legacy-removal-window-example',
    starts_at: '2026-01-02T15:00:00Z',
    ends_at: '2026-01-02T17:00:00Z',
  };
  inventory.bake = {
    started_at: '2026-01-01T14:00:00Z',
    completed_at: '2026-01-02T14:00:00Z',
    minimum_hours: 24,
    incident_free: true,
    evidence: evidence('bake'),
  };
  inventory.legacy_removal = {
    separate_release: true,
    version: 'v1.9.0',
    commit: '3'.repeat(40),
    change_evidence: evidence('legacy-removal-change'),
  };
  return inventory;
}

function writeInventory(inventory) {
  fixtureSequence += 1;
  const path = join(testRoot, `inventory-${fixtureSequence}.json`);
  writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return path;
}

function runGate(phase, inventory) {
  const inventoryPath = writeInventory(inventory);
  return spawnSync(process.execPath, [gatePath, phase, inventoryPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function assertPass(result, phase, expectedSummary) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(
    result.stdout,
    `PASS phase=${phase} ${expectedSummary}\n`,
  );
}

function assertGateFailure(result, ...expectedFragments) {
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /^FAIL phase=[a-z-]+ errors=\d+\n/);
  for (const fragment of expectedFragments) {
    assert.ok(
      result.stderr.includes(fragment),
      `expected ${JSON.stringify(fragment)} in:\n${result.stderr}`,
    );
  }
}

test('release phase accepts the complete ordered release matrix and classified inventory', () => {
  const first = runGate('release', baseInventory());
  const second = runGate('release', baseInventory());
  const expected =
    'hosts=3 migrated=0 systemd_canaries=0 docker_canaries=0';

  assertPass(first, 'release', expected);
  assertPass(second, 'release', expected);
  assert.equal(first.stdout, second.stdout);
});

test('the documented repository-external template remains invalid until placeholder proof is replaced', () => {
  const runbook = readFileSync(
    resolve('docs/runbooks/bridge-release-fleet-gate.md'),
    'utf8',
  );
  const template = runbook.match(
    /<!-- bridge-fleet-gate-template:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- bridge-fleet-gate-template:end -->/,
  );
  assert.ok(template, 'runbook inventory template marker is missing');
  const inventory = JSON.parse(template[1]);

  assertGateFailure(
    runGate('release', inventory),
    '$.release_matrix.contracts.release_evidence',
    'placeholder',
  );
});

test('secret-like keys fail closed without echoing their values', async (t) => {
  for (const key of [
    'runtime_token',
    'runtime_token_file',
    'runtime_token_rotation',
    'client_secret_path',
    'ssh_private_key_path',
    'password_source',
    'api_key_reference',
    'credential_file',
    'session_cookie',
    'bearer_header',
    'host_agent_identity',
  ]) {
    await t.test(key, () => {
      const inventory = baseInventory();
      inventory.hosts[0].metadata = {
        [key]: 'do-not-echo-private-test-value',
      };
      const result = runGate('release', inventory);

      assertGateFailure(
        result,
        `$.hosts[0].metadata.${key}`,
        'secret-like key',
      );
      assert.doesNotMatch(result.stderr, /do-not-echo-private-test-value/);
    });
  }
});

test('secret-like values fail closed even under neutral keys', () => {
  const inventory = baseInventory();
  inventory.hosts[0].note =
    'Bearer abcdefghijklmnopqrstuvwxyz0123456789';
  const result = runGate('release', inventory);

  assertGateFailure(result, '$.hosts[0].note', 'secret-like value');
  assert.doesNotMatch(
    result.stderr,
    /abcdefghijklmnopqrstuvwxyz0123456789/,
  );
});

test('all-zero and repeated-character proof digests are rejected as placeholders', () => {
  const evidencePlaceholder = baseInventory();
  evidencePlaceholder.release_matrix.contracts.release_evidence =
    `sha256:${'0'.repeat(64)}`;
  assertGateFailure(
    runGate('release', evidencePlaceholder),
    '$.release_matrix.contracts.release_evidence',
    'placeholder',
  );

  const rawPlaceholder = baseInventory();
  rawPlaceholder.release_matrix.contracts.asset_set.metadata_sha256 =
    'f'.repeat(64);
  assertGateFailure(
    runGate('release', rawPlaceholder),
    '$.release_matrix.contracts.asset_set.metadata_sha256',
    'placeholder',
  );

  const imagePlaceholder = baseInventory();
  imagePlaceholder.release_matrix.docker.images[0].manifest_digest =
    `sha256:${'a'.repeat(64)}`;
  assertGateFailure(
    runGate('release', imagePlaceholder),
    '$.release_matrix.docker.images[0].manifest_digest',
    'placeholder',
  );
});

test('release phase requires every exact release asset and Docker image proof in order', async (t) => {
  const cases = [
    ['missing Contracts release', (inventory) => {
      delete inventory.release_matrix.contracts;
    }, '$.release_matrix.contracts'],
    ['immutable Control Panel release', (inventory) => {
      inventory.release_matrix.control_panel.immutable = false;
    }, '$.release_matrix.control_panel.immutable'],
    ['Control Panel exact 18 assets', (inventory) => {
      inventory.release_matrix.control_panel.asset_set.names.pop();
    }, '$.release_matrix.control_panel.asset_set.names'],
    ['Node exact 6 assets', (inventory) => {
      inventory.release_matrix.worker.asset_set.names.pop();
    }, '$.release_matrix.worker.asset_set.names'],
    ['attestation evidence', (inventory) => {
      inventory.release_matrix.encoder_recorder.asset_set.attestation_evidence =
        'checked';
    }, '$.release_matrix.encoder_recorder.asset_set.attestation_evidence'],
    ['Contracts before Control Panel', (inventory) => {
      inventory.release_matrix.contracts.released_at =
        '2026-01-01T01:30:00Z';
    }, '$.release_matrix'],
    ['all Node releases before Docker', (inventory) => {
      inventory.release_matrix.worker.released_at =
        '2026-01-01T03:30:00Z';
    }, '$.release_matrix'],
    ['all five Docker images', (inventory) => {
      inventory.release_matrix.docker.images.pop();
    }, '$.release_matrix.docker.images'],
    ['Docker manifest digest', (inventory) => {
      inventory.release_matrix.docker.images[0].manifest_digest =
        'sha256:not-a-digest';
    }, '$.release_matrix.docker.images[0].manifest_digest'],
    ['Docker platform digest', (inventory) => {
      inventory.release_matrix.docker.images[0].platforms.arm64 =
        'sha256:not-a-digest';
    }, '$.release_matrix.docker.images[0].platforms.arm64'],
    ['Docker source version map', (inventory) => {
      delete inventory.release_matrix.docker.source_versions.worker;
    }, '$.release_matrix.docker.source_versions'],
    ['Docker source version binding', (inventory) => {
      inventory.release_matrix.docker.source_versions.worker.version =
        'v9.9.9';
    }, '$.release_matrix.docker.source_versions.worker.version'],
    ['Docker source commit binding', (inventory) => {
      inventory.release_matrix.docker.source_versions[
        'control-panel'
      ].commit = '9'.repeat(40);
    }, '$.release_matrix.docker.source_versions.control-panel.commit'],
    ['Docker source map extra', (inventory) => {
      inventory.release_matrix.docker.source_versions.extra = {
        version: 'v1.0.0',
        commit: '9'.repeat(40),
      };
    }, '$.release_matrix.docker.source_versions'],
  ];

  for (const [name, mutate, expectedPath] of cases) {
    await t.test(name, () => {
      const inventory = baseInventory();
      mutate(inventory);
      assertGateFailure(runGate('release', inventory), expectedPath);
    });
  }
});

test('Control Panel roster revision and exact execution host IDs are authoritative', () => {
  const missingHost = baseInventory();
  missingHost.control_plane_roster.execution_host_ids.pop();
  assertGateFailure(
    runGate('release', missingHost),
    '$.control_plane_roster.execution_host_ids',
  );

  const badRevision = baseInventory();
  badRevision.control_plane_roster.revision = 0;
  assertGateFailure(
    runGate('release', badRevision),
    '$.control_plane_roster.revision',
  );

  const simultaneousExport = baseInventory();
  simultaneousExport.control_plane_roster.exported_at =
    simultaneousExport.release_matrix.docs.released_at;
  assertGateFailure(
    runGate('release', simultaneousExport),
    '$.control_plane_roster.exported_at',
    'must follow',
  );
});

test('all hosts require explicit migration classification and unmigrated reason', () => {
  const missingStatus = baseInventory();
  delete missingStatus.hosts[0].migration.status;
  assertGateFailure(
    runGate('release', missingStatus),
    '$.hosts[0].migration.status',
  );

  const missingReason = baseInventory();
  missingReason.hosts[0].migration.reason = '';
  assertGateFailure(
    runGate('release', missingReason),
    '$.hosts[0].migration.reason',
  );
});

test('active jobs and recovery state stop every phase', () => {
  const active = baseInventory();
  active.hosts[0].active_job = true;
  assertGateFailure(runGate('release', active), '$.hosts[0].active_job');

  const recovering = baseInventory();
  recovering.hosts[1].recovery = true;
  assertGateFailure(runGate('release', recovering), '$.hosts[1].recovery');
});

test('systemd-canary requires a migrated non-control systemd canary', () => {
  assertGateFailure(
    runGate('systemd-canary', baseInventory()),
    'non-control systemd canary',
  );

  assertPass(
    runGate('systemd-canary', systemdCanaryInventory()),
    'systemd-canary',
    'hosts=3 migrated=1 systemd_canaries=1 docker_canaries=0',
  );

  const prematureDocker = systemdCanaryInventory();
  migrateHost(
    prematureDocker.hosts[1],
    prematureDocker.release_matrix,
    '2026-01-01T07:30:00Z',
    true,
  );
  assertGateFailure(
    runGate('systemd-canary', prematureDocker),
    '$.hosts[1].canary',
    'must not precede',
  );
});

test('canaries require rollback, self-update, token, outage, restart, update, and port proof', async (t) => {
  for (const key of requiredCanaryProofs) {
    await t.test(key, () => {
      const inventory = systemdCanaryInventory();
      delete inventory.hosts[0].canary.proofs[key];
      assertGateFailure(
        runGate('systemd-canary', inventory),
        `$.hosts[0].canary.proofs.${key}`,
      );
    });
  }
});

test('ownership rollback, minimum protocol rejection, and grant convergence are typed', () => {
  const ownership = systemdCanaryInventory();
  ownership.hosts[0].canary.proofs.ownership_reverse_cas.restored_ssh_epoch += 1;
  assertGateFailure(
    runGate('systemd-canary', ownership),
    '$.hosts[0].canary.proofs.ownership_reverse_cas.restored_ssh_epoch',
  );

  const oldAgent = systemdCanaryInventory();
  oldAgent.hosts[0].canary.proofs.old_agent_minimum_protocol_rejection.reason =
    'generic_failure';
  assertGateFailure(
    runGate('systemd-canary', oldAgent),
    '$.hosts[0].canary.proofs.old_agent_minimum_protocol_rejection.reason',
  );

  const grant = systemdCanaryInventory();
  grant.hosts[0].canary.proofs.stage_grant_terminal_convergence.receipt_present =
    true;
  assertGateFailure(
    runGate('systemd-canary', grant),
    '$.hosts[0].canary.proofs.stage_grant_terminal_convergence.receipt_present',
  );
});

test('outbound HTTPS canary proof separates heartbeat acceptance and job completion', () => {
  const missingHeartbeat = systemdCanaryInventory();
  missingHeartbeat.hosts[
    0
  ].canary.proofs.outbound_https_with_22_8090_blocked.heartbeat_accepted =
    false;
  assertGateFailure(
    runGate('systemd-canary', missingHeartbeat),
    '$.hosts[0].canary.proofs.outbound_https_with_22_8090_blocked.heartbeat_accepted',
  );

  const missingJob = systemdCanaryInventory();
  delete missingJob.hosts[
    0
  ].canary.proofs.outbound_https_with_22_8090_blocked.job_evidence;
  assertGateFailure(
    runGate('systemd-canary', missingJob),
    '$.hosts[0].canary.proofs.outbound_https_with_22_8090_blocked.job_evidence',
  );
});

test('migrated hosts require typed listener and firewall snapshots', () => {
  const tcp22 = systemdCanaryInventory();
  tcp22.hosts[
    0
  ].network.firewall_snapshot.external_tcp_22_blocked = false;
  assertGateFailure(
    runGate('systemd-canary', tcp22),
    '$.hosts[0].network.firewall_snapshot.external_tcp_22_blocked',
  );

  const tcp8090 = systemdCanaryInventory();
  tcp8090.hosts[
    0
  ].network.firewall_snapshot.external_tcp_8090_blocked = false;
  assertGateFailure(
    runGate('systemd-canary', tcp8090),
    '$.hosts[0].network.firewall_snapshot.external_tcp_8090_blocked',
  );

  const listenerPresent = systemdCanaryInventory();
  listenerPresent.hosts[0].network.listener_snapshot.tcp_8090_state =
    'loopback_only';
  assertGateFailure(
    runGate('systemd-canary', listenerPresent),
    '$.hosts[0].network.listener_snapshot.tcp_8090_state',
  );

  const missingListenerEvidence = systemdCanaryInventory();
  delete missingListenerEvidence.hosts[0].network.listener_snapshot.evidence;
  assertGateFailure(
    runGate('systemd-canary', missingListenerEvidence),
    '$.hosts[0].network.listener_snapshot.evidence',
  );

  const missingFirewallEvidence = systemdCanaryInventory();
  delete missingFirewallEvidence.hosts[0].network.firewall_snapshot.evidence;
  assertGateFailure(
    runGate('systemd-canary', missingFirewallEvidence),
    '$.hosts[0].network.firewall_snapshot.evidence',
  );
});

test('every migrated host binds activation owner and epochs to transport state', () => {
  const missingEvidence = controlFleetInventory();
  delete missingEvidence.hosts[2].migration.evidence;
  assertGateFailure(
    runGate('fleet-control', missingEvidence),
    '$.hosts[2].migration.evidence',
  );

  const wrongOwner = controlFleetInventory();
  wrongOwner.hosts[2].migration.activation.owner = 'ssh_v1';
  assertGateFailure(
    runGate('fleet-control', wrongOwner),
    '$.hosts[2].migration.activation.owner',
  );

  const staleServerEpoch = controlFleetInventory();
  staleServerEpoch.hosts[2].migration.activation.server_epoch -= 1;
  assertGateFailure(
    runGate('fleet-control', staleServerEpoch),
    '$.hosts[2].migration.activation.server_epoch',
  );

  const staleAgentEpoch = controlFleetInventory();
  staleAgentEpoch.hosts[2].migration.activation.agent_reported_epoch -= 1;
  assertGateFailure(
    runGate('fleet-control', staleAgentEpoch),
    '$.hosts[2].migration.activation.agent_reported_epoch',
  );
});

test('docker-canary requires both systemd and Docker canaries', () => {
  assertGateFailure(
    runGate('docker-canary', systemdCanaryInventory()),
    'non-control Docker canary',
  );

  assertPass(
    runGate('docker-canary', dockerCanaryInventory()),
    'docker-canary',
    'hosts=3 migrated=2 systemd_canaries=1 docker_canaries=1',
  );
});

test('Control Panel migration is blocked until every non-control host is migrated', () => {
  const inventory = systemdCanaryInventory();
  migrateHost(
    inventory.hosts[2],
    inventory.release_matrix,
    '2026-01-01T07:30:00Z',
  );

  assertGateFailure(
    runGate('systemd-canary', inventory),
    'Control Panel host migrated before all non-control hosts',
  );
});

test('fleet-non-control requires every non-control host to be migrated after both canaries', () => {
  assertGateFailure(
    runGate('fleet-non-control', systemdCanaryInventory()),
    '$.hosts[1].migration.status',
    'non-control Docker canary',
  );

  assertPass(
    runGate('fleet-non-control', nonControlFleetInventory()),
    'fleet-non-control',
    'hosts=3 migrated=2 systemd_canaries=1 docker_canaries=1',
  );
});

test('fleet-control requires all hosts and enforces Control Panel last by timestamp', () => {
  const earlyControl = controlFleetInventory();
  earlyControl.hosts[2].migration.completed_at = '2026-01-01T08:30:00Z';
  assertGateFailure(
    runGate('fleet-control', earlyControl),
    'Control Panel host must migrate after every non-control host',
  );

  assertPass(
    runGate('fleet-control', controlFleetInventory()),
    'fleet-control',
    'hosts=3 migrated=3 systemd_canaries=1 docker_canaries=1',
  );
});

test('phase receipts chain prior inventory SHA and enforce systemd then Docker chronology', () => {
  const missingReleaseReceipt = systemdCanaryInventory();
  delete missingReleaseReceipt.phase_receipts.release;
  assertGateFailure(
    runGate('systemd-canary', missingReleaseReceipt),
    '$.phase_receipts.release',
  );

  const brokenChain = dockerCanaryInventory();
  brokenChain.phase_receipts['systemd-canary'].previous_inventory_sha256 =
    digest('unrelated-inventory');
  assertGateFailure(
    runGate('docker-canary', brokenChain),
    '$.phase_receipts.systemd-canary.previous_inventory_sha256',
  );

  const reusedInventory = dockerCanaryInventory();
  reusedInventory.phase_receipts['systemd-canary'].inventory_sha256 =
    reusedInventory.phase_receipts.release.inventory_sha256;
  assertGateFailure(
    runGate('docker-canary', reusedInventory),
    '$.phase_receipts.systemd-canary.inventory_sha256',
    'must be unique',
  );

  const missingBindings = systemdCanaryInventory();
  delete missingBindings.phase_receipts.release.release_matrix_sha256;
  delete missingBindings.phase_receipts.release.roster_export_sha256;
  assertGateFailure(
    runGate('systemd-canary', missingBindings),
    '$.phase_receipts.release.release_matrix_sha256',
    '$.phase_receipts.release.roster_export_sha256',
  );

  const changedReleaseMatrix = systemdCanaryInventory();
  changedReleaseMatrix.release_matrix.worker.asset_set.metadata_sha256 =
    digest('changed-worker-asset-metadata');
  assertGateFailure(
    runGate('systemd-canary', changedReleaseMatrix),
    '$.phase_receipts.release.release_matrix_sha256',
  );

  const changedRoster = systemdCanaryInventory();
  changedRoster.control_plane_roster.export_sha256 =
    digest('changed-roster-export');
  assertGateFailure(
    runGate('systemd-canary', changedRoster),
    '$.phase_receipts.release.roster_export_sha256',
  );

  const dockerFirst = dockerCanaryInventory();
  dockerFirst.hosts[1].canary.completed_at = '2026-01-01T07:30:00Z';
  dockerFirst.hosts[1].migration.completed_at = '2026-01-01T07:30:00Z';
  assertGateFailure(
    runGate('docker-canary', dockerFirst),
    '$.hosts[1].canary.completed_at',
  );

  const receiptBeforeControlMigration = legacyRemovalInventory();
  receiptBeforeControlMigration.phase_receipts[
    'fleet-control'
  ].completed_at = '2026-01-01T11:30:00Z';
  assertGateFailure(
    runGate('legacy-removal', receiptBeforeControlMigration),
    '$.hosts[2].migration.completed_at',
    'fleet-control receipt',
  );
});

test('completed proof timestamps in the future are rejected', () => {
  const inventory = baseInventory();
  inventory.release_matrix.docs.released_at = '2999-01-01T00:00:00Z';
  assertGateFailure(
    runGate('release', inventory),
    '$.release_matrix.docs.released_at',
    'must not be in the future',
  );

  const invalidCalendarDate = baseInventory();
  invalidCalendarDate.release_matrix.docs.released_at =
    '2026-02-30T00:00:00Z';
  assertGateFailure(
    runGate('release', invalidCalendarDate),
    '$.release_matrix.docs.released_at',
    'RFC 3339',
  );
});

test('legacy-removal fails before a completed incident-free bake and separate release', () => {
  const beforeBake = controlFleetInventory();
  beforeBake.legacy_removal = {
    separate_release: true,
    version: 'v1.9.0',
    commit: '3'.repeat(40),
    change_evidence: evidence('legacy-removal-change'),
  };
  assertGateFailure(
    runGate('legacy-removal', beforeBake),
    '$.bake',
  );

  const shortBake = legacyRemovalInventory();
  shortBake.bake.completed_at = '2026-01-01T20:00:00Z';
  assertGateFailure(
    runGate('legacy-removal', shortBake),
    '$.bake.completed_at',
  );

  const sameRelease = legacyRemovalInventory();
  sameRelease.legacy_removal.version =
    sameRelease.release_matrix.control_panel.version;
  assertGateFailure(
    runGate('legacy-removal', sameRelease),
    '$.legacy_removal.version',
  );

  const earlyBake = legacyRemovalInventory();
  earlyBake.bake.started_at = '2026-01-01T12:30:00Z';
  earlyBake.bake.completed_at = '2026-01-02T12:30:00Z';
  assertGateFailure(
    runGate('legacy-removal', earlyBake),
    '$.bake.started_at',
    'fleet-control',
  );

  assertPass(
    runGate('legacy-removal', legacyRemovalInventory()),
    'legacy-removal',
    'hosts=3 migrated=3 systemd_canaries=1 docker_canaries=1',
  );
});

test('usage and JSON input errors are deterministic and use exit code 2', () => {
  const unknown = spawnSync(
    process.execPath,
    [gatePath, 'unknown-phase', writeInventory(baseInventory())],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.equal(unknown.status, 2);
  assert.equal(
    unknown.stderr,
    'ERROR unknown phase: unknown-phase\n',
  );

  fixtureSequence += 1;
  const invalidPath = join(testRoot, `inventory-${fixtureSequence}.json`);
  writeFileSync(invalidPath, '{not-json}\n', 'utf8');
  const malformed = spawnSync(
    process.execPath,
    [gatePath, 'release', invalidPath],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.equal(malformed.status, 2);
  assert.equal(
    malformed.stderr,
    `ERROR invalid JSON inventory: ${basename(invalidPath)}\n`,
  );

  const inRepository = spawnSync(
    process.execPath,
    [gatePath, 'release', resolve('package.json')],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.equal(inRepository.status, 2);
  assert.equal(
    inRepository.stderr,
    'ERROR inventory must be outside the repository: package.json\n',
  );
});
