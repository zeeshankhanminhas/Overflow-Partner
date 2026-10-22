'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

export type LinkedInWorkItem = {
  id:string; company:string; contact:string; action:string; detail:string;
  archived:boolean; priority:number;
};

export default function LinkedInProspectList({items}:{items:LinkedInWorkItem[]}) {
  const [search,setSearch]=useState('');
  const [showArchived,setShowArchived]=useState(false);
  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return items.filter(item=>(showArchived||!item.archived)
      && (!term||[item.company,item.contact,item.action].some(v=>v.toLowerCase().includes(term))))
      .sort((a,b)=>a.priority-b.priority);
  },[items,search,showArchived]);
  return <div className={styles.workPanel}>
    <div className={styles.simpleListHeader}>
      <label className={styles.searchLabel}>
        <span className="sr-only">Search prospects by company or contact</span>
        <input type="search" placeholder="Search company or contact…" value={search}
          onChange={event=>setSearch(event.target.value)} aria-label="Search prospects"/>
      </label>
      <label className={styles.showArchived}>
        <input type="checkbox" checked={showArchived} onChange={event=>setShowArchived(event.target.checked)}/>
        Include completed
      </label>
      <span className={styles.count}>{filtered.length} prospect{filtered.length===1?'':'s'}</span>
    </div>
    {filtered.length?<ul className={styles.prospectList}>
      {filtered.map(item=><li key={item.id}>
        <Link className={styles.prospectRow} href={`/outreach/${item.id}`}>
          <div className={styles.prospectText}>
            <strong>{item.company}</strong>
            <small>{item.contact||'Contact not recorded'}</small>
          </div>
          <div className={styles.rowContext}>
            <span className={styles.stage}>{item.action}</span>
            {item.detail?<small>{item.detail}</small>:null}
          </div>
          <span className={styles.rowAction}>Open <span aria-hidden="true">↗</span></span>
        </Link>
      </li>)}
    </ul>:<div className={styles.empty}>
      <strong>No matching prospects</strong>
      <p>Clear the search, include completed prospects, or add someone new.</p>
    </div>}
  </div>;
}
