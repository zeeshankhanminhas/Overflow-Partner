const signals = [
  'Drawing backlogs',
  'Accelerated timelines',
  'Unavailable internal resource',
  'Recruitment delays',
];

export default function Problem() {
  return (
    <section className="section_problem border-t border-black/10 bg-white py-32 text-black md:py-44">
      <div className="container_large padding_global">
        <div className="problem_wrapper mx-auto max-w-2xl text-center">
          <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-black">The pressure point</p>
          <h2 className="heading_section mx-auto max-w-xl text-4xl font-semibold leading-tight md:text-5xl">
            Your Team Is At Capacity
          </h2>
          <p className="text_body mx-auto mt-10 max-w-xl text-lg leading-8 text-black md:text-xl">
            Drawing backlogs, accelerated timelines, unavailable internal resource, and recruitment delays create delivery pressure.
          </p>
          <div className="grid_signals mt-14 grid gap-4 border-y border-black/20 py-5 text-xs font-semibold uppercase text-black sm:grid-cols-2 md:grid-cols-4">
            {signals.map((signal) => (
              <p key={signal} className="text_signal md:border-l md:border-black/20 md:first:border-l-0">
                {signal}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
