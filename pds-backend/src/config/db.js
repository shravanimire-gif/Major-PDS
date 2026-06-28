const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const getConnectionString = () => {
  if (isTest) {
    return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
};

const getSslConfig = () => {
  const envSsl = process.env.DATABASE_SSL?.toLowerCase();
  const sslMode = process.env.PGSSLMODE?.toLowerCase();

  if (envSsl === "disable") {
    return false;
  }

  if (envSsl === "require" || envSsl === "true" || envSsl === "1") {
    return { rejectUnauthorized: false };
  }

  if (sslMode === "disable") {
    return false;
  }

  if (sslMode === "require" || sslMode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  return isProduction ? { rejectUnauthorized: false } : false;
};

const connectionString = getConnectionString();

if (!connectionString) {
  throw new Error(
    isTest
      ? "Missing database connection string. Set TEST_DATABASE_URL or DATABASE_URL."
      : "Missing database connection string. Set DATABASE_URL.",
  );
}

const pool = new Pool({
  connectionString,
  ssl: getSslConfig(),
  max: Number(process.env.DB_MAX_CLIENTS) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis:
    Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL client error", error);
});

module.exports = pool;
