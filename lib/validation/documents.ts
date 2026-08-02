import { z } from 'zod';

export const documentInputSchema = z.object({
  document_type: z.string().trim().min(2, 'Document type is required').max(120),
  title: z.string().trim().min(2, 'Document title is required').max(220),
  reference: z.string().trim().min(2, 'Reference is required').max(120),
  lead_id: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['draft', 'in_review', 'approved', 'issued', 'superseded']).default('draft'),
  version: z.coerce.number().int().min(1).default(1),
});

export type DocumentInput = z.infer<typeof documentInputSchema>;
