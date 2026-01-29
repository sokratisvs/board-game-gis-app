/**
 * Base path for the app (e.g. '' for root, '/boardgames' for path-based deploy).
 * Derived from the main script URL at runtime (no server injection) so it is safe from XSS.
 * Fallback: process.env.REACT_APP_BASE_PATH (build-time / tests).
 */
export const getBasePath = (): string => {
  if (typeof window === 'undefined' || !document) {
    return process.env.REACT_APP_BASE_PATH || ''
  }
  const script = document.querySelector('script[src*="/static/js/main."]')
  const src = script?.getAttribute('src')
  if (!src) return process.env.REACT_APP_BASE_PATH || ''
  try {
    const url = new URL(src, window.location.origin)
    const path = url.pathname
    const match = path.match(/^(.+)\/static\/js\/main\.[^/]+\.js$/)
    if (!match) return process.env.REACT_APP_BASE_PATH || ''
    const base = match[1]
    return base === '' || base === '/' ? '' : base
  } catch {
    return process.env.REACT_APP_BASE_PATH || ''
  }
}
