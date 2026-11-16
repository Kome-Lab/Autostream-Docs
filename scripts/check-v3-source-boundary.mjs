import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const baseline = 'dc856739caf11bd4b255e53b4311528ab35062e8';
const manifestPath = 'scripts/v3-source-patches.json';
const canonical = (data) => data.toString('utf8').replace(/\r\n/g, '\n');
const digest = (data) => createHash('sha256').update(canonical(data)).digest('hex');
const git = (...args) => execFileSync('git', args);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.baseline, baseline);
assert.equal(manifest.schema, 1);
const changed = new Map(canonical(git('diff', '--name-status', baseline, 'HEAD')).trim().split('\n').filter(Boolean).map((line) => {
  const [status, path] = line.split('\t');
  assert.ok(status === 'A' || status === 'M', 'preserved source deleted or renamed');
  assert.ok(path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'), 'unsafe source path');
  return [path, status];
}));
const owned = [...Object.keys(manifest.new), ...Object.keys(manifest.patches), manifestPath];
assert.equal(owned.length, new Set(owned).size, 'overlapping source ownership');
assert.deepEqual([...changed.keys()].sort(), [...owned].sort(), 'diff does not match exact reviewed source manifest');
git('merge-base', '--is-ancestor', baseline, 'HEAD');
git('diff', '--exit-code', 'HEAD', '--');
for (const [path, expected] of Object.entries(manifest.new)) {
  assert.equal(changed.get(path), 'A');
  assert.equal(digest(readFileSync(path)), expected, 'new source digest: ' + path);
}
for (const [path, patch] of Object.entries(manifest.patches)) {
  assert.equal(changed.get(path), 'M');
  let expected = canonical(git('show', baseline + ':' + path));
  assert.equal(digest(expected), patch.before_sha256, 'original source changed: ' + path);
  for (const edit of patch.edits) {
    assert.ok(edit.old && expected.split(edit.old).length === 2, 'nonunique patch anchor: ' + path);
    expected = expected.replace(edit.old, edit.new);
  }
  assert.equal(canonical(readFileSync(path)), expected, 'unreviewed source change: ' + path);
  assert.equal(digest(expected), patch.after_sha256);
}
const before = JSON.parse(canonical(git('show', baseline + ':package.json')));
const after = JSON.parse(readFileSync('package.json', 'utf8'));
for (const key of ['dependencies', 'devDependencies', 'overrides', 'engines']) assert.deepEqual(after[key], before[key], 'unrelated dependency/toolchain change');
assert.equal(canonical(readFileSync('package-lock.json')), canonical(git('show', baseline + ':package-lock.json')), 'lockfile pin changed');
for (const [key, value] of Object.entries(before.scripts)) assert.equal(after.scripts[key], value, 'existing verification script changed');
assert.equal(canonical(readFileSync('.github/workflows/release-docs.yml')), canonical(git('show', baseline + ':.github/workflows/release-docs.yml')), 'release workflow changed');
const oldCI = canonical(git('show', baseline + ':.github/workflows/ci.yml'));
const newCI = canonical(readFileSync('.github/workflows/ci.yml'));
assert.ok(newCI.startsWith(oldCI), 'existing CI jobs/steps/pins/triggers changed');
assert.doesNotMatch(newCI.slice(oldCI.length), /(?:\bdocker\s+(?:push|login)\b|\bgh\s+release\b|\bgit\s+push\b|action-gh-release|build-push-action|(?:packages|contents):\s*write|workflow_dispatch:|workflow_call:|\$\{\{\s*secrets\.)/i, 'CI extension contains a publication or credential path');
const tested = canonical(git('log', '-1', '--format=%H%n%T')).trim().split('\n');
console.log(JSON.stringify({ commit: tested[0], tree: tested[1], added: Object.keys(manifest.new).length, modified: Object.keys(manifest.patches).length, source_boundary: 'PASS' }));
