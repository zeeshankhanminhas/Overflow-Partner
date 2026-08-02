import Footer from '@/components/Footer';
import Header from '@/components/Header';

export const metadata = {
  title: 'Privacy Policy | Overflow Partner',
  description: 'Overflow Partner privacy policy for enquiries, project files, client communication, and partner workflow data.',
  alternates: { canonical: '/privacy/' },
};

const sections = [
  ['Who Overflow Partner is', 'Overflow Partner provides CAD/CAM overflow engineering support, reverse engineering support, production drawings, technical documentation, and related project support for engineering clients. For UK GDPR purposes, Overflow Partner is responsible for the personal data collected through this website and related enquiry workflows.'],
  ['What data is collected', 'Overflow Partner may collect your name, work email, phone number, company, role, project type, enquiry notes, quote responses, partner references, pricing details, email communication, and technical information you choose to provide. This can include drawings, CAD files, specifications, images, spreadsheets, documents, project timelines, complexity details, and file-readiness information.'],
  ['Enquiry form data', 'When you submit an enquiry form, Overflow Partner uses the details to identify your request, respond to you, send follow-up intake steps where needed, assess whether the work is suitable, and prepare a technical or commercial response.'],
  ['Technical and project files', 'Technical files and project materials are used to review requirements, estimate scope, prepare quotes, brief suitable engineering partners, and deliver agreed work. Overflow Partner treats engineering files and project details as confidential business information.'],
  ['Email communication', 'Overflow Partner may use email to discuss enquiries, request missing information, send intake links, issue or discuss quotes, manage accepted work, coordinate partner input, and keep records of project decisions.'],
  ['Legal basis under UK GDPR', 'Overflow Partner processes data where it is necessary for enquiry handling, legitimate business interests, taking steps before entering into a contract, performing a contract, maintaining business records, and meeting legal obligations.'],
  ['How data is stored', 'Data may be stored in email, form submission systems, databases, document storage, file storage, project records, and automation tools used by Overflow Partner. Appropriate organisational and technical measures are used to limit access and protect information.'],
  ['Who data may be shared with', 'Overflow Partner may share relevant information with service providers supporting the website, email, storage, administration, and project delivery. Limited project information may also be shared with suitable engineering partners or subcontractors where required to assess, quote, or deliver the requested work.'],
  ['Client and partner workflow', 'Client enquiries, technical intake information, quote decisions, partner pricing submissions, and project status details may be connected as part of the Overflow Partner workflow.'],
  ['Data retention', 'Overflow Partner keeps enquiry, project, quote, partner, and communication records only for as long as needed to manage the request, deliver services, maintain business records, resolve queries, protect legal rights, and meet accounting or legal requirements.'],
  ['Your rights', 'Under UK GDPR, you may have rights to access your personal data, request correction or deletion, restrict or object to processing, request portability where applicable, and complain to the Information Commissioner’s Office.'],
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="section_privacy bg-[var(--paper)] py-32 text-[var(--ink)] md:py-44">
        <div className="container_large padding_global">
          <div className="privacy_wrapper mx-auto max-w-3xl">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-neutral-500">Privacy Policy</p>
            <h1 className="heading_section text-4xl font-semibold leading-tight md:text-5xl">How Overflow Partner handles personal and project data.</h1>
            <p className="text_body mt-6 text-sm leading-6 text-[var(--muted)]">Last updated: 2 August 2026</p>
            <div className="privacy_content mt-12 grid gap-10 border-y border-black/10 py-10">
              {sections.map(([title, text]) => (
                <section className="privacy_block" key={title}>
                  <h2 className="heading_card text-xl font-semibold">{title}</h2>
                  <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">{text}</p>
                </section>
              ))}
              <section className="privacy_block">
                <h2 className="heading_card text-xl font-semibold">Contact</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Use the enquiry form on this website to contact Overflow Partner about privacy or data-handling matters.</p>
                <a className="text_link mt-3 block w-fit text-[var(--ink)] underline-offset-4 hover:underline" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ICO complaint guidance</a>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
