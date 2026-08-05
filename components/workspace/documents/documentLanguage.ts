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
    purpose: 'Records the execution partner’s technical assessment of the approved engineering scope and provides the evidence required for an internal technical decision.',
    audience: 'Overflow Partner technical reviewers and authorised execution partner personnel',
    visibility: 'Private / Partner-controlled',
    issueCondition: 'May be approved only after the partner declaration is complete and all required technical fields have been submitted.',
    closingStatement: 'The assessment conclusion applies only to the information, files, assumptions and constraints identified in this revision.',
    sections: [
      { title: 'Assessment basis', entries: [
        { heading: 'Scope reviewed', body: 'The assessment shall identify the approved scope, deliverables, source information, required output formats, governing standards and required delivery date reviewed by the partner.' },
        { heading: 'Information status', body: 'The partner shall distinguish confirmed information from assumptions, missing information and items requiring clarification. No unstated assumption shall form part of the approval basis.' },
      ]},
      { title: 'Technical conclusion', entries: [
        { heading: 'Feasibility', body: 'The response shall state whether the work is feasible, feasible subject to conditions, requires further information, or is not feasible. Conditional conclusions shall identify each condition explicitly.' },
        { heading: 'Capability and compatibility', body: 'The partner shall confirm relevant engineering capability, software compatibility, source-file usability and ability to produce the required deliverables to the stated format.' },
        { heading: 'Capacity and programme', body: 'The response shall state current capacity, earliest start date, estimated engineering hours and estimated lead time. These values constitute planning estimates until commercially accepted.' },
      ]},
      { title: 'Risks and declaration', entries: [
        { heading: 'Technical risks', body: 'Material technical, data-quality, manufacturing, tolerance, standards and schedule risks shall be recorded with their likely consequence and proposed control.' },
        { heading: 'Assumptions and exclusions', body: 'All assumptions and exclusions affecting feasibility, effort, programme or deliverables shall be listed. Silence shall not be interpreted as acceptance of an unstated requirement.' },
        { heading: 'Reviewer declaration', body: 'The named reviewer confirms that the response represents the partner’s considered technical position for the identified revision and has been prepared by a person authorised to assess the work.' },
      ]},
    ],
  },
  'commercial-approval': {
    purpose: 'Records the internal commercial decision derived from an approved technical response and the selected execution route.',
    audience: 'Overflow Partner commercial approvers and authorised management',
    visibility: 'Strictly internal / Commercially sensitive',
    issueCondition: 'Approval requires an internally approved technical response, a valid partner commercial submission and an identified approving authority.',
    closingStatement: 'This record is an internal approval instrument and shall not be distributed to the client or execution partner.',
    sections: [
      { title: 'Commercial basis', entries: [
        { heading: 'Approved technical basis', body: 'The commercial position shall reference the approved technical response, accepted assumptions, accepted risks and selected execution partner on which the pricing decision is based.' },
        { heading: 'Cost position', body: 'Partner cost, currency, validity, lead time, payment terms and delivery commitment shall be reproduced from the selected commercial response without manual alteration.' },
      ]},
      { title: 'Pricing decision', entries: [
        { heading: 'Client price', body: 'The approved client price shall be calculated from the partner cost and authorised markup or margin rule. VAT and other taxes shall follow the applicable organisation and client tax configuration.' },
        { heading: 'Commercial rationale', body: 'The approver shall record the reason the proposed price is commercially acceptable, including delivery exposure, complexity, client value, market position and any approved contingency.' },
        { heading: 'Commercial risks', body: 'Material validity, currency, payment, scope, schedule and supplier-dependency risks shall be recorded before approval. Unresolved risks shall block quote issue unless formally accepted.' },
      ]},
    ],
  },
  'client-quote': {
    purpose: 'Presents Overflow Partner’s controlled commercial offer for the defined engineering services.',
    audience: 'Client commercial and technical representatives',
    visibility: 'Client-facing / Controlled',
    issueCondition: 'May be issued only from an approved commercial position and an approved client-facing scope.',
    closingStatement: 'Acceptance of this quotation confirms the client’s agreement to the stated scope, assumptions, exclusions, programme and commercial terms.',
    sections: [
      { title: 'Commercial offer', entries: [
        { heading: 'Introduction', body: 'Thank you for the opportunity to support your engineering requirements. Based on the information supplied and the scope identified in this quotation, Overflow Partner is pleased to submit this commercial offer.' },
        { heading: 'Proposed service', body: 'The service comprises the engineering activities and deliverables expressly listed in this quotation. Work outside the stated scope is excluded unless agreed through controlled change.' },
        { heading: 'Delivery programme', body: 'The stated programme is based on timely receipt of complete client inputs, access to the required source information and prompt resolution of clarifications.' },
      ]},
      { title: 'Price and terms', entries: [
        { heading: 'Commercial summary', body: 'The quotation shall state subtotal, VAT or applicable tax, total value, currency and validity. Internal partner cost, margin and commercial strategy shall not appear.' },
        { heading: 'Payment terms', body: 'Payment terms, invoicing basis and any advance or milestone requirements shall be stated clearly. Work may be paused where agreed payment conditions are not met.' },
        { heading: 'Acceptance', body: 'The quotation may be accepted through the approved written acceptance route before expiry. Any requested amendment is subject to review and may require a revised quotation.' },
      ]},
    ],
  },
  'scope-of-work': {
    purpose: 'Defines the technical and delivery boundaries of the engineering services to be performed.',
    audience: 'Client, Overflow Partner and authorised execution personnel',
    visibility: 'Controlled / Project-facing',
    issueCondition: 'Requires an approved technical scope, confirmed deliverables and identified acceptance criteria.',
    closingStatement: 'Only the activities expressly identified as in scope form part of the authorised work.',
    sections: [
      { title: 'Scope definition', entries: [
        { heading: 'Purpose', body: 'This document defines the engineering services to be provided by Overflow Partner and establishes the technical, delivery and responsibility boundaries applicable to the agreed work.' },
        { heading: 'Included activities', body: 'Included activities shall be described as specific engineering outputs or actions. General descriptions shall not override the detailed deliverable and acceptance requirements.' },
        { heading: 'Deliverables', body: 'Each deliverable shall identify its format, revision basis, required level of detail and intended use. Source and output file requirements shall be stated separately.' },
      ]},
      { title: 'Responsibilities and control', entries: [
        { heading: 'Client responsibilities', body: 'The client shall provide complete, accurate and authorised inputs, respond to clarifications and review submitted deliverables within the agreed timescale.' },
        { heading: 'Overflow Partner responsibilities', body: 'Overflow Partner shall coordinate the approved work, maintain document control, manage authorised execution resources and issue deliverables through the controlled route.' },
        { heading: 'Acceptance and change', body: 'Acceptance criteria shall be measurable and linked to the approved deliverables. Changes to scope, inputs, standards, quantities or programme require controlled review before implementation.' },
      ]},
    ],
  },
  'client-requirements': {
    purpose: 'Provides a traceable record of the client’s confirmed, assumed, missing and clarified requirements.',
    audience: 'Client and Overflow Partner technical reviewers',
    visibility: 'Client-facing / Controlled',
    issueCondition: 'May be baselined when material requirements are confirmed or clearly identified as open.',
    closingStatement: 'Items not confirmed in this revision remain subject to clarification and shall not be treated as approved requirements.',
    sections: [
      { title: 'Requirements baseline', entries: [
        { heading: 'Confirmed requirements', body: 'Confirmed requirements are those explicitly supplied or subsequently accepted by the client and shall form the primary technical basis of the work.' },
        { heading: 'Assumed requirements', body: 'Assumptions used to permit assessment or pricing shall be clearly identified and require confirmation before they can become part of the approved baseline.' },
        { heading: 'Missing information', body: 'Missing information that may affect feasibility, effort, programme, price or acceptance shall be recorded with an owner and required response date.' },
      ]},
    ],
  },
  'vendor-safe-package': {
    purpose: 'Issues only the authorised technical information required for partner assessment or execution while protecting client identity, commercial data and unrelated records.',
    audience: 'Authorised execution partner personnel',
    visibility: 'Partner-facing / Restricted',
    issueCondition: 'Requires a valid NDA, approved partner status, explicit file selection and approved identity-visibility settings.',
    closingStatement: 'The package is provided solely for the authorised assessment or execution purpose and shall not be copied, disclosed or reused outside that purpose.',
    sections: [
      { title: 'Authorised issue', entries: [
        { heading: 'Assignment summary', body: 'The package shall state the controlled case reference, technical objective, required deliverables, response or delivery date and any approved review instructions.' },
        { heading: 'Document and file register', body: 'Only documents and files listed in the package register are authorised for use. Omitted or inaccessible information shall not be inferred or requested outside the controlled clarification route.' },
        { heading: 'Identity and confidentiality', body: 'Client identity shall be shown only where expressly authorised. Commercial prices, internal notes, margin information and unrelated customer data are excluded from the package.' },
      ]},
    ],
  },
  'vendor-instructions': {
    purpose: 'Defines the mandatory operating, communication, security and submission requirements for an execution partner.',
    audience: 'Approved execution partners',
    visibility: 'Partner-facing / Controlled',
    issueCondition: 'Applies when issued with a controlled partner review or delivery package.',
    closingStatement: 'Failure to follow these instructions may invalidate the submission or require controlled rework.',
    sections: [
      { title: 'Operating requirements', entries: [
        { heading: 'Assessment and execution', body: 'The partner shall assess and execute only the authorised scope and shall not alter requirements, standards, deliverables or programme without written instruction.' },
        { heading: 'Clarifications', body: 'All technical and commercial clarifications shall be raised through the designated Overflow Partner route. Direct client contact is prohibited unless expressly authorised.' },
        { heading: 'Information security', body: 'Files shall be stored, accessed and shared only by authorised personnel using approved systems. Further distribution or reuse is prohibited.' },
        { heading: 'Submission standard', body: 'Responses and deliverables shall use the required structure, naming convention, reference, revision and declaration. Incomplete or untraceable submissions may be rejected.' },
      ]},
    ],
  },
  'rfq-response': {
    purpose: 'Records the partner’s structured commercial response against an approved technical review.',
    audience: 'Overflow Partner commercial reviewers',
    visibility: 'Private / Partner commercial',
    issueCondition: 'Requires an approved or conditionally approved technical response for the same case and partner.',
    closingStatement: 'The response remains subject to Overflow Partner selection and does not constitute an award or instruction to proceed.',
    sections: [
      { title: 'Commercial response', entries: [
        { heading: 'Price and currency', body: 'The partner shall provide a complete price in the stated currency and identify whether taxes, licences, travel, specialist services or third-party costs are included or excluded.' },
        { heading: 'Lead time and validity', body: 'The response shall state committed lead time, earliest start, validity date and any capacity condition affecting the offer.' },
        { heading: 'Terms and commitment', body: 'Payment terms, delivery commitment, commercial assumptions, exclusions and quote reference shall be stated clearly and shall remain consistent with the approved technical response.' },
      ]},
    ],
  },
  'document-register': {
    purpose: 'Maintains the controlled index of documents, revisions, issue states, owners and distributions associated with the case or project.',
    audience: 'Overflow Partner operations, technical and quality personnel',
    visibility: 'Internal / Controlled',
    issueCondition: 'The register shall be updated whenever a controlled document is created, revised, issued, superseded or withdrawn.',
    closingStatement: 'The current approved revision identified in the register is the authoritative document unless otherwise stated.',
    sections: [
      { title: 'Document control', entries: [
        { heading: 'Identification', body: 'Each document shall have a unique reference, title, type and revision. Duplicate references and uncontrolled filenames are not permitted.' },
        { heading: 'Status and ownership', body: 'The register shall identify owner, approval status, issue date, recipient and current or superseded state.' },
        { heading: 'Distribution', body: 'External and partner distributions shall be traceable to the issued revision and authorised recipient.' },
      ]},
    ],
  },
  'commercial-qualification-record': {
    purpose: 'Records whether an enquiry is commercially suitable to progress into a governed engineering case.',
    audience: 'Overflow Partner business development and operations',
    visibility: 'Internal / Commercially sensitive',
    issueCondition: 'Requires sufficient customer, requirement, timing and commercial information to support a decision.',
    closingStatement: 'Qualification confirms suitability to progress; it does not constitute technical approval, price approval or a commitment to deliver.',
    sections: [
      { title: 'Qualification decision', entries: [
        { heading: 'Opportunity context', body: 'The record shall identify the customer need, expected service, likely value, timescale, source and strategic relevance.' },
        { heading: 'Readiness', body: 'Technical information, customer responsiveness, decision authority, budget indication and delivery timing shall be assessed to determine whether structured progression is justified.' },
        { heading: 'Decision and rationale', body: 'The decision shall state whether to qualify, hold, reject or seek further information and shall record the evidence supporting that outcome.' },
      ]},
    ],
  },
  'capability-statement': {
    purpose: 'Explains Overflow Partner’s engineering capacity model, service capability and controlled delivery approach.',
    audience: 'Prospective and existing clients',
    visibility: 'External / Approved marketing',
    issueCondition: 'May be issued only in the current approved corporate revision.',
    closingStatement: 'Specific capability, capacity and delivery commitments remain subject to review of the client’s actual requirement.',
    sections: [
      { title: 'Engineering capacity', entries: [
        { heading: 'Operating model', body: 'Overflow Partner extends client engineering capacity through a governed network of approved execution capability, while retaining UK-based commercial coordination and controlled delivery oversight.' },
        { heading: 'Service capability', body: 'Services may include CAD drafting, 3D modelling, manufacturing drawings, design support, CAM-related preparation and associated engineering documentation, subject to case-specific review.' },
        { heading: 'Governance', body: 'Each engagement follows controlled intake, technical assessment, partner approval, commercial review, document control and auditable delivery stages.' },
      ]},
    ],
  },
  'requirement-sheet': {
    purpose: 'Captures the initial technical information required to assess an engineering request.',
    audience: 'Client and Overflow Partner intake reviewers',
    visibility: 'Controlled / Intake',
    issueCondition: 'May progress to technical review when mandatory fields and source information are complete or material gaps are recorded.',
    closingStatement: 'The requirement sheet is an intake record and does not replace the approved Scope of Work.',
    sections: [
      { title: 'Requirement capture', entries: [
        { heading: 'Engineering objective', body: 'The required outcome shall be stated in practical engineering terms, including the intended use of the deliverables.' },
        { heading: 'Inputs and outputs', body: 'Available source formats, required output formats, drawing quantities, software requirements and reference documents shall be identified.' },
        { heading: 'Constraints and clarifications', body: 'Standards, tolerances, deadlines, known constraints and unresolved questions shall be recorded before assessment.' },
      ]},
    ],
  },
  'technical-review': {
    purpose: 'Records the internal assessment of whether the supplied requirement is sufficiently defined and technically suitable to progress.',
    audience: 'Overflow Partner technical reviewers',
    visibility: 'Internal / Technical',
    issueCondition: 'Requires access to the current intake, source files and material clarifications.',
    closingStatement: 'Technical review approval confirms readiness for the next governed stage and does not constitute commercial approval.',
    sections: [
      { title: 'Technical readiness', entries: [
        { heading: 'Review conclusion', body: 'The reviewer shall state whether the scope is technically ready, ready subject to conditions, requires clarification or should not progress.' },
        { heading: 'Risks and gaps', body: 'Technical ambiguity, missing data, incompatible formats, standards gaps, tolerance risk and programme exposure shall be recorded.' },
        { heading: 'Required action', body: 'Each clarification or corrective action shall identify an owner and completion requirement before approval.' },
      ]},
    ],
  },
  'proposal': {
    purpose: 'Sets out the recommended engineering approach before a final commercial quotation or project instruction.',
    audience: 'Client technical and commercial representatives',
    visibility: 'Client-facing / Controlled',
    issueCondition: 'Requires a reviewed requirement and an approved proposed delivery approach.',
    closingStatement: 'The proposal is subject to final scope confirmation, commercial approval and issue of an accepted quotation or contract.',
    sections: [
      { title: 'Proposed approach', entries: [
        { heading: 'Objective', body: 'The proposal shall restate the client objective and the outcome Overflow Partner proposes to achieve.' },
        { heading: 'Delivery method', body: 'The proposed engineering method, review points, responsibilities and deliverable route shall be described at a level appropriate for client evaluation.' },
        { heading: 'Assumptions and next steps', body: 'Material assumptions, client inputs and the actions required to progress to quotation or instruction shall be identified.' },
      ]},
    ],
  },
  'quote': {
    purpose: 'Provides a controlled commercial price for a defined scope where the legacy quote format is required.',
    audience: 'Client commercial representatives',
    visibility: 'Client-facing / Controlled',
    issueCondition: 'Requires approved scope, commercial position, validity and payment terms.',
    closingStatement: 'The quote is valid only for the stated scope, revision and validity period.',
    sections: [
      { title: 'Quote control', entries: [
        { heading: 'Scope and value', body: 'The quote shall identify the priced scope, deliverables, currency, subtotal, tax and total without exposing internal cost or margin.' },
        { heading: 'Validity and terms', body: 'Validity, payment terms, programme basis, assumptions and exclusions shall be stated clearly.' },
        { heading: 'Acceptance', body: 'Acceptance shall reference the quote number and revision and shall be received through the authorised written route.' },
      ]},
    ],
  },
  'statement-of-work': {
    purpose: 'Establishes the detailed work package, responsibilities, milestones and acceptance requirements for delivery.',
    audience: 'Client, Overflow Partner and authorised execution personnel',
    visibility: 'Controlled / Contract-supporting',
    issueCondition: 'Requires an accepted commercial basis and approved delivery scope.',
    closingStatement: 'The Statement of Work and accepted quotation together define the authorised delivery basis unless a signed contract states otherwise.',
    sections: [
      { title: 'Work package', entries: [
        { heading: 'In-scope work', body: 'The authorised engineering activities and deliverables shall be listed in sufficient detail to permit execution and acceptance.' },
        { heading: 'Out-of-scope work', body: 'Excluded activities, services and responsibilities shall be stated to prevent implied scope.' },
        { heading: 'Milestones and acceptance', body: 'Milestones shall identify expected outputs, target dates, review responsibilities and acceptance criteria.' },
        { heading: 'Change control', body: 'No change affecting scope, effort, cost, programme or acceptance shall be implemented before written approval.' },
      ]},
    ],
  },
  'handover-pack': {
    purpose: 'Transfers the approved commercial, technical and control basis into active project delivery.',
    audience: 'Overflow Partner project team and authorised execution personnel',
    visibility: 'Internal / Delivery controlled',
    issueCondition: 'Requires accepted quotation, approved project creation and identified delivery ownership.',
    closingStatement: 'The handover pack defines the delivery baseline at project commencement and shall be revised when an approved change alters that baseline.',
    sections: [
      { title: 'Delivery handover', entries: [
        { heading: 'Project summary', body: 'The pack shall identify the client, project objective, accepted quote, approved scope, selected partner, delivery date and project owner.' },
        { heading: 'Technical baseline', body: 'Approved requirements, deliverables, standards, assumptions, exclusions, source files and accepted technical risks shall be transferred without re-entry.' },
        { heading: 'Commercial and control notes', body: 'Payment milestones, partner commitment, document controls, communication route and material outstanding actions shall be recorded for delivery management.' },
      ]},
    ],
  },
  'completion-report': {
    purpose: 'Confirms the delivered engineering scope, identifies deviations and records the completion position.',
    audience: 'Client and Overflow Partner project stakeholders',
    visibility: 'Client-facing / Controlled',
    issueCondition: 'Requires completion of the approved deliverables, quality review and an identified release revision.',
    closingStatement: 'Overflow Partner confirms that the documented deliverables have been completed against the approved scope, subject to the deviations and outstanding actions stated in this report.',
    sections: [
      { title: 'Completion record', entries: [
        { heading: 'Project overview', body: 'The report shall identify the approved scope, delivery period, issued revision and principal project references.' },
        { heading: 'Delivered work', body: 'Completed activities and issued deliverables shall be listed against the approved scope and acceptance basis.' },
        { heading: 'Deviations and limitations', body: 'Approved deviations, unresolved limitations, client dependencies and exclusions affecting use of the deliverables shall be stated clearly.' },
        { heading: 'Completion declaration', body: 'The authorised reviewer shall confirm the quality-review status and whether the project is complete, complete subject to actions, or not ready for closure.' },
      ]},
    ],
  },
  'invoice': {
    purpose: 'Requests payment for engineering services supplied under an accepted quotation, contract or approved project milestone.',
    audience: 'Client accounts payable and commercial representatives',
    visibility: 'Client-facing / Financial',
    issueCondition: 'Requires a valid billing event, approved amount, tax treatment, client billing details and payment instructions.',
    closingStatement: 'Payment shall be made using the invoice reference and remittance instructions stated in the issued document.',
    sections: [
      { title: 'Billing record', entries: [
        { heading: 'Billing information', body: 'The invoice shall identify the legal billing entities, billing address, invoice number, issue date, due date, purchase-order reference where applicable and project or quote reference.' },
        { heading: 'Charges and tax', body: 'Each line item shall describe the billed service or milestone, quantity or basis, net value, applicable tax and total amount due.' },
        { heading: 'Payment instructions', body: 'Approved bank and remittance details, payment terms and contact route for invoice queries shall be stated clearly. Internal margin and partner cost shall never appear.' },
      ]},
    ],
  },
  'email-templates': {
    purpose: 'Provides controlled operational wording for lifecycle communications generated by the workspace.',
    audience: 'Overflow Partner operators, clients and approved partners as identified by each template',
    visibility: 'Internal template control / Recipient-specific output',
    issueCondition: 'A message may be sent only when the corresponding governed event has occurred and recipient data is authorised.',
    closingStatement: 'Generated messages shall inherit current case references, dates, links and recipient details from controlled records.',
    sections: [
      { title: 'Communication standards', entries: [
        { heading: 'Partner review invitation', body: 'The message shall identify the controlled case reference, response due date, secure review route and confidentiality obligations without exposing internal commercial information.' },
        { heading: 'Clarification request', body: 'The message shall list the specific information required, the affected case or revision and the response route. General or ambiguous requests shall be avoided.' },
        { heading: 'Quote issue', body: 'The message shall identify the quote number, revision, total value, validity and authorised acceptance route without reproducing internal approval information.' },
        { heading: 'Acceptance and handover', body: 'The message shall confirm the recorded outcome, resulting project reference and next operational step.' },
      ]},
    ],
  },
};
