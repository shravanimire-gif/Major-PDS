const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { dispenseSchema, transactionSchema } = require("../validators/shopkeeper");
const {
  getMe,
  getBeneficiaryByRationCardId,
  dispense,
  createTransaction,
} = require("../controllers/shopkeeperController");

const router = express.Router();

router.use(verifyToken, requireRole("shopkeeper"));

router.get("/me", getMe);
router.get("/beneficiary/:id", getBeneficiaryByRationCardId);
router.post("/dispense", validate(dispenseSchema), dispense);
router.post("/transactions", validate(transactionSchema), createTransaction);

module.exports = router;
