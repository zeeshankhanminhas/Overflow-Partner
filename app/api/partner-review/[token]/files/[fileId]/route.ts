import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(_: Request, context: { params: Promise<{ token: string; fileId: string }> }) {
  try {
    const { token, fileId } = await context.params;
    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return NextResponse.json({ message: 'File not found.' }, { status: 404 });
    }

    const supabase = admin();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { data: review, error: reviewError } = await supabase
      .from('partner_review_requests')
      .select('id,organisation_id,status,expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (reviewError) throw reviewError;
    if (!review || ['revoked', 'expired'].includes(review.status) ||
        (review.expires_at && new Date(review.expires_at).getTime() < Date.now())) {
      return NextResponse.json({ message: 'Review link is unavailable or expired.' }, { status: 404 });
    }

    const { data: shared, error: sharedError } = await supabase
      .from('partner_review_files')
      .select('id,organisation_id,partner_review_request_id,intake_file_id,document_id,storage_path,display_name,access_count')
      .eq('id', fileId)
      .eq('partner_review_request_id', review.id)
      .eq('organisation_id', review.organisation_id)
      .maybeSingle();
    if (sharedError) throw sharedError;
    if (!shared) return NextResponse.json({ message: 'File is not shared with this review.' }, { status: 404 });

    let bucket: string;
    let storagePath: string | null = null;
    if (shared.intake_file_id) {
      const { data: intakeFile, error } = await supabase.from('intake_files')
        .select('storage_path')
        .eq('id', shared.intake_file_id)
        .eq('organisation_id', review.organisation_id)
        .maybeSingle();
      if (error) throw error;
      if (!intakeFile) return NextResponse.json({ message: 'Source file not found.' }, { status: 404 });
      bucket = 'technical-intake';
      storagePath = intakeFile.storage_path;
    } else {
      // Additional document storage types must be mapped explicitly, not guessed.
      return NextResponse.json({ message: 'This file source is not yet supported for secure download.' }, { status: 422 });
    }

    if (!storagePath) return NextResponse.json({ message: 'File path unavailable.' }, { status: 404 });
    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60, { download: shared.display_name || 'engineering-file' });
    if (signedError || !signed?.signedUrl) throw signedError || new Error('Unable to sign download.');

    await supabase.from('partner_review_files').update({
      access_count: (shared.access_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    }).eq('id', shared.id).eq('partner_review_request_id', review.id);

    return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    console.error('Partner review file download failed', error);
    return NextResponse.json({ message: 'Unable to open the shared file.' }, { status: 500 });
  }
}
