# Board Game GIS App – Client

React + TypeScript + Vite frontend.

**Requirements:** Node.js 18+ (Vite 5 and Vitest require Node 18+). If you see `crypto.getRandomValues is not a function`, you're on Node 16 or older — switch with `nvm use` (see `.nvmrc`) or install Node 20.

## Scripts

- **`npm run dev`** – Start dev server at [http://localhost:3000](http://localhost:3000) (Vite HMR).
- **`npm run build`** – Production build (output in `dist/`).
- **`npm run preview`** – Serve the production build locally.
- **`npm run test`** – Run tests once (Vitest).
- **`npm run test:watch`** – Run tests in watch mode.

## Env

- **`VITE_API_BASE_URL`** – API base URL (default: `http://localhost:4000`). Only env vars prefixed with `VITE_` are exposed to the client.

## Docker

The frontend image is built with Node 20 and outputs to `dist/`. Jenkins / deploy pass `REACT_APP_API_BASE_URL` as a build arg; the Dockerfile sets `VITE_API_BASE_URL` from it so the built app gets the correct API URL.
