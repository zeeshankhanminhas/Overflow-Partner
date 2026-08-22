const capabilities = [
  ['01', 'Capacity'],
  ['02', 'CAD / CAM'],
  ['03', 'Controlled delivery'],
] as const;

function EngineeringField() {
  return (
    <div
      className="relative min-h-[420px] overflow-hidden border border-black/15 bg-[var(--paper)] md:min-h-[560px]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(17,24,21,.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,24,21,.12)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute left-[10%] top-[12%] text-[10px] font-semibold uppercase tracking-[0.18em] text-black/55">
        OP / Capacity Extension
      </div>
      <div className="absolute right-[8%] top-[12%] text-[10px] font-semibold uppercase tracking-[0.18em] text-black/55">
        Controlled Overflow
      </div>

      <svg
        className="absolute inset-[8%] h-[84%] w-[84%] text-[var(--ink)]"
        viewBox="0 0 600 520"
        fill="none"
      >
        <path d="M84 160h168M84 260h168M84 360h168" stroke="currentColor" strokeWidth="2" />
        <path d="M252 160h220M252 260h168M252 360h250" stroke="currentColor" strokeWidth="2" />
        <path d="M472 160h72M420 260h124M502 360h42" stroke="var(--accent)" strokeWidth="4" strokeLinecap="square" />

        <circle cx="252" cy="160" r="6" fill="currentColor" />
        <circle cx="252" cy="260" r="6" fill="currentColor" />
        <circle cx="252" cy="360" r="6" fill="currentColor" />

        <path d="M108 118v284M96 118h24M96 402h24" stroke="currentColor" opacity=".45" />
        <path d="M492 118v284M480 118h24M480 402h24" stroke="currentColor" opacity=".45" />

        <text x="126" y="145" fontSize="11" fill="currentColor" opacity=".55">
          EXISTING TEAM
        </text>
        <text x="318" y="145" fontSize="11" fill="currentColor" opacity=".55">
          OVERFLOW PARTNER
        </text>

        <path
          d="M330 246h56M374 238l12 8-12 8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".7"
        />
      </svg>

      <div className="absolute bottom-[8%] left-[8%] right-[8%] grid grid-cols-3 border-t border-black/20 pt-4 text-[10px] uppercase tracking-[0.12em] text-black/60">
        <span>Existing capacity</span>
        <span>Extended resource</span>
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
