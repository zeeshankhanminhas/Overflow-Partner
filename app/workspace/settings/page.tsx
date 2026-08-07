import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { Badge } from '@/components/ui/badge';

function SettingCard({title,description,href,meta}:{title:string;description:string;href:string;meta:string}){
  return <Link href={href} className="vp-object" style={{display:'grid',gap:8,textDecoration:'none'}}>
    <div><Badge variant="outline">{meta}</Badge></div>
    <h2 style={{margin:0,fontSize:'1.05rem'}}>{title}</h2>
    <p style={{margin:0,color:'var(--op-muted)',lineHeight:1.6}}>{description}</p>
    <span style={{marginTop:8}}>Open →</span>
  </Link>;
}

export default async function WorkspaceSettingsPage(){
  const { supabase, organisationId, profile } = await requireUserContext();
  const {data:organisation}=await supabase.from('organisations').select('name').eq('id',organisationId).maybeSingle();

  return <section className="vp-page">
    <header className="vp-header">
      <div>
        <p className="vp-kicker">System · Workspace configuration</p>
        <h1>Settings</h1>
        <p className="vp-subtitle">Manage the operating preferences and control surfaces that support this workspace. Business workflow and lifecycle rules remain governed elsewhere.</p>
      </div>
    </header>

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Workspace identity</p>
      <div className="vp-facts" style={{marginTop:0}}>
        <div className="vp-fact"><small>Organisation</small><strong>{organisation?.name||'Organisation'}</strong></div>
        <div className="vp-fact"><small>User</small><strong>{profile.full_name||'Workspace user'}</strong></div>
        <div className="vp-fact"><small>Role</small><strong>{profile.role||'Not recorded'}</strong></div>
        <div className="vp-fact"><small>Account state</small><strong><Badge variant={profile.is_active===false?'destructive':'secondary'}>{profile.is_active===false?'Inactive':'Active'}</Badge></strong></div>
      </div>
    </section>

    <section>
      <div className="vp-section-title"><div><p className="vp-label">Configuration areas</p><h2>System controls</h2></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14}}>
        <SettingCard title="Notification Centre" meta="Communications" description="Review delivery status, retries and scheduled operational notifications." href="/workspace/notifications" />
        <SettingCard title="Partners" meta="Execution network" description="Manage approved execution partners and the controlled partner operating surface." href="/workspace/partners" />
        <SettingCard title="Evidence Registry" meta="Document control" description="Review organisation-wide governed documents and evidence records." href="/workspace/documents" />
        <SettingCard title="Risk & Compliance" meta="Governance" description="Manage business, project and partner risk or compliance exceptions." href="/workspace/risk" />
      </div>
    </section>

    <section className="vp-callout">
      <strong>Configuration boundary</strong>
      <p>Workflow stages, approvals, commercial gates and document transitions are controlled by their respective business modules and are intentionally not editable from Settings.</p>
    </section>
  </section>;
}
