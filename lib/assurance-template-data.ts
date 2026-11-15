/**
 * Public, synthetic portfolio template content.
 * Shared by the React A4 preview and PDF export so the two formats
 * describe the same services and sample controls.
 */
export const assuranceIdentity = {
  brand: 'Overflow Partner',
  positioning: 'Additional engineering execution capacity',
  site: 'overflow-partner.vercel.app',
  contact: 'overflow-partner.vercel.app/contact',
  templateStatus: 'ILLUSTRATIVE / NOT CLIENT WORK',
} as const;

export const capabilityServices = [
  {name:'3D CAD Modelling',detail:'Part and assembly geometry developed to agreed technical inputs.'},
  {name:'Production Drawings',detail:'Controlled drawing and revision packages for defined requirements.'},
  {name:'Reverse Engineering',detail:'Reconstruction from suitable measurements and source references.'},
  {name:'Technical Documentation',detail:'Structured document registers, BOMs and technical records.'},
  {name:'Drawing Conversion',detail:'Updates and migration of existing drawings across agreed formats.'},
  {name:'Overflow Engineering Support',detail:'Additional execution capacity for defined engineering work packages.'},
] as const;

export const capabilitySteps = [
  {title:'01 / Clarify',detail:'Agree the objective, technical inputs, constraints and acceptance criteria.'},
  {title:'02 / Define',detail:'Confirm outputs, roles, scope boundaries, timescale and commercial terms.'},
  {title:'03 / Execute',detail:'Work against agreed requirements with documented decision points.'},
  {title:'04 / Review & handover',detail:'Release agreed files, revisions and supporting records after the required review.'},
] as const;

export const capabilityControls = [
  {title:'Scope control',detail:'Requirements, source information, boundaries and acceptance conditions are recorded.'},
  {title:'Information protection',detail:'Confidentiality and sharing arrangements are confirmed before sensitive technical data transfer.'},
  {title:'Technical review',detail:'Clarifications, comments and revisions follow agreed review responsibilities.'},
  {title:'Release control',detail:'Drawing numbers, file versions and the released handover index are identified.'},
] as const;

export const capabilityRecords = [
  {name:'Drawing register',detail:'Drawing or document references, descriptions and revisions.'},
  {name:'Bill of materials',detail:'Part references, quantities, materials and specification fields.'},
  {name:'Technical review log',detail:'Findings, owners, dispositions and closure evidence.'},
  {name:'Handover index',detail:'Issued file inventory, approvals and outstanding exceptions.'},
] as const;

export const handoverIndex = [
  {ref:'SAMPLE-INDEX-001',title:'Handover index',status:'TEMPLATE'},
  {ref:'SAMPLE-DWG-001',title:'Drawing register',status:'TEMPLATE'},
  {ref:'SAMPLE-BOM-001',title:'Bill of materials',status:'TEMPLATE'},
  {ref:'SAMPLE-REV-001',title:'Technical review log',status:'TEMPLATE'},
  {ref:'SAMPLE-CHK-001',title:'Release checklist',status:'TEMPLATE'},
] as const;

export const drawingRegister = [
  {ref:'DWG-EX-001',title:'Assembly arrangement',rev:'—',status:'SAMPLE'},
  {ref:'DWG-EX-002',title:'Detail part A',rev:'—',status:'SAMPLE'},
  {ref:'DWG-EX-003',title:'Detail part B',rev:'—',status:'SAMPLE'},
  {ref:'DWG-EX-004',title:'Interface / installation',rev:'—',status:'SAMPLE'},
] as const;

export const sampleBOM = [
  {item:'01',ref:'PART-EX-A',description:'Example fabricated plate',qty:'1'},
  {item:'02',ref:'PART-EX-B',description:'Example machined spacer',qty:'2'},
  {item:'03',ref:'HARDWARE-EX',description:'Unspecified fastener (TBC)',qty:'4'},
] as const;

export const sampleReview = [
  {ref:'REVIEW-01',requirement:'Confirm input dimensions and design data',status:'OPEN'},
  {ref:'REVIEW-02',requirement:'Assess critical assembly interfaces',status:'OPEN'},
  {ref:'REVIEW-03',requirement:'Review drawing notes and revision status',status:'OPEN'},
] as const;

export const releaseChecklist = [
  'Scope and agreed deliverable schedule referenced',
  'Drawing and native / neutral file revisions matched',
  'Technical review comments and exceptions recorded',
  'Client-facing release package identified',
  'Outstanding assumptions and exclusions disclosed',
  'Release owner and recipient recorded',
] as const;

export const templateSafetyNote = 'Illustrative template only. No completed client project, independent accreditation, manufacturing approval, executed contract or signed technical review is implied.';
