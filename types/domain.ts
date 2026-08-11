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
export type DocumentStatus = 'draft' | 'in_review' | 'changes_requested' | 'signed' | 'approved' | 'issued' | 'published' | 'archived' | 'superseded';
export type PartnerStatus = 'prospective' | 'approved' | 'suspended' | 'inactive';
export type PartnerQuoteStatus = 'requested' | 'received' | 'under_review' | 'selected' | 'declined' | 'expired';
export type CommercialReviewStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type QuoteStatus = 'draft' | 'internal_review' | 'issued' | 'accepted' | 'declined' | 'expired' | 'superseded' | 'rejected' | 'withdrawn';
export type ProjectStatus = 'planning' | 'active' | 'waiting' | 'review' | 'completed' | 'closed' | 'cancelled';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export type CommercialAuthorisationBasis = 'deposit' | 'po' | 'credit' | 'manual' | 'none';
export type InvoiceType = 'deposit' | 'milestone' | 'final' | 'credit_note';
export type InvoiceStatus = 'draft' | 'issued' | 'part_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'cleared' | 'failed' | 'refunded';
export type BillingMilestoneStatus = 'pending' | 'ready' | 'invoiced' | 'paid' | 'waived';
export type PartnerPayableStatus = 'draft' | 'received' | 'matched' | 'approved' | 'scheduled' | 'paid' | 'disputed' | 'cancelled';
export type RiskCategory = 'commercial' | 'technical' | 'delivery' | 'financial' | 'client' | 'partner' | 'operational' | 'compliance' | 'security';
export type RiskStatus = 'open' | 'mitigating' | 'accepted' | 'closed';
export type ComplianceStatus = 'missing' | 'pending' | 'valid' | 'due' | 'expired' | 'waived';
export type KnowledgeType = 'note' | 'lesson' | 'decision' | 'standard' | 'scope' | 'partner_insight' | 'client_preference';

export interface Profile { id: string; organisation_id: string | null; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null; role: AppRole; is_active: boolean; developer_delete_enabled: boolean; }
export interface Company { id: string; organisation_id: string; name: string; website: string | null; industry: string | null; country: string | null; employee_count: number | null; annual_revenue: number | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string; }
export interface Contact { id: string; organisation_id: string; company_id: string | null; full_name: string; job_title: string | null; email: string | null; phone: string | null; linkedin_url: string | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string; company?: Pick<Company, 'id' | 'name'> | null; }
export interface Prospect { id: string; organisation_id: string; created_by: string; source: AcquisitionSource; company_name: string; contact_name: string | null; job_title: string | null; linkedin_url: string | null; email: string | null; phone: string | null; industry: string | null; project_type: string | null; requirement_summary: string | null; website_submission_id: string | null; status: ProspectStatus; last_contacted_at: string | null; next_action: string | null; next_action_at: string | null; notes: string | null; converted_lead_id: string | null; company_id: string | null; contact_id: string | null; assigned_to: string | null; created_at: string; updated_at: string; }
export interface Lead { id: string; organisation_id: string; created_by: string; company_name: string; contact_name: string | null; contact_email: string | null; project_type: string | null; status: LeadStatus; notes: string | null; company_id: string | null; contact_id: string | null; prospect_id: string | null; source: AcquisitionSource | null; title: string | null; service: string | null; priority: Priority; owner_id: string | null; reference: string | null; next_action: string | null; created_at: string; updated_at: string; }
export interface TechnicalIntake { id: string; organisation_id: string; lead_id: string; project_type: string | null; discipline: string | null; description: string; deliverables: string | null; deadline: string | null; special_requirements: string | null; status: IntakeStatus; submitted_at: string | null; reviewed_by: string | null; reviewed_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface DocumentRecord { id: string; organisation_id: string; lead_id: string | null; project_id: string | null; technical_intake_id: string | null; quote_id: string | null; created_by: string; document_type: string; reference: string; title: string; status: DocumentStatus; storage_path: string | null; version: number; approved_by: string | null; approved_at: string | null; issued_at: string | null; created_at: string; updated_at: string; }
export interface Partner { id: string; organisation_id: string; company_name: string; country: string | null; services: string | null; contact_name: string | null; email: string | null; phone: string | null; nda_signed: boolean; nda_signed_at: string | null; status: PartnerStatus; rating: number | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string; }
export interface PartnerQuote { id: string; organisation_id: string; partner_id: string; lead_id: string; technical_intake_id: string | null; price: number; currency: string; lead_time_days: number | null; valid_until: string | null; notes: string | null; status: PartnerQuoteStatus; submitted_at: string | null; created_by: string | null; created_at: string; updated_at: string; partner?: Pick<Partner, 'id' | 'company_name'> | null; lead?: Pick<Lead, 'id' | 'title' | 'company_name'> | null; }
export interface CommercialReview { id: string; organisation_id: string; lead_id: string; partner_quote_id: string | null; client_price: number; cost_price: number | null; margin_amount: number | null; margin_percent: number | null; status: CommercialReviewStatus; approved_by: string | null; approved_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface ClientQuote { id: string; organisation_id: string; lead_id: string; commercial_review_id: string | null; quote_number: string; revision: number; status: QuoteStatus; subtotal: number; vat: number; total: number; currency: string; valid_until: string | null; issued_at: string | null; accepted_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface Project { id: string; organisation_id: string; lead_id: string; quote_id: string | null; project_number: string; title: string; status: ProjectStatus; project_stage?: string | null; start_date: string | null; due_date: string | null; project_manager_id: string | null; notes: string | null; created_by: string; created_at: string; updated_at: string; }
export interface Task { id: string; organisation_id: string; entity_type: string; entity_id: string; title: string; description: string | null; assigned_to: string | null; priority: Priority; status: TaskStatus; due_at: string | null; completed_at: string | null; created_by: string; created_at: string; updated_at: string; }
export interface ActivityEvent { id: string; organisation_id: string; entity_type: string; entity_id: string; user_id: string | null; event_type: string; event_data: Record<string, unknown>; old_value: unknown; new_value: unknown; created_at: string; }

export interface CommercialTerms { id:string; organisation_id:string; project_id:string; quote_id:string|null; authorisation_basis:CommercialAuthorisationBasis; payment_terms_days:number; deposit_percent:number; deposit_required_amount:number; po_number:string|null; credit_approved:boolean; override_reason:string|null; authorised_by:string|null; authorised_at:string|null; created_by:string|null; created_at:string; updated_at:string; }
export interface Invoice { id:string; organisation_id:string; project_id:string; lead_id:string|null; quote_id:string|null; invoice_number:string; invoice_type:InvoiceType; status:InvoiceStatus; description:string|null; subtotal:number; vat_rate:number; vat:number; total:number; amount_paid:number; currency:string; due_date:string|null; issued_at:string|null; paid_at:string|null; external_reference:string|null; created_by:string|null; created_at:string; updated_at:string; }
export interface Payment { id:string; organisation_id:string; invoice_id:string; project_id:string; amount:number; currency:string; payment_method:string; status:PaymentStatus; reference:string|null; paid_at:string; recorded_by:string|null; created_at:string; }
export interface BillingMilestone { id:string; organisation_id:string; project_id:string; label:string; sequence_no:number; percentage:number|null; amount:number; trigger_stage:string|null; status:BillingMilestoneStatus; invoice_id:string|null; due_date:string|null; created_by:string|null; created_at:string; updated_at:string; }
export interface PartnerPayable { id:string; organisation_id:string; project_id:string; partner_id:string; partner_quote_id:string|null; payable_number:string; invoice_reference:string|null; status:PartnerPayableStatus; description:string|null; subtotal:number; vat:number; total:number; amount_paid:number; currency:string; due_date:string|null; evidence_confirmed:boolean; approved_by:string|null; approved_at:string|null; created_by:string|null; created_at:string; updated_at:string; }
export interface RiskRecord { id:string; organisation_id:string; entity_type:'organisation'|'lead'|'project'|'partner'|'client'; entity_id:string|null; title:string; category:RiskCategory; likelihood:number; impact:number; status:RiskStatus; owner_id:string|null; due_date:string|null; mitigation:string|null; residual_score:number|null; created_by:string|null; created_at:string; updated_at:string; }
export interface ComplianceRecord { id:string; organisation_id:string; entity_type:'organisation'|'project'|'partner'|'client'; entity_id:string|null; control_type:string; title:string; status:ComplianceStatus; effective_date:string|null; expiry_date:string|null; evidence_document_id:string|null; owner_id:string|null; notes:string|null; created_by:string|null; created_at:string; updated_at:string; }
export interface KnowledgeEntry { id:string; organisation_id:string; title:string; summary:string|null; body:string; knowledge_type:KnowledgeType; tags:string[]; source_entity_type:string|null; source_entity_id:string|null; is_pinned:boolean; created_by:string|null; created_at:string; updated_at:string; }

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
