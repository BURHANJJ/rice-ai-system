import { useEffect, useSyncExternalStore } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Per-user display preferences for the web portal (researchers and admins).
 * Kept in localStorage so the page paints correctly before Firestore answers,
 * and mirrored to users/{uid}.preferences so they follow the user to other devices.
 */
export const DEFAULT_PREFS = { theme: 'light', fontScale: 'md', reduceMotion: false };
const KEY = 'rb-prefs';
const SCALE = { sm: '15px', md: '16px', lg: '17.5px' };

const read = () => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT_PREFS; }
};

let prefs = read();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function usePreferences() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => prefs);
}

export function setPreferences(patch, uid) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  emit();
  if (uid) updateDoc(doc(db, 'users', uid), { preferences: prefs }).catch(() => {});
}

/** Adopt preferences saved on the profile (e.g. set on another computer). */
export function adoptPreferences(saved) {
  if (!saved || JSON.stringify({ ...DEFAULT_PREFS, ...saved }) === JSON.stringify(prefs)) return;
  prefs = { ...DEFAULT_PREFS, ...saved };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  emit();
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
export const resolvedTheme = (p) => (p.theme === 'system' ? (systemDark() ? 'dark' : 'light') : p.theme);

/** Applies the preferences to <html> while the portal is mounted; the public site stays light. */
export function useApplyPreferences(active) {
  const p = usePreferences();
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolvedTheme(p);
      root.style.fontSize = SCALE[p.fontScale] || SCALE.md;
      root.classList.toggle('rb-reduce-motion', !!p.reduceMotion);
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', apply);
    return () => {
      mq?.removeEventListener?.('change', apply);
      delete root.dataset.theme;
      root.style.fontSize = '';
      root.classList.remove('rb-reduce-motion');
    };
  }, [active, p]);
}
