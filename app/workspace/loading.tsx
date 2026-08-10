export default function WorkspaceLoading(){
  return <section className="vp-page" aria-busy="true" aria-live="polite">
    <div className="product-page-header">
      <div className="product-page-header__copy"><p className="product-eyebrow">Overflow Partner</p><h1>Loading workspace…</h1><p className="product-description">Reading the latest operating state.</p></div>
    </div>
    <section className="product-metrics" aria-hidden="true">{Array.from({length:4}).map((_,index)=><article className="product-metric product-skeleton" key={index}><span/><strong/><small/></article>)}</section>
    <div className="product-panel product-skeleton-panel" aria-hidden="true"><span/><span/><span/><span/></div>
  </section>;
}
