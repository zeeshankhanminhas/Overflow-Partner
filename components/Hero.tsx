const capabilities = [
  ['01', 'Capacity'],
  ['02', 'CAD / CAM'],
  ['03', 'Controlled delivery'],
] as const;

const values = [
  {
    title: 'Extend Capacity',
    body: 'Add experienced engineering resource when workload exceeds internal bandwidth.',
    icon: (
      <svg viewBox="0 0 44 44" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M22 7 36 14 22 21 8 14 22 7Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="m8 21 14 7 14-7M8 28l14 7 14-7" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: 'Maintain Control',
    body: 'We work inside your process, tools and standards — never outside them.',
    icon: (
      <svg viewBox="0 0 44 44" className="h-8 w-8" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="9" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="22" cy="22" r="14" stroke="currentColor" strokeWidth="1.6" />
        <path d="M22 3v8M22 33v8M3 22h8M33 22h8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: 'Deliver with Confidence',
    body: 'Structured handover, full visibility and documentation you can stand behind.',
    icon: (
      <svg viewBox="0 0 44 44" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M22 5 34 10v10c0 8.1-4.5 14.2-12 19-7.5-4.8-12-10.9-12-19V10L22 5Z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
] as const;

export default function Hero() {
  return (
    <section id="top" className="section_hero overflow-hidden border-b border-black/10 bg-[#f4f3ee] text-[#101311]">
      <div className="container_large padding_global">
        <div className="relative pt-12 md:pt-16 lg:min-h-[730px] lg:pt-20">
          <div className="relative z-10 grid max-w-[560px] grid-cols-3 border-b border-black/10 pb-5 lg:max-w-[520px]">
            {capabilities.map(([index, label]) => (
              <div key={label} className="border-l border-black/15 px-4 first:border-l-0 first:pl-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/35">{index}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/80">{label}</p>
              </div>
            ))}
          </div>

          <div className="relative z-10 max-w-[610px] pb-8 pt-16 md:pt-20 lg:pb-24 lg:pt-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-black/55">The pressure point</p>
            <h1 className="mt-8 max-w-[10.8ch] text-[clamp(3.25rem,5.6vw,5.55rem)] font-medium leading-[0.98] tracking-[-0.052em]">
              Capacity pressure should not become delivery failure.
            </h1>
            <div className="mt-7 h-px w-9 bg-[#ff5a2f]" aria-hidden="true" />
            <p className="mt-7 max-w-[540px] text-[17px] leading-7 text-black/64 md:text-lg md:leading-8">
              Overflow Partner adds controlled engineering resource without asking you to rebuild your team, compromise your process, or hand over ownership of the work.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-8">
              <a
                className="inline-flex min-h-14 items-center gap-7 bg-[#101311] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85"
                href="#contact"
              >
                Submit a requirement <span aria-hidden="true">↗</span>
              </a>
              <a className="group inline-flex items-center gap-5 text-[12px] font-semibold uppercase tracking-[0.08em]" href="#process">
                <span className="border-b border-[#ff5a2f] pb-2">How we work</span>
                <span className="text-[#ff5a2f] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div className="relative z-0 -mx-5 mt-4 aspect-[600/523] overflow-hidden sm:-mx-7 lg:absolute lg:-right-[8%] lg:bottom-4 lg:top-14 lg:mx-0 lg:mt-0 lg:h-auto lg:w-[66%] lg:overflow-visible xl:-right-[7%] xl:w-[65%]">
            <Image
              src="/overflow-hero-cad-faithful.webp"
              alt="Mechanical CAD gear assembly with wireframe geometry"
              fill
              sizes="(min-width: 1280px) 65vw, (min-width: 1024px) 66vw, 100vw"
              className="h-full w-full object-cover object-center lg:object-contain"
              priority
            />
          </div>
        </div>
      </div>

      <div className="border-t border-black/8 bg-white/55">
        <div className="container_large padding_global py-10 lg:py-11">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.34em] text-black/55">We help engineering teams</p>
          <div className="mt-8 grid gap-0 md:grid-cols-3">
            {values.map((item, index) => (
              <article key={item.title} className={`grid grid-cols-[56px_1fr] gap-5 py-5 md:min-h-[130px] md:px-7 md:py-2 ${index > 0 ? 'md:border-l md:border-black/12' : ''}`}>
                <div className="flex h-14 w-14 items-center justify-center bg-[#f1f0eb] text-black/85">{item.icon}</div>
                <div>
                  <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{item.title}</h2>
                  <p className="mt-2 max-w-[260px] text-sm leading-6 text-black/58">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
import Image from 'next/image';
