// Handoff section 21 — Architecture decision LOCKED for this implementation:
// "Option A: Server-side inference" — Flutter/Web -> FastAPI -> model -> JSON.
// TFLite stays a documented future deployment option (mobile/offline), not
// built here, per handoff 37.3.
//
// This client calls the ai-service (FastAPI, see /ai-service). If the
// service is unreachable (e.g. running the Node backend standalone for a
// demo), it falls back to an explicitly-labeled local mock so the rest of
// the product (history, wiki linking, GPS, statistics) can still be
// exercised end-to-end. The mock must never be mistaken for the real
// 97.4%-accuracy model target in section 3 of the handoff.

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const CLASSES = [
  { code: 'BLAST', name_th: 'โรคไหม้ (Rice Blast)' },
  { code: 'BLB', name_th: 'โรคขอบใบแห้ง (Bacterial Leaf Blight)' },
  { code: 'TUNGRO', name_th: 'โรคใบสีส้ม (Rice Tungro Virus)' },
  { code: 'HEALTHY', name_th: 'ใบข้าวปกติ (Healthy Rice Leaf)' },
];

async function predict(imageBuffer, mimeType) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500); // keep well under the 5s target in section 3
    const res = await fetch(`${AI_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Mime-Type': mimeType },
      body: imageBuffer,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Unclear photo, not a rice leaf (confidence below 75%) or a leaf problem outside the four
      // supported classes (out_of_scope, model v3+): tell the user why, not that the AI is down.
      if (res.status === 400 && ['not_a_leaf', 'low_confidence', 'out_of_scope'].includes(data.error)) {
        const err = new Error(data.message || 'not_a_leaf');
        err.isNotALeaf = true;
        err.aiError = data.error;
        throw err;
      }
      throw new Error(data.message || `ai-service responded ${res.status}`);
    }
    const data = await res.json();
    return { ...data, source: 'ai-service' };
  } catch (err) {
    if (err.isNotALeaf) {
      throw err;
    }
    throw new Error('AI Service Unavailable: ' + err.message);
  }
}

async function getAiStatus() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${AI_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`ai-service responded ${res.status}`);
    const data = await res.json();
    const isOnline = data.model_status === 'trained_model_loaded';
    return {
      status: isOnline ? 'online' : 'offline',
      model_status: data.model_status,
      // measured accuracy on the held-out test set (ai-service/model/metrics.json), not a hard-coded target
      accuracy: isOnline && typeof data.test_accuracy === 'number' ? `${(data.test_accuracy * 100).toFixed(1)}%` : 'N/A',
      model_version: data.model_version || null,
      is_placeholder: !isOnline
    };
  } catch (err) {
    return {
      status: 'offline',
      model_status: 'unreachable',
      accuracy: 'N/A',
      is_placeholder: true
    };
  }
}

module.exports = { predict, getAiStatus, CLASSES };
