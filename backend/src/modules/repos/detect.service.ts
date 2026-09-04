import { listAllFiles, readFileAt } from './git.service';

export interface DetectedEndpoint {
  method: string;
  path: string;
  sourceFile: string;
  line: number;
}

export interface SecretFinding {
  file: string;
  line: number;
  kind: string;
  snippet: string;
}

export interface DetectionResult {
  framework: string | null;
  language: string | null;
  detectedAt: string;
  endpoints: DetectedEndpoint[];
  openapi: { file: string; title?: string; version?: string } | null;
  authRequirements: string[];
  envVariables: { name: string; example: string }[];
  dependencies: Record<string, string>;
  secrets: SecretFinding[];
  scannedFiles: number;
}

const SECRET_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { kind: 'Stripe key', re: /sk_(live|test)_[0-9a-zA-Z]{16,}/ },
  { kind: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { kind: 'Slack token', re: /xox[baprs]-[0-9a-zA-Z-]{10,}/ },
  { kind: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { kind: 'Generic token assignment', re: /(api[_-]?key|secret|token|password|passwd|auth)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{16,}['"]/i },
];

const ENDPOINT_PATTERN = /\b(?:app|router|server|r|api)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const PY_ENDPOINT_PATTERN = /@(app|router|api)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/;

const JS_FRAMEWORKS = ['Express', 'Fastify', 'Koa', 'NestJS', 'Hapi'];
const PY_FRAMEWORKS = ['FastAPI', 'Flask', 'Django'];

function stripQuotes(v: string): string {
  return v.trim().replace(/^["']|["']$/g, '');
}

export async function detectRepo(repoId: string, ref: string): Promise<DetectionResult> {
  const files = await listAllFiles(repoId, ref);
  const result: DetectionResult = {
    framework: null, language: null, detectedAt: new Date().toISOString(),
    endpoints: [], openapi: null, authRequirements: [], envVariables: [],
    dependencies: {}, secrets: [], scannedFiles: 0,
  };

  // --- Dependencies / framework / language ---
  const pkgJson = files.find(f => f === 'package.json');
  if (pkgJson) {
    result.language = result.language || 'JavaScript/TypeScript';
    try {
      const pkg = JSON.parse(await readFileAt(repoId, ref, pkgJson));
      result.dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch { /* malformed package.json */ }
  }
  const requirements = files.find(f => /^requirements.*\.txt$/i.test(f));
  if (requirements) {
    result.language = result.language || 'Python';
    try {
      const txt = await readFileAt(repoId, ref, requirements);
      for (const line of txt.split('\n')) {
        const m = line.trim().match(/^([A-Za-z0-9_.\-\[\]]+)==?([^\s=]+)$/);
        if (m) result.dependencies[m[1]] = m[2];
      }
    } catch { /* ignore */ }
  }

  for (const fw of JS_FRAMEWORKS) {
    if (result.dependencies[fw.toLowerCase()]) { result.framework = fw; break; }
  }
  if (!result.framework) {
    for (const fw of PY_FRAMEWORKS) {
      if (result.dependencies[fw.toLowerCase()]) { result.framework = fw; break; }
    }
  }
  if (!result.framework && files.some(f => f.endsWith('.go'))) result.framework = 'Go (net/http)';
  if (!result.language) {
    if (files.some(f => f.endsWith('.py'))) result.language = 'Python';
    else if (files.some(f => f.endsWith('.go'))) result.language = 'Go';
    else if (files.some(f => f.endsWith('.java'))) result.language = 'Java';
  }

  // --- OpenAPI spec ---
  const openapiFile = files.find(f => /openapi\.(json|ya?ml)$/i.test(f) || /swagger\.(json|ya?ml)$/i.test(f));
  if (openapiFile) {
    result.openapi = { file: openapiFile };
    try {
      const raw = await readFileAt(repoId, ref, openapiFile);
      if (openapiFile.endsWith('.json')) {
        const spec = JSON.parse(raw);
        result.openapi.title = spec.info?.title;
        result.openapi.version = spec.info?.version;
      } else {
        const title = raw.match(/^title:\s*(.+)$/m);
        const ver = raw.match(/^\s*version:\s*(.+)$/m);
        if (title) result.openapi.title = stripQuotes(title[1]);
        if (ver) result.openapi.version = stripQuotes(ver[1]);
      }
    } catch { /* ignore malformed spec */ }
  }

  // --- .env.example: env variables (never read real .env) ---
  const envExample = files.find(f => /^\.env\.example$/i.test(f) || /^\.env\.sample$/i.test(f));
  if (envExample) {
    try {
      const raw = await readFileAt(repoId, ref, envExample);
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) result.envVariables.push({ name: m[1], example: stripQuotes(m[2]) });
      }
    } catch { /* ignore */ }
  }

  // --- Scan source files for endpoints, auth, secrets ---
  const sourceExts = /\.(ts|tsx|js|jsx|mjs|py|go|rb|php|java|kt)$/i;
  const secretExts = /\.(ts|tsx|js|jsx|mjs|py|go|rb|php|java|kt|json|yaml|yml|toml|conf|ini|txt|sh|env)$/i;
  for (const file of files) {
    if (/\.env$/i.test(file)) continue; // never read real .env
    if (/node_modules|(^|\/)dist\/|(^|\/)build\/|\.min\./i.test(file)) continue;
    let content: string;
    try { content = await readFileAt(repoId, ref, file); } catch { continue; }
    if (content.length > 1024 * 1024) continue;
    result.scannedFiles++;

    if (sourceExts.test(file)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (file.endsWith('.py')) {
          const fm = line.match(PY_ENDPOINT_PATTERN);
          if (fm) result.endpoints.push({ method: fm[2].toUpperCase(), path: fm[3], sourceFile: file, line: i + 1 });
        } else {
          ENDPOINT_PATTERN.lastIndex = 0;
          let em: RegExpExecArray | null;
          while ((em = ENDPOINT_PATTERN.exec(line)) !== null) {
            result.endpoints.push({ method: em[1].toUpperCase(), path: em[2], sourceFile: file, line: i + 1 });
          }
        }
      });
      const authChecks: [string, RegExp][] = [
        ['Bearer / JWT', /(jwt|jsonwebtoken|bearer\s+token|verifytoken|oauth2)/i],
        ['API Key', /(api[-_]?key|x-api-key|apikey)/i],
        ['Basic Auth', /(basic\s+auth|basicauth)/i],
        ['OAuth 2.0', /(passport|oauth2|oauth20)/i],
      ];
      for (const [label, re] of authChecks) {
        if (re.test(content) && !result.authRequirements.includes(label)) result.authRequirements.push(label);
      }
    }

    if (secretExts.test(file)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        for (const { kind, re } of SECRET_PATTERNS) {
          if (re.test(line)) {
            result.secrets.push({ file, line: i + 1, kind, snippet: line.trim().slice(0, 80) });
            break;
          }
        }
      });
    }
  }

  result.endpoints = result.endpoints.slice(0, 500);
  result.secrets = result.secrets.slice(0, 100);
  return result;
}

/** Scan a raw diff/patch text for secrets (used before merges and pushes). */
export function scanDiffForSecrets(diff: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  let currentFile = '';
  let lineNo = 0;
  for (const line of diff.split('\n')) {
    const fm = line.match(/^\+\+\+ b\/(.+)$/);
    if (fm) { currentFile = fm[1]; lineNo = 0; continue; }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNo++;
      for (const { kind, re } of SECRET_PATTERNS) {
        if (re.test(line)) {
          findings.push({ file: currentFile, line: lineNo, kind, snippet: line.slice(1).trim().slice(0, 80) });
          break;
        }
      }
    }
  }
  return findings;
}
