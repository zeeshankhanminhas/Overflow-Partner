import {readFileSync,existsSync} from 'node:fs';
const read=(file)=>readFileSync(file,'utf8');const checks=[];
const check=(condition,label)=>checks.push({ok:Boolean(condition),label});
const pages=['app/services/page.tsx','app/services/[slug]/page.tsx','app/about/page.tsx','app/process/page.tsx','app/demonstrations/page.tsx','app/contact/page.tsx','app/faq/page.tsx'];
for(const page of pages)check(existsSync(page),'Marketing route: '+page);
const services=read('lib/marketing.ts');const showcase=read('components/EngineeringShowcase.tsx');const home=read('app/page.tsx');const faq=read('components/FAQ.tsx');const header=read('components/Header.tsx');const form=read('components/EnquiryForm.tsx');const css=read('app/globals.css');const sitemap=read('app/sitemap.ts');const api=read('app/api/intake/route.ts');
check((services.match(/slug:'/g)||[]).length>=8,'Dedicated service catalogue and demonstration records');
check(showcase.includes("useState")&&showcase.includes('role="tablist"')&&showcase.includes('aria-selected')&&showcase.includes('role="tabpanel"'),'Accessible functional demonstration tabs');
check(home.includes('<EngineeringShowcase/>')&&home.indexOf('<FAQ/>')<home.indexOf('<CTA/>'),'Showcase present, FAQ before enquiry');
check(faq.includes('faqs.slice(0,8)')&&faq.includes('<details'),'Eight expandable questions on homepage');
for(const path of ['/services','/process','/demonstrations','/about','/faq'])check(header.includes(path),'Header navigation '+path);
check(form.includes("name=\"nurture_consent\"")&&form.includes('submitNativeIntake'),'Original client intake workflow and opt-in retained');
check(!form.includes('Technical intake follows')&&!form.includes('Step 2.')&&!form.includes('Submission ID:'),'No internal workflow terms in public form');
check(!api.includes('Workspace ownership is not configured.')&&!api.includes('Preview intake is disabled until'),'Internal server configuration suppressed in public error');
check(css.includes('.op-cta')&&css.includes('@media(max-width:640px)'),'Shared brand buttons and mobile form styles');
check(sitemap.includes('/demonstrations')&&sitemap.includes('services.map'),'New SEO sitemap entries');
for(const file of ['public/demos/indexing-clamping-fixture.scad','public/demos/roller-support-assembly.scad'])check(existsSync(file),'Downloadable original parametric CAD source '+file);
let fails=0;for(const c of checks){console.log((c.ok?'PASS ':'FAIL ')+c.label);if(!c.ok)fails++;}
console.log(`Marketing QA: ${checks.length-fails}/${checks.length} passed`);if(fails)process.exit(1);