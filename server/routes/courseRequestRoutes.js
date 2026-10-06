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
    "/advisor/pending",
    verifyToken,
    authorizeRoles("advisor"),
    courseRequestController.getAdvisorPendingRequests,
);
router.patch(
    "/advisor/notifications/:requestType/:requestId",
    verifyToken,
    authorizeRoles("advisor"),
    courseRequestController.setAdvisorRequestReadState,
);
router.delete(
    "/advisor/notifications/:requestType/:requestId",
    verifyToken,
    authorizeRoles("advisor"),
    courseRequestController.dismissAdvisorRequestNotification,
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
router.delete(
    "/:id",
    verifyToken,
    courseRequestController.deleteCourseRequest,
);

module.exports = router;