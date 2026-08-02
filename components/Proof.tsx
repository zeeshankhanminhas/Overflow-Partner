const reasons = [
  { title: 'Capacity Without Recruitment', text: 'Add engineering execution when the workload spikes, without waiting on recruitment or long onboarding cycles.' },
  { title: 'Structured Delivery', text: 'Work moves through a structured intake, review, and delivery flow so scope and files stay clear.' },
  { title: 'Reduced Delivery Risk', text: 'Defined review points reduce unclear scope, missing files, and uncontrolled handoff.' },
  { title: 'Professional Documentation', text: 'Drawing packs, CAD files, and supporting documentation are prepared for manufacturing, internal review, or supplier handoff.' },
  { title: 'Commercial Clarity', text: 'Scope, timing, deliverables, and cost are reviewed before execution begins.' },
];

export default function Proof() {
  return (
    <section id="why-overflow-partner" className="section_proof border-t border-white/20 bg-black py-32 text-white md:py-44">
      <div className="container_large padding_global">
        <div className="proof_wrapper mx-auto max-w-4xl">
          <div className="proof_heading motion_fade_up mx-auto max-w-2xl text-center">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-white">Why Overflow Partner</p>
            <h2 className="heading_section mx-auto max-w-xl text-3xl font-semibold leading-tight text-white md:text-4xl">Built for teams that need reliable engineering output, not more coordination overhead.</h2>
          </div>
          <div className="grid_proof mt-16 border-y border-white/40">
            {reasons.map((reason, index) => (
              <article key={reason.title} className="card_reason motion_fade_up grid gap-6 border-b border-white/40 py-8 last:border-b-0 md:grid-cols-[96px_1fr] md:items-start">
                <p className="text_label text-sm font-medium text-white">0{index + 1}</p>
                <div>
                  <h3 className="heading_card text-xl font-semibold text-white md:text-2xl">{reason.title}</h3>
                  <p className="text_body mt-4 max-w-2xl text-base leading-7 text-white md:text-lg">{reason.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
