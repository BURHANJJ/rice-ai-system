import { useEffect, useRef, useState } from 'react';

import { reduceMotion, shot } from './landingHooks';

/** Phone frame showing one or more real app screens; crossfades to `active`. */
export function Phone({ screens, active = 0, scroll = false, className = '', glow = false, children }) {
  return (
    <div className={`rb-phone ${glow ? 'rb-phone-glow' : ''} ${className}`}>
      <div className="rb-phone-screen">
        {screens.map((s, i) => (
          <img
            key={s}
            src={shot(s)}
            alt=""
            loading={i === 0 ? 'eager' : 'lazy'}
            draggable="false"
            className={`rb-phone-shot ${i === active ? 'is-on' : ''} ${scroll && s === 'Home' ? 'rb-shot-scroll' : ''}`}
          />
        ))}
        <span className="rb-phone-island" />
        {children}
      </div>
    </div>
  );
}

/** Number that counts up the first time it scrolls into view. */
export function CountUp({ to, decimals = 0, suffix = '', duration = 1400 }) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      setV(to);
      return undefined;
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return <span ref={ref}>{v.toFixed(decimals)}{suffix}</span>;
}
