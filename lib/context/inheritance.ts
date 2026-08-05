import type { Lead, TechnicalIntake } from '@/types/domain';

export type Lead360Context = {
  identity: {
    leadId: string;
    companyId: string | null;
    contactId: string | null;
    companyName: string;
    contactName: string | null;
    contactEmail: string | null;
    source: string | null;
  };
  requirement: {
    title: string;
    projectType: string | null;
    service: string | null;
    description: string;
    discipline: string | null;
    deliverables: string | null;
    deadline: string | null;
    specialRequirements: string | null;
  };
  provenance: {
    source: 'lead_360';
    technicalIntakeId: string | null;
    technicalIntakeStatus: string | null;
  };
};

function clean(value: string | null | undefined) {
  const result = value?.trim();
  return result || null;
}

export function buildLead360Context(lead: Lead, intake?: TechnicalIntake | null): Lead360Context {
  const description = clean(intake?.description)
    || clean(lead.notes)
    || clean(lead.title)
    || `${lead.company_name} engineering requirement`;

  return {
    identity: {
      leadId: lead.id,
      companyId: lead.company_id,
      contactId: lead.contact_id,
      companyName: lead.company_name,
      contactName: clean(lead.contact_name),
      contactEmail: clean(lead.contact_email),
      source: clean(lead.source),
    },
    requirement: {
      title: clean(lead.title) || `${lead.company_name} engineering requirement`,
      projectType: clean(intake?.project_type) || clean(lead.project_type),
      service: clean(lead.service),
      description,
      discipline: clean(intake?.discipline),
      deliverables: clean(intake?.deliverables) || clean(lead.service),
      deadline: clean(intake?.deadline),
      specialRequirements: clean(intake?.special_requirements),
    },
    provenance: {
      source: 'lead_360',
      technicalIntakeId: intake?.id || null,
      technicalIntakeStatus: intake?.status || null,
    },
  };
}

export function buildPartnerReviewScope(context: Lead360Context) {
  const parts = [
    context.requirement.title,
    context.requirement.projectType ? `Project type: ${context.requirement.projectType}` : null,
    context.requirement.discipline ? `Discipline: ${context.requirement.discipline}` : null,
    context.requirement.deliverables ? `Deliverables: ${context.requirement.deliverables}` : null,
    `Requirement: ${context.requirement.description}`,
    context.requirement.deadline ? `Required by: ${context.requirement.deadline}` : null,
    context.requirement.specialRequirements ? `Special requirements: ${context.requirement.specialRequirements}` : null,
  ];
  return parts.filter(Boolean).join('\n');
}

export function inheritedSnapshot(context: Lead360Context) {
  return {
    identity: context.identity,
    requirement: context.requirement,
    provenance: context.provenance,
  };
}
