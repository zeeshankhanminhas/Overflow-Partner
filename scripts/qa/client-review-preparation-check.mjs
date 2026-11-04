import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const metadata=read('lib/projects/stages.ts');
const operator=read('app/opos-next/projects/[id]/page.tsx');
const preview=read('app/opos-next/projects/[id]/review-preview/page.tsx');
const viewer=read('app/opos-next/projects/[id]/review-preview/WatermarkedPdfViewer.tsx');
const pdf=read('app/opos-next/projects/[id]/review-preview/[fileId]/route.ts');
const baseline=read('app/workspace/projects/[id]/client-actions.ts');
const decision=read('lib/presentation/threePortalNextAction.ts');
const cases=[
 ['client first verifies the secure PDF before invoking the PDF plugin',
   preview.includes('<WatermarkedPdfViewer')&&viewer.includes("credentials:'same-origin'")&&
   viewer.includes("response.headers.get('content-type')")&&
   viewer.includes("header!=='%PDF-'")&&viewer.includes("!tail.includes('%%EOF')")],
 ['preview error must be readable rather than an opaque PDF plugin failure',
   viewer.includes("role=\"alert\"")&&viewer.includes('Retry secure PDF preview')&&
   viewer.includes('Open in a separate PDF tab')],
 ['server PDF serialization is compatible with older browser PDF engines',
   pdf.includes('doc.save({useObjectStreams:false})')&&pdf.includes("'Content-Type':'application/pdf'")&&
   pdf.includes("'Content-Length':String(payload.length)")],
 ['private PDF service failures are logged without file contents or storage paths',
   pdf.includes("console.error('OPOS QA watermarked preview failed'")&&
   pdf.includes('kind:error instanceof Error?error.name')&&pdf.includes('return denied(500)')],
 ['project stage is preparation, not transmission',
  metadata.includes("label: 'Review package preparation'")&&
  metadata.includes("completion: 'Client issue is still pending.")&&
  !metadata.includes("completion: 'Client transmittal is recorded.'")],
 ['the next operator action points only to internal preview',
  operator.includes("'/review-preview'")&&operator.includes('Open watermarked QA review preview')&&
  decision.includes("situation.key==='secure_review_blocked'")],
 ['operator preview is QA-only and staff-authenticated',
  preview.includes('isKnownIsolatedQaBackend()')&&preview.includes('requireUserContext()')&&
  preview.includes("assertRole(profile.role,['owner','admin','operator','engineering'])")],
 ['the preparation page requires acceptance, manifest, release and private files',
  ['gate.storage_complete','gate.engineering_accepted','gate.manifest_verified',
    'gate.release_authorised','gate.file_count>0'].every(x=>preview.includes(x))],
 ['the PDF route is QA-only, role-scoped and organisation-filtered',
  ['assertIsolatedQaBackend()','requireUserContext()',
    "assertRole(profile.role,['owner','admin','operator','engineering'])",
    ".eq('organisation_id',organisationId)"].every(x=>pdf.includes(x))],
 ['the PDF route validates current-stage same submission and manifest',
  ['project.project_stage!==','gate.project_stage!==','gate.submission_id',
    'gate.storage_complete','gate.engineering_accepted','gate.manifest_verified',
    'gate.release_authorised','(gate.files||[]).find(file=>file.id===fileId)'].every(x=>pdf.includes(x))],
 ['the PDF never exposes the raw private-storage URL or service key',
  pdf.includes('storage.storage.from(item.bucket).download(item.path)')&&
   !pdf.includes('createSignedUrl(')&&!pdf.includes('NextResponse.redirect(')],
 ['the served PDF is actually watermarked and not cacheable',
  ['PDFDocument.load','drawText(text,','setTitle(','Content-Disposition',
    'inline; filename=','no-store','X-Content-Type-Options'].every(x=>pdf.includes(x))],
 ['the preview does not mutate the project, client issue or review',
  !/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\('op_record_/.test(pdf+preview)],
 ['the previously blocked external PDF-email issue is still blocked in QA',
  baseline.includes("if(process.env.VERCEL_ENV==='preview')throw new Error(")&&
  baseline.includes('Client Review Package issue is blocked in QA')],
 ['no external client can open this operator-only preview via an unrelated portal',
  preview.includes('assertRole(profile.role')&&pdf.includes('assertRole(profile.role')&&
  preview.includes('ISOLATED QA / INTERNAL REVIEWER ONLY')],
];
for(const [name,ok] of cases)assert.ok(ok,name);
console.log('Client Review Package preparation: '+cases.length+' release/preview security and no-issue invariants PASS (static).');
