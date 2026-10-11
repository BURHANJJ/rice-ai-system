// Handoff 4.2 (admin user mgmt), 4.10 (dashboard/reports/live feed), 4.11 (audit).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { authRequired } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { audit } = require('../services/audit');

const router = express.Router();

// GET /admin/dashboard — summary cards, user/system metrics, model metrics,
// disease distribution, outbreak overview (handoff section 19/4.10).
router.get('/admin/dashboard', authRequired, requireRole('admin'), (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const usersByRole = db.prepare('SELECT role, COUNT(*) c FROM users GROUP BY role').all();
  const pendingResearchers = db.prepare("SELECT COUNT(*) c FROM users WHERE role='researcher' AND status='pending'").get().c;
  const totalDiagnoses = db.prepare('SELECT COUNT(*) c FROM diagnosis').get().c;
  const diseaseDistribution = db.prepare(`
    SELECT e.disease_name, e.disease_code, COUNT(*) c
    FROM diagnosis d JOIN encyclopedia e ON e.disease_id = d.disease_id
    GROUP BY e.disease_name, e.disease_code
  `).all();
  const provincesCovered = db.prepare('SELECT COUNT(*) c FROM boundaries').get().c;
  const avgConfidence = db.prepare('SELECT AVG(confidence) a FROM diagnosis').get().a;
  const last7days = db.prepare(`
    SELECT date(diag_date) AS day, COUNT(*) c
    FROM diagnosis
    WHERE diag_date >= datetime('now', '-7 days')
    GROUP BY date(diag_date)
    ORDER BY day
  `).all();

  audit({ userId: req.user.user_id, activity: 'admin_view_dashboard' });

  res.json({
    summary_cards: {
      total_users: totalUsers,
      total_diagnoses: totalDiagnoses,
      pending_researcher_approvals: pendingResearchers,
      provinces_covered: provincesCovered, // target: 77
      provinces_target: 77,
      // Section 3 model target — NOT the live accuracy of the mock/demo
      // classifier bundled here; see docs/ASSUMPTIONS_AND_TODOS.md.
      model_accuracy_target_pct: 97.4,
      avg_confidence_observed_pct: avgConfidence ? Math.round(avgConfidence * 100) / 100 : null,
      latency_target_seconds: 5,
    },
    users_by_role: usersByRole,
    disease_distribution: diseaseDistribution,
    diagnoses_last_7_days: last7days,
  });
});

// GET /admin/live-feed — most recent diagnoses stream
router.get('/admin/live-feed', authRequired, requireRole('admin'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200); // Increased limit for gallery
  const rows = db.prepare(`
    SELECT d.diag_id, d.confidence, d.diag_date, e.disease_name, e.disease_code,
           u.username, l.province, i.file_path as image_url
    FROM diagnosis d
    JOIN encyclopedia e ON e.disease_id = d.disease_id
    JOIN users u ON u.user_id = d.user_id
    JOIN images i ON d.image_id = i.image_id
    LEFT JOIN locations l ON l.location_id = d.location_id
    ORDER BY d.diag_date DESC
    LIMIT ?
  `).all(limit);
  res.json({ feed: rows });
});

// GET /admin/users — list + search/filter
router.get('/admin/users', authRequired, requireRole('admin'), (req, res) => {
  const { role, status, q } = req.query;
  const clauses = [];
  const params = [];
  if (role) { clauses.push('role = ?'); params.push(role); }
  if (status) { clauses.push('status = ?'); params.push(status); }
  if (q) { clauses.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT user_id, username, full_name, email, role, status, institution, access_purpose, created_at
    FROM users ${where} ORDER BY created_at DESC
  `).all(...params);
  res.json({ users: rows });
});

// POST /admin/users — create user (any role) by admin
router.post('/admin/users', authRequired, requireRole('admin'), (req, res) => {
  const { username, email, password, full_name, role } = req.body || {};
  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'validation_error' });
  }
  if (!['farmer', 'researcher', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  const { newId } = require('../services/id');
  const user_id = newId();
  const password_hash = bcrypt.hashSync(password, 10);
  const status = role === 'researcher' ? 'active' : 'active'; // admin-created researcher accounts are pre-approved
  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, full_name, email, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, username, password_hash, full_name, email, role, status);
  db.prepare('INSERT INTO settings (setting_id, user_id) VALUES (?, ?)').run(newId(), user_id);
  audit({ userId: req.user.user_id, activity: 'admin_create_user', metadata: { created_user_id: user_id, role } });
  res.status(201).json({ user_id });
});

// PATCH /admin/users/:id — edit role/profile fields
router.patch('/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { full_name, role } = req.body || {};
  db.prepare(`
    UPDATE users SET full_name = ?, role = ?, updated_at = datetime('now') WHERE user_id = ?
  `).run(full_name ?? user.full_name, role ?? user.role, req.params.id);
  audit({ userId: req.user.user_id, activity: 'admin_edit_user', metadata: { target_user_id: req.params.id } });
  res.json({ user: db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.id) });
});

// POST /admin/researchers/:id/approve
router.post('/admin/researchers/:id/approve', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ? AND role = 'researcher'").get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE user_id = ?").run(req.params.id);
  audit({ userId: req.user.user_id, activity: 'researcher_approved', metadata: { target_user_id: req.params.id } });
  res.json({ status: 'active' });
});

router.post('/admin/researchers/:id/reject', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ? AND role = 'researcher'").get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE users SET status = 'rejected', updated_at = datetime('now') WHERE user_id = ?").run(req.params.id);
  audit({ userId: req.user.user_id, activity: 'researcher_rejected', severity: 'warning', metadata: { target_user_id: req.params.id } });
  res.json({ status: 'rejected' });
});

// POST /admin/users/:id/suspend
router.post('/admin/users/:id/suspend', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE users SET status = 'suspended', updated_at = datetime('now') WHERE user_id = ?").run(req.params.id);
  audit({ userId: req.user.user_id, activity: 'user_suspended', severity: 'warning', metadata: { target_user_id: req.params.id } });
  res.json({ status: 'suspended' });
});

// POST /admin/users/:id/reactivate
router.post('/admin/users/:id/reactivate', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE user_id = ?").run(req.params.id);
  audit({ userId: req.user.user_id, activity: 'user_reactivated', metadata: { target_user_id: req.params.id } });
  res.json({ status: 'active' });
});

// GET /admin/audit-logs — Security/Audit (handoff 4.11)
router.get('/admin/audit-logs', authRequired, requireRole('admin'), (req, res) => {
  const { user_id, activity, severity, page = 1, page_size = 50 } = req.query;
  const clauses = [];
  const params = [];
  if (user_id) { clauses.push('l.user_id = ?'); params.push(user_id); }
  if (activity) { clauses.push('l.activity LIKE ?'); params.push(`%${activity}%`); }
  if (severity) { clauses.push('l.severity = ?'); params.push(severity); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(parseInt(page_size, 10) || 50, 200);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
  const rows = db.prepare(`
    SELECT l.log_id, l.user_id, u.username, l.activity, l.severity, l.metadata, l.log_time
    FROM logs l
    LEFT JOIN users u ON u.user_id = l.user_id
    ${where}
    ORDER BY l.log_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  res.json({ logs: rows, page: Number(page), page_size: limit });
});

module.exports = router;
