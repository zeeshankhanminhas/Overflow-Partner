'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ProjectRealtimeRefresh({projectId}:{projectId:string}){
  const router=useRouter();
  const [,startTransition]=useTransition();
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const supabase=createClient();
    const refresh=()=>{
      if(timer.current)clearTimeout(timer.current);
      timer.current=setTimeout(()=>startTransition(()=>router.refresh()),80);
    };
    const channel=supabase.channel(`project-live-${projectId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'projects',filter:`id=eq.${projectId}`},payload=>{
        const before=String((payload.old as Record<string,unknown>)?.project_stage||'');
        const after=String((payload.new as Record<string,unknown>)?.project_stage||'');
        if(before!==after)refresh();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'partner_progress_updates',filter:`project_id=eq.${projectId}`},refresh)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'project_execution_assignments',filter:`project_id=eq.${projectId}`},refresh)
      .subscribe();

    return()=>{
      if(timer.current)clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  },[projectId,router]);

  return null;
}
