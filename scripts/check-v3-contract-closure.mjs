import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const contractsCommit = 'd32ea3514b1c1010391caae0348b0ff9e751f447';
export const requiredUnits = {
  'IU-WS5-01': {
    features: ['V3-MD-024', 'V3-MD-025', 'V3-MD-026', 'V3-MD-027', 'OP-MD-017', 'OP-MD-018', 'OP-MD-019', 'OP-MD-020', 'OP-MD-021', 'OP-RL-029'],
    scenarios: ['SC-OPS-006', 'SC-CC-07', 'SC-CC-08'],
  },
  'IU-WS6-01': {
    features: ['OP-RL-001', 'OP-RL-005', 'OP-RL-014', 'OP-RL-015', 'OP-RL-018', 'OP-RL-019', 'OP-RL-020', 'OP-RL-021', 'OP-RL-022', 'OP-RL-023', 'OP-RL-026'],
    scenarios: ['SC-OPS-004', 'SC-OPS-005', 'SC-OPS-007', 'SC-CC-10'],
  },
  'IU-WS7-01': {
    features: ['V3-TR-035', 'V3-TR-036', 'V3-TR-037', 'V3-MD-029', 'OP-RL-024', 'OP-RL-025'],
    scenarios: ['SC-UI-COV-01', 'SC-UI-COV-03', 'SC-UI-VIS-01', 'SC-UI-STOP-01', 'SC-UI-PREV-01', 'SC-UI-PREV-02', 'SC-UI-PREV-03', 'SC-OPS-008'],
  },
};
const requiredOperations = ['cover', 'visual', 'stop', 'preview', 'notification', 'release-return'];
const evidenceStates = new Set(['NOT_RUN', 'SOURCE_CONFIRMED', 'SYNTHETIC_TESTED', 'NOT_QUALIFIED', 'NOT_CERTIFIED']);
const read = (path) => readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n');
const requireValue = (condition, reason) => { if (!condition) throw new Error(reason); };
const exactSet = (actual, expected) => Array.isArray(actual) && actual.length === new Set(actual).size && actual.length === expected.length && expected.every((x) => actual.includes(x));
const safePath = (path) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && path.split('/').every((part) => part && part !== '.' && part !== '..');

export function checkContractClosure(register, readFile = read) {
  requireValue(register.schema_revision === 1, 'unknown register revision');
  requireValue(register.contracts?.commit === contractsCommit && register.contracts?.logical_revision === 1 && register.contracts?.spec_ref === 'G0-LOGICAL-20261115-R1', 'frozen contract reference changed');
  requireValue(register.production_qualified === false && register.authorizes_mutation === false, 'documentation cannot qualify or authorize a product');
  requireValue(register.product_acceptance === 'NOT_RUN' && register.formal_v2_return === 'NOT_CERTIFIED', 'product/return acceptance incorrectly promoted');
  requireValue(Array.isArray(register.units) && exactSet(register.units.map((x) => x.id), Object.keys(requiredUnits)), 'required IU missing or duplicate');
  const features = new Set();
  const scenarios = new Set(['SC-UI-COV-02']);
  for (const unit of register.units) {
    const expected = requiredUnits[unit.id];
    requireValue(exactSet(unit.features, expected.features), 'Feature coverage drift: ' + unit.id);
    requireValue(exactSet(unit.scenarios, expected.scenarios), 'Scenario coverage drift: ' + unit.id);
    requireValue(unit.implementation === 'CODE_CONNECTED_AND_SYNTHETIC_SUBSET' || unit.implementation === 'IN_PROGRESS', 'IU is not full-feature acceptance');
    requireValue(unit.environment === 'NOT_QUALIFIED' && unit.product_acceptance === 'NOT_RUN', 'IU environment/acceptance incorrectly promoted');
    for (const id of unit.features) features.add(id);
    for (const id of unit.scenarios) scenarios.add(id);
  }
  requireValue(Array.isArray(register.sources) && register.sources.length >= 4, 'fixed source register missing');
  const sourceIDs = new Set();
  for (const source of register.sources) {
    requireValue(typeof source.id === 'string' && !sourceIDs.has(source.id), 'duplicate source reference');
    sourceIDs.add(source.id);
    requireValue(/^Kome-Lab\/Autostream-[A-Za-z-]+$/.test(source.repository) && /^[0-9a-f]{40}$/.test(source.commit), 'source must use an exact public repository commit');
    requireValue(Array.isArray(source.paths) && source.paths.length > 0 && source.paths.every(safePath) && new Set(source.paths).size === source.paths.length, 'source path missing or unsafe');
  }
  requireValue(Array.isArray(register.operations) && exactSet(register.operations.map((x) => x.id), requiredOperations), 'operation coverage missing or duplicate');
  const seenFeatures = new Set();
  const seenScenarios = new Set();
  const seenSources = new Set();
  for (const op of register.operations) {
    requireValue(requiredUnits[op.unit] !== undefined, 'orphan operation IU: ' + op.id);
    requireValue(Array.isArray(op.features) && op.features.length > 0 && op.features.every((id) => features.has(id)), 'orphan Feature: ' + op.id);
    requireValue(Array.isArray(op.scenarios) && op.scenarios.length > 0 && op.scenarios.every((id) => scenarios.has(id)), 'orphan Scenario: ' + op.id);
    requireValue(op.features.every((id) => requiredUnits[op.unit].features.includes(id)), 'Feature belongs to another IU: ' + op.id);
    requireValue(op.scenarios.every((id) => requiredUnits[op.unit].scenarios.includes(id) || op.id === 'cover' && id === 'SC-UI-COV-02'), 'Scenario belongs to another IU: ' + op.id);
    requireValue(Array.isArray(op.source_refs) && op.source_refs.length > 0 && op.source_refs.every((id) => sourceIDs.has(id)), 'orphan Source: ' + op.id);
    requireValue(Array.isArray(op.permissions) && op.permissions.length > 0 && op.permissions.every((x) => typeof x === 'string' && x.length > 0), 'operation permission/purpose missing: ' + op.id);
    requireValue(op.query?.mutation_resend === false && Array.isArray(op.query?.identity) && op.query.identity.length > 0, 'lookup must preserve original identity without mutation resend: ' + op.id);
    requireValue(typeof op.query.kind === 'string' && op.query.kind.length > 0, 'lookup boundary missing: ' + op.id);
    requireValue(op.production_qualified === false && op.authorizes_mutation === false, 'operation falsely qualified/authorized: ' + op.id);
    requireValue(Array.isArray(op.prohibited) && op.prohibited.includes('BLIND_MUTATION_RESEND') && op.prohibited.includes('AUTOMATIC_HOLD_RELEASE') && op.prohibited.includes('OLD_AUTHORITY_REUSE'), 'unsafe operation guidance: ' + op.id);
    requireValue(Array.isArray(op.remaining) && op.remaining.length > 0, 'unqualified remainder missing: ' + op.id);
    requireValue(op.evidence && Object.values(op.evidence).every((x) => evidenceStates.has(x)), 'unknown/incorrect evidence status: ' + op.id);
    requireValue(safePath(op.runbook?.path) && /^[a-z][a-z0-9-]*$/.test(op.runbook?.anchor ?? ''), 'unsafe Runbook reference: ' + op.id);
    const text = readFile(op.runbook.path);
    const section = new RegExp('^## ' + op.runbook.anchor + '$', 'm');
    requireValue(section.test(text), 'Runbook section missing: ' + op.id);
    const sectionText = text.split(section)[1].split(/^## /m)[0];
    for (const id of [...op.features, ...op.scenarios]) requireValue(sectionText.includes(id), 'Runbook trace reference missing: ' + id);
    for (const id of op.features) seenFeatures.add(id);
    for (const id of op.scenarios) seenScenarios.add(id);
    for (const id of op.source_refs) seenSources.add(id);
  }
  requireValue([...features].every((id) => seenFeatures.has(id)), 'Feature has no operation');
  requireValue([...scenarios].every((id) => seenScenarios.has(id)), 'Scenario has no operation');
  requireValue([...sourceIDs].every((id) => seenSources.has(id)), 'Source has no operation');
  const cover = register.operations.find((x) => x.id === 'cover');
  requireValue(cover.query.kind === 'OBSERVE_THEN_RECORD_AUDIT', 'Cover GET must disclose record/audit Writer');
  const stop = register.operations.find((x) => x.id === 'stop');
  requireValue(stop.query.kind === 'SAME_STOP_OUTCOME' && stop.query.identity.includes('source-version'), 'Stop lookup must bind source-version');
  const notification = register.operations.find((x) => x.id === 'notification');
  requireValue(notification.query.kind === 'PURE_EFFECT_INSPECT' && notification.query.identity.includes('EffectID') && notification.query.identity.includes('AttemptID'), 'Effect Inspect identity missing');
  const release = register.operations.find((x) => x.id === 'release-return');
  requireValue(release.query.kind === 'NONAUTHORITY_EVALUATION', 'requirements evaluator cannot actuate');
  return { units: register.units.length, operations: register.operations.length, features: features.size, scenarios: scenarios.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const register = JSON.parse(read('implementation-unit-register.json'));
  console.log('v3 contract/Runbook references:', checkContractClosure(register));
}
