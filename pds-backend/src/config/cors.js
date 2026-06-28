const logger = require("./logger");

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const LOCALHOST_REGEX = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;
const PRIVATE_NETWORK_REGEX =
  /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d{2,5})?$/;

const normalizeOrigin = (origin) => {
  if (!origin) return origin;
  // remove trailing slash and surrounding whitespace
  return origin.trim().replace(/\/$/, "");
};

const parseOrigins = (value) => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
};

const buildAllowedOrigins = () => {
  const envOrigins = parseOrigins(process.env.CORS_ORIGINS);
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    return envOrigins;
  }

  return Array.from(new Set([...DEFAULT_DEV_ORIGINS, ...envOrigins]));
};

const allowedOrigins = buildAllowedOrigins();

// Log configured origins for visibility in startup logs
logger.info("CORS Configuration Startup Logs", {
  nodeEnv: process.env.NODE_ENV || "development",
  corsOriginsEnv: process.env.CORS_ORIGINS || "not set",
  allowedOrigins: allowedOrigins,
  allowAllDevOrigins: process.env.CORS_ALLOW_ALL_DEV_ORIGINS !== "false",
  originCount: allowedOrigins.length,
});

const corsOptions = {
  origin(origin, callback) {
    // Log every origin request for debugging
    logger.debug("CORS origin check", {
      requestOrigin: origin || "no-origin-header",
      allowedOrigins: allowedOrigins,
      nodeEnv: process.env.NODE_ENV,
    });

    // Allow requests with no Origin header (React Native, Postman, server-to-server).
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      logger.debug("CORS origin allowed", {
        origin: normalizedOrigin,
        method: "exact-match",
      });
      return callback(null, true);
    }

    const isDevelopment = process.env.NODE_ENV !== "production";
    const allowAllDevOrigins =
      process.env.CORS_ALLOW_ALL_DEV_ORIGINS !== "false";

    // In development, allow all explicit origins unless disabled via env.
    if (isDevelopment && allowAllDevOrigins) {
      logger.debug("CORS origin allowed", {
        origin: normalizedOrigin,
        method: "development-allow-all",
      });
      return callback(null, true);
    }

    if (
      isDevelopment &&
      (LOCALHOST_REGEX.test(normalizedOrigin) ||
        PRIVATE_NETWORK_REGEX.test(normalizedOrigin))
    ) {
      logger.debug("CORS origin allowed", {
        origin: normalizedOrigin,
        method: "development-regex-match",
      });
      return callback(null, true);
    }

    logger.warn("CORS origin BLOCKED", {
      origin: normalizedOrigin,
      method: "origin-check",
      nodeEnv: process.env.NODE_ENV || "development",
      allowedOrigins: allowedOrigins,
      isDevelopment,
      allowAllDevOrigins,
    });

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

module.exports = {
  corsOptions,
  allowedOrigins,
  getCorsDebugInfo: () => ({
    nodeEnv: process.env.NODE_ENV || "development",
    corsOriginsEnv: process.env.CORS_ORIGINS || "not set",
    allowedOrigins: allowedOrigins,
  }),
};
