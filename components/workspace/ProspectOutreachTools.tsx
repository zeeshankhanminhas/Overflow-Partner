'use client';

import { useState } from 'react';

export default function ProspectOutreachTools({linkedinUrl,message}:{linkedinUrl?:string|null;message:string}){
  const [copied,setCopied]=useState(false);
  async function copyMessage(){
    try{await navigator.clipboard.writeText(message);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}
  }
  return <div className="outreach-tool-row">
    {linkedinUrl?<a className="button secondary" href={linkedinUrl} target="_blank" rel="noreferrer">Open LinkedIn</a>:<span className="button secondary" aria-disabled="true">LinkedIn not recorded</span>}
    <button className="button secondary" type="button" onClick={copyMessage}>{copied?'Message copied':'Copy message'}</button>
  </div>;
}
