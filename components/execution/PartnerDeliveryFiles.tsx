'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type DeliveryFile={id:string;submission_id?:string|null;original_filename:string;mime_type?:string|null;size_bytes:number;uploaded_at?:string|null;attached_at?:string|null};
type PreparedUpload={path:string;token:string;bucket:string;filename:string;size:number;mimeType:string;executionCycle:number};

const ACCEPT='.pdf,.png,.jpg,.jpeg,.zip,.docx,.xlsx,.xls,.csv,.txt,.step,.stp,.iges,.igs,.x_t,.x_b,.sldprt,.sldasm,.ipt,.iam,.dwg,.dxf,.stl,.obj,.3mf,.nc,.ncc,.cnc,.tap,.gcode,.prt';
function fileSize(bytes:number){if(bytes<1024)return`${bytes} B`;if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;return`${(bytes/(1024*1024)).toFixed(1)} MB`;}

export default function PartnerDeliveryFiles({token,onStateChange}:{token:string;onStateChange?:(state:{count:number;locked:boolean;cycle:number})=>void}){
  const inputRef=useRef<HTMLInputElement>(null);const[files,setFiles]=useState<DeliveryFile[]>([]);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const[locked,setLocked]=useState(false);const[cycle,setCycle]=useState(1);const[loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    const response=await fetch(`/api/execution/${token}/files`,{cache:'no-store'});const body=await response.json();
    if(!response.ok)throw new Error(body.message||'Unable to load delivery files.');
    const nextFiles=(body.files||[]) as DeliveryFile[];const nextLocked=Boolean(body.locked);const nextCycle=Number(body.execution_cycle||1);
    setFiles(nextFiles);setLocked(nextLocked);setCycle(nextCycle);onStateChange?.({count:nextFiles.length,locked:nextLocked,cycle:nextCycle});setLoading(false);
  },[token,onStateChange]);
  useEffect(()=>{load().catch(error=>{setMessage(error instanceof Error?error.message:'Unable to load delivery files.');setLoading(false);});},[load]);

  async function prepare(file:File):Promise<PreparedUpload>{
    const response=await fetch(`/api/execution/${token}/files`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',filename:file.name,size:file.size,mimeType:file.type||'application/octet-stream'})});
    const body=await response.json();if(!response.ok||!body.upload)throw new Error(body.message||`Unable to prepare ${file.name}.`);return body.upload as PreparedUpload;
  }
  async function finalize(upload:PreparedUpload):Promise<DeliveryFile>{
    const response=await fetch(`/api/execution/${token}/files`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'finalize',...upload})});
    const body=await response.json();if(!response.ok||!body.file)throw new Error(body.message||`Unable to register ${upload.filename}.`);return body.file as DeliveryFile;
  }
  async function uploadSelected(event:ChangeEvent<HTMLInputElement>){
    const selected=Array.from(event.target.files||[]);if(!selected.length)return;setBusy(true);setMessage('');let uploaded=0;let lastError='';
    for(const file of selected){
      if(file.size>25*1024*1024){lastError=`${file.name} is larger than 25 MB.`;continue;}
      try{const prepared=await prepare(file);const supabase=createClient();const{error}=await supabase.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path,prepared.token,file,{contentType:file.type||'application/octet-stream'});if(error)throw error;const registered=await finalize(prepared);setFiles(current=>{const next=[...current,registered];onStateChange?.({count:next.length,locked:false,cycle});return next;});uploaded+=1;}catch(error){lastError=error instanceof Error?error.message:`Unable to upload ${file.name}.`;}
    }
    setMessage(lastError||`${uploaded} file${uploaded===1?'':'s'} uploaded securely.`);setBusy(false);if(inputRef.current)inputRef.current.value='';
  }
  async function removeFile(file:DeliveryFile){
    setBusy(true);setMessage('');try{const response=await fetch(`/api/execution/${token}/files`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:file.id})});const body=await response.json();if(!response.ok)throw new Error(body.message||'Unable to remove the file.');setFiles(current=>{const next=current.filter(item=>item.id!==file.id);onStateChange?.({count:next.length,locked:false,cycle});return next;});setMessage(`${file.original_filename} removed.`);}catch(error){setMessage(error instanceof Error?error.message:'Unable to remove the file.');}setBusy(false);
  }

  const totalBytes=files.reduce((sum,file)=>sum+Number(file.size_bytes||0),0);
  const packageState=locked?'Submitted · locked':files.length?'Ready to submit':'Files required';

  return <section className="grid gap-5 border-y border-black/10 py-6" aria-label="Engineering delivery files">
    <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">Delivery files</p><h3 className="text-xl font-semibold tracking-[-0.02em]">Engineering output package</h3><p className="max-w-2xl text-sm leading-6 text-neutral-600">Add the drawings, CAD/CAM files, models, programmes, BOMs or output pack included in this delivery. Once the delivery is submitted, these files become locked evidence.</p></div>

    <div className="grid grid-cols-3 border-y border-black/10">
      <div className="border-r border-black/10 py-4 pr-4"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Files</p><strong className="mt-1 block text-sm">{files.length}</strong></div>
      <div className="border-r border-black/10 py-4 px-4"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Size</p><strong className="mt-1 block text-sm">{fileSize(totalBytes)}</strong></div>
      <div className="py-4 pl-4"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Status</p><strong className="mt-1 block text-sm">{packageState}</strong></div>
    </div>

    {!locked?<div><label className={`inline-flex min-h-11 items-center border border-black/30 px-5 py-2.5 text-sm font-medium transition ${busy?'cursor-not-allowed opacity-50':'cursor-pointer hover:bg-black hover:text-white'}`}>{busy?'Uploading…':files.length?'Add more files':'Add delivery files'}<input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} onChange={uploadSelected} disabled={busy}/></label></div>:<div className="border-l-2 border-black pl-4 text-sm leading-6 text-neutral-600"><strong className="block text-black">Delivery submitted</strong>These files are locked to the submitted delivery and can no longer be changed.</div>}

    {loading?<p className="text-sm text-neutral-500">Loading files…</p>:files.length?<div className="grid border-t border-black/10">{files.map((file,index)=><div key={file.id} className="grid gap-3 border-b border-black/10 py-4 sm:grid-cols-[42px_1fr_auto] sm:items-center"><span className="text-xs font-medium tabular-nums text-neutral-400">{String(index+1).padStart(2,'0')}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{file.original_filename}</p><p className="mt-1 text-xs text-neutral-500">{fileSize(Number(file.size_bytes||0))} · {file.submission_id?'Submitted':'Ready to submit'}</p></div>{!locked&&!file.submission_id?<button type="button" className="text-left text-xs font-medium uppercase tracking-[0.08em] text-neutral-600 hover:text-black sm:text-right" onClick={()=>removeFile(file)} disabled={busy}>Remove</button>:<span className="text-xs text-neutral-500">{locked?'Locked':'Ready'}</span>}</div>)}</div>:<div className="border-l-2 border-orange-500 pl-4 text-sm leading-6 text-neutral-600">Add at least one delivery file before submitting.</div>}
    {message?<p className="text-sm leading-6 text-neutral-600" role="status">{message}</p>:null}
  </section>;
}