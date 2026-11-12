import type {Metadata} from 'next';
import Link from 'next/link';
import PageShell from '@/components/marketing/PageShell';
import BrandedTemplates from '@/components/assurance/BrandedTemplates';
import './template.css';

export const metadata:Metadata={
  title:'Engineering Document Templates | Overflow Partner',
  description:'Preview branded engineering capability and controlled handover sample templates. Inspect A4 React layouts and export PDFs.',
  alternates:{canonical:'/assurance/templates'},
};

export default function TemplatesPage(){
  return <PageShell>
    <section className="op-template-page">
      <div className="container_large padding_global op-template-top">
        <Link href="/assurance" className="op-template-back">← Back to engineering assurance</Link>
        <div className="op-template-title-row">
          <div><p className="op-template-eyebrow">OVERFLOW PARTNER / DOCUMENT LIBRARY</p>
            <h1>Technical documents,<br/><span>presented professionally.</span></h1>
            <p>Explore how we organise a capability statement and an engineering handover. Both examples are fully branded and clearly labelled as samples, not completed client work.</p>
          </div>
          <div className="op-template-meta-card"><span>DOCUMENT STANDARD</span><strong>A4 / REVISION CONTROLLED</strong><small>React preview · PDF-ready</small></div>
        </div>
      </div>
      <div className="container_large padding_global">
        <BrandedTemplates/>
      </div>
    </section>
  </PageShell>;
}
