const capabilities = [
  ['01', 'Capacity'],
  ['02', 'CAD / CAM'],
  ['03', 'Controlled delivery'],
] as const;

function EngineeringField() {
  return (
    <figure className="relative aspect-[16/9] overflow-hidden border border-black/15 bg-[#111] lg:aspect-[4/3]">
      <img
        src="/overflow-mechanical-hero.webp"
        alt="Mechanical CAD gear and shaft assembly"
        className="absolute inset-0 h-full w-full object-cover object-center"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </figure>
  );
}

export default function Hero() {
  return (
    <section id="top" className="section_hero motion_hero border-b border-black/10 bg-[var(--canvas)] text-[var(--ink)]">
      <div className="container_large padding_global">
        <div className="grid min-h-[calc(100svh-72px)] items-stretch lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex flex-col justify-between py-16 pr-0 md:py-24 lg:pr-16 lg:py-28">
            <div>
              <p className="text_eyebrow mb-8 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">Overflow engineering partner</p>
              <h1 className="heading_hero max-w-[13ch] text-[clamp(3.5rem,7.3vw,7.4rem)] font-medium leading-[0.9] tracking-[-0.055em]">
                Extend your engineering capacity.
              </h1>
              <p className="mt-10 max-w-xl text-lg leading-8 text-black/70 md:text-xl">
                Additional CAD/CAM resource for engineering teams facing drawing backlogs, accelerated programmes and delivery pressure.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <a className="button_primary motion_button inline-flex min-h-12 items-center justify-center bg-[var(--ink)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white" href="#contact">
                  Submit requirement
                </a>
                <a className="group inline-flex items-center gap-3 text-sm font-medium" href="#process">
                  See how delivery works <span className="transition-transform group-hover:translate-x-1">→</span>
                </a>
              </div>
            </div>

            <div className="mt-16 grid max-w-2xl grid-cols-3 border-t border-black/20 pt-5 md:mt-24">
              {capabilities.map(([index, label]) => (
                <div key={label} className="border-l border-black/15 px-4 first:border-l-0 first:pl-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">{index}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-black/75">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pb-8 lg:flex lg:items-center lg:py-8">
            <EngineeringField />
          </div>
        </div>
      </div>
    </section>
  );
}
