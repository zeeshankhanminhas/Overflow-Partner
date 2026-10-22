'use client';

import { useMemo, useState } from 'react';
import { parseConversationTranscript, type ParsedConversationMessage } from '@/lib/acquisition/conversationImport';
import { importProspectConversationAction } from '@/app/workspace/acquisition/conversation-actions';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

export default function LinkedInConversationImportForm({prospectId}:{prospectId:string}) {
  const [raw,setRaw]=useState('');
  const [overrides,setOverrides]=useState<Record<number,Partial<ParsedConversationMessage>>>({});
  const preview=useMemo(()=>{
    try{return {rows:parseConversationTranscript(raw),error:''};}
    catch(error){return {rows:[] as ParsedConversationMessage[],error:raw.trim()?(error instanceof Error?error.message:'Invalid transcript'):''};}
  },[raw]);
  const reviewed=preview.rows.map((row,index)=>({...row,...(overrides[index]||{})}));
  const unresolved=reviewed.filter(row=>row.speaker==='unknown').length;
  return <form action={importProspectConversationAction} className={styles.importForm}>
    <input type="hidden" name="prospect_id" value={prospectId}/>
    <label>Source
      <select name="source" defaultValue="linkedin"><option value="linkedin">LinkedIn</option><option value="sales_navigator">Sales Navigator</option></select>
    </label>
    <label>Source conversation URL (optional)
      <input name="source_url" type="url" maxLength={2048} placeholder="https://www.linkedin.com/messaging/..."/>
    </label>
    <label>Paste the conversation
      <textarea name="transcript" required rows={8} maxLength={60000} value={raw}
        onChange={event=>{setRaw(event.target.value);setOverrides({});}}
        placeholder={'Paste messages copied from LinkedIn or Sales Navigator.\n\nYou: Hello, do you use external CAD support?\nProspect: Occasionally, yes.'}/>
    </label>
    <small>Paste first, then review each message below. Clearly labelled messages are recognised; unlabelled paragraphs remain unassigned until you choose a speaker. Original text is retained unchanged.</small>
    {preview.error?<p role="alert">{preview.error}</p>:null}
    {reviewed.length?<div>
      <p className={styles.eyebrow}>Review before saving · {reviewed.length} message{reviewed.length===1?'':'s'}</p>
      {unresolved?<p className={styles.formNote}>{unresolved} message{unresolved===1?' needs':'s need'} speaker review. Nothing is attributed automatically.</p>:null}
      <ol className={styles.previewList}>
        {reviewed.map((item,index)=><li key={index} className={styles.previewItem}>
          <div>
            <label>Sender
              <select aria-label={`Sender of message ${index+1}`} value={item.speaker}
                onChange={event=>setOverrides(old=>({...old,[index]:{...old[index],speaker:event.target.value as ParsedConversationMessage['speaker']}}))}>
                <option value="unknown">Unassigned</option><option value="you">You</option><option value="prospect">Prospect</option>
              </select>
            </label>
            <small>{item.sentAt?new Date(item.sentAt).toLocaleString('en-GB'):'Time not supplied'}</small>
          </div>
          <label>Message {index+1}
            <textarea maxLength={20000} value={item.body} rows={Math.min(5,Math.max(2,item.body.split('\n').length))}
              onChange={event=>setOverrides(old=>({...old,[index]:{...old[index],body:event.target.value}}))}/>
          </label>
        </li>)}
      </ol>
    </div>:null}
    <input type="hidden" name="reviewed_messages" value={JSON.stringify(reviewed.map(item=>({speaker:item.speaker,body:item.body,sentAt:item.sentAt})))}/>
    <button className="button" type="submit" disabled={!preview.rows.length||Boolean(preview.error)||reviewed.some(item=>!item.body.trim())}>
      Archive reviewed conversation ↗
    </button>
    <small>Re-importing the same conversation won't create duplicate records. Importing does not mark someone interested or send any LinkedIn message.</small>
  </form>;
}
