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
        { heading: 'Scope reviewed', body: 'This assessment covers the scope, deliverables, source information, output formats, applicable standards and required delivery date identified in the controlled record.' },
        { heading: 'Information status', body: 'Confirmed information, assumptions, missing information and outstanding questions are distinguished in the assessment evidence.' },
      ]},
      { title: 'Technical conclusion', entries: [
        { heading: 'Feasibility', body: 'The recorded conclusion identifies whether the work is feasible, feasible subject to conditions, awaiting further information or not feasible, together with any conditions that apply.' },
        { heading: 'Capability and compatibility', body: 'The assessment evidence confirms the required engineering capability, software compatibility, source-file usability and ability to produce the requested deliverables.' },
        { heading: 'Capacity and programme', body: 'Capacity, earliest start date, estimated engineering effort and lead time remain planning estimates until Overflow Partner issues a written work instruction.' },
      ]},
      { title: 'Risks and declaration', entries: [
        { heading: 'Technical risks', body: 'The assessment evidence records significant technical, data, manufacturing, tolerance, standards and schedule risks, including their likely effect and proposed treatment.' },
        { heading: 'Assumptions and exclusions', body: 'The recorded assumptions and exclusions form part of the assessment basis and may affect scope, effort, timing or deliverables.' },
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
        { heading: 'Technical basis', body: 'The pricing decision is based on the approved technical response, accepted assumptions, material risks and selected Delivery Partner recorded for this requirement.' },
        { heading: 'Partner cost', body: 'The controlled commercial record contains the selected partner cost, currency, validity, lead time, payment terms and delivery commitment.' },
      ]},
      { title: 'Pricing decision', entries: [
        { heading: 'Client price', body: 'The approved client price, margin basis and applicable VAT or tax are shown in the controlled commercial evidence.' },
        { heading: 'Reason for approval', body: 'Approval reflects the recorded complexity, delivery risk, client value, contingency and commercial rationale.' },
        { heading: 'Commercial risks', body: 'Material risks affecting validity, currency, payment, scope, programme or partner dependency must be resolved or expressly accepted before the quotation is issued.' },
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
        { heading: 'Price', body: 'The controlled quotation record shows the subtotal, applicable VAT or tax, total, currency and quotation expiry date.' },
        { heading: 'Payment terms', body: 'Invoices are payable in accordance with the terms shown in this quotation. Work may be withheld or paused when an agreed payment condition is not satisfied.' },
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
        { heading: 'Purpose', body: 'The engineering objective and intended outcome are defined by the controlled requirement and accepted quotation referenced in this document.' },
        { heading: 'Included activities', body: 'Only the engineering activities identified in the controlled scope evidence are included.' },
        { heading: 'Deliverables', body: 'The controlled record defines each deliverable, its format, required level of detail, intended use and source-file requirements.' },
      ]},
      { title: 'Responsibilities and changes', entries: [
        { heading: 'Client responsibilities', body: 'The client provides accurate inputs, answers questions and reviews deliverables within the agreed timescale.' },
        { heading: 'Overflow Partner responsibilities', body: 'Overflow Partner coordinates the work, manages document revisions and reviews, and issues the agreed deliverables.' },
        { heading: 'Acceptance and changes', body: 'Deliverables will be reviewed against the recorded acceptance requirements. Changes to scope, inputs, standards, quantities or timing require review and written approval before affected work proceeds.' },
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
        { heading: 'Confirmed requirements', body: 'The confirmed client requirements shown in the controlled record form the basis of technical assessment and pricing.' },
        { heading: 'Assumptions', body: 'Any assumption not expressly confirmed remains subject to client verification before it is treated as an agreed requirement.' },
        { heading: 'Missing information', body: 'Outstanding information that may affect feasibility, effort, timing, price or acceptance must be resolved by the recorded owner and response date.' },
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
        { heading: 'Assignment summary', body: 'The controlled record identifies the requirement reference, technical objective, required deliverables, response or delivery date and review instructions.' },
        { heading: 'Files provided', body: 'Only the documents and files identified in this package are authorised for use. Questions must be raised through Overflow Partner.' },
        { heading: 'Confidentiality', body: 'Client identity is disclosed only where authorised. Client prices, internal notes, margin information and unrelated customer information are excluded from this package.' },
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
        { heading: 'Price and currency', body: 'The submitted price and currency must identify whether tax, licences, travel, specialist services and third-party costs are included or excluded.' },
        { heading: 'Lead time and validity', body: 'The quotation is subject to the recorded earliest start date, lead time, expiry date and capacity limitations.' },
        { heading: 'Terms', body: 'The recorded payment terms, delivery commitment, assumptions, exclusions and partner quotation reference form part of this response.' },
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
        { heading: 'Identification', body: 'Each controlled document is identified by a unique reference, title, type and revision.' },
        { heading: 'Status and owner', body: 'The register identifies document ownership, approval status, issue date, authorised recipient and whether the revision is current or superseded.' },
        { heading: 'Distribution', body: 'External distribution is controlled by revision, issue date and named recipient.' },
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
        { heading: 'Requirement', body: 'The commercial assessment considers the customer need, expected service, indicative value, timescale and source.' },
        { heading: 'Readiness', body: 'Progression requires sufficient technical information, client engagement, decision authority, budget indication and delivery timing.' },
        { heading: 'Decision', body: 'The recorded decision and rationale identify whether the requirement is qualified, held, declined or awaiting further information.' },
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
        { heading: 'Engineering objective', body: 'The controlled requirement identifies the practical engineering outcome and intended use of the deliverables.' },
        { heading: 'Inputs and outputs', body: 'Available source formats, required outputs, drawing quantities, software requirements and reference documents are defined in the intake evidence.' },
        { heading: 'Constraints and questions', body: 'Applicable standards, tolerances, deadlines, known constraints and outstanding questions form part of the assessment basis.' },
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
        { heading: 'Conclusion', body: 'The technical decision identifies whether the requirement is ready, ready subject to conditions, awaiting clarification or unsuitable to progress.' },
        { heading: 'Risks and gaps', body: 'The review evidence identifies unclear requirements, missing data, incompatible formats, standards issues, tolerance risks and programme concerns.' },
        { heading: 'Required action', body: 'Each open item requires a named owner, responsible party and completion condition before approval.' },
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
        { heading: 'Objective', body: 'The proposed approach responds to the client objective and intended engineering outcome shown in the controlled requirement.' },
        { heading: 'How we will deliver', body: 'Overflow Partner will coordinate the agreed engineering approach, review points, responsibilities and expected deliverables.' },
        { heading: 'Assumptions and next steps', body: 'The proposal remains subject to the recorded assumptions, outstanding client information and actions required before quotation.' },
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
        { heading: 'Scope and price', body: 'The quotation applies to the priced scope and deliverables shown with the stated currency, subtotal, applicable tax and total.' },
        { heading: 'Validity and terms', body: 'The quotation is subject to its expiry date, payment terms, delivery basis, assumptions and exclusions.' },
        { heading: 'Acceptance', body: 'Acceptance must be provided in writing before expiry and must identify the quotation number and revision.' },
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
        { heading: 'In scope', body: 'The controlled scope and deliverables define the engineering activities authorised for delivery and review.' },
        { heading: 'Out of scope', body: 'Activities, services and responsibilities not expressly included in the controlled scope are excluded.' },
        { heading: 'Milestones and acceptance', body: 'Each recorded milestone is governed by its expected output, target date, reviewer and acceptance criteria.' },
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
        { heading: 'Project summary', body: 'The handover baseline identifies the client, project objective, accepted quotation, agreed scope, selected Delivery Partner, delivery date and project owner.' },
        { heading: 'Technical information', body: 'The agreed requirements, deliverables, standards, assumptions, exclusions, source files and accepted technical risks carry into delivery.' },
        { heading: 'Commercial and delivery controls', body: 'Payment milestones, partner commitment, communication route and outstanding actions remain governed by the controlled project record.' },
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
        { heading: 'Project overview', body: 'The completion record identifies the agreed scope, delivery period, final issued revision and principal project references.' },
        { heading: 'Delivered work', body: 'Completed activities and issued deliverables are assessed against the agreed scope.' },
        { heading: 'Deviations and limitations', body: 'Any agreed deviation, remaining limitation, client dependency or exclusion affecting use of the deliverables forms part of this completion record.' },
        { heading: 'Completion status', body: 'The recorded status confirms whether the project is complete, complete with open actions or not ready to close, together with its quality-review position.' },
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
        { heading: 'Billing information', body: 'This invoice applies to the legal billing parties, invoice number, issue date, due date, purchase-order reference and project or quotation reference shown in the controlled record.' },
        { heading: 'Charges and tax', body: 'The billed service or milestone, charging basis, net amount, applicable tax and total due are shown in the invoice evidence.' },
        { heading: 'Payment instructions', body: 'Payment must use the approved bank details, terms and invoice reference supplied through the controlled payment route. Internal margin and Delivery Partner cost are not disclosed.' },
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
