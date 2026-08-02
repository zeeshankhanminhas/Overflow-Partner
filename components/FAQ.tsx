const faqs = [
  { question: 'What file formats do you support?', answer: 'Typical inputs include SolidWorks, Fusion 360, AutoCAD, Inventor, STEP, IGES, DXF, PDF, sketches, scan data, photos, and reference parts.' },
  { question: 'Can you support urgent projects?', answer: 'Urgent projects can be reviewed when the requirement, files, scope, and expected delivery window are clear enough for technical assessment.' },
  { question: 'How are projects reviewed?', answer: 'Each request moves through requirement review, technical assessment, commercial assessment, execution, and controlled handover.' },
  { question: 'Do you work with existing engineering teams?', answer: 'Yes. MIDTS is designed to add structured engineering capacity alongside existing internal teams when delivery requirements exceed available resource.' },
];

export default function FAQ() {
  return (
    <section id="faq" className="section_faq border-t border-black/10 bg-white py-32 text-black md:py-44">
      <div className="container_large padding_global">
        <div className="faq_wrapper mx-auto max-w-4xl">
          <div className="faq_heading motion_fade_up mx-auto max-w-2xl text-center">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-black">FAQ</p>
            <h2 className="heading_section text-3xl font-semibold leading-tight text-black md:text-4xl">Common questions before sending a request.</h2>
          </div>
          <div className="grid_faq mt-16 border-y border-black/20">
            {faqs.map((item) => (
              <article key={item.question} className="card_faq motion_fade_up grid gap-4 border-b border-black/20 py-7 last:border-b-0 md:grid-cols-[0.75fr_1fr]">
                <h3 className="heading_card text-lg font-semibold text-black">{item.question}</h3>
                <p className="text_body text-base leading-7 text-black">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
