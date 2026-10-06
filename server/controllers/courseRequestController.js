const Offering = require("../models/Offering");
const Registration = require("../models/Registration");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseRequest = require("../models/CourseRequest");
const AdvisorNotification = require("../models/AdvisorNotification");
const AddDropRequest = require("../models/AddDropRequest");
const Record = require("../models/Record");
const User = require("../models/User");
const {
  describeScheduleConflict,
  findScheduleConflict,
  hasScheduleConflict,
} = require("../utils/schedule");

const removeOrphanedApprovedCourseRequests = async (studentId) => {
  const approvedRequests = await CourseRequest.find({
    studentId,
    status: "approved",
  }).select("_id courseId term");
  if (approvedRequests.length === 0) return;

  const registrations = await Registration.find({
    studentId,
    term: { $in: [...new Set(approvedRequests.map((request) => request.term))] },
    status: "registered",
  }).populate({
    path: "offeringId",
    select: "courseId",
  });
  const registeredCourses = new Set(
    registrations
      .filter((registration) => registration.offeringId?.courseId)
      .map(
        (registration) =>
          `${registration.term}:${String(
            registration.offeringId.courseId._id ||
              registration.offeringId.courseId,
          )}`,
      ),
  );
  const orphanedRequestIds = approvedRequests
    .filter(
      (request) =>
        !registeredCourses.has(
          `${request.term}:${String(request.courseId)}`,
        ),
    )
    .map((request) => request._id);

  if (orphanedRequestIds.length > 0) {
    await CourseRequest.deleteMany({ _id: { $in: orphanedRequestIds } });
  }
};

exports.getMyCourseRequests = async (req, res) => {
  try {
    await removeOrphanedApprovedCourseRequests(req.user.id);
    const requests = await CourseRequest.find({ studentId: req.user.id })
        .sort({ createdAt: -1 })
        .populate("courseId");
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAdvisorPendingRequests = async (req, res) => {
  try {
    const students = await User.find({
      advisorId: req.user.id,
      role: "student",
      active: true,
    }).select("_id name studentId");
    const studentIds = students.map((student) => student._id);
    if (studentIds.length === 0) {
      return res.json([]);
    }

    const [courseRequests, registrations, addDropRequests] = await Promise.all([
      CourseRequest.find({
        studentId: { $in: studentIds },
        term: "2026-2",
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .populate("courseId")
        .populate("studentId", "name studentId"),
      Registration.find({
        studentId: { $in: studentIds },
        term: "2026-2",
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .populate({
          path: "offeringId",
          populate: { path: "courseId" },
        })
        .populate("studentId", "name studentId"),
      AddDropRequest.find({
        advisorId: req.user.id,
        term: "2026-2",
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .populate("studentId", "name studentId")
        .populate({
          path: "registrationId",
          populate: { path: "offeringId", populate: { path: "courseId" } },
        })
        .populate({
          path: "targetOfferingId",
          populate: { path: "courseId" },
        }),
    ]);

    const notifications = [
      ...courseRequests.map((request) => ({
        id: request._id,
        requestType: "course",
        studentId: request.studentId?._id,
        studentName: request.studentId?.name,
        studentNumber: request.studentId?.studentId,
        courseCode: request.courseId?.code,
        courseTitle: request.courseId?.title,
        term: request.term,
        createdAt: request.createdAt,
      })),
      ...registrations.map((registration) => ({
        id: registration._id,
        requestType: "section",
        studentId: registration.studentId?._id,
        studentName: registration.studentId?.name,
        studentNumber: registration.studentId?.studentId,
        courseCode: registration.offeringId?.courseId?.code,
        courseTitle: registration.offeringId?.courseId?.title,
        term: registration.term,
        createdAt: registration.createdAt,
      })),
      ...addDropRequests.map((request) => ({
        id: request._id,
        requestType: "add_drop",
        studentId: request.studentId?._id,
        studentName: request.studentId?.name,
        studentNumber: request.studentId?.studentId,
        courseCode:
          request.registrationId?.offeringId?.courseId?.code || "Course",
        courseTitle:
          request.registrationId?.offeringId?.courseId?.title || "",
        term: request.term,
        addDropType: request.requestType,
        message: request.message,
        currentSection: request.registrationId?.offeringId?.section,
        targetSection: request.targetOfferingId?.section,
        targetSchedule: request.targetOfferingId
          ? `${request.targetOfferingId.day} ${request.targetOfferingId.startTime}-${request.targetOfferingId.endTime}`
          : "",
        createdAt: request.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const notificationStates = await AdvisorNotification.find({
      advisorId: req.user.id,
      requestId: { $in: notifications.map((notification) => notification.id) },
    }).select("requestType requestId read dismissed");
    const notificationStateByKey = new Map(
      notificationStates.map((state) => [
        `${state.requestType}:${state.requestId}`,
        { read: state.read, dismissed: state.dismissed },
      ]),
    );

    res.json(
      notifications
        .filter(
          (notification) =>
            !notificationStateByKey.get(
              `${notification.requestType}:${notification.id}`,
            )?.dismissed,
        )
        .map((notification) => ({
          ...notification,
          read:
            notificationStateByKey.get(
              `${notification.requestType}:${notification.id}`,
            )?.read || false,
        })),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setAdvisorRequestReadState = async (req, res) => {
  try {
    const { requestType, requestId } = req.params;
    const { read } = req.body;
    if (!["course", "section", "add_drop"].includes(requestType)) {
      return res.status(400).json({ message: "Invalid request type" });
    }
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "A valid request is required" });
    }
    if (typeof read !== "boolean") {
      return res.status(400).json({ message: "Read status must be true or false" });
    }

    const requestModel =
      requestType === "course"
        ? CourseRequest
        : requestType === "add_drop"
          ? AddDropRequest
          : Registration;
    const requestQuery =
      requestType === "add_drop"
        ? { _id: requestId, advisorId: req.user.id, status: "pending" }
        : { _id: requestId, status: "pending" };
    const request = await requestModel.findOne(requestQuery);
    if (!request) {
      return res.status(404).json({ message: "Pending course request not found" });
    }

    const assignedStudent = await User.exists({
      _id: request.studentId,
      advisorId: req.user.id,
      role: "student",
    });
    if (!assignedStudent) {
      return res.status(403).json({
        message: "You can only update notifications for your assigned students",
      });
    }

    const notification = await AdvisorNotification.findOneAndUpdate(
      {
        advisorId: req.user.id,
        requestType,
        requestId,
      },
      { $set: { read } },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ read: notification.read });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.dismissAdvisorRequestNotification = async (req, res) => {
  try {
    const { requestType, requestId } = req.params;
    if (!["course", "section", "add_drop"].includes(requestType)) {
      return res.status(400).json({ message: "Invalid request type" });
    }
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "A valid request is required" });
    }

    const requestModel =
      requestType === "course"
        ? CourseRequest
        : requestType === "add_drop"
          ? AddDropRequest
          : Registration;
    const requestQuery =
      requestType === "add_drop"
        ? { _id: requestId, advisorId: req.user.id, status: "pending" }
        : { _id: requestId, status: "pending" };
    const request = await requestModel.findOne(requestQuery);
    if (!request) {
      return res.status(404).json({ message: "Pending course request not found" });
    }

    const assignedStudent = await User.exists({
      _id: request.studentId,
      advisorId: req.user.id,
      role: "student",
    });
    if (!assignedStudent) {
      return res.status(403).json({
        message: "You can only update notifications for your assigned students",
      });
    }

    await AdvisorNotification.findOneAndUpdate(
      { advisorId: req.user.id, requestType, requestId },
      { $set: { dismissed: true } },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ requestId, dismissed: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudentCourseRequests = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ message: "A valid student is required" });
    }

    const assignedStudent = await User.exists({
      _id: req.params.studentId,
      advisorId: req.user.id,
      role: "student",
    });
    if (!assignedStudent) {
      return res.status(403).json({
        message: "You can only view requests for your assigned students",
      });
    }

    await removeOrphanedApprovedCourseRequests(req.params.studentId);
    const requests = await CourseRequest.find({
      studentId: req.params.studentId,
    })
        .sort({ createdAt: -1 })
        .populate("courseId");
    const pendingRequests = requests.filter(
      (request) => request.status === "pending",
    );
    const terms = [...new Set(pendingRequests.map((request) => request.term))];
    const courseIds = [
      ...new Set(
          pendingRequests
              .filter((request) => request.courseId)
              .map((request) => request.courseId._id.toString()),
      ),
    ];
    const [offerings, registrations] = await Promise.all([
      Offering.find({ term: { $in: terms }, courseId: { $in: courseIds } })
          .sort({ section: 1 })
          .populate("courseId"),
      Registration.find({
        studentId: req.params.studentId,
        term: { $in: terms },
        status: { $in: ["pending", "registered"] },
      }).populate({
        path: "offeringId",
        populate: { path: "courseId" },
      }),
    ]);

    res.json(
        requests.map((request) => {
          const offering = offerings.find(
              (item) =>
                item.term === request.term &&
                request.courseId &&
                item.courseId._id.toString() === request.courseId._id.toString(),
          );
          const conflict = request.status === "pending" && offering
              ? registrations.find(
                  (registration) =>
                    registration.term === request.term &&
                    registration.offeringId &&
                    hasScheduleConflict(offering, registration.offeringId),
              )
              : null;
          const requestData = request.toObject();
          requestData.scheduleOffering = offering || null;
          requestData.scheduleConflict = conflict
              ? describeScheduleConflict(conflict)
              : null;
          return requestData;
        }),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createCourseRequest = async (req, res) => {
  try {
    const { courseId, term = "2026-2" } = req.body;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "A valid course is required" });
    }
    if (typeof term !== "string" || !/^\d{4}-\d+$/.test(term)) {
      return res.status(400).json({ message: "A valid term is required" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const openOffering = await Offering.exists({
      courseId,
      term,
      addDropOpen: true,
      $expr: { $lt: ["$seatsTaken", "$seats"] },
    });
    if (!openOffering) {
      return res.status(409).json({
        message:
          "This course is unavailable for student requests. The advisor must open a section with available seats first.",
      });
    }

    const existingRecord = await Record.exists({
      studentId: req.user.id,
      courseId,
    });
    if (existingRecord) {
      return res.status(400).json({
        message: "This course already appears in your academic history",
      });
    }

    const existingRequest = await CourseRequest.findOne({
      studentId: req.user.id,
      courseId,
      term,
      status: { $in: ["pending", "approved"] },
    });
    if (existingRequest) {
      return res.status(409).json({
        message: "You already have a pending or approved request for this course",
      });
    }

    const request = await CourseRequest.create({
      studentId: req.user.id,
      courseId,
      term,
      status: "pending",
    });
    res.status(201).json(await request.populate("courseId"));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.reviewCourseRequest = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res
          .status(400)
          .json({ message: "Decision must be approved or rejected" });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "A valid request is required" });
    }

    const request = await CourseRequest.findById(req.params.id);
    if (!request || request.status !== "pending") {
      return res
          .status(404)
          .json({ message: "Pending course request not found" });
    }

    const assignedStudent = await User.exists({
      _id: request.studentId,
      advisorId: req.user.id,
      role: "student",
    });
    if (!assignedStudent) {
      return res.status(403).json({
        message: "You can only review requests for your assigned students",
      });
    }

    if (status === "approved") {
      const hasAcademicRecord = await Record.exists({
        studentId: request.studentId,
        courseId: request.courseId,
      });
      if (hasAcademicRecord) {
        return res.status(409).json({
          message: "This course now appears in the student's academic history",
        });
      }

      const offering = await Offering.findOne({
        courseId: request.courseId,
        term: request.term,
        addDropOpen: true,
        $expr: { $lt: ["$seatsTaken", "$seats"] },
      })
          .sort({ section: 1 })
          .populate("courseId");
      if (!offering) {
        return res.status(409).json({
          message:
            "No open section with available seats exists for this course and term.",
        });
      }

      const scheduleConflict = await findScheduleConflict({
        studentId: request.studentId,
        term: request.term,
        offering,
      });
      if (scheduleConflict) {
        return res.status(409).json({
          message: `${describeScheduleConflict(scheduleConflict)} You chose the same day and time. Please choose another course.`,
        });
      }

      const reservedOffering = await Offering.findOneAndUpdate(
          {
            _id: offering._id,
            addDropOpen: true,
            $expr: { $lt: ["$seatsTaken", "$seats"] },
          },
          { $inc: { seatsTaken: 1 } },
          { new: true },
      );
      if (!reservedOffering) {
        return res.status(409).json({
          message: "This course section is full.",
        });
      }

      let registration;
      try {
        registration = await Registration.create({
          studentId: request.studentId,
          offeringId: offering._id,
          term: request.term,
          status: "registered",
        });

        const reviewedRequest = await CourseRequest.findOneAndUpdate(
            { _id: request._id, status: "pending" },
            {
              $set: {
                status,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
              },
            },
            { new: true },
        ).populate("courseId");

        if (!reviewedRequest) {
          await Registration.findByIdAndDelete(registration._id);
          await Offering.updateOne(
              { _id: offering._id, seatsTaken: { $gt: 0 } },
              { $inc: { seatsTaken: -1 } },
          );
          return res.status(409).json({
            message: "This course request has already been reviewed",
          });
        }

        return res.json(reviewedRequest);
      } catch (err) {
        if (registration) {
          await Registration.findByIdAndDelete(registration._id);
        }
        await Offering.updateOne(
            { _id: offering._id, seatsTaken: { $gt: 0 } },
            { $inc: { seatsTaken: -1 } },
        );
        throw err;
      }
    }

    const reviewedRequest = await CourseRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        {
          $set: {
            status,
            reviewedBy: req.user.id,
            reviewedAt: new Date(),
          },
        },
        { new: true },
    ).populate("courseId");

    if (!reviewedRequest) {
      return res.status(409).json({
        message: "This course request has already been reviewed",
      });
    }

    res.json(reviewedRequest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCourseRequest = async (req, res) => {
  try {
    const request = await CourseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // --- STUDENT LOGIC: Take back a pending request ---
    if (req.user.role === "student") {
      if (request.studentId.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      if (request.status !== "pending") {
        return res.status(400).json({ message: "You can only take back pending requests." });
      }

      await CourseRequest.findByIdAndDelete(req.params.id);
      return res.json({ message: "Request taken back successfully" });
    }

    // --- ADVISOR LOGIC: Remove an approved request ---
    if (req.user.role === "advisor") {
      const assignedStudent = await User.exists({
        _id: request.studentId,
        advisorId: req.user.id,
        role: "student",
      });
      if (!assignedStudent) {
        return res.status(403).json({ message: "Unauthorized for this student" });
      }

      // Remove the student's registration without deleting the shared course offering.
      if (request.status === "approved") {
        const offerings = await Offering.find({
          courseId: request.courseId,
          term: request.term,
        });
        const registration = await Registration.findOneAndDelete({
          studentId: request.studentId,
          offeringId: { $in: offerings.map((offering) => offering._id) },
          term: request.term,
          status: "registered",
        });
        if (registration) {
          await Offering.updateOne(
              { _id: registration.offeringId, seatsTaken: { $gt: 0 } },
              { $inc: { seatsTaken: -1 } },
          );
        }
      }

      // 3. Finally, delete the request record entirely
      await CourseRequest.findByIdAndDelete(req.params.id);
      return res.json({ message: "Approved course removed and schedule cleared successfully" });
    }

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};