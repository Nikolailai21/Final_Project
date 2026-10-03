const Offering = require("../models/Offering");
const Registration = require("../models/Registration");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseRequest = require("../models/CourseRequest");
const Record = require("../models/Record");
const User = require("../models/User");

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
    res.json(requests);
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

      // Hardcode the target term so it matches the frontend's NEXT_TERM
      const targetTerm = "2026-2";

      // Auto-generate an offering for the schedule (defaulting to Monday 09:00 - 12:00)
      const newOffering = await Offering.create({
        courseId: request.courseId,
        term: targetTerm,
        section: 1,
        day: "Monday",
        startTime: "09:00",
        endTime: "12:00",
        room: "TBA",
        instructor: "TBA",
        seats: 30,
        seatsTaken: 1,
        addDropOpen: true
      });

      // Automatically register the student to this new schedule offering
      await Registration.create({
        studentId: request.studentId,
        offeringId: newOffering._id,
        term: targetTerm,
        status: "registered"
      });
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

      // If it was already approved, we must clean up the auto-generated Schedule & Registration
      if (request.status === "approved") {
        const targetTerm = "2026-2"; // Match the hardcoded term we set earlier

        const offering = await Offering.findOne({
          courseId: request.courseId,
          term: targetTerm
        });

        if (offering) {
          // 1. Delete the student's registration for this auto-generated block
          await Registration.findOneAndDelete({
            studentId: request.studentId,
            offeringId: offering._id,
          });
          // 2. Delete the auto-generated schedule block itself
          await Offering.findByIdAndDelete(offering._id);
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