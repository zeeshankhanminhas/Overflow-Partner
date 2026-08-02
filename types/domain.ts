export type AppRole =
  | 'owner'
  | 'admin'
  | 'operator'
  | 'reviewer'
  | 'business_development'
  | 'engineering'
  | 'commercial'
  | 'partner'
  | 'viewer';

export type AcquisitionSource = 'linkedin' | 'website' | 'email' | 'referral' | 'phone' | 'manual';
export type ProspectStatus = 'identified' | 'contacted' | 'conversation' | 'qualified' | 'converted' | 'not_a_fit';
export type LeadStatus = 'new' | 'qualified' | 'technical_intake' | 'partner_review' | 'pricing' | 'quoted' | 'won' | 'lost';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type IntakeStatus = 'draft' | 'submitted' | 'under_review' | 'clarification_required' | 'approved' | 'rejected';
export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'issued' | 'superseded';

export interface Profile {
  id: string;
  organisation_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: AppRole;
  is_active: boolean;
}

export interface Company {
  id: string;
  organisation_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prospect {
  id: string;
  organisation_id: string;
  created_by: string;
  source: AcquisitionSource;
  company_name: string;
  contact_name: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  status: ProspectStatus;
  last_contacted_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
  notes: string | null;
  converted_lead_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  organisation_id: string;
  created_by: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  project_type: string | null;
  status: LeadStatus;
  notes: string | null;
  company_id: string | null;
  contact_id: string | null;
  prospect_id: string | null;
  source: AcquisitionSource | null;
  title: string | null;
  service: string | null;
  priority: Priority;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicalIntake {
  id: string;
  organisation_id: string;
  lead_id: string;
  project_type: string | null;
  discipline: string | null;
  description: string;
  deliverables: string | null;
  deadline: string | null;
  special_requirements: string | null;
  status: IntakeStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  organisation_id: string;
  lead_id: string | null;
  project_id: string | null;
  technical_intake_id: string | null;
  quote_id: string | null;
  created_by: string;
  document_type: string;
  reference: string;
  title: string;
  status: DocumentStatus;
  storage_path: string | null;
  version: number;
  approved_by: string | null;
  approved_at: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
