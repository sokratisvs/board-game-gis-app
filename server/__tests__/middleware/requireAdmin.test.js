const { requireAuth, requireAdmin, requireAdminOrSelf } = require('../../middleware/requireAdmin')

describe('middleware/requireAdmin', () => {
  const next = jest.fn()
  const json = jest.fn()

  beforeEach(() => {
    next.mockClear()
    json.mockClear()
  })

  describe('requireAuth', () => {
    it('returns 401 when no session', () => {
      const req = { session: null }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAuth(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(json).toHaveBeenCalledWith({ message: 'Authentication required' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when session has no user', () => {
      const req = { session: {} }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAuth(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next when session has user', () => {
      const req = { session: { user: { id: 1, username: 'test' } } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAuth(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('requireAdmin', () => {
    it('returns 401 when not logged in', () => {
      const req = { session: {} }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdmin(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 403 when user is not admin', () => {
      const req = { session: { user: { id: 1, type: 'user' } } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdmin(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
      expect(json).toHaveBeenCalledWith({ message: 'Admin access required' })
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next when user is admin', () => {
      const req = { session: { user: { id: 1, type: 'admin' } } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdmin(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('requireAdminOrSelf', () => {
    it('returns 401 when not logged in', () => {
      const req = { session: {}, params: { id: '5' } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdminOrSelf(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next when user is admin', () => {
      const req = { session: { user: { id: 1, type: 'admin' } }, params: { id: '99' } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdminOrSelf(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('calls next when user is self (same id)', () => {
      const req = { session: { user: { id: 5, type: 'user' } }, params: { id: '5' } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdminOrSelf(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('returns 403 when user is neither admin nor self', () => {
      const req = { session: { user: { id: 5, type: 'user' } }, params: { id: '99' } }
      const res = { status: jest.fn().mockReturnThis(), json }
      requireAdminOrSelf(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
      expect(json).toHaveBeenCalledWith({ message: 'Access denied' })
      expect(next).not.toHaveBeenCalled()
    })
  })
})
