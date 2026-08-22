const services = [
  { title: 'CAD Modelling', text: 'Additional modelling support for defined engineering requirements.' },
  { title: 'Production Drawings', text: 'Manufacturing-ready drawings, revisions, and release packs.' },
  { title: 'Reverse Engineering', text: 'Model and drawing support from parts, scans, sketches, or references.' },
  { title: 'Technical Documentation', text: 'Structured documentation for review, release, and supplier handoff.' },
  { title: 'Drawing Conversion', text: 'Conversion and clean-up across practical CAD and drawing formats.' },
  { title: 'Overflow Engineering Support', text: 'Additional execution capacity when internal resource is stretched.' },
];

const software = ['SolidWorks', 'Fusion 360', 'AutoCAD', 'Inventor', 'STEP', 'IGES', 'DXF', 'PDF'];

export default function Services() {
  return (
    <section id="services" className="section_services bg-[var(--canvas)] py-24 text-black md:py-32 lg:py-40">
      <div className="container_large padding_global">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="text_eyebrow text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Capabilities</p>
          </div>
          <div>
            <h2 className="heading_section max-w-[16ch] text-[clamp(2.6rem,4.8vw,5rem)] font-medium leading-[0.96] tracking-[-0.04em]">
              Engineering support where capacity gets tight.
            </h2>
          </div>
        </div>

        <div className="mt-20 grid border-t border-black/20 md:grid-cols-2 lg:mt-28 lg:grid-cols-3">
          {services.map((service, index) => (
            <article key={service.title} className="group min-h-[280px] border-b border-black/15 p-7 transition-colors hover:bg-white md:border-r md:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 lg:p-9">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">0{index + 1}</p>
              <div className="mt-20">
                <h3 className="text-2xl font-medium tracking-[-0.025em] md:text-3xl">{service.title}</h3>
                <p className="mt-5 max-w-sm text-base leading-7 text-black/60">{service.text}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 grid gap-6 border-y border-black/20 py-6 lg:grid-cols-[0.72fr_1.28fr]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Common software &amp; file workflows</p>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
            {software.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
