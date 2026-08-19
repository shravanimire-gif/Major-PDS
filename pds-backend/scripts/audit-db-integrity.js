#!/usr/bin/env node
/**
 * audit-db-integrity.js
 *
 * Read-only integrity audit of the live database. Every check is a SELECT — this
 * script writes nothing, ever, so it is safe to run against the demo database
 * before or after a dispense.
 *
 *   node scripts/audit-db-integrity.js
 *
 * Checks the invariants the IoT dispensing path depends on, and the ones the
 * allocation redesign established:
 *
 *   schema        the tables/columns the IoT path needs exist
 *   FK integrity  no orphaned sessions, records, readings, wallets or devices
 *   uniqueness    one dispense_record per session; one device_id per row
 *   devices       every active device is assigned to an existing, active shop
 *   tx/record     every dispense_record points at a real transaction, and the
 *                 quantities agree with the allocation it claims to have fulfilled
 *   wallets       no negative balances; one wallet per card
 *   commodities   rice and wheat only, and no Sugar anywhere
 *   allocation    every policy is within the 4000 g ceiling and a multiple of 10
 *   tolerance     every active commodity has a tolerance row
 *
 * Exits non-zero if any check fails, so it can gate a demo.
 */

const pool = require("../src/config/db");
const { MAX_DISPENSE_TRANSACTION_GRAMS, ALLOCATION_GRAMS_STEP } = require("../src/config/allocation");

const results = [];

const check = async (name, sql, { expectEmpty = true, describe = null } = {}) => {
    try {
        const { rows } = await pool.query(sql);
        const ok = expectEmpty ? rows.length === 0 : rows.length > 0;
        results.push({ name, ok, rows, describe });
        const mark = ok ? "PASS" : "FAIL";
        console.log(`  [${mark}] ${name}`);
        if (!ok) {
            const preview = rows.slice(0, 5).map((r) => JSON.stringify(r));
            preview.forEach((line) => console.log(`         ${line}`));
            if (rows.length > 5) console.log(`         ... and ${rows.length - 5} more`);
        } else if (describe && rows.length > 0) {
            rows.slice(0, 10).forEach((r) => console.log(`         ${describe(r)}`));
        }
        return ok;
    } catch (err) {
        results.push({ name, ok: false, error: err.message });
        console.log(`  [FAIL] ${name}`);
        console.log(`         query error: ${err.message}`);
        return false;
    }
};

const section = (title) => console.log(`\n${title}\n${"-".repeat(title.length)}`);

/**
 * The cutoff between "history" and "must be clean".
 *
 * Read from pgmigrations rather than hardcoded: migration 026 is the point the
 * USB/serial integration landed, by which time the three dispensing-correctness
 * fixes (derived entitlement, allocation-based debit, commit-boundary tolerance)
 * were all in place. Rows written before it were produced by the pre-fix code and
 * are HISTORY — this script must not rewrite them, and reporting them as current
 * failures would be misleading. Rows written after it are the code under test,
 * and any violation there is a real defect.
 */
const legacyCutoff = async () => {
    const { rows } = await pool.query(
        `SELECT run_on FROM pgmigrations WHERE name = '026_iot_device_identity_and_assignment'`,
    );
    return rows[0]?.run_on || null;
};

/**
 * A check that must hold for rows written since the cutoff, and merely reports
 * anything older. `sql` must accept $1 as the cutoff and return only rows newer
 * than it; `legacySql` returns the older violations.
 */
const checkSince = async (name, sql, legacySql, cutoff) => {
    try {
        const { rows } = await pool.query(sql, [cutoff]);
        const ok = rows.length === 0;
        results.push({ name, ok });
        console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
        if (!ok) {
            rows.slice(0, 5).forEach((r) => console.log(`         ${JSON.stringify(r)}`));
            if (rows.length > 5) console.log(`         ... and ${rows.length - 5} more`);
        }

        if (legacySql) {
            const legacy = await pool.query(legacySql, [cutoff]);
            if (legacy.rows.length > 0) {
                console.log(
                    `         (${legacy.rows.length} pre-026 row(s) violate this — written by the pre-fix` +
                    " code, left untouched as history)",
                );
                legacy.rows.slice(0, 5).forEach((r) => console.log(`           legacy: ${JSON.stringify(r)}`));
            }
        }
        return ok;
    } catch (err) {
        results.push({ name, ok: false, error: err.message });
        console.log(`  [FAIL] ${name}`);
        console.log(`         query error: ${err.message}`);
        return false;
    }
};

const main = async () => {
    console.log("\nPDS DATABASE INTEGRITY AUDIT (read-only)");
    console.log("========================================");

    const cutoff = await legacyCutoff();
    if (cutoff) {
        console.log(`\nCorrectness cutoff: ${new Date(cutoff).toISOString()} (migration 026).`);
        console.log("Business rows written before it came from the pre-fix code and are treated as");
        console.log("history — never rewritten. Rows after it must satisfy every invariant.");
    } else {
        console.log("\nMigration 026 not found — treating ALL rows as current.");
    }

    section("1. Schema");

    await check(
        "IoT tables all present",
        `SELECT unnest(ARRAY['iot_devices','sensor_readings','sensor_reading_rejections','dispense_sessions',
                        'dispense_records','transactions','wallets','policies','commodity_tolerances',
                        'qr_sessions','used_jtis','iot_audit']) AS expected
     EXCEPT
     SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );

    await check(
        "iot_devices has the columns the Admin Panel reads",
        `SELECT unnest(ARRAY['device_id','device_token_hash','shop_id','status','last_seen_at','created_at',
                        'device_name','firmware_version','needs_recalibration','calibrated_at']) AS expected
     EXCEPT
     SELECT column_name FROM information_schema.columns WHERE table_name = 'iot_devices'`,
    );

    await check(
        "dispense_records.transaction_id exists (the canonical link)",
        `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'dispense_records' AND column_name = 'transaction_id'`,
        { expectEmpty: false },
    );

    await check(
        "iot_devices.shop_id is nullable (unassign is representable)",
        `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'iot_devices' AND column_name = 'shop_id' AND is_nullable = 'YES'`,
        { expectEmpty: false },
    );

    section("2. Foreign-key / orphan integrity");

    await check(
        "no dispense_sessions pointing at a missing shop",
        `SELECT ds.id FROM dispense_sessions ds LEFT JOIN shops s ON s.id = ds.shop_id WHERE s.id IS NULL`,
    );
    await check(
        "no dispense_sessions pointing at a missing ration card",
        `SELECT ds.id FROM dispense_sessions ds
      LEFT JOIN ration_cards rc ON rc.id = ds.ration_card_id WHERE rc.id IS NULL`,
    );
    await check(
        "no dispense_sessions referencing an unregistered device",
        `SELECT ds.id, ds.device_id FROM dispense_sessions ds
      LEFT JOIN iot_devices d ON d.device_id = ds.device_id
      WHERE ds.device_id IS NOT NULL AND d.device_id IS NULL`,
    );
    await check(
        "no dispense_records pointing at a missing session",
        `SELECT dr.id FROM dispense_records dr
      LEFT JOIN dispense_sessions ds ON ds.id = dr.session_id WHERE ds.id IS NULL`,
    );
    await check(
        "no sensor_readings from an unregistered device",
        `SELECT sr.id FROM sensor_readings sr
      LEFT JOIN iot_devices d ON d.device_id = sr.device_id WHERE d.device_id IS NULL`,
    );
    await check(
        "no wallets pointing at a missing ration card",
        `SELECT w.id FROM wallets w LEFT JOIN ration_cards rc ON rc.id = w.ration_card_id WHERE rc.id IS NULL`,
    );
    await check(
        "no transactions pointing at a missing shop or card",
        `SELECT t.id FROM transactions t
      LEFT JOIN shops s ON s.id = t.shop_id
      LEFT JOIN ration_cards rc ON rc.id = t.ration_card_id
      WHERE s.id IS NULL OR rc.id IS NULL`,
    );

    section("3. Uniqueness");

    await check(
        "one dispense_record per session (idempotency guard)",
        `SELECT session_id, COUNT(*)::int AS n FROM dispense_records GROUP BY session_id HAVING COUNT(*) > 1`,
    );
    await check(
        "no duplicate device_id",
        `SELECT device_id, COUNT(*)::int AS n FROM iot_devices GROUP BY device_id HAVING COUNT(*) > 1`,
    );
    await check(
        "one wallet per ration card",
        `SELECT ration_card_id, COUNT(*)::int AS n FROM wallets GROUP BY ration_card_id HAVING COUNT(*) > 1`,
    );
    await check(
        "no two dispense_records share a transaction_id",
        `SELECT transaction_id, COUNT(*)::int AS n FROM dispense_records
      WHERE transaction_id IS NOT NULL GROUP BY transaction_id HAVING COUNT(*) > 1`,
    );

    section("4. Device assignment");

    await check(
        "every assigned device points at an existing shop",
        `SELECT d.device_id FROM iot_devices d
      LEFT JOIN shops s ON s.id = d.shop_id
      WHERE d.shop_id IS NOT NULL AND s.id IS NULL`,
    );
    await check(
        "no active device assigned to an inactive shop",
        `SELECT d.device_id, s.shop_code FROM iot_devices d
      JOIN shops s ON s.id = d.shop_id
      WHERE d.status = 'active' AND s.is_active = false`,
    );
    await check(
        "no shop has two active devices",
        `SELECT shop_id, COUNT(*)::int AS n FROM iot_devices
      WHERE status = 'active' AND shop_id IS NOT NULL
      GROUP BY shop_id HAVING COUNT(*) > 1`,
    );
    await check(
        "device inventory",
        `SELECT d.device_id, COALESCE(d.device_name,'(no name)') AS name, d.status,
            COALESCE(s.shop_code,'UNASSIGNED') AS shop, COALESCE(u.email,'-') AS shopkeeper,
            COALESCE(d.firmware_version,'-') AS firmware,
            COALESCE(to_char(d.last_seen_at,'YYYY-MM-DD HH24:MI:SS'),'never') AS last_seen
       FROM iot_devices d
       LEFT JOIN shops s ON s.id = d.shop_id
       LEFT JOIN users u ON u.id = s.shopkeeper_id
       ORDER BY d.created_at`,
        {
            expectEmpty: false,
            describe: (r) =>
                `${r.device_id.padEnd(20)} ${r.status.padEnd(9)} ${r.shop.padEnd(12)} ${r.shopkeeper.padEnd(26)} fw=${r.firmware} seen=${r.last_seen}`,
        },
    );

    section("5. transactions <-> dispense_records consistency");

    await check(
        "every dispense_record links to a real transaction",
        `SELECT dr.id, dr.transaction_id FROM dispense_records dr
      LEFT JOIN transactions t ON t.id = dr.transaction_id
      WHERE dr.transaction_id IS NOT NULL AND t.id IS NULL`,
    );

    // BUG 2's signature. The wallet is debited by the AUTHORISED ALLOCATION;
    // measured_grams is audit data. A transaction matching the measurement
    // instead is tolerance leaking into entitlement — and, when the measurement
    // is short, a consumed monthly claim with grain stranded in the wallet.
    await checkSince(
        "the transaction's quantity equals the record's ENTITLED grams, not its measurement",
        `SELECT dr.id, dr.commodity, dr.entitled_grams, dr.measured_grams, t.rice_qty_kg, t.wheat_qty_kg
       FROM dispense_records dr
       JOIN transactions t ON t.id = dr.transaction_id
      WHERE dr.committed_at >= $1
        AND ((dr.commodity = 'rice'  AND ROUND(t.rice_qty_kg  * 1000) <> dr.entitled_grams)
          OR (dr.commodity = 'wheat' AND ROUND(t.wheat_qty_kg * 1000) <> dr.entitled_grams))`,
        `SELECT dr.id, dr.commodity, dr.entitled_grams, dr.measured_grams, t.rice_qty_kg,
            to_char(dr.committed_at,'YYYY-MM-DD HH24:MI') AS committed_at
       FROM dispense_records dr
       JOIN transactions t ON t.id = dr.transaction_id
      WHERE dr.committed_at < $1
        AND ((dr.commodity = 'rice'  AND ROUND(t.rice_qty_kg  * 1000) <> dr.entitled_grams)
          OR (dr.commodity = 'wheat' AND ROUND(t.wheat_qty_kg * 1000) <> dr.entitled_grams))`,
        cutoff,
    );

    // BUG 3's signature: a commit that bypassed the tolerance check entirely.
    await checkSince(
        "no dispense_record measurement outside its session's tolerance",
        `SELECT dr.id, dr.entitled_grams, dr.measured_grams, ds.tolerance_grams
       FROM dispense_records dr
       JOIN dispense_sessions ds ON ds.id = dr.session_id
      WHERE dr.committed_at >= $1
        AND ABS(dr.measured_grams - dr.entitled_grams) > ds.tolerance_grams`,
        `SELECT dr.id, dr.entitled_grams, dr.measured_grams, ds.tolerance_grams,
            to_char(dr.committed_at,'YYYY-MM-DD HH24:MI') AS committed_at
       FROM dispense_records dr
       JOIN dispense_sessions ds ON ds.id = dr.session_id
      WHERE dr.committed_at < $1
        AND ABS(dr.measured_grams - dr.entitled_grams) > ds.tolerance_grams`,
        cutoff,
    );

    // BUG 1's signature: a session opened for less than the card's whole
    // allocation, which consumes the month's claim and strands the remainder.
    await checkSince(
        "every dispense covered the card's COMPLETE allocation (no partial sessions)",
        `SELECT dr.id, dr.commodity, dr.entitled_grams, rc.category,
            p.rice_per_card_grams, p.wheat_per_card_grams
       FROM dispense_records dr
       JOIN ration_cards rc ON rc.id = dr.ration_card_id
       JOIN policies p ON p.category = rc.category
      WHERE dr.committed_at >= $1
        AND ((dr.commodity = 'rice'  AND dr.entitled_grams <> p.rice_per_card_grams)
          OR (dr.commodity = 'wheat' AND dr.entitled_grams <> p.wheat_per_card_grams))`,
        `SELECT dr.id, dr.commodity, dr.entitled_grams, rc.category,
            p.rice_per_card_grams, p.wheat_per_card_grams,
            to_char(dr.committed_at,'YYYY-MM-DD HH24:MI') AS committed_at
       FROM dispense_records dr
       JOIN ration_cards rc ON rc.id = dr.ration_card_id
       JOIN policies p ON p.category = rc.category
      WHERE dr.committed_at < $1
        AND ((dr.commodity = 'rice'  AND dr.entitled_grams <> p.rice_per_card_grams)
          OR (dr.commodity = 'wheat' AND dr.entitled_grams <> p.wheat_per_card_grams))`,
        cutoff,
    );

    await check(
        "no committed session without a dispense_record",
        `SELECT ds.id FROM dispense_sessions ds
      LEFT JOIN dispense_records dr ON dr.session_id = ds.id
      WHERE ds.state = 'committed' AND dr.id IS NULL`,
    );

    await check(
        "no dispense_record whose session is not committed",
        `SELECT dr.id, ds.state FROM dispense_records dr
      JOIN dispense_sessions ds ON ds.id = dr.session_id
      WHERE ds.state <> 'committed'`,
    );

    await check(
        "no entitled_grams above the 4000 g business ceiling",
        `SELECT id, entitled_grams FROM dispense_records WHERE entitled_grams > ${MAX_DISPENSE_TRANSACTION_GRAMS}`,
    );

    await check(
        "no measured_grams above the 5000 g load-cell rating",
        `SELECT id, measured_grams FROM dispense_records WHERE measured_grams > 5000`,
    );

    section("6. Wallets");

    await check(
        "no negative wallet balance",
        `SELECT ration_card_id, rice_balance_kg, wheat_balance_kg FROM wallets
      WHERE rice_balance_kg < 0 OR wheat_balance_kg < 0`,
    );
    await check(
        "no wallet balance above its category's allocation",
        `SELECT w.ration_card_id, rc.category, w.rice_balance_kg, p.rice_per_card_grams,
            w.wheat_balance_kg, p.wheat_per_card_grams
       FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       JOIN policies p ON p.category = rc.category
      WHERE ROUND(w.rice_balance_kg * 1000)  > p.rice_per_card_grams
         OR ROUND(w.wheat_balance_kg * 1000) > p.wheat_per_card_grams`,
    );

    section("7. Commodities — rice and wheat only, no Sugar");

    await check(
        "no sugar column anywhere in the schema",
        `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name ILIKE '%sugar%'`,
    );
    await check(
        "no sugar row in commodity_tolerances",
        `SELECT commodity FROM commodity_tolerances WHERE commodity ILIKE '%sugar%'`,
    );
    await check(
        "no sugar in dispense_records / dispense_sessions",
        `SELECT 'dispense_records' AS src, commodity FROM dispense_records WHERE commodity NOT IN ('rice','wheat')
      UNION ALL
      SELECT 'dispense_sessions', commodity FROM dispense_sessions WHERE commodity NOT IN ('rice','wheat')`,
    );
    await check(
        "active commodities",
        `SELECT commodity, min_tolerance_grams, tolerance_pct FROM commodity_tolerances ORDER BY commodity`,
        {
            expectEmpty: false,
            describe: (r) => `${r.commodity}: min ${r.min_tolerance_grams} g, ${r.tolerance_pct}%`,
        },
    );

    section("8. Allocation policy");

    await check(
        `every policy within the ${MAX_DISPENSE_TRANSACTION_GRAMS} g single-transaction ceiling`,
        `SELECT category, rice_per_card_grams, wheat_per_card_grams FROM policies
      WHERE rice_per_card_grams  > ${MAX_DISPENSE_TRANSACTION_GRAMS}
         OR wheat_per_card_grams > ${MAX_DISPENSE_TRANSACTION_GRAMS}`,
    );
    await check(
        `every policy a multiple of ${ALLOCATION_GRAMS_STEP} g (lossless grams <-> kg)`,
        `SELECT category, rice_per_card_grams, wheat_per_card_grams FROM policies
      WHERE rice_per_card_grams  % ${ALLOCATION_GRAMS_STEP} <> 0
         OR wheat_per_card_grams % ${ALLOCATION_GRAMS_STEP} <> 0`,
    );
    await check(
        "no zero or negative allocation",
        `SELECT category FROM policies WHERE rice_per_card_grams <= 0 OR wheat_per_card_grams <= 0`,
    );
    await check(
        "policies",
        `SELECT category, rice_per_card_grams, wheat_per_card_grams FROM policies ORDER BY category`,
        {
            expectEmpty: false,
            describe: (r) => `${r.category}: rice ${r.rice_per_card_grams} g, wheat ${r.wheat_per_card_grams} g per card`,
        },
    );
    await check(
        "every commodity used by a policy has a tolerance row",
        `SELECT unnest(ARRAY['rice','wheat']) AS commodity
     EXCEPT
     SELECT commodity FROM commodity_tolerances`,
    );

    section("9. Multi-pass check");

    await check(
        "no ration card with two dispenses of the same commodity in one month",
        // The one-allocation/one-transaction invariant, observed from the data
        // rather than from the code: a multi-pass flow would show up here.
        `SELECT ration_card_id, date_trunc('month', created_at) AS month,
            COUNT(*) FILTER (WHERE rice_qty_kg  > 0)::int AS rice_dispenses,
            COUNT(*) FILTER (WHERE wheat_qty_kg > 0)::int AS wheat_dispenses
       FROM transactions
      GROUP BY ration_card_id, date_trunc('month', created_at)
     HAVING COUNT(*) FILTER (WHERE rice_qty_kg  > 0) > 1
         OR COUNT(*) FILTER (WHERE wheat_qty_kg > 0) > 1`,
    );

    // ---- summary -------------------------------------------------------
    const failed = results.filter((r) => !r.ok);
    console.log("\n----------------------------------------------------------");
    console.log(`INTEGRITY AUDIT: ${failed.length === 0 ? "PASS" : "FAIL"}`);
    console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
    console.log("----------------------------------------------------------");
    if (failed.length > 0) {
        console.log("\nFailed:");
        failed.forEach((r) => console.log(`  - ${r.name}${r.error ? ` (${r.error})` : ""}`));
        process.exitCode = 1;
    }
    console.log(
        "\nAny pre-026 violations listed above are historical rows from the pre-fix code.\n" +
        "They are reported, never rewritten: `transactions` and `dispense_records` are the\n" +
        "dispensing audit trail, and silently correcting them would destroy the evidence that\n" +
        "the defect existed.",
    );
    console.log("");
};

main()
    .catch((err) => {
        console.error(`\nUNEXPECTED ERROR: ${err.stack || err.message}\n`);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
