import { z } from 'zod';

const optionalText = z.string().trim().max(500).optional().or(z.literal(''));

export const prospectInputSchema = z.object({
  source: z.enum(['linkedin', 'website', 'email', 'referral', 'phone', 'manual']).default('linkedin'),
  company_name: z.string().trim().min(2, 'Company name is required').max(180),
  contact_name: optionalText,
  job_title: optionalText,
  linkedin_url: z.string().trim().url('Enter a valid LinkedIn URL').optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: optionalText,
  industry: optionalText,
  status: z.enum(['identified', 'contacted', 'conversation', 'qualified', 'converted', 'not_a_fit']).default('identified'),
  next_action: optionalText,
  next_action_at: z.string().optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
});

export type ProspectInput = z.infer<typeof prospectInputSchema>;
