# Fixing "Network Error" in Expo Go After Changing WiFi

The **pds-beneficiary** app talks to the backend over your computer's **local network IP** (not `localhost`), because your phone (running Expo Go) is a separate device on the WiFi network. Every time you connect to a **different WiFi network** — or sometimes even reconnect to the same one — your computer can get a **new local IP address**, and the app needs to be told about it.

This guide shows how to find the new IP and update the app in under a minute.

---

## 1. Find your computer's current WiFi IP address

Open PowerShell and run:

```powershell
ipconfig
```

Look for the **Wireless LAN adapter Wi-Fi** section, and copy the `IPv4 Address` value. It usually looks like `10.x.x.x` or `192.168.x.x`.

Example:

```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 10.251.165.5
```

---

## 2. Update the beneficiary app's `.env.local`

Open [.env.local](.env.local) in this folder (`pds-beneficiary/.env.local`) and update the IP, keeping the same port (`5055`):

```
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_NEW_IP>:5055
```

**Example:** if your new IP is `10.251.170.20`:

```
EXPO_PUBLIC_API_BASE_URL=http://10.251.170.20:5055
```

> The port `5055` comes from [pds-backend/.env](../pds-backend/.env) (`PORT=5055`). Only change the port if you also change it there.

---

## 3. Make sure the backend is running and reachable

In `pds-backend/`, the server must be running with `HOST=0.0.0.0` (already set in `.env`) so it accepts connections from other devices, not just `localhost`:

```powershell
cd ../pds-backend
npm start
```

---

## 4. Restart Expo with a cleared cache

Environment variables are baked in at bundle time, so Expo must be restarted (not just reloaded) after editing `.env.local`:

```powershell
cd ../pds-beneficiary
npx expo start --clear
```

Then re-scan the QR code with Expo Go on your phone.

---

## Checklist every time WiFi changes

- [ ] Phone and computer are on the **same** WiFi network
- [ ] Ran `ipconfig` and got the new IPv4 address
- [ ] Updated `EXPO_PUBLIC_API_BASE_URL` in `pds-beneficiary/.env.local`
- [ ] Backend is running (`cd pds-backend && npm start`)
- [ ] Restarted Expo with `npx expo start --clear`

---

## Optional: stop doing this manually

`src/api/axios.js` can actually **auto-detect** the correct IP on its own — it reads the host Expo Go connected through (`Constants.expoConfig.hostUri`) and builds the URL from that, falling back to port `5055`... wait, its hardcoded fallback port is `5000`, so this only works cleanly if the backend also runs on `5000`. Auto-detection is **skipped** whenever `EXPO_PUBLIC_API_BASE_URL` is set in `.env.local`.

If you'd rather never touch this file again:
1. Delete or comment out `EXPO_PUBLIC_API_BASE_URL` in `.env.local`.
2. Align the backend `PORT` in `pds-backend/.env` to `5000` (the axios.js fallback), **or** edit `DEFAULT_API_PORT` in [src/api/axios.js](src/api/axios.js#L24) to `5055` to match the current backend port.
3. Restart Expo with `--clear`.

After that, the app will always point at whatever IP Expo Go is currently connected through — no manual edits needed when WiFi changes.
