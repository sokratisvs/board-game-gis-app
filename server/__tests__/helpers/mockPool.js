/**
 * Creates a mock pg Pool that resolves query() with the given rows.
 * query(sql, params, callback) or query(sql, params) returning Promise.
 * rowsByCall: array of row arrays, one per query call in order.
 */
function createMockPool(rowsByCall = []) {
  let callIndex = 0
  const query = jest.fn((sql, params, callback) => {
    const rows = rowsByCall[callIndex] ?? []
    callIndex++
    const result = { rows, rowCount: rows.length }
    let cb = callback
    if (typeof params === 'function') {
      cb = params
    }
    if (typeof cb === 'function') {
      setImmediate(() => cb(null, result))
      return undefined
    }
    return Promise.resolve(result)
  })
  return { query }
}

/**
 * Mock pool that returns a single set of rows for every query (convenience).
 */
function createSimpleMockPool(rows) {
  return createMockPool([rows])
}

module.exports = { createMockPool, createSimpleMockPool }
