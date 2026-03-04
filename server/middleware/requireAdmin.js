/**
 * Require any logged-in user. Use for mobile profile, explore, matches.
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  next()
}

/**
 * Require session user to be admin. Use for dashboard/admin routes.
 * Returns 401 if not logged in, 403 if not admin.
 * Accepts both .type and .role (session may store either from login/me).
 */
function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  const u = req.session.user
  const isAdmin = u.type === 'admin' || u.role === 'admin'
  if (!isAdmin) {
    return res.status(403).json({ message: 'Admin access required' })
  }
  next()
}

/**
 * Allow access if admin or the same user (by id). Use for per-user config.
 */
function requireAdminOrSelf(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  const u = req.session.user
  const isAdmin = u.type === 'admin' || u.role === 'admin'
  const targetId = parseInt(req.params.id, 10)
  if (isAdmin || u.id === targetId) {
    return next()
  }
  return res.status(403).json({ message: 'Access denied' })
}

module.exports = { requireAuth, requireAdmin, requireAdminOrSelf }
