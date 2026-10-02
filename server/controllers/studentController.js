const Record = require("../models/Record");
const Registration = require("../models/Registration");
const User = require("../models/User");

exports.getStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      advisorId: req.user.id,
      active: true,
    }).select("name email studentId");
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudentRecord = async (req, res) => {
  try {
    const studentId = req.params.id || req.user.id;
    const records = await Record.find({ studentId })
      .sort({ term: 1, createdAt: 1 })
      .populate("courseId");
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyRegistrations = async (req, res) => {
  try {
    const studentId = req.user.id;
    const regs = await Registration.find({
      studentId,
      status: { $in: ["pending", "registered"] },
    }).populate({
      path: "offeringId",
      populate: { path: "courseId" },
    });
    res.json(regs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudentRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({
      studentId: req.params.studentId,
      status: { $in: ["pending", "registered"] },
    })
      .sort({ term: 1, createdAt: 1 })
      .populate({
        path: "offeringId",
        populate: { path: "courseId" },
      });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
