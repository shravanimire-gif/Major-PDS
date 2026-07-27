import { test, expect } from '@playwright/test';
import { seedIotOpsData } from './seed.js';

const login = async (page, email, password) => {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /login/i }).click();
};

test('fleet page shows a device that has never connected as Offline', async ({ page }) => {
    const seed = await seedIotOpsData();

    await login(page, seed.adminEmail, seed.adminPassword);
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    await page.goto('/admin/iot/fleet');

    const row = page.getByRole('row', { name: new RegExp(seed.offlineDeviceId) });
    await expect(row).toBeVisible({ timeout: 10_000 });
    // exact: true — the shop itself is named "E2E Offline Shop ..." for
    // readability, which would otherwise also match a loose "Offline" search.
    await expect(row.getByText('Offline', { exact: true })).toBeVisible();
});

test('anomaly dropdown count updates live after a rule fires, without a page reload', async ({ page }) => {
    const seed = await seedIotOpsData();

    await login(page, seed.adminEmail, seed.adminPassword);
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Give the AnomalyBadge's WS a moment to connect before triggering.
    await page.waitForTimeout(500);

    // Badge should start with no visible count (nothing critical yet for
    // this fresh admin — the seeded RAPID_FIRE data hasn't been evaluated).
    const badgeButton = page.getByRole('button', { name: /unresolved critical anomalies/i });
    await expect(badgeButton).toBeVisible();

    // Trigger the rule engine inside the REAL running backend process (not
    // this test process) so its in-memory anomalyBus actually pushes over
    // the WebSocket this page is already connected to — see
    // iot-device/PHASE3_DONE.md for why this can't be done by calling the
    // rule engine directly from the test.
    await page.evaluate(async () => {
        const token = localStorage.getItem('pds_token');
        await fetch(`${window.location.protocol}//${window.location.hostname}:5055/api/admin/anomalies/run-now`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
    });

    // No page.reload() / page.goto() here — this proves the WS push, not a
    // fresh fetch on navigation.
    await expect(badgeButton.locator('span')).toHaveText(/[1-9]/, { timeout: 10_000 });

    await badgeButton.click();
    // .first() — repeated E2E runs each seed their own RAPID_FIRE-violating
    // shop, so more than one flag can legitimately be present; this proves
    // at least the dropdown surfaces one, not that it's exactly one.
    await expect(page.getByText('RAPID_FIRE').first()).toBeVisible({ timeout: 5_000 });
});
