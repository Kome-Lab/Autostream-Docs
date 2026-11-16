import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const rootArgument = process.argv[2];
assert.ok(rootArgument && isAbsolute(rootArgument), 'explicit disposable source root required');
const root = realpathSync(rootArgument);
const register = JSON.parse(readFileSync('implementation-unit-register.json', 'utf8'));
const known = new Set(['cp', 'updater', 'observability', 'docker', 'contracts', 'encoder']);
const seen = new Set();
let paths = 0;
for (const source of register.sources) {
  assert.ok(known.has(source.id) && !seen.has(source.id), 'unknown/duplicate source owner');
  seen.add(source.id);
  const directory = realpathSync(join(root, source.id));
  assert.ok(relative(root, directory) === source.id && lstatSync(directory).isDirectory(), 'source checkout escapes disposable root');
  const sha = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(sha, source.commit, 'source commit mismatch: ' + source.id);
  execFileSync('git', ['-C', directory, 'diff', '--exit-code', 'HEAD', '--']);
  for (const path of source.paths) {
    assert.ok(typeof path === 'string' && path && !isAbsolute(path) && !path.includes('\\') && path.split('/').every((x) => x && x !== '..' && x !== '.'), 'unsafe source path');
    const full = resolve(directory, path);
    assert.ok(!relative(directory, full).startsWith('..') && lstatSync(full).isFile() && !lstatSync(full).isSymbolicLink(), 'source path missing or not a regular file: ' + source.id + '/' + path);
    const text = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
    assert.ok(text.length > 0, 'empty source path');
    for (const literal of source.required_literals?.[path] ?? []) assert.ok(text.includes(literal), 'source content not confirmed: ' + source.id + '/' + path);
    paths++;
  }
}
assert.deepEqual([...seen].sort(), [...known].sort(), 'fixed source owners incomplete');
const sameBytes = (a, b) => assert.ok(readFileSync(a).equals(readFileSync(b)), 'fixed consumer vector differs from owner source');
const fixtureDir = 'internal/notifications/testdata';
for (const name of ['provider-accepted-local-known', 'provider-ack-unknown', 'provider-accepted-local-unknown']) {
  sameBytes(join(root, 'observability', fixtureDir, name + '.json'), join(root, 'cp', 'web/tests/fixtures/v3-workstreams/ws5-' + name + '.json'));
}
const canonical = join(root, 'updater', 'internal/releasequalification/testdata/conformance.json');
sameBytes(canonical, join(root, 'docker', 'testdata/v3-release-requirements/conformance.json'));
console.log(JSON.stringify({ source_commits: seen.size, regular_paths_content_checked: paths, notification_vector_pairs: 3, requirements_vector_sha256: createHash('sha256').update(readFileSync(canonical)).digest('hex'), product_acceptance: 'NOT_RUN', operational_exercise: 'NOT_RUN' }));
