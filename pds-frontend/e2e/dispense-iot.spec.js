import { test, expect } from '@playwright/test';
import QRCode from 'qrcode';
import WebSocket from 'ws';
import { seedE2eData } from './seed.js';

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:5055';
const BACKEND_WS_URL = BACKEND_URL.replace(/^http/, 'ws');

// Installed via page.addInitScript before any app script runs: replaces the
// camera with a static canvas frame showing the beneficiary's real QR
// payload, so the app's actual @zxing/browser scanner decodes real pixels —
// not a mocked decode result. The ESP32 side is mocked the same way the
// backend's own WS integration tests do it: a real `ws` client driving the
// real /ws/iot endpoint (see below), not a browser-side stub.
//
// The override itself must be installed SYNCHRONOUSLY — React mounts
// QRScanner and calls getUserMedia almost immediately after navigation, so
// deferring the assignment behind an awaited image load raced the real
// (nonexistent) camera call and lost. Only the stream's readiness is async,
// awaited lazily inside getUserMedia itself.
const installFakeCamera = (qrDataUrl) => {
    let streamPromise = null;

    const buildStream = () =>
        new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // A fixed, generous size rather than the image's own natural
                // size — captureStream() on a canvas whose content is drawn
                // only once reported a bogus 2x2 track size in practice;
                // redrawing on an interval keeps the track fed with real
                // frames and stabilizes its reported dimensions.
                const size = 500;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                const draw = () => {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, size, size);
                    ctx.drawImage(img, 0, 0, size, size);
                };
                draw();

                const stream = canvas.captureStream(10);
                setInterval(draw, 200);
                resolve(stream);
            };
            img.onerror = reject;
            img.src = qrDataUrl;
        });

    navigator.mediaDevices.getUserMedia = async () => {
        if (!streamPromise) {
            streamPromise = buildStream();
        }
        return streamPromise;
    };
    navigator.mediaDevices.enumerateDevices = async () => [
        { deviceId: 'fake-camera', kind: 'videoinput', label: 'Fake Camera', groupId: 'fake' },
    ];
};

const login = async (page, email, password) => {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /login/i }).click();
};

const connectFakeDevice = (deviceId, rawToken) =>
    new Promise((resolve, reject) => {
        const ws = new WebSocket(`${BACKEND_WS_URL}/ws/iot?deviceId=${deviceId}`, [rawToken]);
        const timer = setTimeout(() => reject(new Error('fake ESP32: WS handshake timed out')), 5000);
        ws.on('open', () => {
            clearTimeout(timer);
            resolve(ws);
        });
        ws.on('unexpected-response', (req, res) => {
            clearTimeout(timer);
            reject(new Error(`fake ESP32: unexpected response ${res.statusCode}`));
        });
        ws.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });

test('shopkeeper opens an IoT-gated dispense, a stable weight auto-confirms it, and the admin tile updates', async ({
    browser,
}) => {
    const seed = await seedE2eData();
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(seed.qrPayload), { margin: 2, width: 400 });

    const shopkeeperContext = await browser.newContext();
    const shopkeeperPage = await shopkeeperContext.newPage();
    await shopkeeperPage.addInitScript(installFakeCamera, qrDataUrl);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    let fakeDevice;

    try {
        // --- Admin side: open the live weight tile for this shop first, so
        // we can observe it transition as readings arrive. ---
        await login(adminPage, seed.adminEmail, seed.adminPassword);
        await expect(adminPage).toHaveURL(/\/admin\/dashboard/);
        await adminPage.goto(`/admin/shops/${seed.shopId}/live`);
        // No device has connected yet this session, so the tile's neutral
        // default is "Ready (0 g)" — "Device offline" only appears once an
        // explicit device_status:false event has actually been received.
        await expect(adminPage.getByText('Ready (0 g)')).toBeVisible({ timeout: 10_000 });

        // --- Shopkeeper side: log in, scan the beneficiary's (faked-camera)
        // QR exactly like a real shopkeeper would, and start weighing rice. ---
        await login(shopkeeperPage, seed.shopkeeperEmail, seed.shopkeeperPassword);
        await expect(shopkeeperPage).toHaveURL(/\/shopkeeper\/dashboard/);
        await shopkeeperPage.goto('/shopkeeper/scan');

        await expect(shopkeeperPage.getByText('E2E Head')).toBeVisible({ timeout: 15_000 });

        const riceInput = shopkeeperPage.locator('input[type="number"]').first();
        await riceInput.fill('5'); // matches the seeded 5kg = 5000g wallet balance
        await shopkeeperPage.getByRole('button', { name: /weigh on scale/i }).click();

        await expect(shopkeeperPage.getByText(/^\d[\d,]* g$/)).toBeVisible({ timeout: 10_000 });

        // --- Fake ESP32: stream a stable weight at the entitled amount. ---
        fakeDevice = await connectFakeDevice(seed.deviceId, seed.deviceRawToken);
        const sendReading = (grams) =>
            fakeDevice.send(JSON.stringify({ type: 'reading', grams, ts: Date.now(), sessionId: null }));

        for (let i = 0; i < 20; i += 1) {
            sendReading(5000);
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        // --- Admin tile should reflect the live reading while it streams. ---
        await expect(adminPage.getByText(/Reading: 5,000 g/)).toBeVisible({ timeout: 10_000 });

        // --- Shopkeeper UI: countdown, then the terminal "Confirmed" modal. ---
        await expect(shopkeeperPage.getByText(/Hold — confirming in/)).toBeVisible({ timeout: 5_000 });
        await expect(shopkeeperPage.getByRole('heading', { name: 'Confirmed' })).toBeVisible({ timeout: 8_000 });

        fakeDevice.close();
        fakeDevice = null;

        // --- Admin tile settles back to offline once the device disconnects. ---
        // (Both the status badge and the big state paragraph say "Device
        // offline" — .first() avoids a strict-mode ambiguity, either match
        // proves the tile updated.)
        await expect(adminPage.getByText('Device offline').first()).toBeVisible({ timeout: 10_000 });
    } finally {
        fakeDevice?.close();
        await shopkeeperContext.close();
        await adminContext.close();
    }
});
