// seed.js
// Run once: node seed.js
// Seeds 3 areas and 9 shops (3 per area) into ration_db

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const shopsByArea = {
  Dharampeth: ["Dharampeth Shop 1", "Dharampeth Shop 2", "Dharampeth Shop 3"],

  Sadar: ["Sadar Shop 1", "Sadar Shop 2", "Sadar Shop 3"],

  Manewada: ["Manewada Shop 1", "Manewada Shop 2", "Manewada Shop 3"],
};

const areaCodes = {
  Dharampeth: "DHP",
  Sadar: "SDR",
  Manewada: "MNW",
};

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const [areaName, shopNames] of Object.entries(shopsByArea)) {
      // 1. Upsert area (safe to re-run)
      const areaRes = await client.query(
        `INSERT INTO areas (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [areaName],
      );
      const areaId = areaRes.rows[0].id;
      console.log(`✓ Area: ${areaName} (${areaId})`);

      // 2. Insert shops for this area
      const code = areaCodes[areaName];
      for (let i = 0; i < shopNames.length; i++) {
        const shopCode = `${code}-00${i + 1}`;
        const shopName = shopNames[i];

        await client.query(
          `INSERT INTO shops (shop_code, shop_name, area_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (shop_code) DO NOTHING`,
          [shopCode, shopName, areaId],
        );
        console.log(`  ✓ Shop: ${shopName} (${shopCode})`);
      }
    }

    await client.query("COMMIT");
    console.log("\n✅ Seed complete — 3 areas, 9 shops ready.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
