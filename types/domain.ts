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

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
