const express = require("express");
const router = express.Router();
const offeringController = require("../controllers/offeringController");
const offeringOptionController = require("../controllers/offeringOptionController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.get("/options", verifyToken, offeringOptionController.getOfferingOptions);
router.get(
  "/open",
  verifyToken,
  authorizeRoles("student"),
  offeringController.getOpenOfferings,
);
router.patch(
  "/open/:offeringId/read-state",
  verifyToken,
  authorizeRoles("student"),
  offeringController.setStudentOfferingNotificationReadState,
);
router.delete(
  "/open/:offeringId/notification",
  verifyToken,
  authorizeRoles("student"),
  offeringController.dismissStudentOfferingNotification,
);
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
