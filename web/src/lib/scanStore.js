import { useSyncExternalStore } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

/**
 * One live subscription to `diagnoses`, shared by every page that needs scans
 * (public map, admin alerts, review queue, reports...). Images are dropped from
 * memory; pages that show a photo fetch that one document on demand.
 */

export const DISEASE_NAMES = {
  BLAST: 'โรคไหม้',
  BLB: 'โรคขอบใบแห้ง',
  TUNGRO: 'โรคใบสีส้ม',
  BROWN_SPOT: 'โรคใบจุดสีน้ำตาล',
  NARROW_BROWN_SPOT: 'โรคใบขีดสีน้ำตาล',
  BAKANA: 'โรคถอดฝักดาบ',
  GRASSY_STUNT: 'โรคใบหงิก',
  RAGGED_STUNT: 'โรคจู๋',
  SHEATH_BLIGHT: 'โรคกาบใบแห้ง',
};

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

export function readScan(id, data) {
  const loc = data.location || {};
  const lat = num(loc.latitude ?? loc.lat ?? data.latitude ?? data.lat);
  const lng = num(loc.longitude ?? loc.lng ?? data.longitude ?? data.lng);
  const ts = data.diag_date || data.created_at || data.timestamp;
  const conf = num(data.confidence);
  return {
    id,
    userId: data.user_id || null,
    code: data.disease_code || 'HEALTHY',
    disease: DISEASE_NAMES[data.disease_code] || data.disease_name || data.disease_code || 'ไม่ระบุ',
    isDisease: !!data.disease_code && data.disease_code !== 'HEALTHY',
    confidence: Number.isFinite(conf) ? conf : null,
    text: String(data.province || loc.province || ''),
    districtText: String(data.district || data.amphoe || loc.district || loc.amphoe || ''),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    date: typeof ts?.toDate === 'function' ? ts.toDate() : ts ? new Date(ts) : null,
    hasImage: !!(data.image_base64 || data.image_url),
  };
}

let state = { scans: null, error: '' };
let unsub = null;
let stopTimer = null;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

function start() {
  if (unsub) return;
  unsub = onSnapshot(
    collection(db, 'diagnoses'),
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push(readScan(d.id, d.data())));
      list.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      state = { scans: list, error: '' };
      emit();
    },
    () => {
      state = { ...state, error: 'โหลดข้อมูลผลสแกนไม่สำเร็จ' };
      emit();
    },
  );
}

function subscribe(listener) {
  listeners.add(listener);
  window.clearTimeout(stopTimer);
  start();
  return () => {
    listeners.delete(listener);
    // keep the stream briefly so page-to-page navigation doesn't refetch
    if (!listeners.size) {
      stopTimer = window.setTimeout(() => {
        if (listeners.size || !unsub) return;
        unsub();
        unsub = null;
        state = { scans: null, error: '' };
      }, 60_000);
    }
  };
}

const getSnapshot = () => state;

/** Live list of all scans, newest first: `{ scans, error, loading }`. */
export function useScans() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return { scans: s.scans, error: s.error, loading: !s.scans && !s.error };
}
