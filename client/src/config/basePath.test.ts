/**
 * getBasePath reads REACT_APP_BASE_PATH at runtime.
 * In production build it may be inlined; in tests we verify the fallback.
 */
import { getBasePath } from './basePath'

describe('getBasePath', () => {
  const original = process.env.REACT_APP_BASE_PATH

  afterEach(() => {
    process.env.REACT_APP_BASE_PATH = original
  })

  it('returns empty string when REACT_APP_BASE_PATH is not set', () => {
    delete process.env.REACT_APP_BASE_PATH
    expect(getBasePath()).toBe('')
  })

  it('returns REACT_APP_BASE_PATH when set', () => {
    process.env.REACT_APP_BASE_PATH = '/boardgamesapp'
    expect(getBasePath()).toBe('/boardgamesapp')
  })
})
