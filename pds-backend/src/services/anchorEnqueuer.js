const pool = require("../config/db");
const logger = require("../config/logger");
const { recordDispense } = require("./blockchainService");

// Thin wrapper over the EXISTING blockchain-anchoring service (never
// reimplemented, per Phase 2's DO-NOT) — converts measured_grams -> kg and
// calls recordDispense() with the same fire-and-forget, never-throws
// contract shopkeeperController.js already relies on.
//
// Known gap, not fixed this phase: PDSLedger.sol's recordTransaction()
// requires riceQtyGrams OR wheatQtyGrams > 0. A sugar-only dispense_records
// row therefore always fails to anchor (contract revert) — that's tolerated
// by the existing "anchor failure is silent, never user-visible" design (the
// row just stays with blockchain_tx_hash = NULL forever). See
// iot-device/PHASE2_DONE.md.
const enqueueAnchor = async (dispenseRecordId) => {
    const result = await pool.query(
        `SELECT dr.id, dr.commodity, dr.measured_grams, dr.committed_at,
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
                pool
                    .query(
                        "UPDATE dispense_records SET blockchain_tx_hash = $1, last_anchor_error = NULL WHERE id = $2",
                        [txHash, row.id],
                    )
                    .catch((dbErr) =>
                        logger.error("[IoT] Failed to save anchor tx hash", {
                            dispenseRecordId,
                            message: dbErr.message,
                        }),
                    );
                logger.info("[IoT] Anchor hash stored", { txHash, dispenseRecordId });
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

module.exports = { enqueueAnchor };
