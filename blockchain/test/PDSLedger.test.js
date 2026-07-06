const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PDSLedger", function () {
    let contract;
    let owner;
    let otherAccount;

    // Helper: a valid UUID string
    const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
    const uuid2 = "660e8400-e29b-41d4-a716-446655440001";

    beforeEach(async function () {
        [owner, otherAccount] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("PDSLedger");
        contract = await Factory.deploy();
    });

    // --- Ownership ---

    it("sets owner to deployer", async function () {
        expect(await contract.owner()).to.equal(owner.address);
    });

    // --- Happy path ---

    it("records a transaction and increments totalRecords", async function () {
        const ts = Math.floor(Date.now() / 1000);
        const tx = await contract.recordTransaction(
            uuid1, "GJ-BPL-001", "DHP-001",
            5000, 3000, ts
        );
        await tx.wait();
        expect(await contract.getTotalRecords()).to.equal(1);
    });

    it("stores correct fields on-chain", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await contract.recordTransaction(uuid1, "GJ-BPL-001", "DHP-001", 5000, 3000, ts);

        const rec = await contract.getRecord(1);
        expect(rec.transactionId).to.equal(uuid1);
        expect(rec.cardNumber).to.equal("GJ-BPL-001");
        expect(rec.shopCode).to.equal("DHP-001");
        expect(rec.riceQtyGrams).to.equal(5000);
        expect(rec.wheatQtyGrams).to.equal(3000);
        expect(rec.timestamp).to.equal(ts);
        expect(rec.recordId).to.equal(1);
    });

    it("emits RationDispensed event with correct args", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await expect(
            contract.recordTransaction(uuid1, "GJ-BPL-001", "DHP-001", 5000, 3000, ts)
        )
            .to.emit(contract, "RationDispensed")
            .withArgs(1, uuid1, "GJ-BPL-001", "DHP-001", 5000, 3000, ts);
    });

    it("getCardHistory tracks multiple records for same card", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await contract.recordTransaction(uuid1, "GJ-BPL-001", "DHP-001", 5000, 3000, ts);
        await contract.recordTransaction(uuid2, "GJ-BPL-001", "DHP-002", 4000, 2000, ts);

        const history = await contract.getCardHistory("GJ-BPL-001");
        expect(history.length).to.equal(2);
        expect(history[0]).to.equal(1);
        expect(history[1]).to.equal(2);
    });

    // --- Access control ---

    it("rejects recordTransaction from non-owner", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await expect(
            contract.connect(otherAccount).recordTransaction(
                uuid1, "GJ-BPL-001", "DHP-001", 5000, 3000, ts
            )
        ).to.be.revertedWith("PDSLedger: caller is not owner");
    });

    // --- Input validation ---

    it("rejects empty transactionId", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await expect(
            contract.recordTransaction("", "GJ-BPL-001", "DHP-001", 5000, 3000, ts)
        ).to.be.revertedWith("PDSLedger: transactionId required");
    });

    it("rejects empty cardNumber", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await expect(
            contract.recordTransaction(uuid1, "", "DHP-001", 5000, 3000, ts)
        ).to.be.revertedWith("PDSLedger: cardNumber required");
    });

    it("rejects empty shopCode", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await expect(
            contract.recordTransaction(uuid1, "GJ-BPL-001", "", 5000, 3000, ts)
        ).to.be.revertedWith("PDSLedger: shopCode required");
    });

    it("rejects both quantities zero", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await expect(
            contract.recordTransaction(uuid1, "GJ-BPL-001", "DHP-001", 0, 0, ts)
        ).to.be.revertedWith("PDSLedger: at least one quantity must be > 0");
    });

    it("accepts rice-only dispense (wheat = 0)", async function () {
        const ts = Math.floor(Date.now() / 1000);
        await contract.recordTransaction(uuid1, "GJ-BPL-001", "DHP-001", 5000, 0, ts);
        const rec = await contract.getRecord(1);
        expect(rec.riceQtyGrams).to.equal(5000);
        expect(rec.wheatQtyGrams).to.equal(0);
    });

    it("getRecord reverts for non-existent id", async function () {
        await expect(contract.getRecord(999)).to.be.revertedWith(
            "PDSLedger: record not found"
        );
    });
});
