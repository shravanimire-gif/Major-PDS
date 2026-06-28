# Current State of the Codebase — Q&A

**Date answered:** 2026-06-27  
**Source of truth:** actual files in this repo, not prior chat summaries.

---

## Is localhost actually running right now?

**No.** Nothing is running. There are no `.env` files in the repo — only `.env.example` templates
in each sub-package. Without a real `.env` the backend fails immediately at `validateEnvironment()`
with:

```
Missing required environment variables: JWT_SECRET, TWILIO_ACCOUNT_SID,
TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID, NODE_ENV, DATABASE_URL
```

The frontend would start (`vite.config.js` has no env-var gate) but its axios client would fire
every request at `undefined/auth/login` because `VITE_API_BASE_URL` is also unset.

Restoring the local environment is a **pending task**.

---

## What does "recovery decision" and "database rebuild" refer to?

All the investigation documents (`DEPLOYMENT_INVESTIGATION_REPORT.md`,
`DEPLOYMENT_FIX_GUIDE.md`, etc.) describe the **Render/Neon production deployment**, not
a local setup. The "recovery" terminology appears there in the context of:

1. The production frontend deployed to `major-project-1-sdbw.onrender.com` had no
   `VITE_API_BASE_URL` set in the Render dashboard, so it could never reach the backend.
2. The Neon PostgreSQL database may need `npm run migrate:up` and `npm run seed:admin` re-run
   to populate the admin user and schema (described as verifying/rebuilding the DB state).

There is no record of a local PostgreSQL database being dropped or rebuilt.

---

## What port does the backend actually use locally?

**Port 5000, not 5055.**

- `.env.example` → `PORT=5000`
- `server.js` → `const PORT = Number(process.env.PORT) || 5000`
- `5055` is the **Render production** value set in `render.yaml`

If you want the backend locally on 5055, you must explicitly put `PORT=5055` in your `.env`.

---

## What port does the frontend use locally?

**Port 5174** — confirmed. `vite.config.js` sets `port: 5174, strictPort: true`.
The backend CORS config (`src/config/cors.js`) already whitelists
`http://localhost:5174` and `http://127.0.0.1:5174` for development.

---

## What is "ration_db"?

It is a **stale comment** in `pds-backend/seed.js` (line 3:
`// Seeds 3 areas and 9 shops (3 per area) into ration_db`).

The actual database names are:
- **Local development:** `pds` (`.env.example`: `postgresql://postgres:password@localhost:5432/pds`)
- **Production (Render/Neon):** `pds_production` (`render.yaml` → `databaseName: pds_production`)

There is no database named `ration_db` anywhere in the configuration.

---

## What needs to happen to get localhost working?

1. **Create `pds-backend/.env`** — copy `.env.example` and fill in:
   - `DATABASE_URL` pointing to a local PostgreSQL instance with database `pds`
   - `JWT_SECRET` (any 32+ char string for dev)
   - `TWILIO_*` credentials (or stub them if OTP is not being tested)
   - `NODE_ENV=development`

2. **Create `pds-frontend/.env`** — copy `.env.example` and set:
   - `VITE_API_BASE_URL=http://localhost:5000` (or 5055 if you set `PORT=5055`)

3. **Create and seed the local database:**
   ```
   createdb pds
   cd pds-backend && npm run migrate:up && npm run seed:admin && npm run seed
   ```

4. **Start services:**
   ```
   # terminal 1
   cd pds-backend && npm run dev       # listens on :5000 by default

   # terminal 2
   cd pds-frontend && npm run dev      # listens on :5174
   ```

Nothing from this checklist has been done yet — the local environment is fully unbuilt.
