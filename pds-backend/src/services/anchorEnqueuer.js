const pool = require("../config/db");
const logger = require("../config/logger");
const { recordDispense } = require("./blockchainService");

// Thin wrapper over the EXISTING blockchain-anchoring service (never
// reimplemented, per Phase 2's DO-NOT) — converts measured_grams -> kg and
// calls recordDispense() with the same fire-and-forget, never-throws
// contract shopkeeperController.js already relies on.
//
// Every commodity the system supports (rice, wheat) maps to a contract
// parameter, so PDSLedger's `riceQtyGrams > 0 || wheatQtyGrams > 0` guard is
// always satisfiable. The sugar-only-dispense-never-anchors gap that used to
// be documented here is gone along with the commodity itself.
/**
 * Writes the anchor hash to dispense_records AND mirrors it onto the linked
 * canonical transaction, atomically.
 *
 * dispense_records stays authoritative for the anchor lifecycle
 * (anchorStatusService, anchorRetryCron); the mirror exists so the shared
 * business surfaces — blockchainHealthService, the activity feed's
 * blockchain_anchor event — see an IoT dispense as anchored. A half-applied
 * mirror is unrecoverable (see the call site), so it is all-or-nothing.
 */
const storeAnchorHash = async (dispenseRecordId, transactionId, txHash) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE dispense_records SET blockchain_tx_hash = $1, last_anchor_error = NULL WHERE id = $2`,
            [txHash, dispenseRecordId],
        );
        if (transactionId) {
            await client.query(`UPDATE transactions SET blockchain_tx_hash = $1 WHERE id = $2`, [
                txHash,
                transactionId,
            ]);
        }
        await client.query("COMMIT");
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {
            // Surface the original error, not a rollback failure.
        }
        throw err;
    } finally {
        client.release();
    }
};

const enqueueAnchor = async (dispenseRecordId) => {
    const result = await pool.query(
        `SELECT dr.id, dr.commodity, dr.measured_grams, dr.committed_at, dr.transaction_id,
                rc.card_number, s.shop_code
     FROM dispense_records dr
     JOIN ration_cards rc ON rc.id = dr.ration_card_id
     JOIN shops s ON s.id = dr.shop_id
     WHERE dr.id = $1`,
        [dispenseRecordId],
    );

    if (result.rows.length === 0) {
        logger.warn("[IoT] anchorEnqueuer: dispense_record not found", { dispenseRecordId });
        return;
    }

    const row = result.rows[0];
    const riceQtyKg = row.commodity === "rice" ? row.measured_grams / 1000 : 0;
    const wheatQtyKg = row.commodity === "wheat" ? row.measured_grams / 1000 : 0;

    recordDispense({
        transactionId: row.id,
        cardNumber: row.card_number,
        shopCode: row.shop_code,
        riceQtyKg,
        wheatQtyKg,
        timestamp: Math.floor(new Date(row.committed_at).getTime() / 1000),
    })
        .then(({ success, txHash, error }) => {
            if (success) {
                // Anchoring still runs off dispense_records — that is the
                // hash-chained IoT ledger and stays authoritative for the
                // anchor lifecycle (anchorStatusService, anchorRetryCron).
                // The hash is mirrored onto the linked canonical transaction
                // so the shared business surfaces stay truthful: without it,
                // blockchainHealthService (which counts
                // transactions.blockchain_tx_hash IS NULL as a pending
                // anchor) would report every IoT dispense as permanently
                // unanchored, and the activity feed would never emit its
                // blockchain_anchor event for one.
                // BOTH writes in ONE transaction, and deliberately so.
                //
                // These used to be two independent UPDATEs chained with .then().
                // That left a window — and, if the second one failed or the
                // process died between them, a PERMANENT state — where
                // dispense_records carried the hash but transactions did not.
                // Nothing reconciles that:
                //
                //   - anchorRetryCron selects `dispense_records WHERE
                //     blockchain_tx_hash IS NULL`, so a record that already has
                //     its hash is never retried;
                //   - blockchainHealthService counts `transactions.
                //     blockchain_tx_hash IS NULL` as a pending anchor, so that
                //     dispense would be reported as unanchored forever;
                //   - the activity feed would never emit its blockchain_anchor
                //     event for it.
                //
                // So the record's hash must not become visible unless the mirror
                // landed too. Atomic is the only state that is self-consistent:
                // either both rows carry the hash, or neither does and the retry
                // cron picks it up on its next pass.
                storeAnchorHash(row.id, row.transaction_id, txHash)
                    .then(() => logger.info("[IoT] Anchor hash stored", { txHash, dispenseRecordId }))
                    .catch((dbErr) =>
                        logger.error("[IoT] Failed to save anchor tx hash — retry cron will re-attempt", {
                            dispenseRecordId,
                            message: dbErr.message,
                        }),
                    );
            } else {
                // Persisted (not just logged) so GET /api/admin/iot/anchor-status
                // can surface *why* the most recent attempt failed.
                pool
                    .query("UPDATE dispense_records SET last_anchor_error = $1 WHERE id = $2", [error, row.id])
                    .catch((dbErr) =>
                        logger.error("[IoT] Failed to save anchor error", {
                            dispenseRecordId,
                            message: dbErr.message,
                        }),
                    );
                logger.warn("[IoT] Anchor recording failed — dispense_record unaffected", {
                    dispenseRecordId,
                    error,
                });
            }
        })
        .catch((err) =>
            logger.error("[IoT] Unexpected error in anchorEnqueuer", {
                dispenseRecordId,
                message: err.message,
            }),
        );
};

module.exports = { enqueueAnchor, storeAnchorHash };
