#!/usr/bin/env node
/**
 * audit-schema-drift.js
 *
 * Compares the schema the integration tests run against (built by
 * tests/setup.js) with the schema the application actually deploys against
 * (built by migrations/, i.e. DATABASE_URL).
 *
 *   node scripts/audit-schema-drift.js
 *
 * WHY THIS MATTERS
 * tests/setup.js hand-writes CREATE TABLE statements instead of running the
 * migrations. Wherever it is LAXER than the real schema, an integration test can
 * pass on an INSERT that the deployed database would reject — the test suite
 * says green and the feature fails in the demo. Wherever it is STRICTER, tests
 * fail for reasons that do not exist in production.
 *
 * Read-only against both databases. Reports:
 *   - tables present in one and not the other
 *   - columns present in one and not the other
 *   - NOT NULL mismatches (the dangerous direction called out explicitly)
 *   - type mismatches
 *
 * Exits non-zero if any LAXER-IN-TEST nullability drift exists, since that is
 * the class that lets a broken INSERT through CI.
 */

const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const REAL_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.TEST_DATABASE_URL;

// Tables that legitimately exist only in one place.
const IGNORE_TABLES = new Set([
    "pgmigrations", // migration bookkeeping; tests/setup.js does not run migrations
    "v_beneficiaries",
    "v_blockchain_pending",
    "v_shop_summary",
    "v_transactions", // views, created by schema.sql only
]);

const describe = async (url) => {
    const pool = new Pool({ connectionString: url });
    try {
        const { rows } = await pool.query(
            `SELECT table_name, column_name, is_nullable, data_type, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, column_name`,
        );
        const byTable = new Map();
        for (const row of rows) {
            if (IGNORE_TABLES.has(row.table_name)) continue;
            if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Map());
            byTable.get(row.table_name).set(row.column_name, {
                nullable: row.is_nullable === "YES",
                type: row.data_type,
                hasDefault: row.column_default !== null,
            });
        }
        return byTable;
    } finally {
        await pool.end();
    }
};

const main = async () => {
    console.log("\nSCHEMA DRIFT AUDIT — tests/setup.js vs migrations");
    console.log("================================================\n");

    if (!REAL_URL || !TEST_URL) {
        console.error("Both DATABASE_URL and TEST_DATABASE_URL must be set in pds-backend/.env");
        process.exitCode = 1;
        return;
    }

    const [real, test] = await Promise.all([describe(REAL_URL), describe(TEST_URL)]);

    const dangerous = []; // test laxer than real -> a bad INSERT passes CI
    const noisy = []; // test stricter than real -> tests fail for a non-issue
    const missingInTest = [];
    const missingInReal = [];
    const typeDrift = [];

    for (const [table, realCols] of real) {
        const testCols = test.get(table);
        if (!testCols) {
            missingInTest.push({ table, kind: "table" });
            continue;
        }
        for (const [column, realDef] of realCols) {
            const testDef = testCols.get(column);
            if (!testDef) {
                missingInTest.push({ table, column });
                continue;
            }
            if (realDef.nullable !== testDef.nullable) {
                const entry = {
                    table,
                    column,
                    real: realDef.nullable ? "NULL" : "NOT NULL",
                    test: testDef.nullable ? "NULL" : "NOT NULL",
                    hasDefault: realDef.hasDefault,
                };
                if (testDef.nullable && !realDef.nullable) {
                    // A NOT NULL column WITH a default cannot actually be
                    // violated by omitting it — the default fills it in. Only a
                    // NOT NULL column with NO default lets an INSERT that omits
                    // it pass in test and fail in production, which is the class
                    // that matters.
                    (realDef.hasDefault ? noisy : dangerous).push(entry);
                } else {
                    noisy.push(entry);
                }
            }
            if (realDef.type !== testDef.type) {
                typeDrift.push({ table, column, real: realDef.type, test: testDef.type });
            }
        }
    }

    for (const [table, testCols] of test) {
        const realCols = real.get(table);
        if (!realCols) {
            missingInReal.push({ table, kind: "table" });
            continue;
        }
        for (const column of testCols.keys()) {
            if (!realCols.has(column)) missingInReal.push({ table, column });
        }
    }

    const report = (title, items, render) => {
        console.log(`${title} (${items.length})`);
        console.log("-".repeat(title.length + 6));
        if (items.length === 0) console.log("  none");
        else items.forEach((i) => console.log(`  ${render(i)}`));
        console.log("");
    };

    report(
        "DANGEROUS — real column is NOT NULL with NO DEFAULT, test allows NULL",
        dangerous,
        (i) => `${i.table}.${i.column}: real=NOT NULL (no default), test=NULL  <-- a test can INSERT what production rejects`,
    );
    report(
        "BENIGN — nullability differs, but the real column has a DEFAULT (or test is stricter)",
        noisy,
        (i) => `${i.table}.${i.column}: real=${i.real}${i.hasDefault ? " DEFAULT" : ""}, test=${i.test}`,
    );
    report(
        "MISSING IN TEST SCHEMA",
        missingInTest,
        (i) => (i.kind === "table" ? `table ${i.table}` : `${i.table}.${i.column}`),
    );
    report(
        "PRESENT ONLY IN TEST SCHEMA",
        missingInReal,
        (i) => (i.kind === "table" ? `table ${i.table}` : `${i.table}.${i.column}`),
    );
    report("TYPE DRIFT", typeDrift, (i) => `${i.table}.${i.column}: real=${i.real}, test=${i.test}`);

    console.log("----------------------------------------------------------");
    if (dangerous.length > 0) {
        console.log(`RESULT: ${dangerous.length} DANGEROUS drift(s) — the test suite runs against a laxer schema.`);
        process.exitCode = 1;
    } else {
        console.log("RESULT: no dangerous nullability drift.");
    }
    console.log("----------------------------------------------------------\n");
};

main().catch((err) => {
    console.error(`\nUNEXPECTED ERROR: ${err.stack || err.message}\n`);
    process.exitCode = 1;
});
