import EnquiryForm from './EnquiryForm';

export default function CTA() {
  return (
    <section id="contact" className="section_cta border-t border-white/20 bg-black py-32 text-white md:py-44">
      <div className="container_large padding_global">
        <div className="cta_wrapper motion_fade_up mx-auto grid max-w-5xl gap-12 border-y border-white/40 py-12 md:grid-cols-[0.85fr_1.15fr] md:items-start">
          <div className="cta_content">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-white">Tell us what you need</p>
            <h2 className="heading_section max-w-xl text-3xl font-semibold leading-tight text-white md:text-4xl">Tell us about your engineering project.</h2>
            <p className="text_body mt-8 max-w-xl text-base leading-7 text-white md:text-lg">Share a short outline of the work you have in mind. We’ll review the requirements with you and agree a clear path forward.</p>
            <p className="text_body mt-5 max-w-xl text-xs font-medium uppercase text-white">We’ll agree the scope, deliverables and pricing before work begins.</p>
            <a className="button_secondary motion_button mt-10 inline-flex min-h-12 items-center justify-center rounded-md border border-white/40 px-6 py-3 text-sm font-medium uppercase text-white transition hover:border-white" href="#contact-form">Start your enquiry</a>
          </div>
          <div id="contact-form">
            <EnquiryForm />
          </div>
        </div>
      </div>
    </section>
  );
}
