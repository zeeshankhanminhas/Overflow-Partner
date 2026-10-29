import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const shell = read('app/opos-next/layout.tsx');
const styles = read('app/opos-next/opos.module.css');
const mission = read('app/opos-next/page.tsx');
const register = read('app/opos-next/opportunities/page.tsx');
const record = read('app/opos-next/opportunities/[id]/page.tsx');
const mobileNav = read('app/opos-next/OpMobileNav.tsx');
const navigation = read('app/opos-next/navigation.ts');
const login = read('app/login/actions.ts');
const legacyHome = read('app/workspace/page.tsx');
const casePage = read('app/opos-next/cases/[id]/page.tsx');
const projectPage = read('app/opos-next/projects/[id]/page.tsx');
const v2WorkRecord = read('app/opos-next/WorkRecordV2.tsx');

const checks = [
  ['New operating shell uses only the isolated CSS module', shell.includes("import css from './opos.module.css'") && !/workspace-(base|features|surfaces)|focus-first\.css|coherent-shell\.css/.test(shell)],
  ['Preview stays behind existing workspace authentication', shell.includes("await requireUserContext('/opos-next')")],
  ['Visual review tokens are used consistently', ['#090a0b','#101113','#f4f4f5','#b8bac0','#303238'].every(color => styles.includes(color))],
  ['No destructive broad CSS overrides in new system', !styles.includes('!important')],
  ['Mission Control reuses canonical business prioritisation', mission.includes('buildMissionPriorityQueue') && mission.includes('ranked.slice(1,5)')],
  ['Opportunity register queries organisation-scoped real records', register.includes("from('prospects')") && register.includes(".eq('organisation_id', organisationId)")],
  ['Opportunity detail restricts every data query to its organisation', record.includes("from('prospects')") && record.includes("from('intake_sessions')") && (record.match(/\.eq\('organisation_id',\s*organisationId\)/g) || []).length >= 2],
  ['New detail never invents proof of email delivery', record.includes('Email delivery cannot be independently confirmed')],
  ['Unmigrated business actions remain owned by governed workspace', record.includes("'/workspace/acquisition/' + id")],
  ['Mobile uses a dedicated OPOS navigation component', shell.includes('<OpMobileNav />') && !shell.includes('MobileWorkspaceNav')],
  ['Mobile menu has disclosure semantics, clear tap target, and closes on route selection',
    mobileNav.includes('aria-expanded={open}') && mobileNav.includes('aria-controls="opos-next-mobile-menu"') &&
    mobileNav.includes('setExpandedFor(null)') && styles.includes('min-height: 44px')],
  ['Mobile register uses cards mapped to the same canonical opportunity records',
    register.includes('className={css.mobileRecords}') && register.includes('className={css.mobileRecord}') &&
    register.includes('items.map(item') && styles.includes('.mobileRecords { display: grid')],
  ['No sideways-scrolling desktop table is displayed in the mobile register',
    styles.includes('.tableWrap { display: none; }') && styles.includes('.mobileRecords { display: grid')],
  ['Waiting record is not presented as requiring a primary operator decision',
    record.includes('No operator decision is required') && record.includes('Open governed operational record')],
  ['Mobile and desktop share the same eight-part navigation contract',
    navigation.includes("label:'Outreach'") && navigation.includes("label:'Cases'") &&
    navigation.includes("label:'Projects'") && navigation.includes("label:'Partners'") &&
    navigation.includes("label:'Finance'") && navigation.includes("label:'Documents'") &&
    mobileNav.includes("import { nextNavigation, isNextActive }")],
  ['New records cover Outreach, Cases, Projects, Partners, Finance and Documents',
    ['outreach','cases','projects','partners','finance','documents'].every(name =>
      fs.existsSync('app/opos-next/' + name + '/page.tsx') && fs.existsSync('app/opos-next/' + name + '/[id]/page.tsx'))],
  ['Redesign preview sign-in does not bounce to legacy home',
    login.includes('redesignPreview') && login.includes('safeNext') && legacyHome.includes("redirect('/opos-next')")],
  ['Mission Control matches approved hierarchy without hiding waiting work',
    mission.includes("import styles from './mission.module.css'") && mission.includes('Waiting on others') &&
    mission.includes('className={styles.columns}') && !mission.includes('<details')],
  ['Opportunity matches the approved current position / journey / evidence structure',
    record.includes("import css from '../opportunity.module.css'") && record.includes('Journey progress') &&
    record.includes('Activity and evidence') && record.includes('CURRENT POSITION')],
  ['Case and Project use approved v2 decision, stage and evidence component',
    casePage.includes('WorkRecordV2') && projectPage.includes('WorkRecordV2') &&
    v2WorkRecord.includes('className={css.decision}') && v2WorkRecord.includes('className={css.timeline}') &&
    v2WorkRecord.includes('className={css.section+\' \'+css.grid}')],
  ['Mobile header matches approved compact OPOS visual grammar',
    mobileNav.includes('css.mobilePreview') && mobileNav.includes('css.mobileAvatar') &&
    styles.includes('.shell .mobileHeader {height:61px')],
  ['Mobile shell hides the former desktop sidebar and topbar',
    styles.includes('.shell .sidebar { display: none; }') && styles.includes('.shell .topbar { display: none; }')],
];

let failures = 0;
for (const [label, pass] of checks) {
  console.log((pass ? 'PASS ' : 'FAIL ') + label);
  if (!pass) failures++;
}
if (failures) process.exit(1);
console.log('OPOS next visual contract: ' + checks.length + '/' + checks.length + ' checks passed');
