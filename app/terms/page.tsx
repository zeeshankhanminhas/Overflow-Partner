import Footer from '@/components/Footer';
import Header from '@/components/Header';

export const metadata = {
  title: 'Terms | MIDTS',
  description: 'MIDTS website terms covering information use, quotes, project files, confidentiality, liability, and governing law.',
  alternates: {
    canonical: '/terms/',
  },
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="section_terms bg-[var(--paper)] py-32 text-[var(--ink)] md:py-44">
        <div className="container_large padding_global">
          <div className="terms_wrapper mx-auto max-w-3xl">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-neutral-500">Terms</p>
            <h1 className="heading_section text-4xl font-semibold leading-tight md:text-5xl">Terms for using this website.</h1>
            <p className="text_body mt-6 text-sm leading-6 text-[var(--muted)]">Last updated: 3 June 2026</p>
            <div className="terms_content mt-12 grid gap-10 border-y border-black/10 py-10">
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Website information only</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">This website provides general information about MIDTS services and a way to submit enquiries. Website content is not technical, legal, financial, or professional advice for a specific project.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">No automatic acceptance of work</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Submitting an enquiry, technical intake form, file upload, quote response, or vendor pricing form does not automatically create a contract or mean MIDTS has accepted the work. Work is accepted only when confirmed in writing by MIDTS.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Quotes subject to technical review</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Any quote, estimate, timeline, availability statement, or scope indication is subject to technical review of the brief, files, assumptions, constraints, and delivery requirements. MIDTS may revise or decline a request after review.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Client responsibility for accurate briefs and files</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">You are responsible for providing accurate, complete, lawful, and up-to-date briefs, drawings, CAD files, specifications, dimensions, tolerances, requirements, and project constraints. You must have the right to share any files or information submitted to MIDTS.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Intellectual property and confidentiality</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">You retain ownership of your pre-existing materials. MIDTS treats submitted project information and engineering files as confidential. Any transfer or licensing of deliverables, CAD outputs, drawings, or other work product should be agreed in the relevant quote, statement of work, purchase order, or written project terms.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Limitation of liability</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Nothing in these terms limits liability where it would be unlawful to do so. To the fullest extent permitted by law, MIDTS is not responsible for losses arising from website downtime, incomplete or inaccurate enquiries, unavailable third-party services, or reliance on general website information.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Governing law</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">These website terms are governed by the laws of England and Wales, and the courts of England and Wales will have jurisdiction unless mandatory law requires otherwise.</p>
              </section>
              <section className="terms_block">
                <h2 className="heading_card text-xl font-semibold">Contact</h2>
                <a className="text_link mt-4 block w-fit text-base text-[var(--ink)] underline-offset-4 hover:underline" href="mailto:intake@midts.com">intake@midts.com</a>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
