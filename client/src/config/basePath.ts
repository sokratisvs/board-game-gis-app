/**
 * Base path for the app (e.g. '' for root, '/boardgamesapp' for path-based deploy).
 * Used as React Router basename so Link and navigate respect the deploy path.
 */
export const getBasePath = (): string =>
  process.env.REACT_APP_BASE_PATH || '';
