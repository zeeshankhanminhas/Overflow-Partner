import { z } from 'zod';

export const leadInputSchema = z.object({
  company_name: z.string().trim().min(2, 'Company name is required').max(180),
  contact_name: z.string().trim().max(180).optional().or(z.literal('')),
  contact_email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  project_type: z.string().trim().max(180).optional().or(z.literal('')),
  title: z.string().trim().max(220).optional().or(z.literal('')),
  service: z.string().trim().max(180).optional().or(z.literal('')),
  source: z.enum(['linkedin', 'website', 'email', 'referral', 'phone', 'manual']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  status: z.enum(['new', 'qualified', 'technical_intake', 'partner_review', 'pricing', 'quoted', 'won', 'lost']).default('new'),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
  prospect_id: z.string().uuid().optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;
