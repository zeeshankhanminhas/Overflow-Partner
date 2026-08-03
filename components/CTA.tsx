import EnquiryForm from './EnquiryForm';

export default function CTA() {
  return (
    <section id="contact" className="section_cta border-t border-white/20 bg-black py-32 text-white md:py-44">
      <div className="container_large padding_global">
        <div className="cta_wrapper motion_fade_up mx-auto grid max-w-5xl gap-12 border-y border-white/40 py-12 md:grid-cols-[0.85fr_1.15fr] md:items-start">
          <div className="cta_content">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-white">Requirement Submission</p>
            <h2 className="heading_section max-w-xl text-3xl font-semibold leading-tight text-white md:text-4xl">Submit the requirement. Technical review follows.</h2>
            <p className="text_body mt-8 max-w-xl text-base leading-7 text-white md:text-lg">Send the initial request so Overflow Partner can review scope, available inputs, delivery pressure, and the engineering support required.</p>
            <p className="text_body mt-5 max-w-xl text-xs font-medium uppercase text-white">Quote only after technical review.</p>
            <a className="button_secondary motion_button mt-10 inline-flex min-h-12 items-center justify-center rounded-md border border-white/40 px-6 py-3 text-sm font-medium uppercase text-white transition hover:border-white" href="#contact-form">Use the secure form</a>
          </div>
          <div id="contact-form">
            <EnquiryForm />
          </div>
        </div>
      </div>
    </section>
  );
}
