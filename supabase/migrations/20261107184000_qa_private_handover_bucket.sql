-- Isolated QA only. Private document storage for the Northfield controlled Handover Pack.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('opos-qa-controlled-handover','opos-qa-controlled-handover',false,5242880,ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO NOTHING;
