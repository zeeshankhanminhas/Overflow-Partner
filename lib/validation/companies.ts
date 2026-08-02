import { z } from 'zod';

export const companyInputSchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(180),
  website: z.string().trim().url('Enter a valid website URL').optional().or(z.literal('')),
  industry: z.string().trim().max(180).optional().or(z.literal('')),
  country: z.string().trim().max(120).optional().or(z.literal('')),
  employee_count: z.coerce.number().int().min(0).optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;
