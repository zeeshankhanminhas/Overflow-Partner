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
export type PartnerStatus = 'prospective' | 'approved' | 'suspended' | 'inactive';
export type PartnerQuoteStatus = 'requested' | 'received' | 'under_review' | 'selected' | 'declined' | 'expired';
export type CommercialReviewStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type QuoteStatus = 'draft' | 'internal_review' | 'issued' | 'accepted' | 'declined' | 'expired' | 'superseded';
export type ProjectStatus = 'planning' | 'active' | 'waiting' | 'review' | 'completed' | 'closed' | 'cancelled';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export interface Profile { id: string; organisation_id: string | null; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null; role: AppRole; is_active: boolean; }
export interface Company { id: string; organisation_id: string; name: string; website: string | null; industry: string | null; country: string | null; employee_count: number | null; annual_revenue: number | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string; }
export interface Contact { id: string; organisation_id: string; company_id: string | null; full_name: string; job_title: string | null; email: string | null; phone: string | null; linkedin_url: string | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string; company?: Pick<Company, 'id' | 'name'> | null; }
export interface Prospect { id: string; organisation_id: string; created_by: string; source: AcquisitionSource; company_name: string; contact_name: string | null; job_title: string | null; linkedin_url: string | null; email: string | null; phone: string | null; industry: string | null; status: ProspectStatus; last_contacted_at: string | null; next_action: string | null; next_action_at: string | null; notes: string | null; converted_lead_id: string | null; company_id: string | null; contact_id: string | null; assigned_to: string | null; created_at: string; updated_at: string; }
export interface Lead { id: string; organisation_id: string; created_by: string; company_name: string; contact_name: string | null; contact_email: string | null; project_type: string | null; status: LeadStatus; notes: string | null; company_id: string | null; contact_id: string | null; prospect_id: string | null; source: AcquisitionSource | null; title: string | null; service: string | null; priority: Priority; owner_id: string | null; created_at: string; updated_at: string; }
export interface TechnicalIntake { id: string; organisation_id: string; lead_id: string; project_type: string | null; discipline: string | null; description: string; deliverables: string | null; deadline: string | null; special_requirements: string | null; status: IntakeStatus; submitted_at: string | null; reviewed_by: string | null; reviewed_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface DocumentRecord { id: string; organisation_id: string; lead_id: string | null; project_id: string | null; technical_intake_id: string | null; quote_id: string | null; created_by: string; document_type: string; reference: string; title: string; status: DocumentStatus; storage_path: string | null; version: number; approved_by: string | null; approved_at: string | null; issued_at: string | null; created_at: string; updated_at: string; }
export interface Partner { id: string; organisation_id: string; company_name: string; country: string | null; services: string | null; contact_name: string | null; email: string | null; phone: string | null; nda_signed: boolean; nda_signed_at: string | null; status: PartnerStatus; rating: number | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string; }
export interface PartnerQuote { id: string; organisation_id: string; partner_id: string; lead_id: string; technical_intake_id: string | null; price: number; currency: string; lead_time_days: number | null; valid_until: string | null; notes: string | null; status: PartnerQuoteStatus; submitted_at: string | null; created_by: string | null; created_at: string; updated_at: string; partner?: Pick<Partner, 'id' | 'company_name'> | null; lead?: Pick<Lead, 'id' | 'title' | 'company_name'> | null; }
export interface CommercialReview { id: string; organisation_id: string; lead_id: string; partner_quote_id: string | null; client_price: number; cost_price: number | null; margin_amount: number | null; margin_percent: number | null; status: CommercialReviewStatus; approved_by: string | null; approved_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface ClientQuote { id: string; organisation_id: string; lead_id: string; commercial_review_id: string | null; quote_number: string; revision: number; status: QuoteStatus; subtotal: number; vat: number; total: number; currency: string; valid_until: string | null; issued_at: string | null; accepted_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface Project { id: string; organisation_id: string; lead_id: string; quote_id: string | null; project_number: string; title: string; status: ProjectStatus; start_date: string | null; due_date: string | null; project_manager_id: string | null; notes: string | null; created_by: string; created_at: string; updated_at: string; }
export interface Task { id: string; organisation_id: string; entity_type: string; entity_id: string; title: string; description: string | null; assigned_to: string | null; priority: Priority; status: TaskStatus; due_at: string | null; completed_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface ActivityEvent { id: string; organisation_id: string; entity_type: string; entity_id: string; user_id: string | null; event_type: string; event_data: Record<string, unknown>; old_value: unknown; new_value: unknown; created_at: string; }
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
