// Live health checks for the admin dashboard and model page. Rice AI has no servers of its own:
// the AI runs on the device (TFLite in the app, ONNX in the browser) and data lives in Firebase,
// so "is it up?" means: can we reach Firestore, is the model file served, which app build is out.
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from './firebase';

/** The model the website and the app ship (ai-service/model/metrics.json, model v3). */
export const MODEL = {
  version: 'V3',
  date: '17 ต.ค. 2569',
  architecture: 'EfficientNet-B0 (transfer learning)',
  classes: 'โรคไหม้ · โรคขอบใบแห้ง · โรคใบสีส้ม · ใบปกติ · โรคอื่น',
  accuracy: '96.85%',
  macroF1: '0.971',
  threshold: 60,
  testImages: 761,
  file: '/models/rice-v3.onnx',
  sizeMb: 8.2, // rice-v3.onnx on disk (Content-Length is the gzip size, so it is not used)
  runtimes: 'TensorFlow Lite (แอป) · ONNX Runtime Web (เว็บ)',
};

const timed = async (fn) => {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
};

export async function checkFirestore() {
  try {
    const { ms } = await timed(() => getDocs(query(collection(db, 'diagnoses'), limit(1))));
    return { state: 'online', ms };
  } catch {
    return { state: 'offline' };
  }
}

export async function checkModel() {
  try {
    const { value: res, ms } = await timed(() => fetch(MODEL.file, { method: 'HEAD', cache: 'no-store' }));
    if (!res.ok) return { state: 'offline' };
    return { state: 'online', ms, sizeMb: MODEL.sizeMb };
  } catch {
    return { state: 'offline' };
  }
}

export async function checkAppRelease() {
  try {
    const res = await fetch('/downloads/rice-ai-beta.json', { cache: 'no-cache' });
    if (!res.ok) return { state: 'offline' };
    const j = await res.json();
    return { state: 'online', version: j.version, released: j.released };
  } catch {
    return { state: 'offline' };
  }
}
