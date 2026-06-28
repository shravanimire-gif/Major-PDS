# Production Deployment Checklist - CORS Configuration

## Render.com Environment Variables

Set these environment variables in your Render service dashboard:

```
NODE_ENV=production
CORS_ORIGINS=https://major-project-1-sdbw.onrender.com
```

**Note:** If you have multiple frontend origins, use comma-separated values:

```
CORS_ORIGINS=https://origin1.onrender.com,https://origin2.onrender.com
```

---

## Frontend URL Mapping

| Environment | Frontend URL                                | Backend Expected       |
| ----------- | ------------------------------------------- | ---------------------- |
| Production  | `https://major-project-1-sdbw.onrender.com` | ✅ Included            |
| Dev/Local   | `http://localhost:3000`                     | ✅ Included (dev only) |
| Dev/Local   | `http://localhost:5173`                     | ✅ Included (dev only) |
| Vite Dev    | `http://127.0.0.1:5173`                     | ✅ Included (dev only) |

---

## Verification Steps

### 1. After Deployment - Check Logs

Look for this in your Render service logs:

```
CORS Configuration Startup Logs {
  nodeEnv: "production",
  corsOriginsEnv: "https://major-project-1-sdbw.onrender.com",
  allowedOrigins: [ "https://major-project-1-sdbw.onrender.com" ],
  allowAllDevOrigins: false,
  originCount: 1
}
```

### 2. Test Debug Endpoint

```bash
curl https://your-pds-backend-domain/debug/cors
```

Expected Response:

```json
{
  "nodeEnv": "production",
  "corsOriginsEnv": "https://major-project-1-sdbw.onrender.com",
  "allowedOrigins": ["https://major-project-1-sdbw.onrender.com"]
}
```

### 3. Test Preflight from Frontend

Open browser DevTools Console on the frontend, run:

```javascript
fetch("https://your-backend-domain/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer token",
  },
  body: JSON.stringify({ email: "test@test.com", password: "pass" }),
})
  .then((r) => r.json())
  .then((d) => console.log(d))
  .catch((e) => console.error("CORS Error:", e));
```

### 4. Check Network Tab in DevTools

You should see:

- ✅ OPTIONS request returns 204
- ✅ Response headers include:
  - `Access-Control-Allow-Origin: https://major-project-1-sdbw.onrender.com`
  - `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH`
  - `Access-Control-Allow-Headers: Content-Type,Authorization`
  - `Access-Control-Allow-Credentials: true`

---

## Troubleshooting

### Issue: "CORS error - Origin not allowed"

**Cause:** Frontend origin not in CORS_ORIGINS env var or NODE_ENV not set to production

**Solution:**

```bash
# Check current config
curl https://backend-domain/debug/cors

# Verify env vars in Render dashboard:
# NODE_ENV = production
# CORS_ORIGINS = https://major-project-1-sdbw.onrender.com

# Redeploy after changing env vars
```

### Issue: Preflight returns 403

**Cause:** CORS origin check failed

**Check:** Look for "Blocked CORS origin" in logs

```bash
# Review startup logs for allowed origins
curl https://backend-domain/debug/cors
```

### Issue: OPTIONS returns 405 Method Not Allowed

**Cause:** CORS middleware not properly applied

**Solution:** Ensure app.js has:

```javascript
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
```

---

## Environment Variable Details

### NODE_ENV

- **Required:** Yes
- **Type:** String
- **Values:** `production` or `development`
- **Default:** `development`
- **Effect:**
  - `production`: Only allows origins in CORS_ORIGINS
  - `development`: Allows localhost, 127.0.0.1, and private IPs

### CORS_ORIGINS

- **Required:** No (optional)
- **Type:** Comma-separated string
- **Example:** `https://major-project-1-sdbw.onrender.com`
- **Multiple:** `https://origin1.com,https://origin2.com`
- **Default:** Empty (uses defaults in development)

### CORS_ALLOW_ALL_DEV_ORIGINS

- **Required:** No
- **Type:** Boolean (as string)
- **Values:** `"true"` or `"false"`
- **Default:** `"true"`
- **Effect:** In development, whether to allow all localhost/private IPs

---

## Production Security Notes

1. ✅ CORS is correctly restricted to configured origins
2. ✅ Credentials are allowed (cookies, authorization headers)
3. ✅ Only necessary HTTP methods are allowed
4. ✅ Only necessary headers are allowed
5. ⚠️ Debug endpoint (`/debug/cors`) is present - remove before final release if desired
   - It's not a security risk (only shows origin config)
   - Good for troubleshooting
   - Can be easily removed from app.js

---

## No Business Logic Changes

✅ This CORS configuration review:

- Does NOT change authentication
- Does NOT change database code
- Does NOT change routes
- Does NOT change business logic
- Only configures CORS headers for the frontend

---

## Additional Resources

- CORS Verification Guide: See [CORS_VERIFICATION.md](CORS_VERIFICATION.md)
- Implementation Summary: See [CORS_IMPLEMENTATION_SUMMARY.md](CORS_IMPLEMENTATION_SUMMARY.md)
- Test Script: Run `bash test-cors.sh` to validate CORS setup
