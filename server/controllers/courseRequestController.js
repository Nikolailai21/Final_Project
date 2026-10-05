const Offering = require("../models/Offering");
const Registration = require("../models/Registration");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseRequest = require("../models/CourseRequest");
const Record = require("../models/Record");
const User = require("../models/User");
const {
  describeScheduleConflict,
  findScheduleConflict,
  hasScheduleConflict,
} = require("../utils/schedule");

exports.getMyCourseRequests = async (req, res) => {
  try {
    const requests = await CourseRequest.find({ studentId: req.user.id })
        .sort({ createdAt: -1 })
        .populate("courseId");
    res.json(requests);
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
      })
          .sort({ section: 1 })
          .populate("courseId");
      if (!offering) {
        return res.status(409).json({
          message: "No scheduled offering exists for this course and term.",
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