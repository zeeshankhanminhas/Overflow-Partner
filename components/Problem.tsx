const signals = [
  ['01', 'Drawing backlogs'],
  ['02', 'Accelerated timelines'],
  ['03', 'Unavailable internal resource'],
  ['04', 'Recruitment delays'],
] as const;

export default function Problem() {
  return (
    <section className="section_problem border-b border-black/10 bg-white py-24 text-black md:py-32 lg:py-40">
      <div className="container_large padding_global">
        <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="text_eyebrow text-xs font-semibold uppercase tracking-[0.18em] text-black/50">The pressure point</p>
          </div>
          <div>
            <h2 className="heading_section max-w-[15ch] text-[clamp(2.8rem,5.5vw,5.8rem)] font-medium leading-[0.94] tracking-[-0.045em]">
              Capacity pressure should not become delivery failure.
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-black/65 md:text-xl">
              Overflow Partner adds controlled engineering resource without asking you to rebuild your team, compromise your process, or hand over ownership of the work.
            </p>
          </div>
        </div>

        <div className="mt-20 grid border-t border-black/20 md:grid-cols-2 lg:mt-28 lg:grid-cols-4">
          {signals.map(([index, signal]) => (
            <article key={signal} className="min-h-44 border-b border-black/15 py-7 pr-7 md:border-r md:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0 lg:pl-7 lg:first:pl-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">{index}</p>
              <p className="mt-12 max-w-[14ch] text-lg font-medium leading-6">{signal}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
