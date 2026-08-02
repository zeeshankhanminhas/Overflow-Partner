import { z } from 'zod';

export const contactInputSchema = z.object({
  company_id: z.string().uuid().optional().or(z.literal('')),
  full_name: z.string().trim().min(2, 'Contact name is required').max(180),
  job_title: z.string().trim().max(180).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().max(80).optional().or(z.literal('')),
  linkedin_url: z.string().trim().url('Enter a valid LinkedIn URL').optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
});

export type ContactInput = z.infer<typeof contactInputSchema>;
