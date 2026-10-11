// Handoff 4.1, 4.2, 18, 22, 23, 24, 25 — Account/Access, Profile/Settings,
// Researcher application lifecycle, 2FA.
const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const db = require('../db/db');
const { newId } = require('../services/id');
const { authRequired, signToken } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

function publicUser(u) {
  return {
    user_id: u.user_id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    status: u.status,
    institution: u.institution || null,
    access_purpose: u.access_purpose || null,
    totp_enabled: !!u.totp_enabled,
  };
}

// POST /auth/register
// Handoff 17 Authentication: username, email, password, confirm password.
// Public registration always creates a FARMER account. Researcher accounts
// go through /researcher/apply instead (handoff 4.1 + section 18) — this is
// intentional: "ห้ามข้าม researcher approval".
router.post('/auth/register', (req, res) => {
  const { username, email, password, confirm_password, full_name } = req.body || {};
  if (!username || !email || !password || !confirm_password || !full_name) {
    return res.status(400).json({ error: 'validation_error', message: 'username, email, full_name, password, confirm_password are required' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'password_mismatch', message: 'Password and confirm password do not match' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters' });
  }
  const existing = db.prepare('SELECT user_id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    return res.status(409).json({ error: 'user_exists', message: 'Username or email already registered' });
  }

  const user_id = newId();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, full_name, email, role, status)
    VALUES (?, ?, ?, ?, ?, 'farmer', 'active')
  `).run(user_id, username, password_hash, full_name, email);
  db.prepare(`INSERT INTO settings (setting_id, user_id) VALUES (?, ?)`).run(newId(), user_id);

  audit({ userId: user_id, activity: 'register', metadata: { role: 'farmer' } });

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(user_id);
  const token = signToken({ user_id, role: 'farmer', status: 'active', twofa_verified: true });
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /researcher/apply
// Handoff section 18 Public/Auth "Request Registration": full name,
// institutional email, institution, access purpose.
router.post('/researcher/apply', (req, res) => {
  const { username, email, password, confirm_password, full_name, institution, access_purpose } = req.body || {};
  if (!username || !email || !password || !confirm_password || !full_name || !institution || !access_purpose) {
    return res.status(400).json({ error: 'validation_error', message: 'All researcher application fields are required' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'password_mismatch' });
  }
  const existing = db.prepare('SELECT user_id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) return res.status(409).json({ error: 'user_exists' });

  const user_id = newId();
  const password_hash = bcrypt.hashSync(password, 10);
  const totp_secret = authenticator.generateSecret();
  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, full_name, email, role, status, institution, access_purpose, totp_secret)
    VALUES (?, ?, ?, ?, ?, 'researcher', 'pending', ?, ?, ?)
  `).run(user_id, username, password_hash, full_name, email, institution, access_purpose, totp_secret);
  db.prepare(`INSERT INTO settings (setting_id, user_id) VALUES (?, ?)`).run(newId(), user_id);

  audit({ userId: user_id, activity: 'researcher_apply', metadata: { institution } });

  res.status(201).json({
    message: 'Application submitted. Status: pending admin approval.',
    status: 'pending',
    // Returned once so the researcher can set up an authenticator app ahead of approval.
    // In production this would be delivered via a secure enrollment flow, not a raw API response.
    totp_setup: { secret: totp_secret, issuer: 'RiceAI', account: email },
  });
});

// GET /researcher/application/status
router.get('/researcher/application/status', authRequired, (req, res) => {
  const u = db.prepare('SELECT status FROM users WHERE user_id = ? AND role = ?').get(req.user.user_id, 'researcher');
  if (!u) return res.status(404).json({ error: 'not_a_researcher' });
  res.json({ status: u.status });
});

// POST /auth/login
router.post('/auth/login', (req, res) => {
  const { username_or_email, password } = req.body || {};
  if (!username_or_email || !password) {
    return res.status(400).json({ error: 'validation_error', message: 'username_or_email and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(username_or_email, username_or_email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    audit({ activity: 'login_failed', severity: 'warning', metadata: { attempted: username_or_email } });
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  if (user.status === 'suspended' || user.status === 'rejected') {
    audit({ userId: user.user_id, activity: 'login_blocked_status', severity: 'warning', metadata: { status: user.status } });
    return res.status(403).json({ error: 'account_' + user.status });
  }
  if (user.role === 'researcher' && user.status === 'pending') {
    audit({ userId: user.user_id, activity: 'login_blocked_pending_approval', severity: 'info' });
    return res.status(403).json({ error: 'researcher_not_approved', message: 'Your researcher application is still pending admin approval' });
  }

  // Handoff 25 — 2FA required for researcher role before privileged access.
  const needs2fa = user.role === 'researcher';
  const token = signToken({
    user_id: user.user_id,
    role: user.role,
    status: user.status,
    twofa_verified: !needs2fa, // farmer/admin: true by default (2FA not in scope for them per handoff 25)
  });

  audit({ userId: user.user_id, activity: 'login', metadata: { needs2fa } });
  res.json({ token, user: publicUser(user), requires_2fa: needs2fa });
});

// POST /researcher/2fa/verify
// Handoff section 25: after email/password, a second factor is required
// before the session gets researcher-privileged access. Uses TOTP (RFC 6238).
router.post('/researcher/2fa/verify', authRequired, (req, res) => {
  const { code } = req.body || {};
  if (req.user.role !== 'researcher') {
    return res.status(400).json({ error: 'not_applicable', message: '2FA verification is only required for researcher accounts' });
  }
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id);
  if (!user || !user.totp_secret) return res.status(400).json({ error: 'no_totp_secret' });

  const valid = authenticator.check(String(code || ''), user.totp_secret);
  if (!valid) {
    audit({ userId: user.user_id, activity: '2fa_failed', severity: 'warning' });
    return res.status(401).json({ error: 'invalid_code' });
  }
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE user_id = ?').run(user.user_id);
  audit({ userId: user.user_id, activity: '2fa_success' });

  const token = signToken({ user_id: user.user_id, role: user.role, status: user.status, twofa_verified: true });
  res.json({ token, message: '2FA verified; researcher-privileged access granted for this session' });
});

// GET /me
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user: publicUser(user) });
});

// PATCH /me
router.patch('/me', authRequired, (req, res) => {
  const { full_name } = req.body || {};
  if (full_name) {
    db.prepare('UPDATE users SET full_name = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(full_name, req.user.user_id);
  }
  audit({ userId: req.user.user_id, activity: 'profile_edit' });
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id);
  res.json({ user: publicUser(user) });
});

// GET /me/settings
router.get('/me/settings', authRequired, (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.user_id);
  res.json({ settings: s });
});

// PATCH /me/settings — theme / language / notification (handoff D2)
router.patch('/me/settings', authRequired, (req, res) => {
  const { theme, language, notification } = req.body || {};
  const current = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.user_id);
  db.prepare(`
    UPDATE settings SET theme = ?, language = ?, notification = ? WHERE user_id = ?
  `).run(theme ?? current.theme, language ?? current.language, notification ?? current.notification, req.user.user_id);
  audit({ userId: req.user.user_id, activity: 'settings_update' });
  res.json({ settings: db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.user_id) });
});

module.exports = router;
