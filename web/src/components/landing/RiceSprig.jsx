// A ripe rice sprig: a curved stalk with a drooping golden panicle and two leaves.
// Purely decorative; sways gently (index.css .rs-sway) unless reduced motion is set.
const GRAINS = Array.from({ length: 26 }, (_, i) => {
  const t = i / 25;
  const side = i % 2 ? 1 : -1;
  // along the drooping head: starts at the stalk tip (60, 22) and arcs down to the right
  const x = 60 + t * 52 + side * 3.6;
  const y = 22 + t * t * 90 + side * 1.4;
  return { x, y, rot: 35 + t * 45 + side * 28, s: 1.05 - t * 0.4 };
});

export default function RiceSprig({ className = '', style, flip = false, delay = '0s' }) {
  return (
    <svg
      viewBox="0 0 140 240"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
      style={{ ...style, transform: `${style?.transform || ''} ${flip ? 'scaleX(-1)' : ''}`.trim() }}
    >
      <g className="rs-sway" style={{ '--rs-delay': delay }}>
        {/* leaves */}
        <path d="M58 236 C 40 180 20 150 4 128 C 30 146 52 176 64 236 Z" fill="#3f8f57" />
        <path d="M62 236 C 78 190 104 168 126 158 C 100 178 80 204 70 236 Z" fill="#2f7a4a" />
        {/* stalk curving into the drooping head */}
        <path d="M60 238 C 58 170 54 90 60 22" fill="none" stroke="#b08a38" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M60 22 C 80 30 104 70 114 116" fill="none" stroke="#b08a38" strokeWidth="2.2" strokeLinecap="round" />
        {GRAINS.map((g, i) => (
          <ellipse key={i} cx={g.x} cy={g.y} rx={6.6 * g.s} ry={3.2 * g.s} transform={`rotate(${g.rot} ${g.x} ${g.y})`} fill={i % 3 === 0 ? '#e9c867' : '#d8b24a'} stroke="#b8922f" strokeWidth="0.6" />
        ))}
        {/* awns: fine hairs on the top grains */}
        {GRAINS.slice(0, 10).map((g, i) => (
          <line key={`a${i}`} x1={g.x} y1={g.y} x2={g.x + 6} y2={g.y - 9} stroke="#c9a54a" strokeWidth="0.8" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}
