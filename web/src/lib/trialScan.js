// Free trial scan on the website: the app's V3 model (exported to ONNX, half-size weights) runs in
// the visitor's browser with onnxruntime-web, so the photo never leaves their device and no server
// is needed. Same input contract and confidence cut-off as the app (offline_classifier.dart).
//
// Daily allowance: 5 successful results per browser per day (Thai time). Unclear photos, "other
// disease" answers and errors are not counted. The count lives in this browser's storage, so it is
// a fair-use limit for a free trial, not a security boundary.

const MODEL_URL = '/models/rice-v3.onnx';
const ORT_VERSION = '1.22.0'; // keep in step with package.json
const SIZE = 224;
export const LABELS = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY', 'OTHER'];
export const MIN_CONFIDENCE = 60; // model_config.json "min_confidence"
export const DAILY_LIMIT = 5;

// ---- model ------------------------------------------------------------------------------------

let sessionPromise = null;

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/** Loads the runtime and model once per page visit; onProgress(0..1) follows the model download. */
export function loadModel(onProgress) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
      ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      const bytes = await fetchWithProgress(MODEL_URL, onProgress);
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session };
    })().catch((e) => { sessionPromise = null; throw e; });
  }
  return sessionPromise;
}

// ---- image ------------------------------------------------------------------------------------

/** RGB squashed to 224x224, raw 0-255 floats, NHWC — exactly what the app feeds the model. */
async function toInput(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw Object.assign(new Error('unreadable image'), { code: 'bad_image' });
  }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close?.();
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const input = new Float32Array(SIZE * SIZE * 3);
  for (let i = 0, k = 0; i < data.length; i += 4) {
    input[k++] = data[i];
    input[k++] = data[i + 1];
    input[k++] = data[i + 2];
  }
  return input;
}

/**
 * Classifies a photo. Resolves to
 *   { status: 'ok', code, confidence, probs }       a diagnosis (counts toward the allowance)
 *   { status: 'unclear' | 'other', code, confidence, probs }   not counted
 * and throws (err.code = 'bad_image' | 'model') when it can't run at all.
 */
export async function classify(file, onProgress) {
  if (!file?.type?.startsWith('image/')) throw Object.assign(new Error('not an image'), { code: 'bad_image' });
  let ort; let session;
  try {
    ({ ort, session } = await loadModel(onProgress));
  } catch (e) {
    throw Object.assign(e, { code: 'model' });
  }
  const input = await toInput(file);
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, SIZE, SIZE, 3]) };
  const out = await session.run(feeds);
  const probs = Array.from(out[session.outputNames[0]].data);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  const code = LABELS[best];
  const confidence = Math.round(probs[best] * 1000) / 10;
  const status = confidence < MIN_CONFIDENCE ? 'unclear' : code === 'OTHER' ? 'other' : 'ok';
  return { status, code, confidence, probs };
}

// ---- daily allowance --------------------------------------------------------------------------

const KEY = 'riceai-trial-v1';
const bangkokDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && v.day === bangkokDay() && Number.isInteger(v.used)) return v;
  } catch { /* storage blocked or corrupt: start fresh */ }
  return { day: bangkokDay(), used: 0 };
}

export function quota() {
  const { used } = read();
  return { used, left: Math.max(0, DAILY_LIMIT - used), limit: DAILY_LIMIT };
}

/** Records one successful result; returns the new quota. */
export function spend() {
  const v = read();
  v.used = Math.min(DAILY_LIMIT, v.used + 1);
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: allowance just resets */ }
  return quota();
}

/** Milliseconds until midnight in Thailand (UTC+7, no daylight saving), when the allowance resets. */
export function msUntilReset(now = Date.now()) {
  const bkk = now + 7 * 3600e3;
  const nextMidnight = Math.floor(bkk / 86400e3 + 1) * 86400e3;
  return nextMidnight - bkk;
}
