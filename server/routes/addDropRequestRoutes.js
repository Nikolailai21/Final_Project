const express = require("express");
const router = express.Router();
const addDropRequestController = require("../controllers/addDropRequestController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.patch(
  "/:id/review",
  verifyToken,
  authorizeRoles("advisor"),
  addDropRequestController.reviewAddDropRequest,
);

module.exports = router;
