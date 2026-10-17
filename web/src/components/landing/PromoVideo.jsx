// Video player framed by ripe rice sprigs. Only the poster loads until the visitor presses
// play (preload="none"), so the page stays light. Used for the landing-page promo (defaults)
// and the research-study explainer (with chapters the viewer can jump to).
import { useRef, useState } from 'react';
import { Play, Clock3, Volume2, Subtitles } from 'lucide-react';
import RiceSprig from './RiceSprig';
import { useI18n } from '../../lib/i18n';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export default function PromoVideo({
  src = '/media/rice-ai-promo-720p.mp4',
  poster = '/media/rice-ai-promo-poster.jpg',
  duration = 43,
  title = { th: 'คลิปแนะนำแอป Rice AI', en: 'Rice AI app introduction' },
  subtitled = false,
  chapters = [],
}) {
  const { t } = useI18n();
  const video = useRef(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(0);

  const play = (at) => {
    setStarted(true);
    const v = video.current;
    if (!v) return;
    if (typeof at === 'number') v.currentTime = at;
    v.play().catch(() => {});
  };
  const current = chapters.reduce((k, c, i) => (now >= c.t ? i : k), -1);

  return (
    <div className="relative mx-auto w-full max-w-5xl px-2 sm:px-6">
      {/* rice sprigs arching over the frame */}
      <RiceSprig className="absolute -left-2 -top-16 z-0 w-20 rotate-[-8deg] sm:-left-8 sm:-top-24 sm:w-28 lg:-left-16 lg:w-36" delay="-1.2s" />
      <RiceSprig className="absolute -left-1 -top-6 z-0 hidden w-14 rotate-[-28deg] opacity-90 sm:block sm:-left-4 lg:-left-6 lg:w-20" delay="-2.6s" />
      <RiceSprig flip className="absolute -bottom-12 -right-1 z-0 w-20 rotate-[10deg] sm:-bottom-20 sm:-right-8 sm:w-28 lg:-right-16 lg:w-36" delay="-0.4s" />
      <RiceSprig flip className="absolute -bottom-4 -right-2 z-0 hidden w-14 rotate-[30deg] opacity-90 sm:block sm:-right-4 lg:-right-6 lg:w-20" delay="-3.1s" />

      {/* soft glow behind */}
      <div className="pointer-events-none absolute inset-6 -z-0 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,0.35),transparent_60%),radial-gradient(circle_at_80%_90%,rgba(212,168,75,0.35),transparent_55%)] blur-2xl" />

      {/* gradient frame */}
      <div className="relative z-10 rounded-[2rem] bg-gradient-to-br from-[var(--color-gold)] via-emerald-500 to-[var(--color-paddy-dark)] p-[3px] shadow-2xl shadow-emerald-950/25 sm:rounded-[2.4rem]">
        <div className="relative overflow-hidden rounded-[calc(2rem-3px)] bg-[#0f2a20] sm:rounded-[calc(2.4rem-3px)]">
          <video
            ref={video}
            className="block aspect-video w-full"
            src={src}
            poster={poster}
            preload="none"
            playsInline
            controls={started}
            onPlay={() => setStarted(true)}
            onTimeUpdate={chapters.length ? (e) => setNow(e.currentTarget.currentTime) : undefined}
            title={t(title)}
          />
          {!started && (
            <button
              type="button"
              onClick={() => play()}
              aria-label={t({ th: `เล่นคลิป ${title.th}`, en: `Play ${title.en}` })}
              className="group absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-black/10 to-transparent"
            >
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-[var(--color-paddy)] shadow-2xl transition-transform duration-300 group-hover:scale-110 sm:h-24 sm:w-24">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/40 [animation-duration:2.2s]" />
                <Play size={34} className="relative ml-1.5 fill-current" />
              </span>
              <span className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-2 text-xs font-bold text-white sm:right-5 sm:top-5 sm:text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur"><Clock3 size={14} /> {clock(duration)}</span>
                <span className="hidden items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur sm:inline-flex"><Volume2 size={14} /> {t({ th: 'มีเสียงประกอบ', en: 'With sound' })}</span>
                {subtitled && <span className="hidden items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur sm:inline-flex"><Subtitles size={14} /> {t({ th: 'มีซับไทย', en: 'Thai subtitles' })}</span>}
              </span>
            </button>
          )}
        </div>
      </div>

      {chapters.length > 0 && (
        <div className="relative z-10 mt-5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-800">{t({ th: 'กดเพื่อข้ามไปบทที่ต้องการ', en: 'Jump to a chapter' })}</div>
          <ol className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {chapters.map((c, i) => (
              <li key={c.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => play(c.t)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${i === current ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-700 hover:text-emerald-900'}`}
                >
                  <span className={`tabular-nums ${i === current ? 'text-amber-200' : 'text-slate-400'}`}>{clock(c.t)}</span>
                  {t({ th: c.th, en: c.en })}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
