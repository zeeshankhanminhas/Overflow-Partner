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
    <section id="services" className="section_services border-t border-black/10 bg-white py-32 text-black md:py-44">
      <div className="container_large padding_global">
        <div className="services_wrapper mx-auto max-w-4xl">
          <div className="services_heading motion_fade_up mx-auto max-w-2xl text-center">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-black">Services</p>
            <h2 className="heading_section text-3xl font-semibold leading-tight md:text-4xl">Focused Support For Engineering Teams Under Delivery Pressure</h2>
          </div>
          <div className="grid_services mt-16 grid gap-4 border-y border-black/10 py-4">
            {services.map((service, index) => (
              <article key={service.title} className="card_service motion_fade_up grid gap-6 border-b border-black/10 py-8 last:border-b-0 md:grid-cols-[96px_1fr] md:items-start">
                <p className="text_label text-sm font-medium text-black">0{index + 1}</p>
                <div>
                  <h3 className="heading_card text-xl font-semibold md:text-2xl">{service.title}</h3>
                  <p className="text_body mt-4 max-w-2xl text-base leading-7 text-black md:text-lg">{service.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="software_strip motion_fade_up mt-12 border-y border-black/10 py-6">
            <p className="text_eyebrow text-xs font-semibold uppercase text-black">Common File &amp; Software Workflows</p>
            <div className="grid_software mt-5 grid gap-3 text-xs font-medium uppercase text-black sm:grid-cols-2 md:grid-cols-4">
              {software.map((item) => (
                <p key={item} className="text_software border-t border-black/20 pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:[&:nth-child(2n+1)]:border-l-0 md:[&:nth-child(2n+1)]:border-l md:[&:nth-child(4n+1)]:border-l-0">{item}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
