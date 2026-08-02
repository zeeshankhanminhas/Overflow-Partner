import Footer from '@/components/Footer';
import Header from '@/components/Header';

export const metadata = {
  title: 'Privacy Policy | MIDTS',
  description: 'MIDTS privacy policy for enquiries, project files, client communication, and vendor workflow data.',
  alternates: {
    canonical: '/privacy/',
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="section_privacy bg-[var(--paper)] py-32 text-[var(--ink)] md:py-44">
        <div className="container_large padding_global">
          <div className="privacy_wrapper mx-auto max-w-3xl">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-neutral-500">Privacy Policy</p>
            <h1 className="heading_section text-4xl font-semibold leading-tight md:text-5xl">How MIDTS handles personal and project data.</h1>
            <p className="text_body mt-6 text-sm leading-6 text-[var(--muted)]">Last updated: 3 June 2026</p>
            <div className="privacy_content mt-12 grid gap-10 border-y border-black/10 py-10">
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Who MIDTS is</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">MIDTS provides CAD/CAM overflow engineering support, reverse engineering support, production drawings, technical documentation, and related project support for engineering clients. For UK GDPR purposes, MIDTS is responsible for the personal data collected through this website and related enquiry workflows.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">What data is collected</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">MIDTS may collect your name, work email, phone number, company, role, project type, enquiry notes, quote responses, vendor references, pricing details, email communication, and technical information you choose to provide. This can include drawings, CAD files, specifications, images, spreadsheets, documents, project timelines, complexity details, and file readiness information.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Enquiry form data</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">When you submit an enquiry form, MIDTS uses the details to identify your request, respond to you, send follow-up intake steps where needed, assess whether the work is suitable, and prepare a technical or commercial response.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Technical and project files</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Technical files and project materials are used to review requirements, estimate scope, prepare quotes, brief suitable project partners, and deliver agreed work. MIDTS treats engineering files and project details as confidential business information.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Email communication</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">MIDTS may use email to discuss enquiries, request missing information, send intake links, issue or discuss quotes, manage accepted work, coordinate vendor input, and keep records of project decisions.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Legal basis under UK GDPR</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">MIDTS processes data where it is necessary for enquiry handling, legitimate business interests, taking steps before entering into a contract, performing a contract, maintaining business records, and meeting legal obligations. Legitimate interests include responding to business enquiries, assessing project fit, managing client and vendor workflows, and protecting business operations.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">How data is stored</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Data may be stored in email, form submission systems, spreadsheets, document storage, file storage, project records, and automation tools used by MIDTS. MIDTS aims to use appropriate organisational and technical measures to keep information secure and limit access to people who need it.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Who data may be shared with</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">MIDTS may share relevant information with service providers that support the website, email, storage, automation, administration, and project delivery. Where a client/vendor workflow is needed, MIDTS may share limited project details with suitable vendors, subcontractors, or engineering partners so they can assess, quote, or deliver the requested work.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Client and vendor workflow</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Client enquiries, technical intake information, quote decisions, vendor pricing submissions, and project status details may be connected as part of the MIDTS workflow. MIDTS uses this information to move a request from enquiry to quote, vendor review, acceptance, and delivery where applicable.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Data retention</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">MIDTS keeps enquiry, project, quote, vendor, and communication records only for as long as needed to handle the request, manage the client relationship, deliver services, maintain business records, resolve queries, protect legal rights, and meet accounting or legal requirements.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Your rights</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Under UK GDPR, you may have rights to access your personal data, request correction, request deletion, restrict processing, object to processing, request portability where applicable, and complain to the Information Commissioner&apos;s Office. These rights may be limited where MIDTS needs to keep information for legal, contractual, or legitimate business reasons.</p>
              </section>
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Contact</h2>
                <div className="text_body mt-4 grid gap-2 text-base leading-7 text-[var(--muted)]">
                  <a className="text_link w-fit text-[var(--ink)] underline-offset-4 hover:underline" href="mailto:intake@midts.com">intake@midts.com</a>
                  <p>1010 Cambourne Business Center, Cambridge CB23 6DP</p>
                  <a className="text_link w-fit text-[var(--ink)] underline-offset-4 hover:underline" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ICO complaint guidance</a>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
