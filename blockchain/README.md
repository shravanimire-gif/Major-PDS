# PDS Blockchain — Phase 1

Ethereum Sepolia audit trail for the Public Distribution System.  
Every successful ration dispense is recorded on-chain via `PDSLedger.sol`.  
PostgreSQL remains the primary database; the blockchain is immutable evidence only.

---

## Folder Structure

```
blockchain/
├── contracts/
│   └── PDSLedger.sol        ← Smart contract
├── scripts/
│   └── deploy.js            ← Deployment script
├── test/
│   └── PDSLedger.test.js    ← 7 unit tests
├── deployments.json         ← Created after deploy (not committed)
├── hardhat.config.js
├── package.json
├── .env                     ← Never committed (secrets live here)
└── README.md
```

---

## Environment Variables

Create `blockchain/.env` with:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
PRIVATE_KEY=<64-hex-char private key, WITHOUT 0x prefix>
ETHERSCAN_API_KEY=<optional, for contract verification>
```

Never commit this file. It is in `.gitignore`.

---

## Compile

```bash
cd blockchain
npm install
npm run compile
```

Expected output:
```
Compiled 1 Solidity file successfully (evm target: paris).
```

---

## Test

```bash
npm test
```

Expected output:
```
PDSLedger
  ✔ deploys with owner set correctly
  ✔ records a transaction and returns recordId = 1
  ✔ stores correct data on chain
  ✔ emits RationDispensed event
  ✔ rejects calls from non-owner
  ✔ rejects empty cardNumber
  ✔ rejects all zero quantities
  ✔ getCardHistory returns correct record IDs

8 passing
```

---

## Deploy to Sepolia

Make sure your wallet has at least 0.01 Sepolia ETH.  
Get test ETH from: https://sepoliafaucet.com or https://faucet.quicknode.com/ethereum/sepolia

```bash
npm run deploy:sepolia
```

Expected output:
```
Deploying PDSLedger to sepolia ...
Deployer address: 0x...
Deployer balance: 0.05 ETH

✅ PDSLedger deployed!
Contract address: 0x...
Network: sepolia
Transaction hash: 0x...

Etherscan URL:
https://sepolia.etherscan.io/address/0x...

Deployment info saved to blockchain/deployments.json

=== ADD THESE TO pds-backend/.env ===
BLOCKCHAIN_CONTRACT_ADDRESS=0x...
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
BLOCKCHAIN_PRIVATE_KEY=<same key as blockchain/.env PRIVATE_KEY>
======================================
```

---

## Verify on Etherscan (optional)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

---

## Deploy Locally (for development)

Start a local Hardhat node in one terminal:
```bash
npm run node
```

Deploy in another terminal:
```bash
npm run deploy:local
```

---

## After Deploy — Update pds-backend/.env

Add these four lines to `pds-backend/.env`:

```
BLOCKCHAIN_CONTRACT_ADDRESS=0x<address from deployments.json>
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
BLOCKCHAIN_PRIVATE_KEY=<your private key>
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `PRIVATE_KEY` account not configured | Ensure `PRIVATE_KEY` in `.env` has no `0x` prefix and is exactly 64 hex chars |
| `Insufficient funds` | Get Sepolia ETH from a faucet |
| `nonce too low` | Wait a minute and retry; previous tx may be pending |
| `invalid project` / Hardhat not found | Run `npm install` inside `blockchain/` |
| Tests fail with `revertedWith` | Ensure you're on hardhat network, not sepolia, for tests |
| Etherscan verification fails | Wait ~1 minute after deploy before verifying |

---

## What Goes On-Chain

| ✅ On-chain | ❌ NOT on-chain |
|---|---|
| Ration dispense records | Users / beneficiaries |
| Card number, shop code, quantities | OTPs / QR sessions |
| PostgreSQL transaction UUID | Wallets / policies |
| Timestamp | Authentication |

---

## Phase 2 (not built yet)

- `pds-backend/src/services/blockchainService.js` — calls `recordTransaction()` post-dispense
- Saves returned `txHash` to `transactions.blockchain_tx_hash` in PostgreSQL
- "View on Etherscan" button in admin transaction history
