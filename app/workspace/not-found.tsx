import Link from 'next/link';

export default function WorkspaceNotFound(){
  return <section className="vp-page">
    <div className="product-page-header"><div className="product-page-header__copy"><p className="product-eyebrow">Record not found</p><h1>This workspace record is unavailable.</h1><p className="product-description">It may have been removed, moved out of your organisation, or the link may be incomplete.</p></div></div>
    <div className="product-empty-state"><strong>Choose where to continue</strong><p>Use a live operating register rather than relying on the old link.</p><div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}><Link className="button" href="/workspace">Mission Control</Link><Link className="button secondary" href="/workspace/leads">Cases</Link><Link className="button secondary" href="/workspace/projects">Projects</Link></div></div>
  </section>;
}
