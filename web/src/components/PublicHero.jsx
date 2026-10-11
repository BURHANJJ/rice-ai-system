import { Microscope, Sprout } from 'lucide-react';

export default function PublicHero({ kicker, title, highlight, copy, summaryTitle, summaryCopy, tiles }) {
  return (
    <section className="relative w-full max-w-full overflow-hidden px-3 pb-8 pt-8 sm:px-5 sm:pb-14 sm:pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(52,211,153,0.18),transparent_32%),radial-gradient(circle_at_88%_22%,rgba(252,211,77,0.18),transparent_28%)]" />
      <div className="absolute inset-0 rb-soft-grid opacity-60" />
      <div className="relative mx-auto w-full max-w-7xl">
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="min-w-0 rb-reveal">
            <div className="rice-hero-kicker mb-4 sm:mb-5">
              <Microscope size={16} />
              {kicker}
            </div>
            <h1 className="rice-hero-title">
              {title}<br />
              <span className="rb-shiny-text">{highlight}</span>
            </h1>
            <p className="rice-hero-copy">{copy}</p>
          </div>

          <div className="rounded-[1.5rem] border border-emerald-100 bg-white/85 p-4 shadow-2xl shadow-emerald-950/10 backdrop-blur sm:rounded-[2rem] sm:p-6 rb-reveal rb-delay-2">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-[var(--color-paddy)] sm:h-14 sm:w-14">
                <Sprout size={26} />
              </div>
              <div>
                <h2 className="rice-summary-title">{summaryTitle}</h2>
                <p className="mt-2 text-sm leading-7 text-gray-600">{summaryCopy}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tiles.map((item) => (
                <div key={item} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center text-xs font-bold text-gray-700 sm:text-sm">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

