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
