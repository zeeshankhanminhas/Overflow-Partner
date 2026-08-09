import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'technical-intake';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_INTAKE = 10;
const ALLOWED_EXTENSIONS = new Set([
  'pdf','png','jpg','jpeg','zip','docx','xlsx','xls','csv',
  'step','stp','iges','igs','x_t','x_b','sldprt','sldasm','ipt','iam',
  'dwg','dxf','stl','obj','3mf','txt'
]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function extension(name: string) {
  const part = name.split('.').pop()?.toLowerCase() || '';
  return part === name.toLowerCase() ? '' : part;
}

function safeFilename(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 140);
  return cleaned || 'engineering-file';
}

async function sessionForToken(token: string) {
  const supabase = admin();
  const { data, error } = await supabase
    .from('intake_sessions')
    .select('id,organisation_id,prospect_id,status,expires_at')
    .eq('token_hash', hashToken(token))
    .single();

  if (error || !data) return { supabase, session: null };
  if (new Date(data.expires_at).getTime() < Date.now() && !['submitted','converted'].includes(data.status)) {
    await supabase.from('intake_sessions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', data.id);
    return { supabase, session: null };
  }
  return { supabase, session: data };
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  let uploadedPath = '';
  try {
    const { token } = await context.params;
    const { supabase, session } = await sessionForToken(token);
    if (!session) return NextResponse.json({ message: 'This technical intake link is invalid or has expired.' }, { status: 404 });
    if (['submitted','converted','cancelled','expired'].includes(session.status)) {
      return NextResponse.json({ message: 'Files can no longer be added to this technical intake.' }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const category = String(formData.get('category') || 'reference').trim().slice(0, 80) || 'reference';
    if (!(file instanceof File)) return NextResponse.json({ message: 'Choose a file to upload.' }, { status: 400 });
    if (file.size <= 0) return NextResponse.json({ message: 'The selected file is empty.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ message: 'Each file must be 25 MB or smaller.' }, { status: 413 });

    const ext = extension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ message: `.${ext || 'unknown'} files are not accepted for technical intake.` }, { status: 415 });
    }

    const { count, error: countError } = await supabase
      .from('intake_files')
      .select('id', { count: 'exact', head: true })
      .eq('intake_session_id', session.id);
    if (countError) throw countError;
    if ((count || 0) >= MAX_FILES_PER_INTAKE) {
      return NextResponse.json({ message: `A maximum of ${MAX_FILES_PER_INTAKE} files can be attached to one technical intake.` }, { status: 409 });
    }

    const storedName = `${randomUUID()}-${safeFilename(file.name)}`;
    uploadedPath = `${session.organisation_id}/${session.prospect_id}/${session.id}/${storedName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: row, error: insertError } = await supabase.from('intake_files').insert({
      organisation_id: session.organisation_id,
      intake_session_id: session.id,
      prospect_id: session.prospect_id,
      storage_path: uploadedPath,
      original_filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      file_category: category,
    }).select('id,original_filename,size_bytes,file_category,uploaded_at').single();

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([uploadedPath]).catch(() => null);
      uploadedPath = '';
      throw insertError;
    }

    if (session.status === 'invited' || session.status === 'opened') {
      await supabase.from('intake_sessions').update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', session.id);
    }

    return NextResponse.json({ file: row }, { status: 201 });
  } catch (error) {
    console.error('Step 2 file upload failed', error);
    return NextResponse.json({ message: 'The engineering file could not be uploaded.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { supabase, session } = await sessionForToken(token);
    if (!session) return NextResponse.json({ message: 'This technical intake link is invalid or has expired.' }, { status: 404 });
    if (['submitted','converted','cancelled','expired'].includes(session.status)) {
      return NextResponse.json({ message: 'Files can no longer be removed from this technical intake.' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const fileId = String(body?.fileId || '');
    if (!fileId) return NextResponse.json({ message: 'File ID is required.' }, { status: 400 });

    const { data: row, error } = await supabase.from('intake_files')
      .select('id,storage_path')
      .eq('id', fileId)
      .eq('intake_session_id', session.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ message: 'File not found.' }, { status: 404 });

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await supabase.from('intake_files').delete().eq('id', fileId).eq('intake_session_id', session.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Step 2 file removal failed', error);
    return NextResponse.json({ message: 'The engineering file could not be removed.' }, { status: 500 });
  }
}
