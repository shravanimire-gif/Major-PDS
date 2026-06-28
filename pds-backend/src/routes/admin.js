const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createRationCardSchema,
  createShopkeeperSchema,
  updateUserSchema,
  createAreaSchema,
  updateAreaSchema,
  createShopSchema,
} = require("../validators/admin");
const {
  createRationCard,
  getRationCards,
  bulkCreateRationCards,
  bulkCreateShops,
  bulkAddFamilyMembers,
  getBeneficiaries,
  getUsers,
  updateUser,
  deleteUser,
  getAreas,
  createArea,
  updateArea,
  getShops,
  createShop,
  deleteShop,
  getUnassignedShopkeepers,
  assignShopkeeper,
  createShopkeeper,
  getDbHealth,
  getIntegrityChecks,
} = require("../controllers/adminController");

const router = express.Router();

router.use(verifyToken, requireRole("admin"));

router.post("/ration-cards/bulk", bulkCreateRationCards);
router.post("/family-members/bulk", bulkAddFamilyMembers);
router.post("/ration-cards", validate(createRationCardSchema), createRationCard);
router.get("/ration-cards", getRationCards);
router.get("/beneficiaries", getBeneficiaries);
router.get("/users", getUsers);
router.put("/users/:id", validate(updateUserSchema), updateUser);
router.delete("/users/:id", deleteUser);
router.get("/areas", getAreas);
router.post("/areas", validate(createAreaSchema), createArea);
router.put("/areas/:id", validate(updateAreaSchema), updateArea);
router.get("/shops", getShops);
router.post("/shops/bulk", bulkCreateShops);
router.post("/shops", validate(createShopSchema), createShop);
router.delete("/shops/:id", deleteShop);
router.get("/shopkeepers/unassigned", getUnassignedShopkeepers);
router.patch("/shops/:id/assign-shopkeeper", assignShopkeeper);
router.post("/shopkeepers", validate(createShopkeeperSchema), createShopkeeper);
router.get("/health", getDbHealth);
router.get("/validation/integrity", getIntegrityChecks);

module.exports = router;
