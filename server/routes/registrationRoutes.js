const express = require("express");
const router = express.Router();
const regController = require("../controllers/registrationController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.post(
  "/request",
  verifyToken,
  authorizeRoles("student"),
  regController.requestCourse,
);
router.patch(
  "/:id/approve",
  verifyToken,
  authorizeRoles("advisor"),
  regController.approveCourseRequest,
);
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
