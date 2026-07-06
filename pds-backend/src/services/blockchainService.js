/**
 * blockchainService.js
 *
 * Connects to the deployed PDSLedger smart contract on Sepolia and records
 * ration dispense transactions on-chain.
 *
 * Design contract:
 *  - This service NEVER throws — all errors are caught, logged, and returned
 *    as { success: false, error } so the dispense flow is never blocked.
 *  - It does NOT store OTPs, QR sessions, wallet balances, family members,
 *    policies, personal information, or authentication data on-chain.
 *  - Only the minimal audit fields go on-chain:
 *    transactionId, cardNumber, shopCode, riceQtyGrams, wheatQtyGrams, timestamp
 */

const path = require("path");
const dotenv = require("dotenv");
const logger = require("../config/logger");

// Load pds-backend/.env (same file the rest of the app uses)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ─── Lazy-loaded ethers instance ─────────────────────────────────────────────
// We load ethers lazily so the backend starts normally even if the
// blockchain/ package is not installed.
let _ethers = null;
let _contract = null;
let _initFailed = false;

/**
 * Minimal ABI — only the functions this service needs.
 */
const PDSLEDGER_ABI = [
    {
        inputs: [
            { internalType: "string", name: "transactionId", type: "string" },
            { internalType: "string", name: "cardNumber", type: "string" },
            { internalType: "string", name: "shopCode", type: "string" },
            { internalType: "uint256", name: "riceQtyGrams", type: "uint256" },
            { internalType: "uint256", name: "wheatQtyGrams", type: "uint256" },
            { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        name: "recordTransaction",
        outputs: [{ internalType: "uint256", name: "newRecordId", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "getTotalRecords",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

/**
 * Initialise the ethers provider + contract signer.
 * Returns true on success, false if configuration is missing or invalid.
 */
async function _init() {
    if (_contract) return true;   // already initialised
    if (_initFailed) return false;  // already tried and failed

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const rawPrivateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

    if (!rpcUrl || !rawPrivateKey || !contractAddress) {
        logger.warn("[Blockchain] Skipping — BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY, " +
            "or BLOCKCHAIN_CONTRACT_ADDRESS not set in .env");
        _initFailed = true;
        return false;
    }

    try {
        // Dynamic import so the backend doesn't crash if ethers is absent
        _ethers = require("ethers");

        // Normalise private key: accept with or without 0x prefix
        const privateKey = rawPrivateKey.startsWith("0x")
            ? rawPrivateKey
            : `0x${rawPrivateKey}`;

        const provider = new _ethers.JsonRpcProvider(rpcUrl);
        const signer = new _ethers.Wallet(privateKey, provider);
        _contract = new _ethers.Contract(contractAddress, PDSLEDGER_ABI, signer);

        logger.info("[Blockchain] Service initialised", {
            contractAddress,
            network: process.env.BLOCKCHAIN_NETWORK || "unknown",
        });
        return true;
    } catch (err) {
        logger.error("[Blockchain] Initialisation failed", { error: err.message });
        _initFailed = true;
        return false;
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Record a ration dispense on the PDSLedger smart contract.
 *
 * @param {object} params
 * @param {string} params.transactionId  - PostgreSQL transaction UUID
 * @param {string} params.cardNumber     - Ration card number
 * @param {string} params.shopCode       - Shop code
 * @param {number} params.riceQtyKg      - Rice dispensed in kg (converted to grams internally)
 * @param {number} params.wheatQtyKg     - Wheat dispensed in kg (converted to grams internally)
 * @param {number} [params.timestamp]    - Unix epoch (defaults to now)
 *
 * @returns {{ success: boolean, txHash?: string, error?: string }}
 */
async function recordDispense({
    transactionId,
    cardNumber,
    shopCode,
    riceQtyKg = 0,
    wheatQtyKg = 0,
    timestamp,
}) {
    const ready = await _init();
    if (!ready) {
        return { success: false, error: "Blockchain service not configured" };
    }

    try {
        const riceGrams = Math.round(Number(riceQtyKg) * 1000);
        const wheatGrams = Math.round(Number(wheatQtyKg) * 1000);
        const ts = timestamp || Math.floor(Date.now() / 1000);

        logger.info("[Blockchain] Submitting transaction", {
            transactionId,
            cardNumber,
            shopCode,
            riceGrams,
            wheatGrams,
        });

        const tx = await _contract.recordTransaction(
            transactionId,
            cardNumber,
            shopCode,
            riceGrams,
            wheatGrams,
            ts
        );

        // Wait for 1 confirmation
        const receipt = await tx.wait(1);

        logger.info("[Blockchain] Transaction confirmed", {
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            transactionId,
        });

        return { success: true, txHash: receipt.hash };
    } catch (err) {
        logger.error("[Blockchain] Transaction failed", {
            error: err.message,
            transactionId,
            cardNumber,
        });
        return { success: false, error: err.message };
    }
}

/**
 * Health check — returns true if the contract is reachable.
 * Safe to call at startup; logs warnings on misconfiguration.
 */
async function healthCheck() {
    const ready = await _init();
    if (!ready) return false;

    try {
        const total = await _contract.getTotalRecords();
        logger.info("[Blockchain] Health check passed", { totalRecords: total.toString() });
        return true;
    } catch (err) {
        logger.warn("[Blockchain] Health check failed", { error: err.message });
        return false;
    }
}

module.exports = { recordDispense, healthCheck };
