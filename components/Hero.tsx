const capabilities = [
  ['01', 'Capacity'],
  ['02', 'CAD / CAM'],
  ['03', 'Controlled delivery'],
] as const;

function EngineeringField() {
  return (
    <div className="relative min-h-[420px] overflow-hidden border border-black/15 bg-[var(--paper)] md:min-h-[560px]" aria-hidden="true">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(17,24,21,.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,24,21,.12)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute left-[10%] top-[12%] text-[10px] font-semibold uppercase tracking-[0.18em] text-black/55">OP / Capacity Extension</div>
      <div className="absolute right-[8%] top-[12%] text-[10px] font-semibold uppercase tracking-[0.18em] text-black/55">Rev A</div>

      <svg className="absolute inset-[8%] h-[84%] w-[84%] text-[var(--ink)]" viewBox="0 0 600 520" fill="none">
        <path d="M84 156h176l54-58h134v82h68v162h-68v80H314l-54-58H84z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="300" cy="260" r="92" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="300" cy="260" r="40" stroke="currentColor" />
        <path d="M84 118h176M84 100v36M260 100v36M448 72v78M516 72v78M448 90h68" stroke="currentColor" opacity=".7" />
        <path d="M52 156h18M52 364h18M61 156v208M66 170l-5-14-5 14M66 350l-5 14-5-14" stroke="currentColor" opacity=".7" />
        <path d="M132 422v42h332v-42M132 448h332" stroke="currentColor" opacity=".7" />
        <path d="M214 442h86M320 442h76" stroke="currentColor" opacity=".45" />
      </svg>

      <div className="absolute bottom-[8%] left-[8%] right-[8%] grid grid-cols-3 border-t border-black/20 pt-4 text-[10px] uppercase tracking-[0.12em] text-black/60">
        <span>Defined scope</span>
        <span>Controlled review</span>
        <span className="text-right">Release ready</span>
      </div>
      <div className="absolute bottom-0 right-0 h-1 w-2/5 bg-[var(--accent)]" />
    </div>
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

          <div className="pb-8 lg:py-8">
            <EngineeringField />
          </div>
        </div>
      </div>
    </section>
  );
}
