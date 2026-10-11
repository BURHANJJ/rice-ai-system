// Night paddy scene above the footer: moon, stars, fireflies, moonlit rice, and Khao Hom
// walking the field dike, stopping to wave, inspect a leaf, think, scan with the app,
// cheer, then nod off. Decorative only; static when the viewer prefers reduced motion.
import { useEffect, useRef, useState } from 'react';
import { makeRow, Row, rng } from './PaddyField';

const W = 1600;
const H = 260;
const DIKE_Y = 196; // where Khao Hom's feet touch, in viewBox units

const BACK = makeRow({ seed: 51, count: 74, y: 184, hMin: 26, hMax: 44, spread: 9, wBase: 2.2 });
const FRONT = makeRow({ seed: 67, count: 44, y: 264, hMin: 34, hMax: 62, spread: 13, wBase: 3, panicle: true });

const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = rng(300 + i);
  return { x: r() * W, y: 8 + r() * 120, r: 0.6 + r() * 1.5, d: 2 + r() * 4, dl: -r() * 6 };
});
const FIREFLIES = Array.from({ length: 16 }, (_, i) => {
  const r = rng(400 + i);
  return { x: r() * W, y: 110 + r() * 120, d: 6 + r() * 6, dl: -r() * 10 };
});

// x is % of the scene width; `say` appears in a bubble while Khao Hom stands there.
const STOPS = [
  { x: 7, mood: 'hello', say: 'สวัสดีครับ ผมน้องข้าวหอม' },
  { x: 25, mood: 'scan', say: 'ขอส่องใบข้าวหน่อยนะ…' },
  { x: 41, mood: 'think', say: 'จุดสีน้ำตาลนี่คืออะไรนะ' },
  { x: 56, mood: 'phone', say: 'ถ่ายรูปให้ Rice AI ช่วยดู' },
  { x: 72, mood: 'joy', say: 'ใบข้าวแข็งแรง เยี่ยมเลย!' },
  { x: 88, mood: 'sleep', say: 'ราตรีสวัสดิ์ครับ… zZ' },
];
const MOODS = ['hello', 'happy', 'scan', 'think', 'phone', 'joy', 'sleep'];
const SPEED = 5.5; // % of width per second
const PAUSE = 3200; // ms at each stop

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useKhaoHomWalk(active) {
  // phase: 'stand' at stops[i], or 'walk' toward stops[i]
  const [state, setState] = useState({ i: 0, phase: 'stand', x: STOPS[0].x, dur: 0, left: false });
  useEffect(() => {
    if (!active) return undefined;
    let t;
    const { i, phase, x } = state;
    if (phase === 'stand') {
      t = setTimeout(() => {
        const next = i === STOPS.length - 1 ? 0 : i + 1;
        const nx = STOPS[next].x;
        setState({ i: next, phase: 'walk', x: nx, dur: Math.abs(nx - x) / SPEED, left: nx < x });
      }, PAUSE);
    } else {
      t = setTimeout(() => setState((s) => ({ ...s, phase: 'stand', dur: 0 })), state.dur * 1000);
    }
    return () => clearTimeout(t);
  }, [active, state]);
  return state;
}

export default function FooterScene() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const walk = useKhaoHomWalk(visible && !reduced);
  const stop = STOPS[walk.i];
  const mood = walk.phase === 'walk' ? 'happy' : stop.mood;
  const talking = walk.phase === 'stand';

  return (
    <div ref={ref} aria-hidden="true" className={`fs-scene pointer-events-none relative h-[170px] select-none sm:h-[220px] lg:h-[260px] ${visible ? 'fs-on' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1224" />
            <stop offset="0.7" stopColor="#16244a" />
            <stop offset="1" stopColor="#1b3352" />
          </linearGradient>
          <radialGradient id="fs-moon-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6d6" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fs-dike" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2c4a3d" />
            <stop offset="1" stopColor="#1a3229" />
          </linearGradient>
          <linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f3a4f" />
            <stop offset="1" stopColor="#132637" />
          </linearGradient>
          <filter id="fs-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.4" /></filter>
        </defs>

        <rect width={W} height={H} fill="url(#fs-sky)" />
        {/* the page's paper colour rolls down into the night like a hill line */}
        <path d={`M0 0 H${W} V18 C 1300 44 1040 10 760 30 S 260 46 0 22 Z`} fill="var(--color-paper)" />

        <g fill="#fff8e1">
          {STARS.map((s, i) => <circle key={i} className="fs-star" cx={s.x} cy={s.y + 20} r={s.r} style={{ '--d': `${s.d}s`, '--dl': `${s.dl}s` }} />)}
        </g>

        {/* crescent moon */}
        <circle cx="1060" cy="78" r="70" fill="url(#fs-moon-glow)" />
        <mask id="fs-crescent">
          <rect width={W} height={H} fill="#fff" />
          <circle cx="1071" cy="70" r="21" fill="#000" />
        </mask>
        <circle cx="1060" cy="78" r="24" fill="#fdf3c8" mask="url(#fs-crescent)" />

        {/* water field with the moon's reflection, then the back row and the dike */}
        <rect y="150" width={W} height={H - 150} fill="url(#fs-water)" />
        <g stroke="#fdf3c8" strokeLinecap="round" className="fs-ripple">
          {[[1030, 162, 60], [1046, 170, 36], [1020, 178, 70]].map(([x, y, l], i) => <line key={i} x1={x} y1={y} x2={x + l} y2={y} strokeWidth="2" style={{ '--dl': `${-i * 0.9}s` }} />)}
        </g>
        <Row plants={BACK} tones={['#25463a', '#2c5243', '#1f3d32']} className="pf-back" />
        <path d={`M0 ${DIKE_Y - 6} C 400 ${DIKE_Y - 12} 1100 ${DIKE_Y} ${W} ${DIKE_Y - 8} L${W} ${DIKE_Y + 14} C 1100 ${DIKE_Y + 20} 400 ${DIKE_Y + 8} 0 ${DIKE_Y + 12} Z`} fill="url(#fs-dike)" />
        <rect y={DIKE_Y + 10} width={W} height={H - DIKE_Y} fill="#132a24" />
      </svg>

      {/* Khao Hom */}
      <div
        className="fs-khao absolute z-10 w-[64px] -translate-x-1/2 sm:w-[82px] lg:w-[96px]"
        style={{ left: `${walk.x}%`, transition: `left ${walk.dur}s linear` }}
      >
        <div className={`fs-bubble ${stop.x < 20 ? 'fs-bubble-l' : stop.x > 80 ? 'fs-bubble-r' : ''} ${talking && !reduced ? 'fs-bubble-on' : ''}`}>{stop.say}</div>
        <div className={walk.phase === 'walk' ? 'fs-walking' : ''}>
          <div className="relative aspect-[212/232]" style={{ transform: walk.left ? 'scaleX(-1)' : undefined }}>
            {MOODS.map((m) => (
              <img key={m} src={`/mascot/khao_hom_${m}.svg`} alt="" draggable="false" className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${m === mood ? 'opacity-100' : 'opacity-0'}`} />
            ))}
          </div>
        </div>
        <div className="mx-auto -mt-1 h-2 w-3/5 rounded-[50%] bg-black/35 blur-[2px]" />
      </div>

      {/* front row and fireflies in front of Khao Hom */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 z-20 h-full w-full">
        <Row plants={FRONT} tones={['#1c3a2f', '#21443a', '#163127', '#28503f']} className="pf-front" grain={['#a88b3f', '#c9a957']} />
        <g fill="#eaff8f">
          {FIREFLIES.map((f, i) => (
            <g key={i} className="fs-fly" style={{ '--d': `${f.d}s`, '--dl': `${f.dl}s` }}>
              <circle cx={f.x} cy={f.y} r="5" filter="url(#fs-glow)" opacity="0.7" />
              <circle cx={f.x} cy={f.y} r="1.8" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
