import {z} from 'zod';
export const publicEnquirySchema=z.object({
 full_name:z.string().trim().min(2).max(160),
 work_email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),
 company:z.string().trim().min(2).max(180),
 project_type:z.string().trim().min(2).max(180),
 brief_requirement:z.string().trim().min(10).max(4000),
 source:z.string().trim().max(80).optional().default('Website'),
 pageUrl:z.string().trim().url().optional().or(z.literal('')),
 lead_id:z.string().trim().max(160).optional().or(z.literal('')),
 nurture_consent:z.enum(['true','false']).optional().default('false'),
 company_website:z.string().max(300).optional().default(''),
 turnstile_token:z.string().min(10).max(5000),
});
