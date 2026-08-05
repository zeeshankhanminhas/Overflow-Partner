import { z } from 'zod';

const optionalText = z.string().trim().max(4000).optional().or(z.literal(''));
const optionalDate = z.string().optional().or(z.literal(''));

export const partnerSchema = z.object({
  company_name: z.string().trim().min(2).max(180), country: optionalText,
  services: z.string().trim().min(2).max(1000), contact_name: optionalText,
  email: z.string().trim().email().optional().or(z.literal('')), phone: optionalText,
  nda_signed: z.enum(['true','false']).default('false'), status: z.enum(['prospective','approved','suspended','inactive']).default('prospective'),
  rating: z.coerce.number().min(0).max(5).optional().or(z.literal('')), notes: optionalText,
});

export const partnerQuoteSchema = z.object({
  partner_review_request_id: z.string().uuid(),
  partner_review_response_id: z.string().uuid().optional().or(z.literal('')),
  partner_id: z.string().uuid(), lead_id: z.string().uuid(),
  technical_intake_id: z.string().uuid().optional().or(z.literal('')),
  price: z.coerce.number().min(0), currency: z.string().trim().length(3).default('GBP'),
  lead_time_days: z.coerce.number().int().min(0).optional().or(z.literal('')), valid_until: optionalDate,
  commercial_assumptions: optionalText, exclusions: optionalText, payment_terms: optionalText,
  delivery_commitment: optionalText, quote_reference: optionalText,
  status: z.enum(['requested','received','under_review','selected','declined','expired']).default('requested'), notes: optionalText,
});

export const commercialReviewSchema = z.object({ lead_id: z.string().uuid(), partner_quote_id: z.string().uuid().optional().or(z.literal('')), cost_price: z.coerce.number().min(0), client_price: z.coerce.number().min(0), status: z.enum(['draft','pending_approval','approved','rejected']).default('draft') });
export const clientQuoteSchema = z.object({ lead_id: z.string().uuid(), commercial_review_id: z.string().uuid().optional().or(z.literal('')), quote_number: z.string().trim().min(3).max(80), revision: z.coerce.number().int().min(1).default(1), subtotal: z.coerce.number().min(0), vat: z.coerce.number().min(0).default(0), currency: z.string().trim().length(3).default('GBP'), valid_until: optionalDate, status: z.enum(['draft','internal_review','issued','accepted','declined','expired','superseded']).default('draft') });
export const projectSchema = z.object({ lead_id: z.string().uuid(), quote_id: z.string().uuid().optional().or(z.literal('')), project_number: z.string().trim().min(3).max(80), title: z.string().trim().min(3).max(220), status: z.enum(['planning','active','waiting','review','completed','closed','cancelled']).default('planning'), start_date: optionalDate, due_date: optionalDate, notes: optionalText });
export const taskSchema = z.object({ entity_type: z.string().trim().min(2).max(80), entity_id: z.string().uuid(), title: z.string().trim().min(3).max(220), description: optionalText, priority: z.enum(['low','normal','high','urgent']).default('normal'), status: z.enum(['open','in_progress','blocked','completed','cancelled']).default('open'), due_at: z.string().optional().or(z.literal('')) });

export type PartnerInput = z.infer<typeof partnerSchema>;
export type PartnerQuoteInput = z.infer<typeof partnerQuoteSchema>;
export type CommercialReviewInput = z.infer<typeof commercialReviewSchema>;
export type ClientQuoteInput = z.infer<typeof clientQuoteSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
