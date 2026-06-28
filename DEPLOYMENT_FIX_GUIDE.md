# PDS Deployment Fix - Implementation Guide

## Critical Finding: Missing Frontend Environment Variable

The CORS error is a **symptom**, not the root cause.

**Root Cause:** Frontend doesn't know where the backend is because `VITE_API_BASE_URL` is not set in the Render environment.

---

## Immediate Fix (5 minutes)

### Step 1: Configure Frontend Environment Variable

**Location:** Render Dashboard

1. Navigate to: https://dashboard.render.com
2. Select **pds-frontend** (Static Site)
3. Click **Settings** tab
4. Scroll to **Environment Variables** section
5. Click **Add Environment Variable**

**Variable Details:**

```
Key: VITE_API_BASE_URL
Value: https://major-project-mdhh.onrender.com
```

6. Click **Save Changes**

**Important:** The deployment will automatically trigger. Wait for status green.

---

### Step 2: Verify Backend CORS Configuration

**Location:** Render Dashboard

1. Select **pds-backend** (Web Service)
2. Click **Settings** tab
3. Scroll to **Environment Variables** section
4. Look for **CORS_ORIGINS** variable

**Expected Value:**

```
CORS_ORIGINS = https://major-project-1-sdbw.onrender.com
```

**If not present:**

1. Click **Add Environment Variable**
2. Add:
   ```
   Key: CORS_ORIGINS
   Value: https://major-project-1-sdbw.onrender.com
   ```
3. Click **Save Changes**

**Note:** Backend will restart automatically.

---

### Step 3: Monitor Startup Logs

**Location:** Render Dashboard

1. Select **pds-backend** (Web Service)
2. Click **Logs** tab
3. Search for: `"CORS Configuration Startup Logs"`

**Expected Output:**

```
CORS Configuration Startup Logs {
  nodeEnv: "production",
  corsOriginsEnv: "https://major-project-1-sdbw.onrender.com",
  allowedOrigins: ["https://major-project-1-sdbw.onrender.com"],
  allowAllDevOrigins: false,
  originCount: 1
}
```

**If you see different values:**

- CORS_ORIGINS not matching
- NODE_ENV not "production"
- Then go back to Step 2 and correct

---

### Step 4: Verify Database Admin User

**Location:** Neon Console

1. Go to: https://console.neon.tech
2. Select **pds-database**
3. Click **SQL Editor**
4. Run query:
   ```sql
   SELECT id, email, role FROM users WHERE email = 'admin@pds.gov';
   ```

**Expected Result:**

```
id    | email           | role
------|-----------------|------
uuid  | admin@pds.gov   | admin
```

**If no results:**

- Admin user was not seeded
- You need to run the seeding script

---

### Step 5: Test Login Flow

**Wait 2-3 minutes** for Render to finish deployments, then:

1. Open: https://major-project-1-sdbw.onrender.com/login
2. Open Browser DevTools: **F12** or **Cmd+Option+I**
3. Go to **Network** tab
4. In Email field, enter: `admin@pds.gov`
5. In Password field, enter: `admin123`
6. Click **Login**

**Check Network Tab:**

Look for these requests in order:

1. **OPTIONS /auth/login** (preflight)

   - Status: `204 No Content` ✅
   - Response Headers include:
     - `access-control-allow-origin: https://major-project-1-sdbw.onrender.com`
     - `access-control-allow-methods: GET,POST,PUT,DELETE,PATCH`

2. **POST /auth/login** (actual request)

   - Status: `200 OK` ✅
   - Response body:
     ```json
     {
       "token": "eyJhbGc...",
       "user": {
         "id": "uuid",
         "role": "admin",
         "email": "admin@pds.gov"
       }
     }
     ```

3. **Redirect to /admin/dashboard** ✅

**If you see errors:**

- 403 Forbidden: CORS mismatch, check CORS_ORIGINS
- 401 Unauthorized: Check credentials or admin user
- Network error: Check VITE_API_BASE_URL or backend URL

---

## What Changed in Backend Code

Added diagnostic logging to help troubleshoot:

### File: pds-backend/src/server.js

```javascript
// Enhanced startup diagnostics
logger.info("===== BACKEND STARTUP DIAGNOSTICS =====");
logger.info("Server Configuration", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: PORT,
  HOST: HOST,
  JWT_SECRET_SET: !!process.env.JWT_SECRET,
  CORS_ORIGINS: process.env.CORS_ORIGINS || "not set",
  CORS_ALLOW_ALL_DEV_ORIGINS: process.env.CORS_ALLOW_ALL_DEV_ORIGINS || "true (default)",
  DATABASE_URL_HOST: ...,
});
logger.info("========================================");
```

### File: pds-backend/src/config/cors.js

```javascript
// Now logs detailed CORS validation
logger.debug("CORS origin check", {
  requestOrigin: origin || "no-origin-header",
  allowedOrigins: allowedOrigins,
  nodeEnv: process.env.NODE_ENV,
});

// Logs whether origin was allowed or blocked
logger.debug("CORS origin allowed", {
  origin: normalizedOrigin,
  method: "exact-match", // or other reason
});
```

### File: pds-backend/src/app.js

```javascript
// Logs all incoming requests
app.use((req, res, next) => {
  logger.debug("Incoming request", {
    method: req.method,
    path: req.path,
    origin: req.get("origin"),
    userAgent: req.get("user-agent"),
  });
  next();
});
```

**These changes enable:**

- Verification that environment variables are loaded
- Tracking of CORS validation decisions
- Request logging for debugging

**No business logic changed.**

---

## Why This Wasn't a CORS Problem

### What Actually Happened:

1. Frontend tried to make API call
2. Axios based URL: `undefined + '/auth/login'` = `"undefined/auth/login"`
3. Browser couldn't resolve `undefined` as a domain
4. Network request failed before reaching backend
5. Browser reported: "CORS error" (generic network error)

### Why CORS Error Message Was Misleading:

- CORS checks only happen for valid HTTP requests
- If URL is invalid, request never reaches the CORS layer
- Browser shows CORS error as a fallback for network issues
- The real problem was frontend's configuration, not backend's CORS

### The Real Issue:

```javascript
// axios.js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // ← undefined!
});
```

Without the environment variable, `baseURL` is `undefined`.

---

## Verification Checklist

After following the steps above:

- [ ] VITE_API_BASE_URL is set in Render (pds-frontend settings)
- [ ] Value is: `https://major-project-mdhh.onrender.com`
- [ ] CORS_ORIGINS is set in Render (pds-backend settings)
- [ ] Value is: `https://major-project-1-sdbw.onrender.com`
- [ ] Frontend shows "CORS Configuration Startup Logs" in backend logs
- [ ] Admin user exists in database (query results)
- [ ] Login page works without CORS errors
- [ ] Can login as admin@pds.gov
- [ ] Token received and stored
- [ ] Redirects to /admin/dashboard

---

## How to Debug Further

### Check Backend Logs for CORS

Render Dashboard > pds-backend > Logs

Search for one of these patterns:

1. **To see all incoming requests:**

   ```
   "Incoming request"
   ```

2. **To see CORS validation:**

   ```
   "CORS origin"
   ```

3. **To see blocked origins:**
   ```
   "CORS origin BLOCKED"
   ```

### Check Frontend Logs for API Calls

In browser, press **F12**:

1. **Network tab:** See all HTTP requests

   - Look for OPTIONS preflight request
   - Look for POST /auth/login
   - Check response status and headers

2. **Console tab:** JavaScript errors

   - CORS errors will appear here
   - API request failures will appear

3. **Application tab:** Check localStorage
   - Look for `pds_token` key
   - Should exist after successful login

---

## Common Issues & Solutions

### Issue: Still seeing CORS error after setting env vars

**Possible causes:**

1. Render still deploying (wait 2-3 minutes)
2. Browser cached old deployment (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
3. CORS_ORIGINS value has typo (check exact spelling)
4. Frontend VITE_API_BASE_URL has typo

**Solution:**

1. Wait for green status in Render
2. Hard refresh browser
3. Check Render logs for actual environment values
4. Redeploy manually if needed

### Issue: Login returns 401 Unauthorized

**Possible causes:**

1. Admin user doesn't exist in database
2. Password is wrong (should be `admin123`)
3. User table schema is missing

**Solution:**

1. Query Neon database directly
2. Verify admin@pds.gov exists
3. If not, check if seed script was run

### Issue: Backend crashes on startup

**Symptoms:**

- Render shows "Deploy failed"
- Service keeps restarting

**Possible causes:**

1. DATABASE_URL not set or invalid
2. Required env var missing
3. Database migration failed

**Solution:**

1. Check Render logs for actual error
2. Verify DATABASE_URL in Render settings
3. Check database connection in Neon console

---

## Environment Variables Summary

### Frontend (pds-frontend)

| Variable          | Value                                   | Required |
| ----------------- | --------------------------------------- | -------- |
| VITE_API_BASE_URL | https://major-project-mdhh.onrender.com | ✅ YES   |

### Backend (pds-backend)

| Variable           | Value                                     | Required        |
| ------------------ | ----------------------------------------- | --------------- |
| NODE_ENV           | production                                | ✅ YES          |
| PORT               | 5055                                      | ✅ YES          |
| DATABASE_URL       | [From Neon]                               | ✅ YES          |
| JWT_SECRET         | [Auto-generated]                          | ✅ YES          |
| CORS_ORIGINS       | https://major-project-1-sdbw.onrender.com | ✅ YES          |
| TWILIO_ACCOUNT_SID | [Your Twilio SID]                         | ❌ NO (for OTP) |
| TWILIO_AUTH_TOKEN  | [Your Twilio Token]                       | ❌ NO (for OTP) |
| TWILIO_SERVICE_SID | [Your Twilio Service]                     | ❌ NO (for OTP) |

---

## Success Indicators

When deployment is successful:

1. ✅ Frontend loads without errors
2. ✅ Login page displays
3. ✅ Can type email and password
4. ✅ Browser shows OPTIONS + POST in Network tab
5. ✅ Both return 200/204 with proper CORS headers
6. ✅ Login succeeds and redirects to dashboard
7. ✅ localStorage contains `pds_token`
8. ✅ Dashboard loads without 401 errors

---

## Next Phase: Testing Other Features

After login works, test:

1. **Logout** - Should clear token and redirect to login
2. **OTP features** - If TWILIO env vars are set
3. **Admin features** - Dashboard, create users, etc.
4. **Shopkeeper features** - QR scanning, rationing, etc.

---

## Support

If issues persist:

1. **Check the diagnostic script:**

   ```bash
   bash test-deployment.sh https://major-project-mdhh.onrender.com
   ```

2. **Review investigation report:**
   See `DEPLOYMENT_INVESTIGATION_REPORT.md` for detailed analysis

3. **Check backend logs:**
   Look for "CORS Configuration Startup Logs" and "Incoming request" entries

4. **Verify environment variables:**
   Render Dashboard > [Service] > Settings > Environment Variables
