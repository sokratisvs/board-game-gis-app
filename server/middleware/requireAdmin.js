/**
 * Require session user to be admin. Use for dashboard/admin routes.
 * Returns 401 if not logged in, 403 if not admin.
 */
function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  if (req.session.user.type !== 'admin') {
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
  const targetId = parseInt(req.params.id, 10)
  if (req.session.user.type === 'admin' || req.session.user.id === targetId) {
    return next()
  }
  return res.status(403).json({ message: 'Access denied' })
}

module.exports = { requireAdmin, requireAdminOrSelf }
