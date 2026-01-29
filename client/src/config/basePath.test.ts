/**
 * getBasePath derives base path from the main script URL (no injection) or falls back to env.
 */
import { getBasePath } from './basePath'

describe('getBasePath', () => {
  const originalEnv = process.env.REACT_APP_BASE_PATH

  afterEach(() => {
    process.env.REACT_APP_BASE_PATH = originalEnv
    document
      .querySelectorAll('script[src*="/static/js/main."]')
      .forEach((s) => s.remove())
  })

  it('returns empty string when env is not set and no matching script', () => {
    delete process.env.REACT_APP_BASE_PATH
    expect(getBasePath()).toBe('')
  })

  it('returns REACT_APP_BASE_PATH when set and no matching script', () => {
    process.env.REACT_APP_BASE_PATH = '/boardgamesapp'
    expect(getBasePath()).toBe('/boardgamesapp')
  })

  it('derives base path from main script src when present', () => {
    delete process.env.REACT_APP_BASE_PATH
    const script = document.createElement('script')
    script.src = 'http://localhost/boardgames/static/js/main.abc123.js'
    document.body.appendChild(script)
    expect(getBasePath()).toBe('/boardgames')
  })
})
