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
const opportunityActions = read('app/opos-next/opportunities/OpportunityWork.tsx');
const acquisitionActions = read('app/workspace/acquisition/actions.ts');
const partnerActions = read('app/workspace/acquisition/partner-actions.ts');
const returnPath = read('app/workspace/acquisition/return-path.ts');
const websiteIntake = read('app/api/intake/route.ts');
const proxy = read('proxy.ts');
const deliveryPage = read('app/opos-next/notifications/page.tsx');


const checks = [
  ['New operating shell uses only the isolated CSS module', shell.includes("import css from './opos.module.css'") && !/workspace-(base|features|surfaces)|focus-first\.css|coherent-shell\.css/.test(shell)],
  ['Preview stays behind existing workspace authentication', shell.includes("await requireUserContext('/opos-next')")],
  ['Visual review tokens are used consistently', ['#090a0b','#101113','#f4f4f5','#b8bac0','#303238'].every(color => styles.includes(color))],
  ['No destructive broad CSS overrides in new system', !styles.includes('!important')],
  ['Light CTA text is not overridden by blanket light link text',
    !/\.shell\s+a\s*\{[^}]*color\s*:\s*inherit/.test(styles) &&
    styles.includes('.shell a:not([class]) { color: inherit; }')],
  ['QA preview displays truthful locked vs writable status',
    shell.includes('QA · Actions locked') && shell.includes('QA · Actions enabled') &&
    shell.includes('isKnownIsolatedQaBackend()') &&
    mobileNav.includes('{statusLabel}')],
  ['Mission Control reuses canonical business prioritisation', mission.includes('buildMissionPriorityQueue') && mission.includes('ranked.slice(1,5)')],
  ['Opportunity register queries organisation-scoped real records', register.includes("from('prospects')") && register.includes(".eq('organisation_id', organisationId)")],
  ['Opportunity detail restricts every data query to its organisation', record.includes("from('prospects')") && record.includes("from('intake_sessions')") && (record.match(/\.eq\('organisation_id',\s*organisationId\)/g) || []).length >= 2],
  ['New detail never invents proof of email delivery', record.includes('Provider acceptance does not prove inbox delivery') && record.includes("op_list_notification_delivery")],
  ['Unmigrated business actions remain owned by governed workspace', record.includes("'/workspace/acquisition/' + id")],
  ['Mobile uses a dedicated OPOS navigation component', shell.includes('<OpMobileNav statusLabel={workspaceStatus} />') && !shell.includes('MobileWorkspaceNav')],
  ['Mobile menu has disclosure semantics, clear tap target, and closes on route selection',
    mobileNav.includes('aria-expanded={open}') && mobileNav.includes('aria-controls="opos-next-mobile-menu"') &&
    mobileNav.includes('setExpandedFor(null)') && styles.includes('min-height: 44px')],
  ['Mobile register uses cards mapped to the same canonical opportunity records',
    register.includes('className={css.mobileRecords}') && register.includes('className={css.mobileRecord}') &&
    register.includes('items.map(item') && styles.includes('.mobileRecords { display: grid')],
  ['No sideways-scrolling desktop table is displayed in the mobile register',
    styles.includes('.tableWrap { display: none; }') && styles.includes('.mobileRecords { display: grid')],
  ['Waiting record is not presented as requiring a primary operator decision',
    record.includes('No operator action is required') && record.includes('Inspect existing governed record')],
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
  ['Website enquiry automatically queues secure requirements and reminders',
    websiteIntake.includes("'requirements.requested'") && websiteIntake.includes("'requirements.reminder'") &&
    websiteIntake.includes("intake_sessions")],
  ['VNext Opportunity renders canonical Acquisition state rather than guessing next action',
    record.includes('resolveAcquisitionState') && record.includes('acquisition.actionKey') &&
    record.includes('<OpportunityWork')],
  ['Opportunity actions use existing secure intake, partner decision and conversion handlers',
    opportunityActions.includes('createStep2InvitationFormAction') &&
    opportunityActions.includes('createProspectPartnerReviewAction') &&
    opportunityActions.includes('decideProspectPartnerReviewAction') &&
    opportunityActions.includes('convertProspectFormAction')],
  ['Every vNext action is guarded against live preview mutations',
    acquisitionActions.includes('assertVNextWritable(formData)') &&
    partnerActions.includes('assertVNextWritable(formData)') &&
    returnPath.includes('assertIsolatedQaBackend') &&
    opportunityActions.includes('disabled={!previewWritable}')],
  ['Form results return to vNext without trusting arbitrary redirect paths',
    acquisitionActions.includes('acquisitionReturn(formData') &&
    partnerActions.includes('acquisitionReturn(formData') &&
    returnPath.includes("'/opos-next/opportunities/'")],
  ['Notification queue failures are recorded on the intake session',
    websiteIntake.includes("email_status:'failed'") && acquisitionActions.includes("email_status:'failed'") &&
    record.includes('failedDelivery')],
  ['Failed delivery has a scoped vNext diagnostics route, not a fake send button',
    deliveryPage.includes("op_list_notification_delivery") && record.includes("Review delivery failure evidence") &&
    deliveryPage.includes(".eq('organisation_id',organisationId)")],
  ['Shared-database preview cannot POST through legacy UI, portal or API routes',
    proxy.includes('isKnownIsolatedQaBackend') && proxy.includes('request.method') &&
    proxy.includes('status: 423') && proxy.includes('/client-portal/:path*') &&
    proxy.includes('/partner-review/:path*')],
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
