import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const technicalIntakeInputSchema = z.object({
  lead_id: z.string().uuid(),
  project_type: optionalText(180),
  discipline: optionalText(180),
  description: z.string().trim().min(20, 'Describe the engineering requirement in more detail').max(8000),
  deliverables: optionalText(4000),
  deadline: z.string().optional().or(z.literal('')),
  special_requirements: optionalText(4000),
  status: z.enum(['draft', 'submitted']).default('draft'),
});

export type TechnicalIntakeInput = z.infer<typeof technicalIntakeInputSchema>;
