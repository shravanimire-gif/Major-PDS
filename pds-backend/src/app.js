const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const logger = require("./config/logger");
const { corsOptions } = require("./config/cors");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const shopkeeperRoutes = require("./routes/shopkeeper");
const entitlementRoutes = require("./routes/entitlement");
const beneficiaryRoutes = require("./routes/beneficiary");
const { verifyToken, requireRole } = require("./middleware/auth");
const { getCorsDebugInfo } = require("./config/cors");

dotenv.config();

const app = express();

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Security headers
app.use(helmet());
// -----------------------------------------------------------------------------
// Public health‑check and info endpoints (no auth required)
// -----------------------------------------------------------------------------
const pkg = require("../package.json");

// Root endpoint – simple ping
app.get("/", (req, res) => {
  logger.info("GET / - health ping", { env: process.env.NODE_ENV });
  res.json({
    status: "success",
    message: "PDS Backend API Running",
    environment: process.env.NODE_ENV || "development",
  });
});

// Basic health probe – useful for Render health checks
app.get("/health", (req, res) => {
  logger.info("GET /health - health check", { env: process.env.NODE_ENV });
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// API meta‑information
app.get("/api-info", (req, res) => {
  logger.info("GET /api-info - meta info", { env: process.env.NODE_ENV });
  res.json({
    project: pkg.name || "pds-backend",
    version: pkg.version || "0.0.0",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Temporary CORS debug endpoint (remove in production)
app.get("/debug/cors", (req, res) => {
  logger.info("GET /debug/cors - CORS debug info requested", {
    clientOrigin: req.get("origin"),
    env: process.env.NODE_ENV,
  });
  res.json(getCorsDebugInfo());
});

// Auth routes — strict (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});
app.use("/auth", authLimiter);
app.use("/api/auth", authLimiter);

// All other API routes — general limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Slow down." },
});
app.use("/api", apiLimiter);

app.use(express.json());

// Request logging middleware for debugging
app.use((req, res, next) => {
  logger.debug("Incoming request", {
    method: req.method,
    path: req.path,
    origin: req.get("origin"),
    userAgent: req.get("user-agent"),
  });
  next();
});

app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", entitlementRoutes);
app.use("/api/shopkeeper", shopkeeperRoutes);
app.use("/api/beneficiary", beneficiaryRoutes);

app.get("/api/admin/test", verifyToken, requireRole("admin"), (req, res) => {
  return res.status(200).json({ message: "Admin route works" });
});

app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS blocked for this origin" });
  }

  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  return res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
