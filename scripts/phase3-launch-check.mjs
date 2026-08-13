import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passed = [];
const abs = (rel) => path.join(root, rel);
const record = (ok, message) => (ok ? passed : failures).push(message);

const required = [
  'app/global-error.tsx', 'app/not-found.tsx', 'app/api/health/route.ts', 'app/robots.ts', 'app/sitemap.ts',
  'app/workspace/error.tsx', 'app/workspace/loading.tsx', 'app/workspace/not-found.tsx', 'app/workspace/layout.tsx',
  'app/workspace/leads/[id]/page.tsx', 'app/workspace/projects/[id]/page.tsx', 'app/workspace/documents/page.tsx',
  'lib/presentation/navigationContract.ts',
];
for (const rel of required) record(existsSync(abs(rel)), `Required file: ${rel}`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|css)$/i.test(name)) out.push(full);
  }
  return out;
}

const runtimeFiles = ['app', 'components', 'lib'].flatMap((dir) => walk(abs(dir)));
const legacyDomains = runtimeFiles.filter((full) => /midts\.(?:com|co\.uk)/i.test(readFileSync(full, 'utf8')));
record(legacyDomains.length === 0, legacyDomains.length ? `Legacy MIDTS domain found in: ${legacyDomains.map((p) => path.relative(root, p)).join(', ')}` : 'No legacy MIDTS domains in runtime source');

const visibleLegacyText = runtimeFiles.filter((full) => /\.tsx$/i.test(full)).filter((full) => />[^<{]*\bMIDTS\b[^<{]*</i.test(readFileSync(full, 'utf8')));
record(visibleLegacyText.length === 0, visibleLegacyText.length ? `Visible MIDTS text found in: ${visibleLegacyText.map((p) => path.relative(root, p)).join(', ')}` : 'No visible MIDTS text in runtime TSX');

if (existsSync(abs('app/sitemap.ts'))) {
  const sitemap = readFileSync(abs('app/sitemap.ts'), 'utf8');
  record(!['/step-2', '/quote-acceptance', '/vendor-pricing'].some((route) => sitemap.includes(route)), 'Sitemap contains only current public routes');
}
if (existsSync(abs('app/workspace/error.tsx'))) {
  const source = readFileSync(abs('app/workspace/error.tsx'), 'utf8');
  record(!source.includes('error.message'), 'Workspace error UI hides raw thrown messages');
}
if (existsSync(abs('lib/presentation/navigationContract.ts'))) {
  const source = readFileSync(abs('lib/presentation/navigationContract.ts'), 'utf8');
  for (const token of ["'primary'", "'contextual'", "'utility'"]) record(source.includes(token), `Navigation placement: ${token}`);
}

async function remoteSmoke(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  for (const route of ['/', '/login', '/privacy', '/terms', '/cookie-policy', '/robots.txt', '/sitemap.xml', '/api/health']) {
    try {
      const response = await fetch(`${base}${route}`, { redirect: 'manual' });
      record(response.status >= 200 && response.status < 400, `${route} returned ${response.status}`);
    } catch (error) {
      record(false, `${route} request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    const response = await fetch(`${base}/workspace`, { redirect: 'manual' });
    const location = response.headers.get('location') || '';
    record(response.status >= 300 && response.status < 400 && location.includes('/login'), `/workspace protected with ${response.status} redirect`);
  } catch (error) {
    record(false, `/workspace request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.argv.includes('--smoke')) {
  const urlArg = process.argv.find((value) => value.startsWith('--url='));
  const baseUrl = urlArg?.slice(6) || process.env.PHASE3_BASE_URL;
  if (baseUrl) await remoteSmoke(baseUrl);
  else record(false, 'Remote smoke needs PHASE3_BASE_URL or --url=https://...');
}
for (const message of passed) console.log(`PASS ${message}`);
for (const message of failures) console.error(`FAIL ${message}`);
if (failures.length) process.exit(1);
console.log(`Phase 3 checks passed: ${passed.length}`);
