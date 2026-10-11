import { useEffect, useRef, useState } from 'react';

export const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Real app screen (exported from the Flutter redesign) in /public/app. */
export const shot = (name) => `/app/${name}.webp`;

/** Adds `.in` to every `.rv` element inside the returned ref once it scrolls into view. */
export function useRevealAll() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = root.querySelectorAll('.rv');
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Cycles 0..count-1 every `ms` while `running`. */
export function useCycle(count, ms, running = true) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!running || count < 2 || reduceMotion()) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms, running]);
  useEffect(() => setI(0), [count]);
  return [i, setI];
}

/** Pointer-driven 3D tilt; writes --rx/--ry (deg) and --mx/--my (%) on the element. */
export function useTilt(max = 8) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion() || !window.matchMedia('(pointer: fine)').matches) return undefined;
    let raf = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
        el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [max]);
  return ref;
}

/** Spotlight that follows the pointer inside `.rb-spot` cards. */
export function spotlight(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--sx', `${e.clientX - r.left}px`);
  el.style.setProperty('--sy', `${e.clientY - r.top}px`);
}
