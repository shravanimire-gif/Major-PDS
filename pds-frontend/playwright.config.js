import { defineConfig } from '@playwright/test';

// E2E prerequisites (documented in iot-device/PHASE2_DONE.md):
//   - pds-backend running and reachable at E2E_BACKEND_URL (default
//     http://localhost:5055), pointed at a Postgres database migrated with
//     `npm run migrate:up` (needs migrations/001..012).
//   - E2E_DATABASE_URL set to that same database's connection string, so
//     e2e/seed.js can seed a shopkeeper/shop/IoT device/ration card directly
//     (mirrors how pds-backend's own integration tests seed data).
// This config only manages the frontend dev server — the backend is a
// separate process/repo folder and isn't started here.
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:5174';
const FRONTEND_PORT = new URL(FRONTEND_URL).port || '5174';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: FRONTEND_URL,
        trace: 'retain-on-failure',
    },
    // Derived from FRONTEND_URL rather than hardcoded to 5173.
    //
    // vite.config.js pins the dev server to port 5174 with strictPort, so a
    // config that hardcoded 5173 both started the server on the wrong port and —
    // worse, with reuseExistingServer — silently "reused" whatever unrelated app
    // happened to be listening on 5173, then failed with a selector timeout that
    // looked like an application bug.
    webServer: {
        command: `npm run dev -- --port ${FRONTEND_PORT}`,
        url: FRONTEND_URL,
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
