import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve('.github/workflows/release-docs.yml');
const workflow = readFileSync(workflowPath, 'utf8');

const requiredMarkers = [
  'INPUT_VERSION: ${{ inputs.version }}',
  'INPUT_PUSH_RELEASE: ${{ inputs.push_release }}',
  "group: release-${{ github.repository }}-${{ github.ref_type == 'tag' && github.ref_name || inputs.version }}",
  'cancel-in-progress: false',
  'attestations: write',
  'id-token: write',
  'version="${INPUT_VERSION}"',
  'push_release="${INPUT_PUSH_RELEASE}"',
  "find . -type f ! -path './checksums.txt'",
  '(cd artifacts && sha256sum --text "${artifact}.tar.gz" > "${artifact}.tar.gz.sha256")',
  '(cd artifacts && sha256sum --check --strict "${artifact}.tar.gz.sha256")',
  'name: Attest release assets',
  'uses: actions/attest@',
  'subject-path: artifacts/*',
  'name: Require repository immutable releases',
  '"repos/${GITHUB_REPOSITORY}/immutable-releases"',
  '(.enabled == true)',
  'gh api --paginate "repos/${GITHUB_REPOSITORY}/releases?per_page=100"',
  'select(.tag_name == $tag)',
  'git/ref/tags/${RELEASE_VERSION}',
  '"${ref_sha}" != "${GITHUB_SHA}"',
  'workflow staging namespace',
  'workflow_dispatch may not overwrite or reuse it',
  'failed or partial release requires a new version',
  'id: create-draft',
  'draft_tag="${RELEASE_VERSION}-staging-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"',
  'docs-release-body.md',
  'docs-release-body.sha256',
  'AutoStream Docs ${RELEASE_VERSION}',
  '--method POST "repos/${GITHUB_REPOSITORY}/releases"',
  '-f tag_name="${DRAFT_TAG}"',
  '-f target_commitish="${GITHUB_SHA}"',
  '-f body="$(< "${release_body_path}")"',
  '-F draft=true',
  'https://uploads.github.com/repos/${GITHUB_REPOSITORY}/releases/${DRAFT_RELEASE_ID}/assets?name=${name}',
  'name: Publish verified release atomically',
  'DRAFT_RELEASE_ID: ${{ steps.create-draft.outputs.release_id }}',
  '(.draft == true)',
  "jq -j '.body'",
  'cmp -s "${release_body_path}" "${actual_body_path}"',
  'immutable-release-settings-prepublish.json',
  'appeared during staging; refusing to overwrite it',
  'moved during staging; refusing to publish mismatched assets',
  'final_draft_json="${RUNNER_TEMP}/docs-final-draft-release.json"',
  'appeared immediately before publication; refusing to overwrite it',
  '--method POST "repos/${GITHUB_REPOSITORY}/git/refs"',
  '-f ref="refs/tags/${RELEASE_VERSION}"',
  '-f sha="${GITHUB_SHA}"',
  '"${RUNNER_TEMP}/docs-owned-final-tag"',
  'Could not atomically claim tag',
  'does not resolve to workflow commit ${GITHUB_SHA} immediately before publish',
  'gh api --method DELETE "repos/${GITHUB_REPOSITORY}/git/refs/tags/${DRAFT_TAG}"',
  '--method PATCH "repos/${GITHUB_REPOSITORY}/releases/${DRAFT_RELEASE_ID}"',
  '-f tag_name="${RELEASE_VERSION}"',
  '-f target_commitish="${GITHUB_SHA}"',
  '-F draft=false',
  '.draft == false',
  '.immutable == true',
  '(.body | type == "string" and length > 0)',
  '(.body | test("^Unpublished .* staging"; "i") | not)',
  'expected_archive="autostream-docs_${RELEASE_VERSION}_static.tar.gz"',
  '(.assets | length == 2)',
  '[.assets[] | {name, size, digest}] | sort_by(.name)',
  'gh attestation verify "${asset_path}" --repo "${GITHUB_REPOSITORY}"',
  'name: Preserve failed release state for manual recovery',
  "if: ${{ always() && steps.create-draft.outputs.release_id != '' }}",
  'if [[ "${is_draft}" == "true" && "${release_tag}" == "${DRAFT_TAG}" ]]; then',
  'elif [[ "${release_tag}" == "${RELEASE_VERSION}" ]]; then',
  'all refs for manual recovery; no release or ref was deleted',
  'published-but-unverified',
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
  'continue-on-error: true',
  'softprops/action-gh-release',
  'generate_release_notes:',
  'gh api --method DELETE "repos/${GITHUB_REPOSITORY}/releases/${DRAFT_RELEASE_ID}"',
  'gh api --method DELETE "repos/${GITHUB_REPOSITORY}/git/refs/tags/${RELEASE_VERSION}"',
];

for (const marker of forbiddenMarkers) {
  if (workflow.includes(marker)) {
    throw new Error(`release-docs.yml contains an unsafe or non-portable marker: ${marker}`);
  }
}

const createDraft = workflow.indexOf('--method POST "repos/${GITHUB_REPOSITORY}/releases"');
const attest = workflow.indexOf('name: Attest release assets');
const prepublishCheck = workflow.indexOf('appeared during staging; refusing to overwrite it');
const finalNamespaceCheck = workflow.lastIndexOf(
  'appeared immediately before publication; refusing to overwrite it',
);
const finalClaim = workflow.indexOf(
  '--method POST "repos/${GITHUB_REPOSITORY}/git/refs"',
);
const finalTagCheck = workflow.lastIndexOf(
  'does not resolve to workflow commit ${GITHUB_SHA} immediately before publish',
);
const publish = workflow.indexOf(
  '--method PATCH "repos/${GITHUB_REPOSITORY}/releases/${DRAFT_RELEASE_ID}"',
);
const cleanup = workflow.indexOf('name: Preserve failed release state for manual recovery');
if (
  !(
    createDraft >= 0 &&
    attest > createDraft &&
    prepublishCheck > attest &&
    finalNamespaceCheck > prepublishCheck &&
    finalClaim > finalNamespaceCheck &&
    finalTagCheck > finalClaim &&
    publish > finalTagCheck &&
    cleanup > publish
  )
) {
  throw new Error(
    'release steps are not ordered as stage, attest, final namespace check, atomic tag claim, exact tag recheck, publish, cleanup',
  );
}

const publishedTagCheck = workflow.lastIndexOf(
  'Published tag ${RELEASE_VERSION} does not resolve to workflow commit ${GITHUB_SHA}',
);
const stagingTagDelete = workflow.indexOf(
  'gh api --method DELETE "repos/${GITHUB_REPOSITORY}/git/refs/tags/${DRAFT_TAG}"',
);
if (!(publishedTagCheck > publish && stagingTagDelete > publishedTagCheck && cleanup > stagingTagDelete)) {
  throw new Error(
    'workflow-owned staging tag may be deleted only after successful published release and final-tag verification',
  );
}
const stagingTagDeletes =
  workflow.match(
    /gh api --method DELETE "repos\/\$\{GITHUB_REPOSITORY\}\/git\/refs\/tags\/\$\{DRAFT_TAG\}"/g,
  ) ?? [];
if (stagingTagDeletes.length !== 1) {
  throw new Error('workflow-owned staging tag must have exactly one success-only deletion');
}

const finalTagClaims =
  workflow.match(/--method POST "repos\/\$\{GITHUB_REPOSITORY\}\/git\/refs"/g) ?? [];
if (finalTagClaims.length !== 1) {
  throw new Error('workflow_dispatch final tag must be atomically claimed exactly once');
}

const bodyComparisons = workflow.match(/cmp -s "\$\{release_body_path\}"/g) ?? [];
if (bodyComparisons.length !== 4) {
  throw new Error(
    'deterministic release body must be compared at draft, prepublish, final-draft, and published checkpoints',
  );
}

console.log('Docs release workflow safety contract passed.');
