const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const regController = require("../controllers/registrationController");
const { verifyToken } = require("../middleware/auth");

router.get("/me/record", verifyToken, studentController.getStudentRecord);
router.get(
  "/me/registrations",
  verifyToken,
  studentController.getMyRegistrations,
);
router.get("/:id/record", verifyToken, studentController.getStudentRecord);
router.get(
  "/:studentId/eligible",
  verifyToken,
  regController.getEligibleCourses,
);
module.exports = router;
