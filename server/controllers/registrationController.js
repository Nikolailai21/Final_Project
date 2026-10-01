const Registration = require("../models/Registration");
const Offering = require("../models/Offering");
const Record = require("../models/Record");
const Course = require("../models/Course");

// Core Rules Engine Evaluator
exports.getEligibleCourses = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const term = req.query.term || "2026-1";

    // 1. Fetch current offerings for the term
    const offerings = await Offering.find({ term }).populate("courseId");

    // 2. Fetch student's academic history (Records)
    const records = await Record.find({ studentId }).populate("courseId");

    // 3. Fetch active registrations for current term
    const currentRegs = await Registration.find({
      studentId,
      term,
      status: "registered",
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
        eligible = false;
        reason = `Already passed — grade ${lastGrade}`;
      } else if (failed) {
        retakeRequired = true;
        reason = "Retake required (Failed in previous term)";
      }

      // Check Rule 4a: Seat Availability
      if (offering.seatsTaken >= offering.seats) {
        eligible = false;
        reason = "Full — 0 seats remaining";
      }

      // Check Rule 4b: Time Clash
      for (let reg of currentRegs) {
        const activeOff = reg.offeringId;
        if (activeOff._id.toString() !== offering._id.toString()) {
          if (activeOff.day === offering.day) {
            // Check overlapping time intervals
            if (
              offering.startTime < activeOff.endTime &&
              offering.endTime > activeOff.startTime
            ) {
              eligible = false;
              reason = `Clashes with ${activeOff.courseId.code} Section ${activeOff.section}`;
              break;
            }
          }
        }
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

exports.registerCourse = async (req, res) => {
  try {
    const { studentId, offeringId, term } = req.body;

    const offering = await Offering.findById(offeringId);
    if (!offering || offering.seatsTaken >= offering.seats) {
      return res
        .status(400)
        .json({ message: "Section is full or unavailable" });
    }

    const registration = await Registration.create({
      studentId,
      offeringId,
      term,
      status: "registered",
    });

    // Increment seat count
    offering.seatsTaken += 1;
    await offering.save();

    res.status(201).json(registration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.dropCourse = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration)
      return res.status(404).json({ message: "Registration not found" });

    registration.status = "dropped";
    await registration.save();

    // Decrement seat count
    const offering = await Offering.findById(registration.offeringId);
    if (offering && offering.seatsTaken > 0) {
      offering.seatsTaken -= 1;
      await offering.save();
    }

    res.json({ message: "Course dropped successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
