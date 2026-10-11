// Promo clip on the landing page, framed by ripe rice sprigs. Only the poster loads until
// the visitor presses play (preload="none"), so the page stays light.
import { useRef, useState } from 'react';
import { Play, Clock3, Volume2 } from 'lucide-react';
import RiceSprig from './RiceSprig';
import { useI18n } from '../../lib/i18n';

const SRC = '/media/rice-ai-promo-720p.mp4';
const POSTER = '/media/rice-ai-promo-poster.jpg';

export default function PromoVideo() {
  const { t } = useI18n();
  const video = useRef(null);
  const [started, setStarted] = useState(false);

  const play = () => {
    setStarted(true);
    const v = video.current;
    if (v) v.play().catch(() => {});
  };

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
            src={SRC}
            poster={POSTER}
            preload="none"
            playsInline
            controls={started}
            onPlay={() => setStarted(true)}
            title={t({ th: 'คลิปแนะนำแอป Rice AI', en: 'Rice AI app introduction' })}
          />
          {!started && (
            <button
              type="button"
              onClick={play}
              aria-label={t({ th: 'เล่นคลิปแนะนำ', en: 'Play the introduction video' })}
              className="group absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-black/10 to-transparent"
            >
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-[var(--color-paddy)] shadow-2xl transition-transform duration-300 group-hover:scale-110 sm:h-24 sm:w-24">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/40 [animation-duration:2.2s]" />
                <Play size={34} className="relative ml-1.5 fill-current" />
              </span>
              <span className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-2 text-xs font-bold text-white sm:right-5 sm:top-5 sm:text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur"><Clock3 size={14} /> 0:43</span>
                <span className="hidden items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur sm:inline-flex"><Volume2 size={14} /> {t({ th: 'มีเสียงประกอบ', en: 'With sound' })}</span>
              </span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
