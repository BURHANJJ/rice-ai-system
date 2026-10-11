// Handoff section 23 — RBAC must be enforced at the backend layer, not just
// hidden in the UI. This middleware verifies the caller's Firebase ID token
// (sent by the mobile app and the web portal) and attaches req.user.
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Verifying ID tokens only needs the project ID: firebase-admin checks the
// token's signature against Google's public keys, no service account required.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'rice-ai-appp';
if (!admin.apps.length) admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-prod';
// Locally signed JWTs belong to the old SQLite login flow. Off unless asked for,
// so a forged token signed with the default secret is never accepted.
const ALLOW_LEGACY_JWT = process.env.ALLOW_LEGACY_JWT === '1';

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function resolveUser(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      user_id: decoded.uid,
      email: decoded.email,
      role: decoded.role || 'farmer', // custom claim if set; roles live in Firestore users/{uid}
      status: 'active',
      twofa_verified: true,
    };
  } catch (e) {
    if (!ALLOW_LEGACY_JWT) return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET); // { user_id, role, status, twofa_verified }
  } catch (e) {
    return null;
  }
}

async function authRequired(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'unauthenticated', message: 'Missing bearer token' });
  const user = await resolveUser(token);
  if (!user) return res.status(401).json({ error: 'unauthenticated', message: 'Invalid or expired token' });
  req.user = user;
  next();
}

async function optionalAuth(req, res, next) {
  const token = bearer(req);
  if (token) {
    const user = await resolveUser(token);
    if (user) req.user = user;
  }
  next();
}

function signToken(payload, expiresIn = '12h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = { authRequired, optionalAuth, signToken, JWT_SECRET };
