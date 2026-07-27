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
export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: process.env.E2E_FRONTEND_URL || 'http://localhost:5173',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
