import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve('docs');
const archiveRoot = resolve('docs/archive');

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return resolve(path) === archiveRoot ? [] : markdownFiles(path);
    }
    return extname(entry.name) === '.md' ? [path] : [];
  });
}

const forbidden = [
  ['retired transport name', /\bssh_v1\b/u],
  ['bridge transport name', /\bpull_v2\b/u],
  ['retired central updater config', /\/etc\/autostream\/updater\.json/u],
  ['retired identity fallback', /\/etc\/autostream\/host-agent\.json/u],
  ['retired identity directory', /\/etc\/autostream-host-agent(?:\/|\b)/u],
  ['retired executor policy path', /\/etc\/autostream-local-executor\/policy\.json/u],
  ['retired update helper', /\bautostream-update-host\b/u],
  ['retired fleet gate', /bridge-release-fleet-gate|bridge:fleet-gate/u],
  ['retired Observability bind environment', /\bOBSERVABILITY_BIND_ADDR\b/u],
  ['retired shared service token', /\bSERVICE_CALL_TOKEN\b/u],
  ['unowned Node listener field', /\bapi\.bind_host\b/u],
  ['retired systemd Node port environment', /\/opt\/autostream\/local-executor\/ports\/(?:<service>|worker|encoder-recorder|discord-bot|observability)\.env/u],
  ['retired embedded updater binary', /\bbin\/autostream-updater(?:\s|$)/u],
  ['retired unconfigured startup', /node config pending/u],
];

export function checkPhysicalEolDocumentation(read = (path) => readFileSync(path, 'utf8')) {
  const failures = [];
  const paths = [...markdownFiles(root), resolve('.github/workflows/release-docs.yml')];
  for (const path of paths) {
    const contents = read(path);
    for (const [label, pattern] of forbidden) {
      if (pattern.test(contents)) {
        failures.push(`${relative(process.cwd(), path)}: ${label}`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`active documentation still contains physical-EOL surfaces:\n${failures.join('\n')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPhysicalEolDocumentation();
  console.log('physical EOL documentation closure: PASS');
}
