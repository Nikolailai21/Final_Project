const express = require("express");
const router = express.Router();
const offeringController = require("../controllers/offeringController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.get("/", verifyToken, offeringController.getOfferings);
router.post(
  "/",
  verifyToken,
  authorizeRoles("advisor"),
  offeringController.createOffering,
);
router.put(
  "/:id",
  verifyToken,
  authorizeRoles("advisor"),
  offeringController.updateOffering,
);
router.patch(
  "/:id",
  verifyToken,
  authorizeRoles("advisor"),
  offeringController.updateOffering,
);
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("advisor"),
  offeringController.deleteOffering,
);
module.exports = router;
