const Offering = require("../models/Offering");
const StudentOfferingNotification = require("../models/StudentOfferingNotification");
const mongoose = require("mongoose");

const findResourceScheduleConflict = async (offering, excludeOfferingId) => {
  const existingOfferings = await Offering.find({
    term: offering.term,
    ...(excludeOfferingId ? { _id: { $ne: excludeOfferingId } } : {}),
  })
    .select("courseId day startTime endTime room instructor")
    .populate("courseId", "code");

  const normalize = (value) => String(value || "").trim().toLowerCase();
  const overlaps = (existing) =>
    normalize(existing.day) === normalize(offering.day) &&
    offering.startTime < existing.endTime &&
    offering.endTime > existing.startTime;

  for (const existing of existingOfferings) {
    if (!overlaps(existing)) continue;

    const instructorMatches =
      normalize(existing.instructor) === normalize(offering.instructor);
    const roomMatches = normalize(existing.room) === normalize(offering.room);
    if (!instructorMatches && !roomMatches) continue;

    const resource = [
      instructorMatches ? `instructor ${offering.instructor}` : null,
      roomMatches ? `room ${offering.room}` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    const courseCode = existing.courseId?.code || "another course";

    return `${resource} is already assigned to ${courseCode} on ${existing.day} ${existing.startTime}-${existing.endTime}.`;
  }

  return null;
};

const validateSectionAssignment = async (offering, excludeOfferingId) => {
  if (
    !Number.isInteger(Number(offering.section)) ||
    Number(offering.section) < 1 ||
    Number(offering.section) > 4
  ) {
    return "Each course can have only sections 1 through 4.";
  }

  const existingSection = await Offering.findOne({
    term: offering.term,
    courseId: offering.courseId,
    section: Number(offering.section),
    ...(excludeOfferingId ? { _id: { $ne: excludeOfferingId } } : {}),
  });

  if (existingSection) {
    return `Section ${offering.section} already exists for this course in term ${offering.term}. Choose another section.`;
  }
  return null;
};

const validateOfferingSchedule = ({ startTime, endTime }) => {
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(startTime || "") || !timePattern.test(endTime || "")) {
    return "Start and end times must be valid 24-hour times.";
  }

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes < 8 * 60 || endMinutes > 18 * 60) {
    return "Classes must fit between 08:00 and 18:00.";
  }
  if (endMinutes - startMinutes !== 120) {
    return "Class duration must be exactly 2 hours.";
  }
  return null;
};

exports.getOfferings = async (req, res) => {
  try {
    const term = req.query.term || "2026-1";
    const offerings = await Offering.find({ term }).populate("courseId");
    res.json(offerings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOpenOfferings = async (req, res) => {
  try {
    const term = req.query.term || "2026-2";
    if (typeof term !== "string" || !/^\d{4}-\d+$/.test(term)) {
      return res.status(400).json({ message: "A valid term is required" });
    }

    const offerings = await Offering.find({
      term,
      addDropOpen: true,
      $expr: { $lt: ["$seatsTaken", "$seats"] },
    })
      .populate("courseId")
      .sort({ section: 1 });
    const notifications = await StudentOfferingNotification.find({
      studentId: req.user.id,
      offeringId: { $in: offerings.map((offering) => offering._id) },
      dismissed: { $ne: true },
    }).select("offeringId read");
    const readByOfferingId = new Map(
      notifications.map((notification) => [
        String(notification.offeringId),
        notification.read,
      ]),
    );
    res.json(
      offerings.map((offering) => ({
        ...offering.toObject(),
        read: readByOfferingId.get(String(offering._id)) ?? false,
      })),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setStudentOfferingNotificationReadState = async (req, res) => {
  try {
    const { offeringId } = req.params;
    const { read } = req.body;
    if (!mongoose.Types.ObjectId.isValid(offeringId)) {
      return res.status(400).json({ message: "A valid course section is required" });
    }
    if (typeof read !== "boolean") {
      return res.status(400).json({ message: "Read status must be true or false" });
    }

    const openOffering = await Offering.exists({
      _id: offeringId,
      addDropOpen: true,
      $expr: { $lt: ["$seatsTaken", "$seats"] },
    });
    if (!openOffering) {
      return res.status(404).json({
        message: "This course section is no longer open for requests",
      });
    }

    const notification = await StudentOfferingNotification.findOneAndUpdate(
      { studentId: req.user.id, offeringId },
      { $set: { read } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({ offeringId, read: notification.read });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.dismissStudentOfferingNotification = async (req, res) => {
  try {
    const { offeringId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(offeringId)) {
      return res.status(400).json({ message: "A valid course section is required" });
    }
    const offeringExists = await Offering.exists({ _id: offeringId });
    if (!offeringExists) {
      return res.status(404).json({ message: "Course section not found" });
    }

    await StudentOfferingNotification.findOneAndUpdate(
      { studentId: req.user.id, offeringId },
      { $set: { dismissed: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({ offeringId, dismissed: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createOffering = async (req, res) => {
  try {
    const sectionError = await validateSectionAssignment(req.body);
    if (sectionError) {
      return res.status(409).json({ message: sectionError });
    }

    const scheduleError = validateOfferingSchedule(req.body);
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    const resourceConflict = await findResourceScheduleConflict(req.body);
    if (resourceConflict) {
      return res.status(409).json({ message: resourceConflict });
    }

    const offering = await Offering.create(req.body);
    const populated = await offering.populate("courseId");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOffering = async (req, res) => {
  try {
    const currentOffering = await Offering.findById(req.params.id);
    if (!currentOffering) {
      return res.status(404).json({ message: "Offering not found" });
    }

    const sectionChanged =
      (req.body.section !== undefined &&
        Number(req.body.section) !== currentOffering.section) ||
      (req.body.courseId !== undefined &&
        String(req.body.courseId) !== String(currentOffering.courseId)) ||
      (req.body.term !== undefined && req.body.term !== currentOffering.term);
    if (sectionChanged) {
      const sectionError = await validateSectionAssignment(
        {
          ...currentOffering.toObject(),
          ...req.body,
          section: Number(req.body.section ?? currentOffering.section),
        },
        currentOffering._id,
      );
      if (sectionError) {
        return res.status(409).json({ message: sectionError });
      }
    }

    const scheduleChanged =
      (req.body.startTime !== undefined &&
        req.body.startTime !== currentOffering.startTime) ||
      (req.body.endTime !== undefined &&
        req.body.endTime !== currentOffering.endTime);
    if (scheduleChanged) {
      const scheduleError = validateOfferingSchedule({
        startTime: req.body.startTime ?? currentOffering.startTime,
        endTime: req.body.endTime ?? currentOffering.endTime,
      });
      if (scheduleError) {
        return res.status(400).json({ message: scheduleError });
      }
    }

    const scheduleFields = ["term", "day", "startTime", "endTime", "room", "instructor"];
    const resourceScheduleChanged = scheduleFields.some(
      (field) =>
        req.body[field] !== undefined &&
        req.body[field] !== currentOffering[field],
    );
    if (resourceScheduleChanged) {
      const resourceConflict = await findResourceScheduleConflict(
        { ...currentOffering.toObject(), ...req.body },
        currentOffering._id,
      );
      if (resourceConflict) {
        return res.status(409).json({ message: resourceConflict });
      }
    }

    const offering = await Offering.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("courseId");
    res.json(offering);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteOffering = async (req, res) => {
  try {
    await Offering.findByIdAndDelete(req.params.id);
    res.json({ message: "Offering deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
