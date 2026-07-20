import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve('.github/workflows/release-docs.yml');
const workflow = readFileSync(workflowPath, 'utf8');

const requiredMarkers = [
  'INPUT_VERSION: ${{ inputs.version }}',
  'INPUT_PUSH_RELEASE: ${{ inputs.push_release }}',
  "group: release-${{ github.repository }}-${{ github.ref_type == 'tag' && github.ref_name || inputs.version }}",
  'cancel-in-progress: false',
  'version="${INPUT_VERSION}"',
  'push_release="${INPUT_PUSH_RELEASE}"',
  "find . -type f ! -path './checksums.txt'",
  '(cd artifacts && sha256sum --text "${artifact}.tar.gz" > "${artifact}.tar.gz.sha256")',
  '(cd artifacts && sha256sum --check --strict "${artifact}.tar.gz.sha256")',
  'gh api --paginate "repos/${GITHUB_REPOSITORY}/releases?per_page=100"',
  'select(.tag_name == $tag)',
  'git/ref/tags/${RELEASE_VERSION}',
  '--method POST "repos/${GITHUB_REPOSITORY}/git/refs"',
  '-f ref="refs/tags/${RELEASE_VERSION}"',
  '-f sha="${GITHUB_SHA}"',
  '"${ref_sha}" != "${GITHUB_SHA}"',
  'already exists (including drafts)',
  'workflow_dispatch may not overwrite or reuse it',
  'failed or partial release requires a new version',
  'target_commitish: ${{ github.sha }}',
  'fail_on_unmatched_files: true',
  'overwrite_files: false',
  'name: Verify published release',
  '.draft == false',
  'expected_archive="autostream-docs_${RELEASE_VERSION}_static.tar.gz"',
  '(.assets | length == 2)',
  '[.assets[] | {name, size, digest}] | sort_by(.name)',
  'diff -u',
];

for (const marker of requiredMarkers) {
  if (!workflow.includes(marker)) {
    throw new Error(`release-docs.yml is missing release-safety marker: ${marker}`);
  }
}

const inputExpressions = workflow.match(/\$\{\{ inputs\./g) ?? [];
if (inputExpressions.length !== 2) {
  throw new Error(
    `direct workflow dispatch input expressions must appear only in step env declarations; found ${inputExpressions.length} occurrences`,
  );
}

const forbiddenMarkers = [
  'version="${{ inputs.version }}"',
  'push_release="${{ inputs.push_release }}"',
  'find . -type f -print0',
  'sha256sum "artifacts/${artifact}.tar.gz"',
];

for (const marker of forbiddenMarkers) {
  if (workflow.includes(marker)) {
    throw new Error(`release-docs.yml contains an unsafe or non-portable marker: ${marker}`);
  }
}

console.log('Docs release workflow safety contract passed.');
