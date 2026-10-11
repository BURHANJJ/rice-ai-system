// Handoff 4.9 — Data Explorer / Export for research (Researcher role, approved + 2FA).
const express = require('express');
const db = require('../db/db');
const { newId } = require('../services/id');
const { authRequired } = require('../middleware/auth');
const { requireApprovedResearcher } = require('../middleware/rbac');
const { audit } = require('../services/audit');
const { anonymizeDiagnosisRow } = require('../services/anonymize');

const router = express.Router();

function queryDiagnoses({ disease_code, province, region, date_from, date_to, page = 1, page_size = 50 }) {
  const clauses = [];
  const params = [];
  if (disease_code) { clauses.push('e.disease_code = ?'); params.push(disease_code); }
  if (province) { clauses.push('l.province = ?'); params.push(province); }
  if (region) { clauses.push('b.region = ?'); params.push(region); }
  if (date_from) { clauses.push('d.diag_date >= ?'); params.push(date_from); }
  if (date_to) { clauses.push('d.diag_date <= ?'); params.push(date_to); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(parseInt(page_size, 10) || 50, 500);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const rows = db.prepare(`
    SELECT d.diag_id, d.confidence, d.diag_date, e.disease_name, e.disease_code,
           l.province, b.region
    FROM diagnosis d
    JOIN encyclopedia e ON e.disease_id = d.disease_id
    LEFT JOIN locations l ON l.location_id = d.location_id
    LEFT JOIN boundaries b ON b.province = l.province
    ${where}
    ORDER BY d.diag_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) AS c
    FROM diagnosis d
    JOIN encyclopedia e ON e.disease_id = d.disease_id
    LEFT JOIN locations l ON l.location_id = d.location_id
    LEFT JOIN boundaries b ON b.province = l.province
    ${where}
  `).get(...params).c;

  return { rows, total, limit, offsetPage: Math.max(parseInt(page, 10) || 1, 1) };
}

// GET /research/data — Data Explorer (already anonymized at the API boundary;
// this endpoint never returns username/full_name/email/user_id/exact GPS).
router.get('/research/data', authRequired, requireApprovedResearcher, (req, res) => {
  const { rows, total, limit, offsetPage } = queryDiagnoses(req.query);
  const anonymized = rows.map(anonymizeDiagnosisRow);
  res.json({ data: anonymized, page: offsetPage, page_size: limit, total });
});

// POST /research/export — CSV or JSON (handoff 37.1 decision: CSV/JSON, not PDF/Excel)
router.post('/research/export', authRequired, requireApprovedResearcher, (req, res) => {
  const { file_type = 'json', filters = {} } = req.body || {};
  if (!['csv', 'json'].includes(file_type)) {
    return res.status(400).json({ error: 'validation_error', message: 'file_type must be csv or json' });
  }
  const { rows, total } = queryDiagnoses({ ...filters, page: 1, page_size: 5000 });
  const anonymized = rows.map(anonymizeDiagnosisRow);

  const export_id = newId();
  db.prepare(`
    INSERT INTO exports (export_id, user_id, file_type, row_count, filters, export_date)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(export_id, req.user.user_id, file_type, anonymized.length, JSON.stringify(filters));

  audit({
    userId: req.user.user_id,
    activity: 'research_export',
    metadata: { export_id, file_type, row_count: anonymized.length, filters },
  });

  if (file_type === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="rice_ai_export_${export_id}.json"`);
    return res.json({ export_id, generated_at: new Date().toISOString(), anonymization: 'applied', rows: anonymized });
  }

  // CSV
  const headers = anonymized.length ? Object.keys(anonymized[0]) : ['diagnosis_ref', 'disease_name', 'disease_code', 'confidence', 'province', 'region', 'period'];
  const csvLines = [headers.join(',')];
  for (const row of anonymized) {
    csvLines.push(headers.map(h => csvEscape(row[h])).join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="rice_ai_export_${export_id}.csv"`);
  res.send(csvLines.join('\n'));
});

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /research/exports — export history for the current researcher (traceability)
router.get('/research/exports', authRequired, requireApprovedResearcher, (req, res) => {
  const rows = db.prepare('SELECT * FROM exports WHERE user_id = ? ORDER BY export_date DESC').all(req.user.user_id);
  res.json({ exports: rows });
});

module.exports = router;
