import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Page-level scroll behaviour for the router:
 * - a new page (link / navigate) starts at the top
 * - a URL with #hash scrolls to that section once it has rendered
 * - Back / Forward keeps the browser's own position
 * - query-only changes on the same page (e.g. ?d=…) leave the scroll alone
 */
export default function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const navType = useNavigationType();
  const lastPath = useRef(null);

  useLayoutEffect(() => {
    const samePage = lastPath.current === pathname;
    lastPath.current = pathname;
    if (navType === 'POP' && !hash) return undefined;
    if (!hash) {
      if (!samePage) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return undefined;
    }
    // Wait for the target section to mount (lazy data, images) then scroll to it.
    let tries = 0;
    let timer = 0;
    const go = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ behavior: tries === 0 && !samePage ? 'instant' : 'smooth', block: 'start' });
      } else if (tries++ < 20) {
        timer = window.setTimeout(go, 50);
      }
    };
    go();
    return () => window.clearTimeout(timer);
  }, [pathname, hash, key, navType]);

  return null;
}
