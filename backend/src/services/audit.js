// D11 logs — Audit/Security log writer.
// Handoff 4.11: every log must connect user + activity + timestamp.
// We also record severity/metadata (not in the literal Data Dictionary,
// documented as an ADDITION in schema.sql) so a real Security Logs screen
// is usable, without dropping the required minimum fields.
const db = require('../db/db');
const { newId } = require('./id');

function audit({ userId = null, activity, severity = 'info', metadata = null }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO logs (log_id, user_id, activity, severity, metadata, log_time)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(newId(), userId, activity, severity, metadata ? JSON.stringify(metadata) : null);
  } catch (err) {
    console.error('[Audit Warning] Could not save audit log (likely foreign key constraint for Firebase UID):', err.message);
  }
}

module.exports = { audit };
