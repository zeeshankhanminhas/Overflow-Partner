import type { WorkspaceDocumentSlug } from './documentRegistry';

export type DocumentSection = { title: string; entries: Array<{ heading: string; body: string }> };
export type DocumentLanguage = {
  purpose: string;
  audience: string;
  visibility: string;
  issueCondition: string;
  closingStatement: string;
  sections: DocumentSection[];
};

export const documentLanguage: Record<WorkspaceDocumentSlug, DocumentLanguage> = {
  'partner-technical-assessment-report': {
    purpose: 'Records the partner’s technical assessment of the engineering request for internal review.',
    audience: 'Overflow Partner technical reviewers and the assigned partner',
    visibility: 'Internal / Partner',
    issueCondition: 'Approve after the partner declaration and required technical fields are complete.',
    closingStatement: 'This assessment applies to the information, files, assumptions and constraints listed in this revision.',
    sections: [
      { title: 'Assessment basis', entries: [
        { heading: 'Scope reviewed', body: 'List the scope reviewed, deliverables, source information, output formats, applicable standards and required delivery date.' },
        { heading: 'Information status', body: 'Separate confirmed information from assumptions, missing information and questions.' },
      ]},
      { title: 'Technical conclusion', entries: [
        { heading: 'Feasibility', body: 'State whether the work is feasible, feasible with conditions, needs more information or is not feasible. List any conditions.' },
        { heading: 'Capability and compatibility', body: 'Confirm the required engineering skills, software compatibility, source-file usability and ability to produce the requested deliverables.' },
        { heading: 'Capacity and programme', body: 'State current capacity, earliest start date, estimated engineering hours and lead time. These are planning estimates until the commercial offer is accepted.' },
      ]},
      { title: 'Risks and declaration', entries: [
        { heading: 'Technical risks', body: 'List significant technical, data, manufacturing, tolerance, standards and schedule risks, their likely impact and how they can be managed.' },
        { heading: 'Assumptions and exclusions', body: 'List assumptions and exclusions that affect scope, effort, timing or deliverables.' },
        { heading: 'Reviewer declaration', body: 'The named reviewer confirms that this assessment reflects the partner’s technical view for this revision.' },
      ]},
    ],
  },
  'commercial-approval': {
    purpose: 'Records the internal decision to approve the client price and commercial terms.',
    audience: 'Overflow Partner commercial approvers',
    visibility: 'Internal only / Commercially sensitive',
    issueCondition: 'Requires an approved technical response, partner price and named approver.',
    closingStatement: 'Internal only. Do not send this record to the client or partner.',
    sections: [
      { title: 'Pricing basis', entries: [
        { heading: 'Technical basis', body: 'Reference the approved technical response, accepted assumptions, key risks and selected partner used for pricing.' },
        { heading: 'Partner cost', body: 'Record the partner cost, currency, validity, lead time, payment terms and delivery commitment from the selected partner response.' },
      ]},
      { title: 'Pricing decision', entries: [
        { heading: 'Client price', body: 'Record the approved client price, markup or margin basis, and applicable VAT or tax.' },
        { heading: 'Reason for approval', body: 'Briefly record why the price is acceptable, including complexity, delivery risk, client value and any contingency.' },
        { heading: 'Commercial risks', body: 'Record significant risks affecting validity, currency, payment, scope, schedule or partner dependency. Resolve or accept them before the quote is issued.' },
      ]},
    ],
  },
  'client-quote': {
    purpose: 'Sets out the scope, price, delivery timing and payment terms for the requested engineering work.',
    audience: 'Client',
    visibility: 'Client-facing',
    issueCondition: 'Issue after the scope and price are approved internally.',
    closingStatement: 'Accepting this quote confirms agreement to the scope, assumptions, exclusions, delivery timing and payment terms.',
    sections: [
      { title: 'Our offer', entries: [
        { heading: 'Introduction', body: 'Thank you for the opportunity to quote. This quotation sets out the engineering work we will provide, the deliverables, price and expected delivery.' },
        { heading: 'Services included', body: 'We will provide the activities and deliverables listed in this quotation. Anything not listed is outside scope unless we agree a change in writing.' },
        { heading: 'Delivery', body: 'Delivery dates depend on receiving the required client information on time and resolving questions promptly.' },
      ]},
      { title: 'Price and terms', entries: [
        { heading: 'Price', body: 'Show the subtotal, VAT or other applicable tax, total, currency and quote expiry date.' },
        { heading: 'Payment terms', body: 'State when invoices are due and any deposit or milestone payment required. Work may be paused if agreed payments are overdue.' },
        { heading: 'Acceptance', body: 'Accept this quotation in writing before the expiry date. Requested changes may require a revised quotation.' },
      ]},
    ],
  },
  'scope-of-work': {
    purpose: 'Defines what work is included, what will be delivered and who is responsible for what.',
    audience: 'Client, Overflow Partner and assigned delivery partner',
    visibility: 'Project',
    issueCondition: 'Requires agreed scope, deliverables and acceptance criteria.',
    closingStatement: 'Only the work listed as in scope is included.',
    sections: [
      { title: 'Scope', entries: [
        { heading: 'Purpose', body: 'Describe the engineering work to be provided and the outcome the project is expected to achieve.' },
        { heading: 'Included activities', body: 'List the engineering activities included in the work.' },
        { heading: 'Deliverables', body: 'List each deliverable, its format, required level of detail, intended use and any source-file requirements.' },
      ]},
      { title: 'Responsibilities and changes', entries: [
        { heading: 'Client responsibilities', body: 'The client provides accurate inputs, answers questions and reviews deliverables within the agreed timescale.' },
        { heading: 'Overflow Partner responsibilities', body: 'Overflow Partner coordinates the work, manages document revisions and reviews, and issues the agreed deliverables.' },
        { heading: 'Acceptance and changes', body: 'State how deliverables will be accepted. Changes to scope, inputs, standards, quantities or timing must be reviewed before work proceeds.' },
      ]},
    ],
  },
  'client-requirements': {
    purpose: 'Records the client’s confirmed requirements, assumptions, missing information and open questions.',
    audience: 'Client and Overflow Partner technical reviewers',
    visibility: 'Client-facing',
    issueCondition: 'Issue when the main requirements are confirmed and any open items are clearly listed.',
    closingStatement: 'Items still open in this revision need confirmation before they are treated as agreed requirements.',
    sections: [
      { title: 'Requirements', entries: [
        { heading: 'Confirmed requirements', body: 'List requirements supplied or confirmed by the client that will be used for the work.' },
        { heading: 'Assumptions', body: 'List assumptions used for assessment or pricing that still need client confirmation.' },
        { heading: 'Missing information', body: 'List missing information that could affect feasibility, effort, timing, price or acceptance, with an owner and required response date.' },
      ]},
    ],
  },
  'vendor-safe-package': {
    purpose: 'Gives the partner only the technical information needed for assessment or delivery while keeping client and commercial information private.',
    audience: 'Assigned partner',
    visibility: 'Partner-facing / Restricted',
    issueCondition: 'Requires a valid NDA, approved partner, selected files and the correct client-identity setting.',
    closingStatement: 'Use this package only for the assigned work. Do not copy, share or reuse it for any other purpose.',
    sections: [
      { title: 'Package contents', entries: [
        { heading: 'Assignment summary', body: 'State the case reference, technical objective, required deliverables, response or delivery date and review instructions.' },
        { heading: 'Files provided', body: 'List the documents and files provided for this assignment. Use only the listed information and raise questions through Overflow Partner.' },
        { heading: 'Confidentiality', body: 'Show client identity only when permitted. Do not include client prices, internal notes, margin information or unrelated customer data.' },
      ]},
    ],
  },
  'vendor-instructions': {
    purpose: 'Sets out the working, communication, security and submission rules for the assigned partner.',
    audience: 'Approved partners',
    visibility: 'Partner-facing',
    issueCondition: 'Issue with a partner review or delivery package.',
    closingStatement: 'Following these instructions is required for the submission to be accepted.',
    sections: [
      { title: 'Partner instructions', entries: [
        { heading: 'Scope', body: 'Work only to the assigned scope. Do not change requirements, standards, deliverables or delivery dates without written agreement from Overflow Partner.' },
        { heading: 'Questions', body: 'Raise technical and commercial questions through Overflow Partner. Do not contact the client directly unless we have approved it in writing.' },
        { heading: 'Information security', body: 'Only people assigned to the work may access the files. Store and share them using the approved systems and do not reuse them elsewhere.' },
        { heading: 'Submission', body: 'Use the required file names, references and revisions. Include the requested declaration and make sure the submission is complete.' },
      ]},
    ],
  },
  'rfq-response': {
    purpose: 'Records the partner’s price, lead time, validity and commercial terms for an approved technical request.',
    audience: 'Overflow Partner commercial reviewers',
    visibility: 'Internal / Partner commercial',
    issueCondition: 'Requires a technical response for the same case and partner.',
    closingStatement: 'This response is a quotation only. It is not an instruction to start work.',
    sections: [
      { title: 'Partner price', entries: [
        { heading: 'Price and currency', body: 'Provide the full price and currency. State whether tax, licences, travel, specialist services or third-party costs are included or excluded.' },
        { heading: 'Lead time and validity', body: 'State the earliest start date, lead time, quote expiry date and any capacity limits.' },
        { heading: 'Terms', body: 'State payment terms, delivery commitment, assumptions, exclusions and the partner quote reference.' },
      ]},
    ],
  },
  'document-register': {
    purpose: 'Lists the current documents, revisions, status, owners and recipients for the case or project.',
    audience: 'Overflow Partner operations and technical reviewers',
    visibility: 'Internal',
    issueCondition: 'Update when a document is created, revised, issued, replaced or withdrawn.',
    closingStatement: 'Use the latest approved revision shown in this register unless stated otherwise.',
    sections: [
      { title: 'Document register', entries: [
        { heading: 'Identification', body: 'Give each document a unique reference, title, type and revision.' },
        { heading: 'Status and owner', body: 'Show the owner, approval status, issue date, recipient and whether the document is current or replaced.' },
        { heading: 'Distribution', body: 'Record which revision was sent externally, when it was sent and who received it.' },
      ]},
    ],
  },
  'commercial-qualification-record': {
    purpose: 'Records whether an enquiry is commercially suitable to progress.',
    audience: 'Overflow Partner business development and operations',
    visibility: 'Internal / Commercially sensitive',
    issueCondition: 'Requires enough customer, requirement, timing and commercial information to make a decision.',
    closingStatement: 'Qualification means the enquiry can progress. It is not technical approval, price approval or a commitment to deliver.',
    sections: [
      { title: 'Qualification decision', entries: [
        { heading: 'Opportunity', body: 'Record the customer need, expected service, likely value, timescale and source.' },
        { heading: 'Readiness', body: 'Check whether there is enough technical information, client engagement, decision authority, budget indication and delivery timing to continue.' },
        { heading: 'Decision', body: 'Choose qualify, hold, reject or request more information, and record the reason.' },
      ]},
    ],
  },
  'capability-statement': {
    purpose: 'Explains what Overflow Partner does, the engineering services we support and how we deliver them.',
    audience: 'Prospective and existing clients',
    visibility: 'External',
    issueCondition: 'Use the current approved company version.',
    closingStatement: 'Capability and delivery timing are confirmed for each request before work starts.',
    sections: [
      { title: 'Engineering capacity', entries: [
        { heading: 'How we work', body: 'Overflow Partner gives clients flexible engineering capacity through a network of approved engineering partners, with UK-based coordination and delivery oversight.' },
        { heading: 'What we support', body: 'We support CAD drafting, 3D modelling, manufacturing drawings, design support, CAM preparation and related engineering documentation. Capability is confirmed for each request.' },
        { heading: 'How work is managed', body: 'Each job is reviewed before pricing, assigned to an approved partner, checked through document review and tracked through delivery.' },
      ]},
    ],
  },
  'requirement-sheet': {
    purpose: 'Captures the technical information needed to assess an engineering request.',
    audience: 'Client and Overflow Partner intake reviewers',
    visibility: 'Intake',
    issueCondition: 'Progress when the required information is complete or important gaps are clearly recorded.',
    closingStatement: 'This sheet records the initial requirement. The agreed Scope of Work defines the final project scope.',
    sections: [
      { title: 'Requirement', entries: [
        { heading: 'Engineering objective', body: 'State the required outcome in practical engineering terms and explain how the deliverables will be used.' },
        { heading: 'Inputs and outputs', body: 'List available source formats, required output formats, drawing quantities, software requirements and reference documents.' },
        { heading: 'Constraints and questions', body: 'List applicable standards, tolerances, deadlines, known constraints and open questions.' },
      ]},
    ],
  },
  'technical-review': {
    purpose: 'Records whether the engineering request is clear enough and technically suitable to progress.',
    audience: 'Overflow Partner technical reviewers',
    visibility: 'Internal / Technical',
    issueCondition: 'Requires the current intake, source files and relevant clarifications.',
    closingStatement: 'Technical approval means the request can move forward. It does not approve the client price.',
    sections: [
      { title: 'Technical readiness', entries: [
        { heading: 'Conclusion', body: 'State whether the request is ready, ready with conditions, needs clarification or should not progress.' },
        { heading: 'Risks and gaps', body: 'Record unclear requirements, missing data, incompatible formats, standards issues, tolerance risks and timing concerns.' },
        { heading: 'Required action', body: 'For each open item, record who is responsible and what must be completed before approval.' },
      ]},
    ],
  },
  'proposal': {
    purpose: 'Explains the recommended engineering approach before a final quotation or project instruction.',
    audience: 'Client',
    visibility: 'Client-facing',
    issueCondition: 'Requires a reviewed requirement and an agreed proposed approach.',
    closingStatement: 'Final scope, price and delivery terms will be confirmed in the quotation or contract.',
    sections: [
      { title: 'Proposed approach', entries: [
        { heading: 'Objective', body: 'Restate the client’s objective and the outcome Overflow Partner proposes to achieve.' },
        { heading: 'How we will deliver', body: 'Describe the engineering approach, review points, responsibilities and expected deliverables.' },
        { heading: 'Assumptions and next steps', body: 'List key assumptions, information needed from the client and the next actions required to move to quotation.' },
      ]},
    ],
  },
  'quote': {
    purpose: 'Sets out the price and terms for a defined scope where the legacy quote format is still used.',
    audience: 'Client',
    visibility: 'Client-facing',
    issueCondition: 'Requires an approved scope, price, validity period and payment terms.',
    closingStatement: 'This quote applies only to the scope and revision shown and is valid until the stated expiry date.',
    sections: [
      { title: 'Quote', entries: [
        { heading: 'Scope and price', body: 'Show the priced scope, deliverables, currency, subtotal, tax and total. Do not show internal cost or margin.' },
        { heading: 'Validity and terms', body: 'State the quote expiry date, payment terms, delivery basis, assumptions and exclusions.' },
        { heading: 'Acceptance', body: 'Accept the quote in writing and reference the quote number and revision.' },
      ]},
    ],
  },
  'statement-of-work': {
    purpose: 'Defines the detailed work, responsibilities, milestones and acceptance requirements for delivery.',
    audience: 'Client, Overflow Partner and assigned delivery partner',
    visibility: 'Project / Contract supporting',
    issueCondition: 'Requires an accepted commercial offer and agreed delivery scope.',
    closingStatement: 'This Statement of Work and the accepted quotation define the agreed delivery unless a signed contract says otherwise.',
    sections: [
      { title: 'Work package', entries: [
        { heading: 'In scope', body: 'List the engineering activities and deliverables included in enough detail for the work to be completed and reviewed.' },
        { heading: 'Out of scope', body: 'List activities, services and responsibilities that are not included.' },
        { heading: 'Milestones and acceptance', body: 'For each milestone, show the expected output, target date, reviewer and acceptance criteria.' },
        { heading: 'Changes', body: 'Changes that affect scope, effort, cost, timing or acceptance need written approval before they are carried out.' },
      ]},
    ],
  },
  'handover-pack': {
    purpose: 'Brings the agreed commercial and technical information together before project delivery starts.',
    audience: 'Overflow Partner project team and assigned delivery partner',
    visibility: 'Internal / Delivery',
    issueCondition: 'Requires an accepted quote, created project and named project owner.',
    closingStatement: 'This pack records the information in place when delivery starts. Update it when an approved change affects the work.',
    sections: [
      { title: 'Delivery handover', entries: [
        { heading: 'Project summary', body: 'Show the client, project objective, accepted quote, agreed scope, selected partner, delivery date and project owner.' },
        { heading: 'Technical information', body: 'Carry forward the agreed requirements, deliverables, standards, assumptions, exclusions, source files and accepted technical risks.' },
        { heading: 'Commercial and delivery notes', body: 'Record payment milestones, partner commitment, communication route and important outstanding actions.' },
      ]},
    ],
  },
  'completion-report': {
    purpose: 'Summarises the work delivered, any agreed deviations and the project completion status.',
    audience: 'Client and Overflow Partner project team',
    visibility: 'Client-facing',
    issueCondition: 'Requires completed deliverables, quality review and a release revision.',
    closingStatement: 'The deliverables listed in this report have been completed against the agreed scope, subject to any deviations or open actions noted here.',
    sections: [
      { title: 'Completion', entries: [
        { heading: 'Project overview', body: 'Show the agreed scope, delivery period, issued revision and main project references.' },
        { heading: 'Delivered work', body: 'List completed activities and issued deliverables against the agreed scope.' },
        { heading: 'Deviations and limitations', body: 'List agreed deviations, remaining limitations, client dependencies and exclusions that affect use of the deliverables.' },
        { heading: 'Completion status', body: 'Confirm whether the project is complete, complete with open actions, or not ready to close, and record the quality-review status.' },
      ]},
    ],
  },
  'invoice': {
    purpose: 'Requests payment for engineering services provided under an accepted quote, contract or project milestone.',
    audience: 'Client accounts payable and commercial contacts',
    visibility: 'Client-facing / Financial',
    issueCondition: 'Requires a valid billing event, approved amount, tax treatment, billing details and payment instructions.',
    closingStatement: 'Please pay using the invoice reference and bank details shown on the invoice.',
    sections: [
      { title: 'Invoice details', entries: [
        { heading: 'Billing information', body: 'Show the legal billing names, billing address, invoice number, issue date, due date, purchase-order reference where applicable, and project or quote reference.' },
        { heading: 'Charges and tax', body: 'Describe each billed service or milestone and show the quantity or basis, net amount, applicable tax and total due.' },
        { heading: 'Payment instructions', body: 'Show the approved bank details, payment terms and contact details for invoice questions. Do not show internal margin or partner cost.' },
      ]},
    ],
  },
  'email-templates': {
    purpose: 'Provides clear wording for routine messages sent from the workspace.',
    audience: 'Overflow Partner operators, clients and partners as relevant to each message',
    visibility: 'Internal templates / Recipient-specific output',
    issueCondition: 'Send only when the relevant workflow event has occurred and the recipient details are correct.',
    closingStatement: 'Messages use the current case reference, dates, links and recipient details from the workspace.',
    sections: [
      { title: 'Message standards', entries: [
        { heading: 'Partner review invitation', body: 'Include the case reference, response due date, secure review link and confidentiality requirements. Do not include internal commercial information.' },
        { heading: 'Clarification request', body: 'List the exact information needed, the affected case or revision, and how to respond.' },
        { heading: 'Quote issue', body: 'Include the quote number, revision, total value, expiry date and how the client can accept it.' },
        { heading: 'Acceptance and handover', body: 'Confirm the recorded outcome, the project reference and what happens next.' },
      ]},
    ],
  },
};
