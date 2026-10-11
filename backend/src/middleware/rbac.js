// Handoff section 23 — role matrix enforcement.
// Usage: router.get('/admin/users', authRequired, requireRole('admin'), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: `Requires role: ${roles.join(' or ')}` });
    }
    if (req.user.status === 'suspended') {
      return res.status(403).json({ error: 'account_suspended' });
    }
    next();
  };
}

// Handoff section 24 — a researcher must be approved AND 2FA-verified
// before touching Data Explorer / Export / researcher-privileged routes.
function requireApprovedResearcher(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  if (req.user.role !== 'researcher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Researcher or Admin only' });
  }
  if (req.user.role === 'researcher') {
    if (req.user.status !== 'active') {
      return res.status(403).json({ error: 'researcher_not_approved', message: 'Researcher account is not approved yet' });
    }
    if (!req.user.twofa_verified) {
      return res.status(403).json({ error: 'twofa_required', message: '2FA verification required for researcher-privileged routes' });
    }
  }
  next();
}

module.exports = { requireRole, requireApprovedResearcher };
