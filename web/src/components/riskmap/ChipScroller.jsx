import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Horizontal chip row that works with a mouse too: vertical wheel scrolls
 * sideways, click-drag scrolls, and arrow buttons appear when there is more.
 */
export default function ChipScroller({ children, className = '' }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const drag = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    const wheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', wheel, { passive: false });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', wheel);
      ro.disconnect();
    };
  }, [children]);

  const by = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) ref.current.scrollLeft = d.left - dx;
  };
  const end = () => {
    setTimeout(() => { drag.current = null; }, 0);
  };
  // Swallow the click that ends a drag so a chip is not selected by accident.
  const onClickCapture = (e) => {
    if (drag.current?.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const fade = `${edge.left ? 'transparent, black 28px' : 'black'}, ${edge.right ? 'black calc(100% - 28px), transparent' : 'black'}`;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerLeave={end}
        onClickCapture={onClickCapture}
        className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: `linear-gradient(90deg, ${fade})`, WebkitMaskImage: `linear-gradient(90deg, ${fade})` }}
      >
        {children}
      </div>
      {edge.left && (
        <button type="button" aria-label="เลื่อนไปทางซ้าย" onClick={() => by(-1)} className="absolute -left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:text-[var(--color-paddy)]">
          <ChevronLeft size={17} />
        </button>
      )}
      {edge.right && (
        <button type="button" aria-label="เลื่อนไปทางขวา" onClick={() => by(1)} className="absolute -right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:text-[var(--color-paddy)]">
          <ChevronRight size={17} />
        </button>
      )}
    </div>
  );
}
