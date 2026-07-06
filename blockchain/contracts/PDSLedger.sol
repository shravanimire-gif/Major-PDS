// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PDSLedger
 * @notice Immutable audit trail for Public Distribution System ration dispenses.
 *         Only successful ration dispense records are stored on-chain.
 *         This contract does NOT store: OTPs, QR sessions, wallet balances,
 *         family members, policies, personal information, or authentication data.
 */
contract PDSLedger {

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted after every successful ration dispense recorded on-chain.
     * @param recordId       Auto-incrementing on-chain record ID.
     * @param transactionId  PostgreSQL transaction UUID for cross-reference.
     * @param cardNumber     Ration card number (e.g. "GJ-BPL-001").
     * @param shopCode       Shop code (e.g. "DHP-001").
     * @param riceQtyGrams   Rice dispensed in grams (kg × 1000).
     * @param wheatQtyGrams  Wheat dispensed in grams (kg × 1000).
     * @param timestamp      Unix timestamp supplied by the backend.
     */
    event RationDispensed(
        uint256 indexed recordId,
        string          transactionId,
        string  indexed cardNumber,
        string          shopCode,
        uint256         riceQtyGrams,
        uint256         wheatQtyGrams,
        uint256         timestamp
    );

    // -------------------------------------------------------------------------
    // DATA STRUCTURE
    // -------------------------------------------------------------------------

    struct DispenseRecord {
        uint256 recordId;
        string  transactionId;   // PostgreSQL transaction UUID
        string  cardNumber;      // Ration card number
        string  shopCode;        // Shop code
        uint256 riceQtyGrams;    // Rice in grams (avoids decimals on-chain)
        uint256 wheatQtyGrams;   // Wheat in grams
        uint256 timestamp;       // Unix timestamp from backend
    }

    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    address public owner;
    uint256 public totalRecords;

    mapping(uint256 => DispenseRecord) public records;
    mapping(string  => uint256[])      public cardHistory;  // cardNumber → recordIds

    // -------------------------------------------------------------------------
    // ACCESS CONTROL
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "PDSLedger: caller is not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        totalRecords = 0;
    }

    // -------------------------------------------------------------------------
    // WRITE — called by Node.js backend after every successful dispense
    // -------------------------------------------------------------------------

    /**
     * @notice Record a ration dispense on-chain.
     * @param transactionId  PostgreSQL UUID of the transaction row.
     * @param cardNumber     Beneficiary ration card number.
     * @param shopCode       Shop code where dispense occurred.
     * @param riceQtyGrams   Rice quantity in grams (pass kg × 1000).
     * @param wheatQtyGrams  Wheat quantity in grams (pass kg × 1000).
     * @param timestamp      Unix epoch timestamp.
     * @return newRecordId   The on-chain record ID assigned.
     */
    function recordTransaction(
        string memory transactionId,
        string memory cardNumber,
        string memory shopCode,
        uint256       riceQtyGrams,
        uint256       wheatQtyGrams,
        uint256       timestamp
    ) external onlyOwner returns (uint256 newRecordId) {
        require(bytes(transactionId).length > 0,  "PDSLedger: transactionId required");
        require(bytes(cardNumber).length  > 0,    "PDSLedger: cardNumber required");
        require(bytes(shopCode).length    > 0,    "PDSLedger: shopCode required");
        require(riceQtyGrams > 0 || wheatQtyGrams > 0,
                "PDSLedger: at least one quantity must be > 0");

        totalRecords  += 1;
        newRecordId    = totalRecords;

        records[newRecordId] = DispenseRecord({
            recordId:      newRecordId,
            transactionId: transactionId,
            cardNumber:    cardNumber,
            shopCode:      shopCode,
            riceQtyGrams:  riceQtyGrams,
            wheatQtyGrams: wheatQtyGrams,
            timestamp:     timestamp
        });

        cardHistory[cardNumber].push(newRecordId);

        emit RationDispensed(
            newRecordId,
            transactionId,
            cardNumber,
            shopCode,
            riceQtyGrams,
            wheatQtyGrams,
            timestamp
        );
    }

    // -------------------------------------------------------------------------
    // READ — view functions (no gas cost)
    // -------------------------------------------------------------------------

    /// @notice Fetch a single dispense record by on-chain ID.
    function getRecord(uint256 recordId)
        external
        view
        returns (DispenseRecord memory)
    {
        require(
            recordId > 0 && recordId <= totalRecords,
            "PDSLedger: record not found"
        );
        return records[recordId];
    }

    /// @notice Get all on-chain record IDs for a given ration card number.
    function getCardHistory(string memory cardNumber)
        external
        view
        returns (uint256[] memory)
    {
        return cardHistory[cardNumber];
    }

    /// @notice Total number of records stored on-chain.
    function getTotalRecords() external view returns (uint256) {
        return totalRecords;
    }
}
