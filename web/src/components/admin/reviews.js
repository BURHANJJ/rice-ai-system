import { useSyncExternalStore } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/** The classes the deployed model predicts (ai-service/model/class_indices.json). */
export const MODEL_CLASSES = [
  { code: 'BLAST', name: 'โรคไหม้', en: 'Rice Blast', key: '1' },
  { code: 'BLB', name: 'โรคขอบใบแห้ง', en: 'Bacterial Leaf Blight', key: '2' },
  { code: 'TUNGRO', name: 'โรคใบสีส้ม', en: 'Tungro', key: '3' },
  { code: 'HEALTHY', name: 'ใบปกติ', en: 'Healthy', key: '4' },
];
/** Reviewer-only label: another disease, not a rice leaf, or an unusable photo. */
export const OTHER = { code: 'OTHER', name: 'อื่น ๆ / ภาพใช้ไม่ได้', en: 'Other', key: '5' };
export const LABELS = [...MODEL_CLASSES, OTHER];
export const labelName = (code) => LABELS.find((l) => l.code === code)?.name || code || '–';

/* reviews/{diagnosisId} — one human verdict per scan, shared by admins and researchers. */
let state = { reviews: null, error: '' };
let unsub = null;
const listeners = new Set();

function subscribe(l) {
  listeners.add(l);
  if (!unsub) {
    unsub = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const map = {};
        snap.forEach((d) => {
          const r = d.data();
          map[d.id] = { ...r, id: d.id, at: r.reviewed_at?.toDate?.() || null };
        });
        state = { reviews: map, error: '' };
        listeners.forEach((x) => x());
      },
      (err) => {
        state = { reviews: {}, error: err?.code === 'permission-denied' ? 'ยังไม่ได้เปิดสิทธิ์ใน Firestore rules สำหรับ reviews' : 'โหลดผลตรวจทานไม่สำเร็จ' };
        listeners.forEach((x) => x());
      },
    );
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && unsub) {
      unsub();
      unsub = null;
      state = { reviews: null, error: '' };
    }
  };
}

export function useReviews() {
  const s = useSyncExternalStore(subscribe, () => state);
  return { reviews: s.reviews, error: s.error, loading: !s.reviews };
}

export function saveReview(scan, label, note, user) {
  return setDoc(doc(db, 'reviews', scan.id), {
    diagnosis_id: scan.id,
    ai_code: scan.code,
    ai_confidence: scan.confidence,
    label,
    correct: label === scan.code,
    note: note || '',
    province: scan.text || '',
    scan_date: scan.date || null,
    reviewer_uid: user?.uid || '',
    reviewer_name: user?.full_name || user?.email || '',
    reviewed_at: serverTimestamp(),
  });
}

export const clearReview = (id) => deleteDoc(doc(db, 'reviews', id));

/**
 * Accuracy figures from human-reviewed scans. OTHER verdicts count as AI errors
 * for accuracy but are kept out of the per-class precision/recall table.
 */
export function modelMetrics(scans, reviews, lowConfidence = 70) {
  const byId = Object.fromEntries((scans || []).map((s) => [s.id, s]));
  // Only reviews of scans that still exist: a deleted scan must not keep counting toward accuracy.
  const rows = Object.values(reviews || {})
    .map((r) => ({ ...r, scan: byId[r.diagnosis_id] }))
    .filter((r) => !scans || r.scan);
  const codes = LABELS.map((l) => l.code);
  const matrix = Object.fromEntries(MODEL_CLASSES.map((c) => [c.code, Object.fromEntries(codes.map((k) => [k, 0]))]));
  let correct = 0;
  for (const r of rows) {
    if (r.correct) correct += 1;
    if (matrix[r.ai_code] && matrix[r.ai_code][r.label] !== undefined) matrix[r.ai_code][r.label] += 1;
  }
  const perClass = MODEL_CLASSES.map((c) => {
    const tp = matrix[c.code][c.code];
    const predicted = codes.reduce((s, k) => s + matrix[c.code][k], 0);
    const actual = MODEL_CLASSES.reduce((s, p) => s + matrix[p.code][c.code], 0);
    const precision = predicted ? tp / predicted : null;
    const recall = actual ? tp / actual : null;
    const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
    return { ...c, tp, predicted, actual, precision, recall, f1 };
  });

  const buckets = [50, 60, 70, 80, 90].map((lo) => ({ lo, hi: lo === 90 ? 100 : lo + 10, n: 0, ok: 0 }));
  for (const r of rows) {
    const c = r.ai_confidence;
    if (c === null || c === undefined) continue;
    const b = buckets.find((x) => c >= x.lo && (c < x.hi || (x.hi === 100 && c <= 100))) || (c < 50 ? buckets[0] : null);
    if (!b) continue;
    b.n += 1;
    if (r.correct) b.ok += 1;
  }

  const confusions = [];
  for (const p of MODEL_CLASSES) for (const k of codes) if (k !== p.code && matrix[p.code][k]) confusions.push({ ai: p.code, label: k, n: matrix[p.code][k] });
  confusions.sort((a, b) => b.n - a.n);

  const all = scans || [];
  const withConf = all.filter((s) => s.confidence !== null);
  const low = withConf.filter((s) => s.confidence < lowConfidence);
  return {
    reviewed: rows.length,
    correct,
    accuracy: rows.length ? correct / rows.length : null,
    coverage: all.length ? rows.length / all.length : 0,
    matrix,
    perClass,
    buckets: buckets.map((b) => ({ ...b, label: `${b.lo}–${b.hi}%`, acc: b.n ? b.ok / b.n : null })),
    confusions,
    avgConfidence: withConf.length ? withConf.reduce((s, x) => s + x.confidence, 0) / withConf.length : null,
    lowCount: low.length,
    lowRate: withConf.length ? low.length / withConf.length : null,
    lowUnreviewed: low.filter((s) => !reviews?.[s.id]).length,
  };
}

export const pct = (v, d = 1) => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(d)}%`);
