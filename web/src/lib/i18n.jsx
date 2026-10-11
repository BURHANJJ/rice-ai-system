// Language for the public website (Thai / English).
// Strings are written next to where they are used as { th, en } pairs and read through t():
//   const { t } = useI18n();  t({ th: 'หน้าหลัก', en: 'Home' })
// A plain string passes through unchanged, so data that exists only in Thai still renders.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const LANGS = [
  { code: 'th', label: 'ไทย', short: 'TH' },
  { code: 'en', label: 'English', short: 'EN' },
];
const KEY = 'rice-ai-lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return 'th';
}

const I18nContext = createContext({ lang: 'th', setLang: () => {}, t: (x) => (typeof x === 'string' ? x : x?.th ?? '') });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((x) => {
    if (x == null || typeof x !== 'object') return x;
    return x[lang] ?? x.th;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/** Sets the browser tab title for the current language. */
export function useDocTitle(title) {
  const { t, lang } = useI18n();
  useEffect(() => {
    const text = t(title);
    if (text) document.title = text;
  }, [t, lang, title]);
}

const THAI_ONLY = { lang: 'th', setLang: () => {}, t: (x) => (x == null || typeof x !== 'object' ? x : x.th) };
/** Pins everything inside to Thai: the staff portal and sign-in pages are Thai-only. */
export function ThaiOnly({ children }) {
  const { lang } = useContext(I18nContext);
  useEffect(() => {
    document.documentElement.lang = 'th';
    return () => { document.documentElement.lang = lang; };
  }, [lang]);
  return <I18nContext.Provider value={THAI_ONLY}>{children}</I18nContext.Provider>;
}
