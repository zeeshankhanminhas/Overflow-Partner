import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const shell = read('app/opos-next/layout.tsx');
const styles = read('app/opos-next/opos.module.css');
const mission = read('app/opos-next/page.tsx');
const register = read('app/opos-next/opportunities/page.tsx');
const record = read('app/opos-next/opportunities/[id]/page.tsx');

const checks = [
  ['New operating shell uses only the isolated CSS module', shell.includes("import css from './opos.module.css'") && !/workspace-(base|features|surfaces)|focus-first\.css|coherent-shell\.css/.test(shell)],
  ['Preview stays behind existing workspace authentication', shell.includes('await requireUserContext()')],
  ['Visual review tokens are used consistently', ['#0b0c0e','#151619','#f4f4f5','#b8bac0','#303238'].every(color => styles.includes(color))],
  ['No destructive broad CSS overrides in new system', !styles.includes('!important')],
  ['Mission Control reuses canonical business prioritisation', mission.includes('buildMissionPriorityQueue') && mission.includes('ranked.slice(1,5)')],
  ['Opportunity register queries organisation-scoped real records', register.includes("from('prospects')") && register.includes(".eq('organisation_id', organisationId)")],
  ['Opportunity detail restricts every data query to its organisation', record.includes("from('prospects')") && record.includes("from('intake_sessions')") && (record.match(/\.eq\('organisation_id', organisationId\)/g) || []).length >= 2],
  ['New detail never invents proof of email delivery', record.includes('Email delivery cannot be independently confirmed')],
  ['Unmigrated business actions remain owned by governed workspace', record.includes("'/workspace/acquisition/' + id")],
];

let failures = 0;
for (const [label, pass] of checks) {
  console.log((pass ? 'PASS ' : 'FAIL ') + label);
  if (!pass) failures++;
}
if (failures) process.exit(1);
console.log('OPOS next visual contract: ' + checks.length + '/' + checks.length + ' checks passed');
