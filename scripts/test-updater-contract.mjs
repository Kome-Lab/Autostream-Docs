import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { checkUpdaterDocumentation } from './check-updater-contract.mjs';
import { checkPhysicalEolDocumentation } from './check-physical-eol.mjs';

const read = (path) => readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n');

test('v2 guides satisfy the retained documentation contract', () => {
  assert.doesNotThrow(() => checkUpdaterDocumentation(read));
  assert.doesNotThrow(() => checkPhysicalEolDocumentation(read));
});

function mutatedRead(path, before, after) {
  const target = resolve(path);
  const source = read(path);
  assert.ok(source.includes(before), 'mutation must affect its intended fixture');
  const mutated = source.replace(before, after);
  assert.notEqual(mutated, source);
  return (candidate) => resolve(candidate) === target ? mutated : read(candidate);
}

const guides = [
  'docs/operations/system-updates.md',
  'docs/control-panel/node-agent-registration.md',
  'docs/deployment/host.md',
  'docs/runbooks/first-install.md',
  'docs/services/host-operations.md',
  'docs/services/control-panel-install.md',
  'docs/security/tokens.md',
  'docs/security/hardening.md',
];
const safety = [
  ['rescue modeは再stage・再applyしません。', 'rescue modeは再stage・再applyしてください'],
  ['journal、ledger、checkpoint、marker、guardを手動削除・編集しないでください。', 'journal、ledger、checkpoint、marker、guardを手動削除・編集してください'],
  ['systemd conditionを回避しないでください。', 'systemd conditionを回避してください'],
];
for (const guide of guides) {
  for (const [negative, affirmative] of safety) {
    test(guide + ' rejects unsafe recovery guidance: ' + affirmative, () => {
      assert.throws(
        () => checkUpdaterDocumentation(mutatedRead(guide, negative, negative + '\n' + affirmative)),
        /forbidden affirmative recovery safety marker/,
      );
    });
  }
}

for (const guide of guides.slice(0, 2)) {
  test(guide + ' rejects an identity example with an extra authority field', () => {
    assert.throws(
      () => checkUpdaterDocumentation(mutatedRead(guide, 'node_id: "host-example-01"', 'node_id: "host-example-01"\nownership_epoch: "7"')),
      /Agent identity must have exactly/,
    );
  });
  test(guide + ' rejects a non-YAML identity example', () => {
    assert.throws(
      () => checkUpdaterDocumentation(mutatedRead(guide, String.fromCharCode(96).repeat(3) + 'yaml\npanel_url:', String.fromCharCode(96).repeat(3) + 'json\npanel_url:')),
      /four-field Agent identity YAML/,
    );
  });
}

test('preserved application identity probes remain required independently of Updater', () => {
  assert.throws(
    () => checkUpdaterDocumentation(mutatedRead(
      'docs/operations/system-updates.md',
      '5つのApplication Runtime Identity Probes',
      'Updater status only',
    )),
    /missing Updater v2 marker/,
  );
});

for (const retiredSurface of [
  'ssh_v1',
  'pull_v2',
  '/etc/autostream/updater.json',
  '/etc/autostream/host-agent.json',
  '/etc/autostream-host-agent/identity.json',
  '/etc/autostream-local-executor/policy.json',
  'autostream-update-host',
  'bridge-release-fleet-gate',
  'OBSERVABILITY_BIND_ADDR',
  'SERVICE_CALL_TOKEN',
  'api.bind_host',
  '/opt/autostream/local-executor/ports/worker.env',
  'bin/autostream-updater\n',
  'node config pending',
]) {
  test('active documentation rejects retired surface: ' + retiredSurface.trim(), () => {
    assert.throws(
      () => checkPhysicalEolDocumentation(mutatedRead(
        'docs/configuration/environment-variables.md',
        '# 設定項目',
        '# 設定項目\n' + retiredSurface,
      )),
      /active documentation still contains physical-EOL surfaces/,
    );
  });
}

test('release notes cannot reintroduce the retired bridge rollout', () => {
  assert.throws(
    () => checkPhysicalEolDocumentation(mutatedRead(
      '.github/workflows/release-docs.yml',
      'name: Docs Release',
      'name: Docs Release\n# pull_v2',
    )),
    /retired|bridge transport name/,
  );
});

test('Node listener credential contract cannot disappear from configuration guidance', () => {
  assert.throws(
    () => checkUpdaterDocumentation(mutatedRead(
      'docs/configuration/environment-variables.md',
      '  credential: node-listener.json',
      '  credential: alternate.json',
    )),
    /missing Updater v2 marker/,
  );
});
