'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type IntakeFile = {
  id: string;
  original_filename: string;
  size_bytes: number;
  file_category?: string | null;
  uploaded_at?: string | null;
};

type PreparedUpload = {
  path: string;
  token: string;
  bucket: string;
  filename: string;
  size: number;
  mimeType: string;
  category: string;
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.zip,.docx,.xlsx,.xls,.csv,.step,.stp,.iges,.igs,.x_t,.x_b,.sldprt,.sldasm,.ipt,.iam,.dwg,.dxf,.stl,.obj,.3mf,.txt';

export default function TechnicalIntakeFiles({ token, initialFiles = [], disabled = false }: { token: string; initialFiles?: IntakeFile[]; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<IntakeFile[]>(initialFiles);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function prepare(file: File): Promise<PreparedUpload> {
    const response = await fetch(`/api/intake/${token}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'prepare',
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        category: 'client_source',
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.upload) throw new Error(body.message || `Unable to prepare ${file.name}.`);
    return body.upload as PreparedUpload;
  }

  async function finalize(upload: PreparedUpload): Promise<IntakeFile> {
    const response = await fetch(`/api/intake/${token}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finalize', ...upload }),
    });
    const body = await response.json();
    if (!response.ok || !body.file) throw new Error(body.message || `Unable to register ${upload.filename}.`);
    return body.file as IntakeFile;
  }

  async function uploadSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setBusy(true);
    setMessage('');
    let uploaded = 0;
    let lastError = '';

    for (const file of selected) {
      if (file.size > 25 * 1024 * 1024) {
        lastError = `${file.name} is larger than 25 MB.`;
        continue;
      }
      try {
        const prepared = await prepare(file);
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(prepared.bucket)
          .uploadToSignedUrl(prepared.path, prepared.token, file, {
            contentType: file.type || 'application/octet-stream',
          });
        if (uploadError) throw uploadError;

        const registered = await finalize(prepared);
        setFiles((current) => [...current, registered]);
        uploaded += 1;
      } catch (error) {
        lastError = error instanceof Error ? error.message : `Unable to upload ${file.name}.`;
      }
    }

    setMessage(lastError || `${uploaded} file${uploaded === 1 ? '' : 's'} uploaded securely.`);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function removeFile(file: IntakeFile) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/intake/${token}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.message || 'Unable to remove the file.');
      } else {
        setFiles((current) => current.filter((item) => item.id !== file.id));
        setMessage(`${file.original_filename} removed.`);
      }
    } catch {
      setMessage('Unable to remove the file.');
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 border border-dashed border-black/20 bg-white/40 p-6">
        <div className="grid gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Technical source files</p>
          <p className="text-sm leading-6 text-[var(--muted)]">Attach drawings, CAD models, mark-ups, BOMs or reference packs. Up to 10 files, maximum 25 MB each.</p>
        </div>
        <div>
          <label className={`inline-flex min-h-11 items-center border border-black/20 px-5 py-2.5 text-sm font-medium transition ${disabled || busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-black'}`}>
            {busy ? 'Uploading…' : 'Choose engineering files'}
            <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} onChange={uploadSelected} disabled={disabled || busy} />
          </label>
        </div>
        <p className="text-xs leading-5 text-[var(--subtle)]">Accepted examples: PDF, STEP/STP, IGES, SolidWorks, Inventor, DWG, DXF, ZIP, spreadsheets and common image formats.</p>
      </div>

      {files.length > 0 ? (
        <div className="grid border-t border-black/10">
          {files.map((file) => (
            <div key={file.id} className="grid gap-3 border-b border-black/10 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--ink)]">{file.original_filename}</p>
                <p className="mt-1 text-xs text-[var(--subtle)]">{fileSize(Number(file.size_bytes || 0))} · Secure technical intake evidence</p>
              </div>
              {!disabled ? <button className="text-left text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)] hover:text-black sm:text-right" type="button" onClick={() => removeFile(file)} disabled={busy}>Remove</button> : null}
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-[var(--subtle)]">No technical source files attached yet.</p>}

      {message ? <p className="text-sm leading-6 text-[var(--muted)]" role="status">{message}</p> : null}
    </div>
  );
}
