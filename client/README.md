# GeoExplorer App – Client

React + TypeScript + Vite frontend.

**Requirements:** Node.js 18+ (Vite 5 and Vitest require Node 18+). If you see `crypto.getRandomValues is not a function`, you're on Node 16 or older — switch with `nvm use` (see `.nvmrc`) or install Node 20.

## Scripts

- **`npm run dev`** – Start dev server at [http://localhost:3000](http://localhost:3000) (Vite HMR).
- **`npm run build`** – Production build (output in `dist/`).
- **`npm run preview`** – Serve the production build locally.
- **`npm run test`** – Run tests once (Vitest).
- **`npm run test:watch`** – Run tests in watch mode.
- **`npm run test:e2e`** – Run E2E tests (Playwright). Requires Node 18+. Starts the dev server if not running. Includes login page tests and LCP check for `/login`.
- **`npm run test:e2e:ui`** – Run E2E tests with Playwright UI.

**E2E (Playwright):** After `npm install`, run `npx playwright install chromium` once to install the browser. Then `npm run test:e2e` will run the login page and LCP tests against `http://localhost:3000/login`.

## Env

- **`VITE_API_BASE_URL`** – API base URL (client). If unset, the app uses `/api` and the dev server proxies to the backend, so the session cookie works (same-origin). Set in production/Docker so the built app talks to the correct API.
- **`VITE_API_PROXY_TARGET`** – Dev server only: backend origin the `/api` proxy forwards to (e.g. `http://localhost:4000`, `http://api:4000`). If unset, falls back to the origin derived from `VITE_API_BASE_URL`, then `http://localhost:4000`. Use this when the backend runs on another host/port (e.g. Docker, VM).

## Docker

The frontend image is built with Node 20 and outputs to `dist/`. Jenkins / deploy pass `REACT_APP_API_BASE_URL` as a build arg; the Dockerfile sets `VITE_API_BASE_URL` from it so the built app gets the correct API URL.
