const express = require("express");
const router = express.Router();
const courseRequestController = require("../controllers/courseRequestController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.get(
  "/me",
  verifyToken,
  authorizeRoles("student"),
  courseRequestController.getMyCourseRequests,
);
router.get(
  "/student/:studentId",
  verifyToken,
  authorizeRoles("advisor"),
  courseRequestController.getStudentCourseRequests,
);
router.post(
  "/",
  verifyToken,
  authorizeRoles("student"),
  courseRequestController.createCourseRequest,
);
router.patch(
  "/:id",
  verifyToken,
  authorizeRoles("advisor"),
  courseRequestController.reviewCourseRequest,
);

module.exports = router;
