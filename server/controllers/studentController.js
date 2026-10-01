const Record = require("../models/Record");
const Registration = require("../models/Registration");

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
      status: "registered",
    }).populate({
      path: "offeringId",
      populate: { path: "courseId" },
    });
    res.json(regs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
