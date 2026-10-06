const CourseRequest = require("../models/CourseRequest");
const Registration = require("../models/Registration");
const Offering = require("../models/Offering");
const Record = require("../models/Record");
const Course = require("../models/Course");
const mongoose = require("mongoose");
const User = require("../models/User");
const {
  describeScheduleConflict,
  findScheduleConflict,
  hasScheduleConflict,
} = require("../utils/schedule");

// Core Rules Engine Evaluator
exports.getEligibleCourses = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user.id;
    const term =
        req.query.term || (req.user.role === "student" ? "2026-2" : "2026-1");

    // 1. Fetch current offerings for the term
    const offerings = await Offering.find({ term }).populate("courseId");

    // 2. Fetch student's academic history (Records)
    const records = await Record.find({ studentId }).populate("courseId");

    // 3. Fetch active registrations for current term
    const currentRegs = await Registration.find({
      studentId,
      term,
      status: { $in: ["pending", "registered"] },
    }).populate({
      path: "offeringId",
      populate: { path: "courseId" },
    });

    const PASSING_GRADES = ["A", "B+", "B", "C+", "C", "D+", "D"];

    const evaluatedOfferings = offerings.map((offering) => {
      const course = offering.courseId;
      let eligible = true;
      let reason = "Eligible";
      let retakeRequired = false;

      // Check Rule 2 & 3: Academic History
      const courseRecords = records.filter(
          (r) => r.courseId._id.toString() === course._id.toString(),
      );
      const passed = courseRecords.some((r) =>
          PASSING_GRADES.includes(r.grade),
      );
      const failed = courseRecords.some((r) => r.grade === "F") && !passed;

      if (passed) {
        const lastGrade = courseRecords[courseRecords.length - 1].grade;
        return {
          offering,
          eligible: false,
          reason: `Already passed — grade ${lastGrade}`,
          retakeRequired: false,
        };
      }

      if (failed) {
        retakeRequired = true;
        reason = "Retake required (Failed in previous term)";
      }

      const activeCourseRegistration = currentRegs.find(
          (registration) =>
              String(registration.offeringId?.courseId?._id) ===
              String(course._id),
      );
      if (activeCourseRegistration) {
        eligible = false;
        reason =
            activeCourseRegistration.status === "pending"
                ? "Request pending advisor approval"
                : "Already registered this term";
      }

      if (!offering.addDropOpen) {
        eligible = false;
        reason = "Unavailable — advisor has not opened this course";
      }

      // Check Rule 4a: Seat Availability
      if (offering.seatsTaken >= offering.seats) {
        eligible = false;
        reason = "Full — 0 seats remaining";
      }

      // Check Rule 4b: Time Clash
      const scheduleConflict = currentRegs.find(
          (registration) =>
            registration.offeringId &&
            registration.offeringId._id.toString() !== offering._id.toString() &&
            hasScheduleConflict(offering, registration.offeringId),
      );
      if (scheduleConflict) {
        eligible = false;
        reason = `Clashes with ${scheduleConflict.offeringId.courseId.code} Section ${scheduleConflict.offeringId.section}`;
      }

      return {
        offering,
        eligible,
        reason,
        retakeRequired,
      };
    });

    // Sort: Retake required first, then eligible, then ineligible
    evaluatedOfferings.sort((a, b) => {
      if (a.retakeRequired && !b.retakeRequired) return -1;
      if (!a.retakeRequired && b.retakeRequired) return 1;
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return 0;
    });

    res.json(evaluatedOfferings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.requestCourse = async (req, res) => {
  try {
    const { offeringId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(offeringId)) {
      return res.status(400).json({ message: "A valid offering is required" });
    }

    const offering = await Offering.findById(offeringId).populate("courseId");
    if (!offering) {
      return res.status(404).json({ message: "Course offering not found" });
    }
    if (!offering.addDropOpen) {
      return res.status(400).json({ message: "The add/drop window is closed" });
    }
    if (offering.seatsTaken >= offering.seats) {
      return res.status(400).json({ message: "This course section is full" });
    }

    const alreadyPassed = await Record.exists({
      studentId: req.user.id,
      courseId: offering.courseId._id,
      grade: { $in: ["A", "B+", "B", "C+", "C", "D+", "D"] },
    });
    if (alreadyPassed) {
      return res
          .status(400)
          .json({ message: "You have already passed this course" });
    }

    const offeringIds = await Offering.find({
      term: offering.term,
      courseId: offering.courseId._id,
    }).distinct("_id");
    const existing = await Registration.findOne({
      studentId: req.user.id,
      offeringId: { $in: offeringIds },
      term: offering.term,
      status: { $in: ["pending", "registered"] },
    });
    if (existing) {
      return res
          .status(409)
          .json({
            message: "You already requested or registered for this course",
          });
    }

    // Fetch the student's current and pending registrations for the term
    const currentRegs = await Registration.find({
      studentId: req.user.id,
      term: offering.term,
      status: { $in: ["pending", "registered"] }
    }).populate("offeringId");

    const scheduleConflict = currentRegs.find(
        (registration) =>
          registration.offeringId &&
          registration.offeringId._id.toString() !== offering._id.toString() &&
          hasScheduleConflict(offering, registration.offeringId),
    );
    if (scheduleConflict) {
      return res.status(409).json({
        message: describeScheduleConflict(scheduleConflict),
      });
    }

    const registration = await Registration.create({
      studentId: req.user.id,
      offeringId: offering._id,
      term: offering.term,
      status: "pending",
    });
    res.status(201).json(
        await Registration.findById(registration._id).populate({
          path: "offeringId",
          populate: { path: "courseId" },
        }),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveCourseRequest = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.id,
      status: "pending",
    }).populate("offeringId");
    if (!registration) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    const assignedStudent = await User.exists({
      _id: registration.studentId,
      advisorId: req.user.id,
      role: "student",
    });
    if (!assignedStudent) {
      return res.status(403).json({
        message: "You can only approve requests for your assigned students",
      });
    }

    const courseOfferingIds = await Offering.find({
      term: registration.term,
      courseId: registration.offeringId.courseId,
    }).distinct("_id");
    const alreadyRegistered = await Registration.exists({
      studentId: registration.studentId,
      term: registration.term,
      status: "registered",
      offeringId: { $in: courseOfferingIds },
    });
    if (alreadyRegistered) {
      return res
          .status(409)
          .json({ message: "Student is already registered for this course" });
    }

    const scheduleConflict = await findScheduleConflict({
      studentId: registration.studentId,
      term: registration.term,
      offering: registration.offeringId,
      excludeRegistrationId: registration._id,
    });
    if (scheduleConflict) {
      return res.status(409).json({
        message: describeScheduleConflict(scheduleConflict),
      });
    }

    const offering = await Offering.findOneAndUpdate(
        {
          _id: registration.offeringId._id,
          addDropOpen: true,
          $expr: {$lt: ["$seatsTaken", "$seats"] },
        },
        { $inc: { seatsTaken: 1 } },
        { new: true },
    );
    if (!offering) {
      return res
          .status(400)
          .json({
            message:
              "This course section is closed or full and cannot be approved.",
          });
    }

    try {
      const approved = await Registration.findOneAndUpdate(
          { _id: registration._id, status: "pending" },
          { $set: { status: "registered" } },
          { new: true },
      ).populate({
        path: "offeringId",
        populate: { path: "courseId" },
      });
      if (!approved) {
        await Offering.updateOne(
            { _id: offering._id, seatsTaken: { $gt: 0 } },           {$inc: { seatsTaken: -1 } },
        );
        return res
            .status(409)
            .json({ message: "Request has already been reviewed" });
      }
      return res.json(approved);
    } catch (err) {
      await Offering.updateOne(
          { _id: offering._id, seatsTaken: { $gt: 0 } },         {$inc: { seatsTaken: -1 } },
      );
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.dropCourse = async (req, res) => {
  try {
    // Populate offeringId so we can access the courseId attached to it
    const registration = await Registration.findById(req.params.id).populate("offeringId");
    if (!registration)
      return res.status(404).json({ message: "Registration not found" });

    const wasRegistered = registration.status === "registered";
    registration.status = "dropped";
    await registration.save();

    const offering = registration.offeringId;
    if (wasRegistered && offering && offering.seatsTaken > 0) {
      offering.seatsTaken -= 1;
      await offering.save();
    }

    // NEW FIX: Find and delete the underlying Course Request so it doesn't get stuck forever
    if (offering && offering.courseId) {
      await CourseRequest.findOneAndDelete({
        studentId: registration.studentId,
        courseId: offering.courseId._id || offering.courseId,
        term: registration.term,
      });
    }

    res.json({ message: "Course dropped and request cleared successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};