// Handoff 4.3, 4.4, 4.5, 30 — Image intake, AI classification, GPS + history.
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../db/db');
const { newId } = require('../services/id');
const { authRequired } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { audit } = require('../services/audit');
const { predict, getAiStatus, CLASSES } = require('../services/aiClient');
const { computeRiskLevel } = require('../services/riskConfig');

const router = express.Router();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — handoff 4.3 "ควรตรวจขนาดไฟล์"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function provinceFromLatLng(lat, lng) {
  // Reference implementation: without a real reverse-geocoder/GeoJSON
  // point-in-polygon lookup wired to a geocoding provider, we deterministically
  // bucket coordinates to a province from the seeded 77-province list so the
  // rest of the pipeline (outbreak aggregation, risk map) has real-looking
  // data to work with. Replace with true point-in-polygon lookup against
  // boundaries.geo_data in production (handoff section 8/11 GIS integration).
  const provinces = db.prepare('SELECT province FROM boundaries ORDER BY province').all();
  if (!provinces.length || lat == null || lng == null) return null;
  const idx = Math.abs(Math.round((lat * 1000 + lng * 1000))) % provinces.length;
  return provinces[idx].province;
}

function bumpStatistics(province, disease_id) {
  if (!province) return;
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const existing = db.prepare(`
    SELECT * FROM statistics WHERE province = ? AND disease_id = ? AND period = ?
  `).get(province, disease_id, period);
  if (existing) {
    const total = existing.total_cases + 1;
    db.prepare(`UPDATE statistics SET total_cases = ?, risk_level = ?, last_update = datetime('now') WHERE stat_id = ?`)
      .run(total, computeRiskLevel(total), existing.stat_id);
  } else {
    db.prepare(`
      INSERT INTO statistics (stat_id, province, disease_id, period, total_cases, risk_level, last_update)
      VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
    `).run(newId(), province, disease_id, period, computeRiskLevel(1));
  }
}

// POST /diagnosis/predict
// Handoff section 30 — request: image + optional GPS + authenticated context.
router.post('/diagnosis/predict', authRequired, upload.single('image'), async (req, res) => {
  const startedAt = Date.now();

  // --- Input validation (handoff 4.3) ---
  if (!req.file) {
    return res.status(400).json({ error: 'no_image', message: 'Image file is required (field name: image)' });
  }
  if (!ALLOWED_MIME.has(req.file.mimetype)) {
    return res.status(415).json({ error: 'unsupported_file_type', message: 'Only JPEG, PNG, or WEBP images are supported' });
  }

  const { latitude, longitude, place_name } = req.body || {};
  const lat = latitude !== undefined ? parseFloat(latitude) : null;
  const lng = longitude !== undefined ? parseFloat(longitude) : null;

  // (No local SQLite DB or disk writes here in Firebase mode)

  // --- AI inference (handoff 4.4, architecture = server-side FastAPI) ---
  let result;
  try {
    result = await predict(req.file.buffer, req.file.mimetype);
  } catch (e) {
    if (e.isNotALeaf) {
      return res.status(400).json({ error: e.aiError || 'not_a_leaf', message: e.message });
    }
    audit({ userId: req.user.user_id, activity: 'ai_inference_error', severity: 'critical', metadata: { message: e.message } });
    return res.status(502).json({ error: 'ai_service_error', message: 'Unable to classify image at this time' });
  }

  const disease = db.prepare('SELECT * FROM encyclopedia WHERE disease_code = ?').get(result.class_code);
  if (!disease) {
    return res.status(500).json({ error: 'unknown_class', message: `AI returned unmapped class ${result.class_code}` });
  }
  const advice = db.prepare('SELECT * FROM advice WHERE disease_id = ?').all(disease.disease_id);

  // --- Return result to Mobile App (Mobile will save to Firebase) ---
  audit({
    userId: req.user.user_id,
    activity: 'ai_inference_success',
    metadata: { disease_code: disease.disease_code, confidence: result.confidence },
  });

  const elapsedMs = Date.now() - startedAt;

  // Compress image to ensure it fits in Firestore's 1MB document limit
  const compressedBuffer = await sharp(req.file.buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();
  
  const compressedBase64 = compressedBuffer.toString('base64');

  res.status(200).json({
    compressed_base64: compressedBase64,
    disease_id: disease.disease_id,
    disease_name: disease.disease_name,
    disease_code: disease.disease_code,
    confidence: result.confidence,
    diagnosis_date: new Date().toISOString(),
    location: (lat != null && lng != null) ? { latitude: lat, longitude: lng, place_name: place_name || null, province: provinceFromLatLng(lat, lng) } : null,
    symptoms: disease.symptoms,
    cause: disease.cause,
    advice,
    disclaimer: 'ผลจาก AI เป็นเพียงเครื่องมือสนับสนุนการตัดสินใจเบื้องต้น ควรปรึกษาผู้เชี่ยวชาญด้านการเกษตรก่อนตัดสินใจใช้สารเคมีหรือวิธีรักษาใด ๆ',
    ai_source: result.source,
    ai_warning: result.warning || null,
    elapsed_ms: elapsedMs,
  });
});

// (Legacy endpoints /diagnosis/me and /diagnosis/:id removed - Mobile app now uses Firebase Firestore directly)

// GET /admin/diagnoses — Admin "All Reports" (handoff 4.10)
router.get('/admin/diagnoses', authRequired, requireRole('admin'), (req, res) => {
  const { disease_code, province, q, page = 1, page_size = 20 } = req.query;
  const clauses = [];
  const params = [];
  if (disease_code) { clauses.push('e.disease_code = ?'); params.push(disease_code); }
  if (province) { clauses.push('l.province = ?'); params.push(province); }
  if (q) { clauses.push('(u.username LIKE ? OR u.full_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(parseInt(page_size, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const rows = db.prepare(`
    SELECT d.diag_id, d.confidence, d.diag_date, e.disease_name, e.disease_code,
           u.username, u.full_name, i.file_path, l.province, l.latitude, l.longitude
    FROM diagnosis d
    JOIN encyclopedia e ON e.disease_id = d.disease_id
    JOIN users u ON u.user_id = d.user_id
    JOIN images i ON i.image_id = d.image_id
    LEFT JOIN locations l ON l.location_id = d.location_id
    ${where}
    ORDER BY d.diag_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM diagnosis d
    JOIN encyclopedia e ON e.disease_id = d.disease_id
    JOIN users u ON u.user_id = d.user_id
    LEFT JOIN locations l ON l.location_id = d.location_id
    ${where}
  `).get(...params).c;

  audit({ userId: req.user.user_id, activity: 'admin_view_all_reports' });
  res.json({ reports: rows, page: Number(page), page_size: limit, total });
});

// GET /ai-status
router.get('/ai-status', async (req, res) => {
  const status = await getAiStatus();
  res.json(status);
});

module.exports = router;
