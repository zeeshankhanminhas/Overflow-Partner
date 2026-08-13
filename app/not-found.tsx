import Link from 'next/link';

export default function RootNotFound() {
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#0b0f0d',color:'#f4f5f3'}}>
    <section style={{width:'min(680px,100%)'}}>
      <p style={{textTransform:'uppercase',letterSpacing:'.12em',opacity:.58}}>Overflow Partner</p>
      <h1 style={{fontSize:'clamp(32px,6vw,64px)',margin:'12px 0'}}>Page not found.</h1>
      <p style={{maxWidth:560,lineHeight:1.6,opacity:.72}}>The link may be outdated or incomplete. Continue from a live Overflow Partner destination.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:24}}>
        <Link href="/" style={{color:'inherit'}}>Website</Link>
        <Link href="/login" style={{color:'inherit'}}>Workspace login</Link>
      </div>
    </section>
  </main>;
}
