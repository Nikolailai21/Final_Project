const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const regController = require("../controllers/registrationController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.get("/me/record", verifyToken, studentController.getStudentRecord);
router.get(
  "/me/registrations",
  verifyToken,
  studentController.getMyRegistrations,
);
router.get(
  "/me/eligible-courses",
  verifyToken,
  authorizeRoles("student"),
  regController.getEligibleCourses,
);
router.get(
  "/",
  verifyToken,
  authorizeRoles("advisor"),
  studentController.getStudents,
);
router.get(
  "/:id/record",
  verifyToken,
  authorizeRoles("advisor"),
  studentController.getStudentRecord,
);
router.get(
  "/:studentId/registrations",
  verifyToken,
  authorizeRoles("advisor"),
  studentController.getStudentRegistrations,
);
router.get(
  "/:studentId/eligible-courses",
  verifyToken,
  authorizeRoles("advisor"),
  regController.getEligibleCourses,
);
module.exports = router;
