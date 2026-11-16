import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkContractClosure } from './check-v3-contract-closure.mjs';

function fixture() {
  assert.doesNotThrow(() => readFileSync('implementation-unit-register.json'), 'v3 operation/Runbook register must exist');
  return JSON.parse(readFileSync('implementation-unit-register.json', 'utf8'));
}

test('DOC-WS7-01 all scoped Features Scenarios operations and Runbooks resolve', () => {
  assert.deepEqual(checkContractClosure(fixture()), { units: 3, operations: 6, features: 27, scenarios: 16 });
});

const mutations = [
  ['unknown contract revision', (x) => { x.contracts.logical_revision = 2; }, /frozen contract/],
  ['removed Feature', (x) => { x.units[0].features.pop(); }, /Feature coverage/],
  ['orphan Scenario', (x) => { x.operations[0].scenarios.push('SC-INVENTED'); }, /orphan Scenario/],
  ['orphan Source', (x) => { x.operations[0].source_refs = ['missing']; }, /orphan Source/],
  ['wrong Feature owner', (x) => { x.operations[0].features = ['OP-RL-001']; }, /another IU/],
  ['wrong Scenario owner', (x) => { x.operations[0].scenarios = ['SC-OPS-006']; }, /another IU/],
  ['missing permission', (x) => { x.operations[0].permissions = []; }, /permission/],
  ['automatic resend', (x) => { x.operations[0].query.mutation_resend = true; }, /mutation resend/],
  ['qualified fixture', (x) => { x.operations[0].production_qualified = true; }, /falsely qualified/],
  ['unsafe source path', (x) => { x.sources[0].paths = ['../outside']; }, /unsafe/],
  ['lost unknown remainder', (x) => { x.operations[0].remaining = []; }, /remainder/],
  ['product accepted', (x) => { x.product_acceptance = 'ACCEPTED'; }, /incorrectly promoted/],
  ['Cover mislabeled pure', (x) => { x.operations.find((o) => o.id === 'cover').query.kind = 'PURE_INSPECT'; }, /record\/audit Writer/],
  ['Stop wrong identity', (x) => { x.operations.find((o) => o.id === 'stop').query.identity = ['StreamID']; }, /source-version/],
  ['Effect wrong identity', (x) => { x.operations.find((o) => o.id === 'notification').query.identity = ['EffectID']; }, /Inspect identity/],
  ['actuating evaluator', (x) => { x.operations.find((o) => o.id === 'release-return').query.kind = 'RECOVERY_EXECUTE'; }, /cannot actuate/],
];
test('DOC-WS7-02 rejects incomplete unsafe or contradictory evidence guidance', async (t) => {
  for (const [name, mutate, pattern] of mutations) {
    await t.test(name, () => { const input = fixture(); mutate(input); assert.throws(() => checkContractClosure(input), pattern); });
  }
});

test('DOC-WS7-03 missing or mismatched Runbook section is not accepted', () => {
  assert.throws(() => checkContractClosure(fixture(), () => '# unrelated guide'), /section missing/);
});
