// Handoff 4.6 — Rice Disease Wiki + treatment advice.
// Read: all roles. Write (CRUD): admin only (handoff role matrix section 5).
const express = require('express');
const db = require('../db/db');
const { newId } = require('../services/id');
const { authRequired } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { audit } = require('../services/audit');

const router = express.Router();

// GET /diseases
router.get('/diseases', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare('SELECT * FROM encyclopedia WHERE disease_name LIKE ? ORDER BY disease_name').all(`%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM encyclopedia ORDER BY disease_name').all();
  }
  res.json({ diseases: rows });
});

// GET /diseases/:id
router.get('/diseases/:id', (req, res) => {
  const disease = db.prepare('SELECT * FROM encyclopedia WHERE disease_id = ?').get(req.params.id);
  if (!disease) return res.status(404).json({ error: 'not_found' });
  const advice = db.prepare('SELECT * FROM advice WHERE disease_id = ?').all(req.params.id);
  res.json({ disease, advice });
});

// --- Admin CRUD: diseases ---------------------------------------------

router.post('/admin/diseases', authRequired, requireRole('admin'), (req, res) => {
  const { disease_name, disease_code, symptoms, cause } = req.body || {};
  if (!disease_name || !disease_code) {
    return res.status(400).json({ error: 'validation_error', message: 'disease_name and disease_code are required' });
  }
  const disease_id = newId();
  db.prepare(`
    INSERT INTO encyclopedia (disease_id, disease_name, disease_code, symptoms, cause)
    VALUES (?, ?, ?, ?, ?)
  `).run(disease_id, disease_name, disease_code, symptoms || null, cause || null);
  audit({ userId: req.user.user_id, activity: 'wiki_disease_create', metadata: { disease_id } });
  res.status(201).json({ disease: db.prepare('SELECT * FROM encyclopedia WHERE disease_id = ?').get(disease_id) });
});

router.patch('/admin/diseases/:id', authRequired, requireRole('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM encyclopedia WHERE disease_id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'not_found' });
  const { disease_name, symptoms, cause } = req.body || {};
  db.prepare(`
    UPDATE encyclopedia SET disease_name = ?, symptoms = ?, cause = ?, updated_at = datetime('now')
    WHERE disease_id = ?
  `).run(disease_name ?? current.disease_name, symptoms ?? current.symptoms, cause ?? current.cause, req.params.id);
  audit({ userId: req.user.user_id, activity: 'wiki_disease_update', metadata: { disease_id: req.params.id } });
  res.json({ disease: db.prepare('SELECT * FROM encyclopedia WHERE disease_id = ?').get(req.params.id) });
});

router.delete('/admin/diseases/:id', authRequired, requireRole('admin'), (req, res) => {
  // Guard: the 4 canonical classes should not be deletable without also
  // updating the AI class mapping — handoff 38 "ห้ามเพิ่ม disease class เกิน 4".
  const CANONICAL = new Set(['BLAST', 'BLB', 'TUNGRO', 'HEALTHY']);
  const disease = db.prepare('SELECT * FROM encyclopedia WHERE disease_id = ?').get(req.params.id);
  if (!disease) return res.status(404).json({ error: 'not_found' });
  if (CANONICAL.has(disease.disease_code)) {
    return res.status(409).json({
      error: 'protected_class',
      message: 'This disease corresponds to one of the 4 canonical AI classes and cannot be deleted without a documented scope change.',
    });
  }
  db.prepare('DELETE FROM encyclopedia WHERE disease_id = ?').run(req.params.id);
  audit({ userId: req.user.user_id, activity: 'wiki_disease_delete', severity: 'warning', metadata: { disease_id: req.params.id } });
  res.status(204).end();
});

// --- Admin CRUD: advice --------------------------------------------------

router.post('/admin/advice', authRequired, requireRole('admin'), (req, res) => {
  const { disease_id, treatment, chemical_name, dosage } = req.body || {};
  if (!disease_id || !treatment) return res.status(400).json({ error: 'validation_error' });
  const advice_id = newId();
  db.prepare(`
    INSERT INTO advice (advice_id, disease_id, treatment, chemical_name, dosage)
    VALUES (?, ?, ?, ?, ?)
  `).run(advice_id, disease_id, treatment, chemical_name || null, dosage || null);
  audit({ userId: req.user.user_id, activity: 'wiki_advice_create', metadata: { advice_id, disease_id } });
  res.status(201).json({ advice: db.prepare('SELECT * FROM advice WHERE advice_id = ?').get(advice_id) });
});

router.patch('/admin/advice/:id', authRequired, requireRole('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM advice WHERE advice_id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'not_found' });
  const { treatment, chemical_name, dosage } = req.body || {};
  db.prepare(`
    UPDATE advice SET treatment = ?, chemical_name = ?, dosage = ? WHERE advice_id = ?
  `).run(treatment ?? current.treatment, chemical_name ?? current.chemical_name, dosage ?? current.dosage, req.params.id);
  audit({ userId: req.user.user_id, activity: 'wiki_advice_update', metadata: { advice_id: req.params.id } });
  res.json({ advice: db.prepare('SELECT * FROM advice WHERE advice_id = ?').get(req.params.id) });
});

router.delete('/admin/advice/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM advice WHERE advice_id = ?').run(req.params.id);
  audit({ userId: req.user.user_id, activity: 'wiki_advice_delete', severity: 'warning', metadata: { advice_id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
