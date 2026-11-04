export type Actor = 'client'|'operator'|'partner';
export type Scenario = 'standard'|'technical_correction'|'client_correction'|'variation';
export type StepStatus = 'configured'|'needs_test'|'blocked'|'policy';
export type JourneyStep = {
  id:string; phase:string; owner:Actor; title:string; why:string;
  client:string; operator:string; partner:string; system:string;
  evidence:string[]; gate:string; failure:string; status:StepStatus;
  portal?:Partial<Record<Actor,string>>;
  notification?:string; scenarios?:Scenario[];
};
export const phases=[
 'Opportunity','Requirements','Feasibility','Commercial Offer',
 'Contractual Commitment','Mobilisation','Execution','Quality Assurance',
 'Delivery','Payment Settlement','Closure',
] as const;
const opportunity='/opos-next/opportunities';
const caseRegister='/opos-next/cases';
const projectRegister='/opos-next/projects';
const partners='/opos-next/partners';
const finance='/opos-next/finance';
export const steps:JourneyStep[]=[
{
 id:'lead-source',phase:'Opportunity',owner:'operator',title:'Prospect comes into view',
 why:'OP learns that an engineering team may need overflow design or manufacturing capacity.',
 client:'Finds Overflow Partner through website, professional introduction or LinkedIn, then chooses whether to engage.',
 operator:'Creates or qualifies a prospect, company and contact. Record source and consent; never treat a profile view as permission for unsolicited email.',
 partner:'Has no access to the client, enquiry or commercial material at this point.',
 system:'Records prospect source, owner, next action and outreach history without creating a delivery project.',
 evidence:['Prospect/company/contact identity','Contact source and consent basis','Lead owner and next follow-up'],
 gate:'An identifiable opportunity and legitimate contact basis must exist before outreach.',
 failure:'No consent or unclear fit → continue permitted nurture; do not send cold email.',
 status:'needs_test',portal:{operator:opportunity}
},
{
 id:'account-enquiry',phase:'Opportunity',owner:'client',title:'Client enquires about capacity',
 why:'A real request begins and OP can determine whether engineering support is relevant.',
 client:'Submits an enquiry or shares an initial brief and preferred contact details. Does not yet receive a quote.',
 operator:'Acknowledges the enquiry, qualifies fit and records the opportunity. Associates it with the right company/contact.',
 partner:'Remains outside the opportunity until disclosure permission and supplier governance are satisfied.',
 system:'Creates or updates the opportunity; sets a required next decision and an audit trail.',
 evidence:['Client contact details','Scope summary','Source and acknowledgement'],
 gate:'The initial request must be attributable to an authorised or identifiable contact.',
 failure:'Insufficient request → ask client for clarification instead of silently assuming requirements.',
 status:'needs_test',portal:{client:'/portal/client',operator:opportunity},
 notification:'Acknowledgement or intake invitation, only if the configured and authorised notification route allows it.'
},
{
 id:'step2-confidentiality',phase:'Requirements',owner:'operator',title:'Check confidentiality and sharing authority',
 why:'Sensitive client drawings cannot go to a partner merely because an opportunity exists.',
 client:'Confirms whether confidentiality terms are required before detailed upload and whether sharing with an approved execution partner is permitted.',
 operator:'Records the client NDA/permission boundary and any restrictions. Choose the safe disclosure path before collecting sensitive evidence.',
 partner:'Sees nothing until OP has approved the partner and verified any required NDA/sharing authority.',
 system:'Preserves disclosure decisions on the Case/intake; does not turn an NDA into a commercial contract.',
 evidence:['Confidentiality requirement','Client sharing permission','Allowed information boundary'],
 gate:'No sensitive technical attachment crosses to an unapproved or unauthorised recipient.',
 failure:'NDA or authority missing → pause sharing and resolve the permission first.',
 status:'needs_test',portal:{operator:caseRegister}
},
{
 id:'client-intake',phase:'Requirements',owner:'client',title:'Client completes technical intake',
 why:'Convert the initial request into actionable engineering requirements.',
 client:'Opens a secure requirements link and supplies product/application, deliverables, drawings, standards, deadline, quantities, assumptions and missing-information answers.',
 operator:'Monitors the intake, reviews completeness and asks precise follow-up questions. Keeps one canonical requirement set.',
 partner:'Not yet exposed to client-identifying material or source files.',
 system:'Tracks invitation/open/submission and freezes a reviewable requirements snapshot when received.',
 evidence:['Client scope and drawings','Deliverables and tolerances','Deadline and technical constraints','Intake submission timestamp'],
 gate:'Submission alone is not approval. OP must assess technical completeness.',
 failure:'Missing technical detail → return a focused clarification request, not a guessed specification.',
 status:'needs_test',portal:{operator:'/workspace/acquisition/intake',client:'/portal/client'},
 notification:'Secure intake link and follow-up, according to authorised notification settings.'
},
{
 id:'scope-approval',phase:'Requirements',owner:'operator',title:'Approve controlled technical scope',
 why:'A stable technical baseline is needed for feasibility, commercial terms and later quality inspection.',
 client:'Confirms material scope assumptions and any outstanding information.',
 operator:'Checks the intake against project boundaries, creates/approves controlled requirements, identifies exclusions and freezes the version for partner assessment.',
 partner:'Only receives a permitted, partner-safe version after the supplier gate.',
 system:'Stores approved technical intake and associated scope documents. Later review compares delivery against this baseline.',
 evidence:['Approved intake','Requirements version','Assumptions and exclusions','Authority who approved scope'],
 gate:'No partner technical assessment or quotation is issued against a draft/unconfirmed scope.',
 failure:'Scope changes → re-review the affected baseline before costing.',
 status:'configured',portal:{operator:caseRegister}
},
{
 id:'partner-governance',phase:'Feasibility',owner:'operator',title:'Qualify and authorise Execution Partner',
 why:'Only an approved, NDA-ready engineering partner may receive a real assessment or Work Order.',
 client:'Does not choose or contract the partner; OP remains client-facing and accountable.',
 operator:'Check partner identity, capabilities, NDA evidence and internal approval; approve the specific partner without fabricating legal signatures.',
 partner:'Provides company/capability information, confidentiality agreement and permitted contact evidence.',
 system:'Separates partner legal evidence from internal approval, with explicit approved/NDA-ready gates.',
 evidence:['Partner profile','Executed NDA where required','Internal approval decision','Active permitted contact'],
 gate:'Unapproved or missing-NDA partner cannot receive sensitive engineering information.',
 failure:'Governance incomplete → retain in pending state; no RFQ/Work Order.',
 status:'configured',portal:{operator:partners,partner:'/portal/partner'}
},
{
 id:'assessment-invite',phase:'Feasibility',owner:'operator',title:'Issue Partner Technical Assessment',
 why:'Evaluate capability and technical feasibility separately from a delivery Work Order.',
 client:'Waits for OP feasibility review; receives consolidated clarification questions only through OP.',
 operator:'Selects authorised partner; shares only permitted, partner-safe brief; issues assessment link and due date.',
 partner:'Opens secure assessment invitation and reviews feasibility, drawing constraints, capacity and technical risk.',
 system:'Records assessment request, expiry, access, status and supporting files; no project is yet mobilised.',
 evidence:['Approved technical scope','Disclosure permission','Partner NDA and approval','Assessment invitation reference'],
 gate:'Technical assessment is not a Work Order and carries no authorisation to start paid execution.',
 failure:'Expired link, missing scope or unauthorised disclosure → stop and reissue only after correction.',
 status:'configured',portal:{operator:'/workspace/assessments',partner:'/portal/partner'},
 notification:'Controlled partner technical-assessment invitation, where email is enabled.'
},
{
 id:'partner-feasibility',phase:'Feasibility',owner:'partner',title:'Partner returns feasibility and missing-information questions',
 why:'Obtain real engineering estimates and identify blockers before making a client promise.',
 client:'Answers any specific technical questions relayed by OP; never has to negotiate directly with the Execution Partner.',
 operator:'Reviews partner assumptions, risks, capacity, earliest start, estimated hours and any missing client inputs.',
 partner:'Submits feasibility outcome, lead time, missing-information list, exclusions, technical risks and price information.',
 system:'Stores versioned partner response and review decision separately from the later technical QA of delivered work.',
 evidence:['Feasibility findings','Capacity and schedule','Clarifications','Partner response revision'],
 gate:'A submitted assessment still needs OP internal review and authorisation.',
 failure:'Unresolved assumptions → relay questions to client; obtain a revised assessment.',
 status:'needs_test',portal:{operator:'/workspace/assessments',partner:'/portal/partner'}
},
{
 id:'feasibility-decision',phase:'Feasibility',owner:'operator',title:'Internal go/no-go decision',
 why:'Commercial pricing cannot be based on an unevaluated supplier reply.',
 client:'Receives a consolidated recommendation or request for clarification, not internal partner costs.',
 operator:'Approves feasibility, restrictions and supplier selection; compares capability to scope and delivery target.',
 partner:'Waits for OP’s commercial decision; does not assume order acceptance.',
 system:'Records approved internal assessment and locks the selected partner lineage for the quotation.',
 evidence:['Assessment decision','Known exceptions','Selected partner','Cost/schedule evidence'],
 gate:'Quotation requires an authorised feasible response and clean supplier lineage.',
 failure:'No-go or unsafe assumptions → stop quotation and resolve technical issue.',
 status:'configured',portal:{operator:'/workspace/approvals'}
},
{
 id:'commercial-model',phase:'Commercial Offer',owner:'operator',title:'Construct governed client commercial offer',
 why:'Convert approved partner cost into a commercially viable client proposal.',
 client:'Sees scope, deliverables, commitments and client price—never partner cost or internal margin.',
 operator:'Uses approved partner cost, plans default 33% gross margin, reviews programme/risks, tax position and quote validity.',
 partner:'Sees only the partner Work Order price after contract authority; not OP’s margin or client selling price.',
 system:'Creates the commercial review and draft quote; separates internal economics from client-facing copy.',
 evidence:['Partner quotation cost','Margin calculation','VAT/tax treatment','Delivery and payment terms','Exclusions'],
 gate:'No quote issue before commercial authority, tax validity and technical lineage are satisfied.',
 failure:'Missing price, VAT conflict or margin exception → block issue and resolve explicitly.',
 status:'configured',portal:{operator:'/workspace/commercial-control'}
},
{
 id:'quote-issue',phase:'Commercial Offer',owner:'operator',title:'Review, authorise and issue quotation',
 why:'Make one traceable commercial promise to the client.',
 client:'Receives a secure quote page showing controlled scope, price, total, validity and offer terms.',
 operator:'Confirms authorised contact and legal/commercial terms; approves controlled quote revision and issues it.',
 partner:'Receives no extra authority or execution instruction yet.',
 system:'Records quote number/revision, issue record, recipient and expiry (normally 14 days); reminders may be scheduled for day 7 and day 12.',
 evidence:['Issued quote PDF/data','Authorised recipient','Revision and validity','Offer terms and amount'],
 gate:'Issue is blocked until required controlled decisions and evidence exist.',
 failure:'Quote expires or needs revision → issue a controlled revision; do not alter accepted historical records.',
 status:'needs_test',portal:{operator:caseRegister,client:'/portal/client'},
 notification:'Issued quotation and agreed validity reminders, subject to enabled email routes.'
},
{
 id:'client-quote-decision',phase:'Contractual Commitment',owner:'client',title:'Client accepts, declines or requests more time',
 why:'A quote is not a contract or order until the authorised client has responded.',
 client:'Opens secure quotation, checks scope and authority, and accepts/declines/requests more time with signatory evidence when required.',
 operator:'Sees the attributable response, handles requests and confirms the accepted revision.',
 partner:'Still cannot commence engineering.',
 system:'Records one governed quote response, signatory attribution and revision; prevents duplicate acceptance from creating another project.',
 evidence:['Quote revision','Named authorised signatory','Timestamp and acceptance basis','Accepted commercial terms'],
 gate:'Client response must be valid, attributable, within quote validity and for the correct revision.',
 failure:'Wrong signatory, expired quote or missing contractual evidence → no acceptance.',
 status:'configured',portal:{client:'/portal/client',operator:caseRegister}
},
{
 id:'client-account',phase:'Contractual Commitment',owner:'client',title:'Permanent Client Workspace reflects accepted position',
 why:'Client should not have to rely on scattered single-use emails for project visibility.',
 client:'Signs into Client Workspace to view linked quotations, active projects and next decisions, then opens the governed secure quote/payment flow.',
 operator:'Grants account access to verified company contacts and checks correct organisation entitlement.',
 partner:'Cannot view client workspace, prices or another organisation’s project.',
 system:'Account access is scoped; secure quotation and payment decisions still open their existing token-based pages.',
 evidence:['Verified client account','Correct company membership','Linked quote/project reference'],
 gate:'Never impersonate a client with an OP administrator session or expose projects across accounts.',
 failure:'Incorrect entitlement → deny with no cross-account record leakage.',
 status:'configured',portal:{client:'/portal/client',operator:'/opos-next/accounts'}
},
{
 id:'opening-payment',phase:'Contractual Commitment',owner:'client',title:'Pay opening amount or provide bank-transfer evidence',
 why:'No mobilised project or partner order before verified opening money.',
 client:'Uses Stripe Checkout in authorised test mode or receives bank instructions. Opening payment is normally 30%; 25% only by agreed exception.',
 operator:'Reviews independent Stripe webhook evidence or independently verifies bank receipt. Never manually invent a settled payment.',
 partner:'Waits; cannot see the client’s payment instrument or commence work.',
 system:'Marks funds verified only on provider evidence or independent bank reconciliation; separate commercial and client gates remain.',
 evidence:['Payment basis and amount','Provider event or bank reconciliation','Cleared-at timestamp','Quote linkage'],
 gate:'Acceptance alone is not payment. Project creation is blocked until independently verified opening settlement.',
 failure:'Pending, failed or unverified transfer → no project, no Work Order, no release.',
 status:'needs_test',portal:{client:'/portal/client',operator:'/workspace/payments'},
 notification:'Payment instructions, receipt or verification notifications only when authorised and configured.'
},
{
 id:'project-creation',phase:'Mobilisation',owner:'operator',title:'Create Project 360 from verified commercial commitment',
 why:'Carry one immutable accepted scope, quote and partner identity into delivery.',
 client:'Sees the project register after a genuinely verified advance, along with current phase and due date.',
 operator:'Verifies inherited quote/contract, opening payment, assigned manager, project number and mobilisation dates.',
 partner:'No execution until Work Order issued, accepted and start declaration recorded.',
 system:'Creates one Project record linked to Case, accepted quote and paid opening amount. Duplicate creation is blocked.',
 evidence:['Verified advance','Accepted quote','Approved scope/SOW','Project number','Project manager and dates'],
 gate:'Project must not exist on quote acceptance alone; no synthetic payment receipt is permitted.',
 failure:'Missing financial authority or conflicting lineage → stay in commercial commitment.',
 status:'configured',portal:{operator:projectRegister,client:'/portal/client'}
},
{
 id:'work-order',phase:'Mobilisation',owner:'operator',title:'Issue controlled Execution Partner Work Order',
 why:'Provide the partner’s contractual instructions after project and deposit are authorised.',
 client:'Sees OP preparing delivery; does not see partner cost or internal instructions.',
 operator:'Issues Work Order containing approved scope, deliverables, timeline, agreed partner price, IP/confidentiality clauses and acceptance requirement.',
 partner:'Receives the governed WO invitation and its own obligations; acceptance is separate from starting work.',
 system:'Records WO reference, partner assignment and securely scoped invitation tied to the selected partner.',
 evidence:['Approved project scope','Verified deposit','Partner agreement and WO','Partner identity','WO issue audit'],
 gate:'No unsigned, unapproved or mismatched partner WO should create execution authority.',
 failure:'WO/email not issued or partner identity mismatch → do not pretend execution began.',
 status:'configured',portal:{operator:projectRegister,partner:'/portal/partner'},
 notification:'Secure partner Work Order invitation after authorised issue.'
},
{
 id:'partner-account',phase:'Mobilisation',owner:'partner',title:'Partner sees the permanent Partner Workspace',
 why:'The assigned execution team needs a continuous register, not a new disconnected link per action.',
 client:'Receives only client-level project milestones.',
 operator:'Verifies assignment and portal permissions; monitors invitations and expiry.',
 partner:'Signs into Partner Workspace, sees only assigned Work Orders, and opens the existing secure Partner Work screen to act.',
 system:'Account-scoped project register resolves to the existing controlled partner execution session.',
 evidence:['Partner membership','Assignment linkage','Valid execution session','No other client project exposure'],
 gate:'Only assigned partner and valid invitation may enter secure Partner Work.',
 failure:'Expired, revoked or rotated session → request refreshed invitation; never bypass account authorisation.',
 status:'configured',portal:{partner:'/portal/partner',operator:projectRegister}
},
{
 id:'work-order-acceptance',phase:'Mobilisation',owner:'partner',title:'Partner formally accepts Work Order',
 why:'Supplier acknowledgement is a distinct contractual commitment.',
 client:'Sees OP’s progress preparing delivery, without internal partner terms.',
 operator:'Monitors WO acceptance and handoff; cannot accept on partner’s behalf.',
 partner:'Reviews scope, schedule, obligations, terms and authority; records formal WO acceptance.',
 system:'Writes acceptance name, role and timestamp without marking engineering work commenced.',
 evidence:['WO acceptance evidence','Accepted scope revision','Partner signatory and authority','Timestamp'],
 gate:'No partner commencement before formal WO acceptance.',
 failure:'Decline or condition requested → OP renegotiates/updates WO; no silent start.',
 status:'needs_test',portal:{partner:'/portal/partner',operator:projectRegister}
},
{
 id:'partner-commencement',phase:'Execution',owner:'partner',title:'Partner confirms engineering commencement',
 why:'Work starts only after confirming all operational prerequisites.',
 client:'Sees engineering in progress after authorised commencement.',
 operator:'Checks planned start, forecast delivery date, inputs and known blockers; investigates variance.',
 partner:'Confirms reviewed scope, inputs received, capacity, no unresolved blocker, planned start and formal declaration.',
 system:'Records partner commencement and advances to In Progress through the guarded stage transition.',
 evidence:['Accepted WO','Inputs and capacity checks','Start declaration','Forecast delivery date'],
 gate:'Acceptance is not commencement. Start declaration must be real and attributable.',
 failure:'Missing inputs or capacity → record blocker; do not advance to execution.',
 status:'configured',portal:{partner:'/portal/partner',operator:projectRegister}
},
{
 id:'partner-progress',phase:'Execution',owner:'partner',title:'Partner reports progress, risks and dependencies',
 why:'OP must manage expectations while execution is underway.',
 client:'Sees appropriate high-level progress and dates; no direct unsanctioned partner disclosures.',
 operator:'Monitors forecast variance, deliverables, blocked work and exceptions. Communicates changes to client.',
 partner:'Posts percent/status, forecast, supporting updates and open exception if necessary.',
 system:'Appends progress reports and exception log; does not alter approved price, target date or scope automatically.',
 evidence:['Progress update','Forecast versus committed date','Exception record','Responsibility and follow-up'],
 gate:'Open exceptions must be resolved before internal release readiness.',
 failure:'New scope or price impact → formal variation instead of unilateral partner change.',
 status:'needs_test',portal:{partner:'/portal/partner',operator:projectRegister}
},
{
 id:'partner-delivery',phase:'Execution',owner:'partner',title:'Submit R01 drawing package and declaration',
 why:'Move finished engineering work into OP quality inspection with immutable file evidence.',
 client:'Waits for OP technical review; cannot download unapproved engineering source files.',
 operator:'Receives submitted revision, engineering summary, file list and link to each private attachment.',
 partner:'Uploads actual drawing/output files, states revision, delivery summary and declaration, then submits and locks evidence.',
 system:'Creates current-cycle submission and file manifest with private storage records and audit data.',
 evidence:['R01 engineering PDF/files','Revision and summary','Submitted-at timestamp','File identity and storage references'],
 gate:'At least one current-cycle file must exist; an empty submission cannot advance.',
 failure:'Missing attachments or inconsistent revision → refuse submission or return for correction.',
 status:'configured',portal:{partner:'/portal/partner',operator:projectRegister}
},
{
 id:'internal-technical-qa',phase:'Quality Assurance',owner:'operator',title:'Inspect actual files and record engineering decision',
 why:'Engineering approval—not mere document approval—is the substantive quality gate.',
 client:'Sees OP quality review under way; has no release access yet.',
 operator:'Opens actual drawings, compares scope, completeness, revision, technical quality and exceptions; records findings and accepts or requests correction.',
 partner:'Waits for OP decision; receives correction requirements if rejected.',
 system:'Binds signed engineering decision to exact submission, cycle, revision and file manifest; prior revision approvals do not carry forward.',
 evidence:['Current submitted files','Scope/quality checklist','Findings and references','Authenticated reviewer decision'],
 gate:'Missing file, incomplete checklist, stale revision or open exception blocks engineering acceptance.',
 failure:'Corrective finding → route to Partner Correction, not client release.',
 status:'configured',portal:{operator:projectRegister,partner:'/portal/partner'}
},
{
 id:'technical-correction',phase:'Quality Assurance',owner:'partner',title:'Technical correction: R01 → R02',
 why:'Demonstrate the failure path when OP cannot accept engineering output.',
 client:'Receives an appropriate timing/status update, not an unapproved file.',
 operator:'Issues one consolidated findings record and requests the precise correction; keeps R01 historical.',
 partner:'Corrects the recorded technical defects, increments revision/cycle, submits new files and declaration.',
 system:'Moves to Partner Correction, creates the next delivery cycle and requires fresh R02 QA; old R01 authorisation is invalid for R02.',
 evidence:['R01 defects','Corrective instructions','R02 files and summary','Fresh QA checklist and acceptance'],
 gate:'No R02 can borrow R01’s file manifest verification or owner release authority.',
 failure:'Correction incomplete → another governed technical decision; do not silently accept.',
 status:'needs_test',portal:{operator:projectRegister,partner:'/portal/partner'},
 scenarios:['technical_correction']
},
{
 id:'manifest-verify',phase:'Quality Assurance',owner:'operator',title:'Verify deliverable manifest separately',
 why:'Document control proves the exact accepted files are the files that will be prepared for review.',
 client:'Does not receive anything simply because engineering was accepted.',
 operator:'Matches file names, document references, revisions, storage objects and intended recipients to the accepted submission.',
 partner:'Can see their submitted revision and status, but cannot alter locked evidence.',
 system:'Records document-controller verification referencing the same accepted submission and file fingerprint.',
 evidence:['Approved engineering decision','Exact R01/R02 file manifest','Controller identity','Verification timestamp'],
 gate:'Engineering acceptance must precede manifest verification.',
 failure:'File mismatch, wrong revision or changed attachment → block and re-review affected evidence.',
 status:'configured',portal:{operator:projectRegister}
},
{
 id:'client-review-authority',phase:'Delivery',owner:'operator',title:'Authorise preparation of client review package',
 why:'Release authority is a separate commercial/operational decision, never inferred from QA.',
 client:'Waits for a controlled review invitation; no native files available.',
 operator:'Checks engineering acceptance and manifest verification, then records owner/admin release rationale for the exact revision.',
 partner:'Cannot release files directly to the client.',
 system:'Creates an attributable owner/admin release-authorisation record. Does NOT send files automatically.',
 evidence:['Accepted current revision','Verified manifest','Owner release decision','Issue instructions'],
 gate:'Only authorised OP release role; cannot bypass engineering or document control.',
 failure:'Approval missing or stale file manifest → no client visibility.',
 status:'configured',portal:{operator:projectRegister}
},
{
 id:'secure-review',phase:'Delivery',owner:'operator',title:'Prepare secure client review package',
 why:'Client must inspect technical detail without receiving final editable/native files prematurely.',
 client:'Should open an authenticated, watermarked, view-only technical review screen and inspect drawings.',
 operator:'Should configure exact approved revision, client contact, permissions and review deadline.',
 partner:'Receives status only. No partner-to-client file sharing.',
 system:'REQUIRED BUT NOT IMPLEMENTED IN QA: secure view-only, watermarked technical viewer and scoped client issue; external issue remains blocked.',
 evidence:['Release authority','Client reviewer entitlement','Exact watermarked review content','Access and expiry log'],
 gate:'No unprotected PDF attachment or native download before client approval and final settlement.',
 failure:'Viewer unavailable → stop; do not claim the client received a controlled package.',
 status:'blocked',portal:{operator:projectRegister,client:'/portal/client'},
 notification:'Future: secure review invitation after the protected viewer and issue workflow pass QA.'
},
{
 id:'client-review',phase:'Delivery',owner:'client',title:'Client inspects and records acceptance or changes',
 why:'Technical client review is a different decision from OP engineering QA.',
 client:'Reviews exactly the approved-for-review drawings, checks against agreed acceptance criteria, accepts with comments or requests changes.',
 operator:'Captures client decision and written evidence, responds to comments and classifies any requested change.',
 partner:'Waits for consolidated client feedback via OP; never sees direct client commercial terms.',
 system:'Would record current-cycle client acceptance and decision timestamp through the governed review route.',
 evidence:['Reviewed issue revision','Named client decision-maker','Acceptance or consolidated comments','Date and evidence reference'],
 gate:'No client acceptance is fabricated from silence or an opened link.',
 failure:'Client requests changes → distinguish included in-scope correction from new scope/variation.',
 status:'blocked',portal:{client:'/portal/client',operator:projectRegister}
},
{
 id:'client-correction',phase:'Delivery',owner:'operator',title:'Client requests one in-scope correction',
 why:'Rework needs a controlled, consolidated request and another fresh review cycle.',
 client:'Provides one consolidated in-scope correction with drawing references during client review.',
 operator:'Classifies the correction, checks one included correction allowance and any partner-defect exception, then routes only approved corrective work.',
 partner:'Receives precise correction instruction, submits revised output and waits for new OP QA.',
 system:'Records correction history and new revision; re-runs engineering, document control and review issue.',
 evidence:['Client written comments','Included correction usage','Revision and partner response','Fresh QA and client outcome'],
 gate:'One included correction by default; partner defect is handled under its own evidence policy.',
 failure:'Second discretionary or out-of-scope revision → commercial variation, not free correction.',
 status:'needs_test',portal:{client:'/portal/client',operator:projectRegister,partner:'/portal/partner'},
 scenarios:['client_correction']
},
{
 id:'variation-control',phase:'Delivery',owner:'operator',title:'Out-of-scope change receives a separate offer',
 why:'New requirements must not silently change approved scope or partner liability.',
 client:'Requests new feature, material, design revision or different deliverable; accepts revised price/programme separately.',
 operator:'Raises controlled change request, gets partner technical impact and fresh commercial authority; obtains client approval before work.',
 partner:'Estimates changed effort and delivery impact but does not start changed scope without authorised Work Order adjustment.',
 system:'Creates variation record; freezes original baseline and blocks new scope execution until approved.',
 evidence:['Change-request reference','Partner technical impact','Revised commercial terms','Client acceptance','Updated scope/WO'],
 gate:'No automatic free work or increased partner payout without explicit variation approval.',
 failure:'Unapproved variation → retain baseline; no partner instruction to perform it.',
 status:'configured',portal:{operator:projectRegister,client:'/portal/client',partner:'/portal/partner'},
 scenarios:['variation']
},
{
 id:'client-review-outcome',phase:'Delivery',owner:'client',title:'Client accepts the reviewed revision',
 why:'Completes client technical acceptance independently from engineering QA.',
 client:'Confirms accepted revision and any comments against the agreed scope.',
 operator:'Verifies and records actual client acceptance evidence for the correct review cycle.',
 partner:'Sees approved delivery outcome, subject to OP closeout and payment gates.',
 system:'Records accepted/accepted-with-comments for the exact cycle; moves project toward completion when permitted.',
 evidence:['Client acceptance reference','Correct issue revision','Resolved technical comments'],
 gate:'No completion on an unconfirmed or stale client outcome.',
 failure:'Rejection or further comments → correction or separately approved variation route.',
 status:'blocked',portal:{client:'/portal/client',operator:projectRegister}
},
{
 id:'final-invoice',phase:'Payment Settlement',owner:'operator',title:'Issue final balance after accepted client review',
 why:'Financial completion happens after acceptance, not when the partner uploads.',
 client:'Sees remaining balance and payment instructions in the secure client payment flow.',
 operator:'Reconciles opening payment, invoice coverage, outstanding balance, contractual terms and tax.',
 partner:'Does not receive client payment details or assume entitlement to immediate payout.',
 system:'Records controlled invoice and settlement request; no final files released yet.',
 evidence:['Accepted review','Issued invoice','Quoted price less opening payment','Payment reference'],
 gate:'Final payment request should follow a valid client review outcome.',
 failure:'Wrong tax, amount or missing invoice evidence → stop and correct; do not mark settled.',
 status:'configured',portal:{client:'/portal/client',operator:finance}
},
{
 id:'final-payment',phase:'Payment Settlement',owner:'client',title:'Final cleared funds are independently verified',
 why:'A successful checkout screen or bank transfer instruction is not payment evidence.',
 client:'Uses approved final Stripe Checkout or bank-transfer route to settle remainder.',
 operator:'Verifies provider webhook or independently reconciles bank funds; separately records settled amount.',
 partner:'Awaits OP confirmation; does not receive advance on expected client funds.',
 system:'Records verified settlement only from authorised evidence; preserves outstanding amounts until then.',
 evidence:['Final invoice','Cleared Stripe/bank evidence','Full amount reconciliation','Settlement timestamp'],
 gate:'No final native file download and no partner payout while client final payment is unverified.',
 failure:'Pending/failed/partial payment → keep final handover locked.',
 status:'needs_test',portal:{client:'/portal/client',operator:finance}
},
{
 id:'final-release',phase:'Payment Settlement',owner:'operator',title:'Owner authorises downloadable final handover',
 why:'Even verified final payment alone does not authorise releasing native engineering IP.',
 client:'Sees final handover only after verified settlement and OP owner decision.',
 operator:'Confirms client acceptance, complete final receipt, current-cycle OP QA, handover document and client rights; signs final release.',
 partner:'Can view closed technical delivery status, not OP client-specific download links.',
 system:'Records final-release approval for the exact submission. Generates short-lived private file links after all gates.',
 evidence:['Client approval','100% verified payment','Current accepted engineering revision','Owner final approval','IP/handover rules'],
 gate:'Wrong revision, missing final funds or unsigned owner release → deny download.',
 failure:'Superseded engineering submission → invalidate previous release and require reapproval.',
 status:'needs_test',portal:{operator:projectRegister,client:'/portal/client'},
 notification:'Controlled final handover invitation after owner-approved final release.'
},
{
 id:'native-handover',phase:'Payment Settlement',owner:'client',title:'Client receives native final engineering files',
 why:'Deliver what the client purchased only when legal, technical and financial conditions are met.',
 client:'Downloads authorised native/editable engineering deliverables through short-lived secure links.',
 operator:'Confirms authorised version, access audit, any handover obligations and completion evidence.',
 partner:'Keeps only permitted contractual copies under confidentiality and IP provisions.',
 system:'Provides specific approved revision from private storage; short-lived links do not become indefinite public URLs.',
 evidence:['Final approved revision','Cleared payment','Owner release','File access audit'],
 gate:'Secure final delivery must not reuse unapproved draft or old-cycle files.',
 failure:'Expired link → regenerate only after checking all gates again.',
 status:'needs_test',portal:{client:'/portal/client',operator:projectRegister}
},
{
 id:'partner-payable',phase:'Payment Settlement',owner:'operator',title:'Approve and settle Execution Partner payable',
 why:'Partner payment is downstream of actual delivered and approved work.',
 client:'Has no visibility of the partner’s commercial terms or payment.',
 operator:'Checks partner completion, OP QA, client final approval, verified final client settlement, agreed partner cost and applicable deductions.',
 partner:'Receives approved remittance/payment status under the Execution Partner Agreement and Work Order.',
 system:'Records partner payable liability and settlement evidence separately from the client invoice.',
 evidence:['Accepted partner Work Order','Approved work and QA','Client final receipt','Partner invoice/payable','Payout approval'],
 gate:'Partner payout only after all required client payment, partner completion, OP QA and client review conditions.',
 failure:'Any missing condition → withhold payout; do not invent ledger settlement.',
 status:'needs_test',portal:{operator:finance,partner:'/portal/partner'}
},
{
 id:'project-closure',phase:'Closure',owner:'operator',title:'Controlled final closure',
 why:'A project is closed when technical, contractual, document and financial evidence reconcile.',
 client:'Sees project marked completed and can access permitted history/final files under current access rules.',
 operator:'Checks final invoice, receipt, partner payable, accepted revision, client acceptance, final handover, exceptions and archived communications.',
 partner:'Sees closed Work Order and payment state with no ability to change delivered evidence.',
 system:'Closes lifecycle and preserves immutable event history; retains only contractually justified records.',
 evidence:['Closure checklist','Complete financial reconciliation','QA and acceptance trail','Final handover record'],
 gate:'No closure with open receivables, unresolved payables/exceptions or incomplete controlled evidence.',
 failure:'Outstanding obligations → stay in Completion until resolved.',
 status:'configured',portal:{operator:projectRegister,client:'/portal/client',partner:'/portal/partner'}
},
{
 id:'post-delivery',phase:'Closure',owner:'operator',title:'Follow-up and repeat business',
 why:'Close the loop without reopening a completed engineering commitment.',
 client:'Can initiate a new requirement from the same business relationship.',
 operator:'Schedules account review, gathers authorised feedback, archives learning and identifies next independent opportunity.',
 partner:'Remains an eligible execution partner, subject to performance and governance reviews.',
 system:'Updates account lifecycle and creates new opportunities independently; no silent reuse of old approvals or files.',
 evidence:['Customer feedback','Account follow-up','Partner quality notes','New opportunity if separately authorised'],
 gate:'Each new project needs its own scope, commercial authorisation, payment and Work Order lineage.',
 failure:'Repeat request is mistakenly treated as a free revision → create and qualify a new opportunity.',
 status:'policy',portal:{operator:'/opos-next/accounts',client:'/portal/client'}
}
];
export const scenarioNames:Record<Scenario,string>={
 standard:'Standard / accepted first time',
 technical_correction:'Technical QA returns R01 for R02',
 client_correction:'Client requests included correction',
 variation:'Client requests out-of-scope change'
};
export function scenarioSteps(s:Scenario){
 return steps.filter(x=>!x.scenarios || x.scenarios.includes(s));
}
export const actorNames:Record<Actor,string>={
 client:'Client',operator:'OP Operator',partner:'Execution Partner'
};
export const statusNames:Record<StepStatus,string>={
 configured:'Existing system route / validation required',
 needs_test:'Workflow wired / authenticated E2E test outstanding',
 blocked:'Known blocker: cannot issue to client in QA',
 policy:'Business policy / verification outstanding'
};
