import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Globe2, LogIn, Menu, UserPlus, X } from 'lucide-react';
import SiteAnnouncement from './AnnouncementBar';
import { LANGS, useI18n } from '../lib/i18n';

const mobileLinkBase = 'rice-public-nav-link flex items-center justify-between rounded-xl px-3 py-3 transition-colors';

const NAV = [
  { to: '/', label: { th: 'หน้าหลัก', en: 'Home' }, key: 'home' },
  { to: '/#app', label: { th: 'แอปมือถือ', en: 'Mobile app' }, key: 'app' },
  { to: '/rice-diseases', label: { th: 'ความรู้โรคข้าว', en: 'Rice diseases' }, key: 'diseases' },
  { to: '/risk-map', label: { th: 'แผนที่การระบาด', en: 'Outbreak map' }, key: 'map' },
];

/** True once the page has scrolled, plus 0–1 reading progress. */
function useScrollState() {
  const [state, setState] = useState({ scrolled: false, progress: 0 });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setState({ scrolled: window.scrollY > 8, progress: max > 0 ? Math.min(1, window.scrollY / max) : 0 });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return state;
}

/** On the landing page, whether the #app section is what the reader is looking at. */
function useAppSectionInView(enabled) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setInView(false);
      return undefined;
    }
    let io;
    let timer = 0;
    const attach = () => {
      const el = document.getElementById('app');
      if (!el) {
        timer = window.setTimeout(attach, 200);
        return;
      }
      io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '-45% 0px -45% 0px' });
      io.observe(el);
    };
    attach();
    return () => {
      window.clearTimeout(timer);
      io?.disconnect();
    };
  }, [enabled]);
  return inView;
}

export default function PublicHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [languageOpen, setLanguageOpen] = useState(false);
  const { lang, setLang, t } = useI18n();
  const current = LANGS.find((l) => l.code === lang);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = location.pathname === '/';
  const appInView = useAppSectionInView(isHome);
  const { scrolled, progress } = useScrollState();
  const activeKey = isHome
    ? (appInView ? 'app' : 'home')
    : location.pathname.startsWith('/rice-diseases')
      ? 'diseases'
      : location.pathname.startsWith('/risk-map')
        ? 'map'
        : null;

  // Close the mobile menu on navigation and with Escape.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const esc = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [mobileOpen]);

  const chooseLanguage = (code) => {
    setLang(code);
    setLanguageOpen(false);
  };

  const mobileLinkClass = (active = false) => `${mobileLinkBase} ${active ? 'rice-public-nav-strong bg-emerald-50 text-[var(--color-paddy)]' : 'text-gray-700 hover:bg-emerald-50 hover:text-[var(--color-paddy)]'}`;
  const closeMobile = () => setMobileOpen(false);

  // Clicking the page you're already on brings you back to its top.
  const handlePageClick = (event, to) => {
    closeMobile();
    if (location.pathname !== to) return;
    event.preventDefault();
    if (location.hash) navigate(to, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToAppSection = () => {
    const target = document.getElementById('app');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAppClick = (event) => {
    event.preventDefault();
    closeMobile();

    if (location.pathname !== '/') {
      navigate('/#app');
      return;
    }

    if (window.location.hash !== '#app') {
      window.history.replaceState(null, '', '/#app');
    }
    scrollToAppSection();
  };

  return (
    <>
    <SiteAnnouncement />
    <nav className={`rice-public-header sticky top-0 z-[9999] border-b backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-300 ${scrolled ? 'border-emerald-900/10 bg-[var(--color-paper)]/90 shadow-[0_8px_30px_-12px_rgba(20,51,39,0.25)]' : 'border-transparent bg-[var(--color-paper)]/70'}`}>
      <div className={`mx-auto flex max-w-7xl items-center justify-between px-4 transition-[min-height,padding] duration-300 lg:px-6 ${scrolled ? 'min-h-16 py-2' : 'min-h-16 py-2.5 sm:min-h-20 sm:py-3'}`}>
        <Link to="/" className="flex items-center gap-3" aria-label="Rice AI home" onClick={(e) => handlePageClick(e, '/')}>
          <img src="/brand/app_icon.svg" alt="Rice AI logo" className="h-10 w-10 rounded-[0.8rem] object-contain shadow-lg shadow-[#166534]/25 rb-logo-breathe sm:h-11 sm:w-11" />
          <span className="rice-public-brand text-xl text-[var(--color-paddy-dark)] sm:text-2xl">Rice AI</span>
        </Link>

        <div className="hidden items-center gap-5 lg:flex">
          <div className="flex items-center gap-1 rounded-2xl border border-emerald-900/5 bg-white/60 p-1 shadow-sm shadow-emerald-950/5">
            {NAV.map((item) => {
              const active = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  onClick={item.key === 'app' ? handleAppClick : (e) => handlePageClick(e, item.to)}
                  className={`rice-public-nav-link group relative rounded-xl px-3.5 py-2 transition-all duration-200 ${active ? 'rice-public-nav-strong bg-white text-[var(--color-paddy)] shadow-sm ring-1 ring-emerald-900/10' : 'text-gray-600 hover:bg-white/70 hover:text-[var(--color-paddy)]'}`}
                >
                  {t(item.label)}
                  <span className={`pointer-events-none absolute inset-x-3.5 -bottom-px h-[2.5px] rounded-full bg-gradient-to-r from-[var(--color-paddy)] via-emerald-500 to-[var(--color-gold)] transition-transform duration-300 ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'}`} />
                </Link>
              );
            })}
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <Link to="/apply-researcher" className="rice-public-nav-link inline-flex h-11 items-center gap-2 rounded-xl px-3 text-[var(--color-paddy)] transition-all hover:bg-emerald-50">
            <UserPlus size={16} />
            {t({ th: 'สมัครนักวิชาการ', en: 'Researcher access' })}
          </Link>

          <Link to="/login" className="rice-public-nav-link rice-public-nav-strong inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-paddy)] px-5 text-white shadow-md shadow-[#166534]/25 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-paddy-dark)]">
            <LogIn size={16} />
            {t({ th: 'เข้าสู่ระบบ', en: 'Sign in' })}
          </Link>

          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={languageOpen}
              aria-label={t({ th: 'เลือกภาษา', en: 'Choose language' })}
              onClick={() => setLanguageOpen((open) => !open)}
              onBlur={() => window.setTimeout(() => setLanguageOpen(false), 120)}
              className="rice-public-nav-link inline-flex h-11 min-w-[96px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-800 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2">
                <Globe2 size={16} className="text-[var(--color-paddy)]" />
                {current.label}
              </span>
              <ChevronDown size={15} className={`text-gray-400 transition-transform ${languageOpen ? 'rotate-180' : ''}`} />
            </button>

            {languageOpen && (
              <div role="menu" className="absolute right-0 top-12 z-50 w-36 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-emerald-950/10 rb-menu-pop">
                {LANGS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={lang === item.code}
                    lang={item.code}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseLanguage(item.code)}
                    className={`rice-public-nav-link flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${lang === item.code ? 'bg-emerald-50 text-[var(--color-paddy)]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    {item.label}
                    {lang === item.code && <span className="h-2 w-2 rounded-full bg-[var(--color-paddy)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-[var(--color-paddy)] shadow-sm transition-all hover:border-emerald-200 hover:shadow-md lg:hidden"
          aria-label={mobileOpen ? t({ th: 'ปิดเมนู', en: 'Close menu' }) : t({ th: 'เปิดเมนู', en: 'Open menu' })}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-emerald-900/10 bg-[var(--color-paper)]/95 px-4 py-4 shadow-lg backdrop-blur-xl lg:hidden rb-menu-pop">
          <div className="grid gap-2">
            {NAV.map((item) => {
              const active = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  onClick={item.key === 'app' ? handleAppClick : (e) => handlePageClick(e, item.to)}
                  className={mobileLinkClass(active)}
                >
                  {t(item.label)}
                  {active && <span className="h-2 w-2 rounded-full bg-[var(--color-gold)] shadow-[0_0_0_4px_rgba(200,155,60,0.18)]" />}
                </Link>
              );
            })}
            <div className="my-2 h-px bg-gray-200" />
            <Link to="/apply-researcher" onClick={closeMobile} className="rice-public-nav-link rounded-xl px-3 py-3 text-[var(--color-paddy)] transition-colors hover:bg-emerald-50">{t({ th: 'สมัครนักวิชาการ', en: 'Researcher access' })}</Link>
            <Link to="/login" onClick={closeMobile} className="rice-public-nav-link rice-public-nav-strong rounded-xl bg-[var(--color-paddy)] px-3 py-3 text-center text-white">{t({ th: 'เข้าสู่ระบบ', en: 'Sign in' })}</Link>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <span className="rice-public-nav-link inline-flex items-center gap-2 text-gray-700"><Globe2 size={16} className="text-[var(--color-paddy)]" />{t({ th: 'ภาษา', en: 'Language' })}</span>
              <div role="radiogroup" className="flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                {LANGS.map((item) => (
                  <button key={item.code} type="button" role="radio" aria-checked={lang === item.code} lang={item.code} onClick={() => chooseLanguage(item.code)} className={`rice-public-nav-link rounded-md px-3 py-1.5 text-xs transition-all ${lang === item.code ? 'bg-white text-[var(--color-paddy)] shadow-sm' : 'text-gray-500'}`}>{item.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* reading progress */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-[var(--color-paddy)] via-emerald-500 to-[var(--color-gold)] transition-opacity duration-300"
        style={{ transform: `scaleX(${progress})`, opacity: scrolled ? 1 : 0 }}
      />
    </nav>
    </>
  );
}
