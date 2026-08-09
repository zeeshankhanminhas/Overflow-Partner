import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { Badge } from '@/components/ui/badge';

function SettingCard({title,description,href,meta}:{title:string;description:string;href:string;meta:string}){
  return <Link href={href} className="vp-object" style={{display:'grid',gap:8,textDecoration:'none'}}><div><Badge variant="outline">{meta}</Badge></div><h2 style={{margin:0,fontSize:'1.05rem'}}>{title}</h2><p style={{margin:0,color:'var(--op-muted)',lineHeight:1.6}}>{description}</p><span style={{marginTop:8}}>Open →</span></Link>;
}

export default async function WorkspaceSettingsPage(){
  const { supabase, organisationId, profile } = await requireUserContext();
  const [{data:organisation},{data:developerDelete}]=await Promise.all([
    supabase.from('organisations').select('name').eq('id',organisationId).maybeSingle(),
    supabase.rpc('op_can_delete_test_data'),
  ]);
  const canDeleteTestData=developerDelete===true;

  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Settings</p><h1>Workspace settings</h1><p className="vp-subtitle">Manage your workspace, notifications, partner directory and supporting business settings.</p></div></header>

    <section className="vp-object vp-object--hero"><p className="vp-label">Your workspace</p><div className="vp-facts" style={{marginTop:0}}><div className="vp-fact"><small>Organisation</small><strong>{organisation?.name||'Organisation'}</strong></div><div className="vp-fact"><small>User</small><strong>{profile.full_name||'Workspace user'}</strong></div><div className="vp-fact"><small>Role</small><strong>{profile.role||'Not recorded'}</strong></div><div className="vp-fact"><small>Account</small><strong><Badge variant={profile.is_active===false?'destructive':'secondary'}>{profile.is_active===false?'Inactive':'Active'}</Badge></strong></div></div></section>

    <section><div className="vp-section-title"><div><p className="vp-label">Settings</p><h2>Manage your workspace</h2></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14}}>
      <SettingCard title="Notification Centre" meta="Messages" description="Review sent, scheduled and failed workspace messages." href="/workspace/notifications" />
      <SettingCard title="Partners" meta="Partner network" description="Manage execution partners, readiness and NDA status." href="/workspace/partners" />
      <SettingCard title="Documents" meta="Documents" description="Browse documents and evidence across the workspace." href="/workspace/documents" />
      <SettingCard title="Risk & Compliance" meta="Risk" description="Review business risks and compliance requirements." href="/workspace/risk" />
      {canDeleteTestData?<SettingCard title="Test Data Cleanup" meta="Developer only" description="Permanently remove selected test records from this workspace." href="/workspace/settings/developer-data" />:null}
    </div></section>

    <section className="vp-callout"><strong>Business rules stay protected</strong><p>Workflow stages, approvals, pricing gates and document status rules are managed within the relevant work areas, not from Settings.</p></section>
  </section>;
}
