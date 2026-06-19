import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = join(process.cwd(), '..');
const repos = [
  'autostream-contracts',
  'autostream-control-panel',
  'autostream-discord-bot',
  'autostream-encoder-recorder',
  'autostream-worker',
  'autostream-observability',
  'autostream-docs',
];

const extensions = new Set(['.md', '.txt', '.yaml', '.yml', '.json']);
const includeNames = new Set(['.env.example']);
const skipDirs = new Set(['node_modules', 'dist', '.vitepress', '.git']);
const skipFiles = new Set(['check-secrets.mjs']);

const detectors = [
  {
    name: 'discord_bot_token',
    pattern: /\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}\b/,
  },
  {
    name: 'discord_webhook_url',
    pattern: /https:\/\/discord\.com\/api\/webhooks\/[0-9]{8,}\/[A-Za-z0-9_-]{20,}/,
  },
  {
    name: 'slack_webhook_url',
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]{8,}\/[A-Za-z0-9]{8,}\/[A-Za-z0-9]{16,}/,
  },
  {
    name: 'slack_token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  },
  {
    name: 'google_api_key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: 'github_token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: 'credential_url',
    pattern: /\b(?:rtmp|rtmps|rtsp|srt|https?):\/\/[^\s<>"']+:[^\s<>"']+@[^\s<>"']+/i,
  },
  {
    name: 'database_url_with_password',
    pattern: /\b(?:mysql|postgres|postgresql):\/\/[^\s<>"']+:[^\s<>"']+@[^\s<>"']+/i,
  },
  {
    name: 'local_admin_password',
    pattern: /\bAUTOSTREAM_LOCAL_ADMIN_PASSWORD\s*=\s*[^\s<>"']{8,}/i,
  },
  {
    name: 'local_admin_password_b64',
    pattern: /\bAUTOSTREAM_LOCAL_ADMIN_PASSWORD_B64\s*=\s*[A-Za-z0-9+/=]{12,}/i,
  },
  {
    name: 'session_cookie',
    pattern: /\bautostream_session\s*=\s*[A-Za-z0-9._-]{12,}/i,
  },
  {
    name: 'csrf_token',
    pattern: /\bcsrf(?:_token)?\s*[:=]\s*[A-Za-z0-9._-]{12,}/i,
  },
  {
    name: 'bearer_token',
    pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/,
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  },
  {
    name: 'private_key_block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

const findings = [];

function redactedFinding(location, detectorName) {
  return `${location}: ${detectorName}: secret-like value redacted`;
}

function extname(path) {
  const index = path.lastIndexOf('.');
  return index >= 0 ? path.slice(index) : '';
}

function shouldScan(file) {
  return includeNames.has(basename(file)) || extensions.has(extname(file));
}

function sanitizeLineForSecretScan(line) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;[^&]+&gt;/g, '')
    .replace(/\b(?:example_)?password_change_me\b/gi, '')
    .replace(/\bchange_me\b/gi, '')
    .replace(/\bdev-only-[A-Za-z0-9._-]+\b/gi, '')
    .replace(/\bexample\.(?:com|net|org)\b/g, 'example.invalid')
    .replace(/https:\/\/example\.com\b/g, 'https://example.invalid');
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (skipFiles.has(basename(full)) || !shouldScan(full)) continue;

    const body = readFileSync(full, 'utf8');
    const lines = body.split(/\r?\n/);
    lines.forEach((line, index) => {
      const scannedLine = sanitizeLineForSecretScan(line);
      for (const detector of detectors) {
        if (detector.pattern.test(scannedLine)) {
          findings.push(redactedFinding(`${relative(root, full)}:${index + 1}`, detector.name));
        }
      }
    });
  }
}

for (const repo of repos) {
  walk(join(root, repo));
}

if (findings.length > 0) {
  console.error('Potential real secrets were found:');
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log('No obvious real secrets found in AutoStream docs/examples.');
