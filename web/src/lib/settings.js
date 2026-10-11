import { useSyncExternalStore } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/** System settings live in one public-readable doc: settings/system. */
export const DEFAULT_SETTINGS = {
  alerts: { windowDays: 14, high: 5, medium: 2 },
  review: { lowConfidence: 70 },
  applications: { open: true, closedMessage: 'ขณะนี้ปิดรับสมัครนักวิชาการชั่วคราว กรุณากลับมาใหม่ภายหลัง' },
  announcement: { active: false, tone: 'info', text: '', linkLabel: '', linkUrl: '', endsAt: '' },
  organization: { name: 'ระบบ Rice AI', preparedBy: '' },
  // 2FA policy for the web portal: off | researcher | all (researchers + admins)
  security: { require2fa: 'off' },
};

const merge = (data = {}) =>
  Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, { ...v, ...(data[k] || {}) }]));

let state = { settings: DEFAULT_SETTINGS, meta: null, loaded: false };
let unsub = null;
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  if (!unsub) {
    unsub = onSnapshot(
      doc(db, 'settings', 'system'),
      (snap) => {
        const data = snap.data() || {};
        state = { settings: merge(data), meta: { updatedAt: data.updated_at?.toDate?.() || null, updatedBy: data.updated_by || '' }, loaded: true };
        listeners.forEach((l) => l());
      },
      () => {
        state = { ...state, loaded: true };
        listeners.forEach((l) => l());
      },
    );
  }
  return () => listeners.delete(listener);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => state);
}

export function saveSettings(settings, by) {
  return setDoc(doc(db, 'settings', 'system'), { ...settings, updated_at: serverTimestamp(), updated_by: by || '' });
}

/** Banner is live when switched on, has text, and hasn't passed its end date. */
export function liveAnnouncement(a) {
  if (!a?.active || !a.text?.trim()) return null;
  if (a.endsAt && new Date(`${a.endsAt}T23:59:59`) < new Date()) return null;
  return a;
}
