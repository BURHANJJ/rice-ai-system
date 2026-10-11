// Animated paddy field for the landing hero: terraced water fields, three depths of rice plants
// swaying in a wind wave that travels left to right, golden panicles on the front row,
// drifting pollen and birds. Pure SVG + CSS (index.css: .pf-*), decorative only.
const W = 1600;

// Deterministic randomness so the field looks the same on every render and on the server.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One tapered blade from (x, y) leaning `lean` px, `h` tall, `w` wide at the base.
// Long blades arch over: the further they lean, the lower the tip droops, like real rice leaves.
const blade = (x, y, h, lean, w) => {
  const tipY = y - h + Math.abs(lean) * 0.35;
  return `M${x - w} ${y} Q${x - w * 0.3 + lean * 0.15} ${y - h * 0.75} ${x + lean} ${tipY} Q${x + w * 0.3 + lean * 0.1} ${y - h * 0.7} ${x + w} ${y}Z`;
};

function makeRow({ seed, count, y, hMin, hMax, spread, wBase, panicle }) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = (i + 0.5) * (W / count) + (r() - 0.5) * (W / count) * 0.8;
    const blades = 3 + Math.floor(r() * 3);
    const h = hMin + r() * (hMax - hMin);
    const leaves = Array.from({ length: blades }, (_, k) => {
      const lean = (k - (blades - 1) / 2) * spread * (0.6 + r() * 0.8) + (r() - 0.5) * spread;
      return { d: blade(x + (r() - 0.5) * wBase * 2, y, h * (0.7 + r() * 0.35), lean, wBase * (0.7 + r() * 0.5)), tone: r() };
    });
    let grains = null;
    if (panicle && r() > 0.25) {
      // A drooping head of grain hanging from the tallest blade's tip.
      const dir = r() > 0.5 ? 1 : -1;
      const tipX = x + dir * spread * 0.6;
      const tipY = y - h * 1.02;
      // Spikelets alternate on both sides of the drooping stalk, smaller towards the tip.
      grains = Array.from({ length: 13 }, (_, g) => {
        const t = g / 12;
        const side = g % 2 ? 1 : -1;
        const cx = tipX + dir * t * h * 0.3 + side * 3.2;
        const cy = tipY + t * t * h * 0.46 + side * 1.2;
        return { cx, cy, rot: dir * (35 + t * 45) + side * 22, s: 1.15 - t * 0.45 };
      });
      leaves.push({ d: `M${x} ${y} Q${x + dir * spread * 0.2} ${y - h * 0.6} ${tipX} ${tipY}`, stem: true });
    }
    // Wind wave: phase follows x so gusts roll across the field.
    const dur = 4.6 + r() * 1.8;
    return { x, leaves, grains, dur, delay: -(x / W) * 3.2 - r() * 0.6, grow: (x / W) * 0.6 + r() * 0.25 };
  });
}

const BACK = makeRow({ seed: 11, count: 78, y: 168, hMin: 16, hMax: 26, spread: 5, wBase: 1.6 });
const MID = makeRow({ seed: 23, count: 56, y: 224, hMin: 40, hMax: 62, spread: 12, wBase: 2.4 });
const FRONT = makeRow({ seed: 37, count: 34, y: 304, hMin: 100, hMax: 150, spread: 24, wBase: 4, panicle: true });

const POLLEN = Array.from({ length: 22 }, (_, i) => {
  const r = rng(100 + i);
  return { x: r() * W, y: 150 + r() * 130, r: 1.4 + r() * 2.2, dur: 9 + r() * 8, delay: -r() * 16 };
});

const LEAF_TONES = {
  back: ['#a9d7a3', '#93cb92'],
  mid: ['#6cb47a', '#5aa56c', '#7fc287'],
  front: ['#2f7d4b', '#3b8d56', '#256b3e', '#4a9a5f'],
};

function Row({ plants, tones, className, grain }) {
  return (
    <g className={className}>
      {plants.map((p, i) => (
        <g key={i} className="pf-grow" style={{ '--grow': `${p.grow}s` }}>
          <g className="pf-sway" style={{ '--dur': `${p.dur}s`, '--delay': `${p.delay}s` }}>
            {p.leaves.map((l, k) =>
              l.stem ? (
                <path key={k} d={l.d} fill="none" stroke="#9c8a3e" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path key={k} d={l.d} fill={tones[Math.floor(l.tone * tones.length)]} />
              ),
            )}
            {p.grains?.map((g, k) => (
              <ellipse key={k} cx={g.cx} cy={g.cy} rx={5.2 * g.s} ry={2.5 * g.s} transform={`rotate(${g.rot} ${g.cx} ${g.cy})`} fill={k % 3 === 0 ? grain[1] : grain[0]} />
            ))}
          </g>
        </g>
      ))}
    </g>
  );
}

export default function PaddyField({ className = '' }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      <svg viewBox={`0 0 ${W} 300`} preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id="pf-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e3f3ea" />
            <stop offset="1" stopColor="#c7e6d4" />
          </linearGradient>
          <linearGradient id="pf-terrace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfe9c8" />
            <stop offset="1" stopColor="#b5dcae" />
          </linearGradient>
          <linearGradient id="pf-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a5d39c" />
            <stop offset="1" stopColor="#86c27f" />
          </linearGradient>
          <radialGradient id="pf-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffe7a3" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#ffd56b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffd56b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pf-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-paper)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--color-paper)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* sun glow behind the horizon */}
        <circle className="pf-sun" cx="1180" cy="120" r="210" fill="url(#pf-sun)" />
        {/* soften the glow where the svg starts */}
        <rect x="0" y="0" width={W} height="80" fill="url(#pf-fade)" />

        {/* terraces, far to near */}
        <path d="M0 150 C 260 132 520 160 820 146 S 1360 128 1600 144 L1600 300 L0 300Z" fill="url(#pf-terrace)" />
        <path d="M0 150 C 260 132 520 160 820 146 S 1360 128 1600 144" fill="none" stroke="#f2faf0" strokeWidth="2.5" opacity="0.9" />
        <path d="M0 186 C 300 172 640 196 980 182 S 1420 170 1600 184 L1600 300 L0 300Z" fill="url(#pf-water)" />
        <path d="M0 186 C 300 172 640 196 980 182 S 1420 170 1600 184" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
        <g className="pf-shimmer" stroke="#ffffff" strokeLinecap="round" opacity="0.8">
          {[[120, 200, 70], [420, 206, 110], [760, 198, 60], [1040, 204, 120], [1380, 196, 80]].map(([x, y, l], i) => (
            <line key={i} x1={x} y1={y} x2={x + l} y2={y} strokeWidth="2" style={{ '--sh': `${i * -1.3}s` }} />
          ))}
        </g>
        <path d="M0 232 C 380 218 760 244 1160 228 S 1500 222 1600 230 L1600 300 L0 300Z" fill="url(#pf-near)" />
        <path d="M0 232 C 380 218 760 244 1160 228 S 1500 222 1600 230" fill="none" stroke="#e8f5e3" strokeWidth="2.5" opacity="0.8" />

        <Row plants={BACK} tones={LEAF_TONES.back} className="pf-back" />
        <Row plants={MID} tones={LEAF_TONES.mid} className="pf-mid" />

        {/* birds crossing the sky */}
        <g fill="none" stroke="#3f5f4c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {[['0s', '46px', 1], ['-0.8s', '70px', 0.8], ['-1.5s', '30px', 0.65]].map(([bd, by, sc], i) => (
            <g key={i} className="pf-bird" style={{ '--bd': bd, '--by': by }}>
              <path className="pf-flap" d="M0 0 q6 -6 12 0 q6 -6 12 0" style={{ scale: sc }} />
            </g>
          ))}
        </g>

        {/* pollen drifting up */}
        <g fill="#f5d77a">
          {POLLEN.map((p, i) => (
            <circle key={i} className="pf-pollen" cx={p.x} cy={p.y} r={p.r} style={{ '--pd': `${p.dur}s`, '--pdl': `${p.delay}s` }} />
          ))}
        </g>

        <Row plants={FRONT} tones={LEAF_TONES.front} className="pf-front" grain={['#d8b24a', '#e9c867']} />

      </svg>
    </div>
  );
}
