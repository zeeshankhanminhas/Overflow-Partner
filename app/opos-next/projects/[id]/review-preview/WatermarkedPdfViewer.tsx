'use client';

import {useEffect,useState} from 'react';

type PdfState={status:'loading'|'ready'|'error';url:string|null;message:string|null;bytes:number};
const start:PdfState={status:'loading',url:null,message:null,bytes:0};

/**
 * Secure QA-only browser presentation. The server verifies all permissions,
 * signs no public URLs, downloads private engineering evidence, and embeds
 * the watermark into PDF bytes before this component receives the response.
 * Fetching with the same signed-in origin avoids the browser PDF plug-in
 * handling an HTML login / 403 response as though it were a PDF.
 */
export default function WatermarkedPdfViewer({projectId,fileId,filename,sourceUrl,audience='operator'}:{
 projectId:string;fileId:string;filename:string;sourceUrl?:string;audience?:'client'|'operator';
}){
 const [attempt,setAttempt]=useState(0);
 const [preview,setPreview]=useState<PdfState>(start);
 useEffect(()=>{
  const controller=new AbortController();
  let objectUrl:string|null=null;
  let active=true;
  (async()=>{
   try{
    const url=sourceUrl||('/opos-next/projects/'+encodeURIComponent(projectId)+'/review-preview/'+encodeURIComponent(fileId));
    const response=await fetch(url,{method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/pdf'},signal:controller.signal});
    if(!response.ok){
     const message=response.status===401||response.status===403
       ? audience==='client'?'Your protected review could not be authorised. Check that you are signed in to the assigned Client Workspace account.':'Your secure preview could not be authorised. Check that you are signed in to the isolated QA workspace with an OP reviewer account.'
       :response.status===404?'This PDF is no longer part of the currently authorised engineering revision.'
       :response.status===413||response.status===415?'The submitted document could not be converted to a supported, watermarked PDF.'
       :'The secure PDF preparation service returned HTTP '+response.status+'. Please use Retry; if the error persists, its server diagnostic can identify the failing step.';
     throw new Error(message);
    }
    if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/pdf'))
     throw new Error('The preview returned a web page instead of a PDF. Your OPOS-QA sign-in may have expired.');
    const data=await response.arrayBuffer();
    const bytes=new Uint8Array(data);
    const header=new TextDecoder().decode(bytes.subarray(0,5));
    const tail=new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-2048)));
    if(header!=='%PDF-'||!tail.includes('%%EOF')||bytes.length<100)
     throw new Error('The watermarked response is not a complete PDF. The viewer has not opened it.');
    objectUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    if(!active){URL.revokeObjectURL(objectUrl);objectUrl=null;return;}
    setPreview({status:'ready',url:objectUrl,message:null,bytes:bytes.length});
   }catch(error){
    if(!active||controller.signal.aborted)return;
    setPreview({status:'error',url:null,bytes:0,
      message:error instanceof Error?error.message:'The secure review PDF could not be prepared.'});
   }
  })();
  return ()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[projectId,fileId,sourceUrl,attempt]);
 const retry=()=>{setPreview(start);setAttempt(v=>v+1);};
 return <div style={{display:'grid',gap:12}}>
  {preview.status==='loading'?<div role="status" aria-live="polite"
    style={{border:'1px solid #40454c',borderRadius:8,minHeight:230,padding:28,
     display:'grid',placeContent:'center',textAlign:'center',gap:12,color:'#bec5c9'}}>
    <strong>Preparing watermarked PDF</strong>
    <span style={{fontSize:13}}>Validating authenticated access, current-cycle approval and PDF bytes…</span>
   </div>:null}
  {preview.status==='error'?<div role="alert" style={{border:'1px solid #8b5555',borderRadius:8,
    padding:24,background:'#251b1e',display:'grid',gap:12,color:'#f3d8d8'}}>
    <strong>Secure engineering review unavailable</strong>
    <span style={{fontSize:13,lineHeight:1.7}}>{preview.message}</span>
    <button type="button" onClick={retry} style={{justifySelf:'start',background:'#f4f4f5',
      color:'#161719',border:0,borderRadius:7,padding:'10px 15px',fontWeight:650,cursor:'pointer'}}>
      Retry secure PDF preview
    </button>
    <small style={{color:'#c4aeb1'}}>{audience==='client'?'Your review decision has not been recorded. No native deliverables have been released.':'No client files have been issued. This does not change the QA decision or project stage.'}</small>
   </div>:null}
  {preview.status==='ready'&&preview.url?<div style={{display:'grid',gap:12}}>
    <div role="status" style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      gap:12,flexWrap:'wrap',color:'#b2d4bf',fontSize:12}}>
      <span>Verified watermarked PDF · {Math.ceil(preview.bytes/1024)} KB</span>
      <a href={preview.url} target="_blank" rel="noopener noreferrer"
        style={{color:'#dfe7e8',textDecoration:'underline',textUnderlineOffset:4}}>
        Open in a separate PDF tab
      </a>
    </div>
    <iframe title={'Watermarked QA preview of '+filename}
      src={preview.url+'#toolbar=0&navpanes=0'}
      style={{border:'1px solid #42464b',borderRadius:8,width:'100%',
        height:'min(84vh,850px)',minHeight:480,background:'#24272b'}}/>
    <p style={{fontSize:12,lineHeight:1.6,color:'#a5a9b1',margin:0}}>
      If your browser cannot display its built-in PDF frame, use the separate PDF tab above.
      The original private engineering file is never linked here. These browser-visible bytes are watermarked, but screenshots and extraction cannot be completely prevented.
    </p>
   </div>:null}
 </div>;
}
