const express = require("express");
const router = express.Router();
const regController = require("../controllers/registrationController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.post(
  "/",
  verifyToken,
  authorizeRoles("advisor"),
  regController.registerCourse,
);
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("advisor"),
  regController.dropCourse,
);
module.exports = router;
