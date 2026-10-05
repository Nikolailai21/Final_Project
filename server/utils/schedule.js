const Registration = require("../models/Registration");

const hasScheduleConflict = (offering, otherOffering) =>
  offering.day?.trim().toLowerCase() ===
    otherOffering.day?.trim().toLowerCase() &&
  timeToMinutes(offering.startTime) < timeToMinutes(otherOffering.endTime) &&
  timeToMinutes(offering.endTime) > timeToMinutes(otherOffering.startTime);

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const findScheduleConflict = async ({
  studentId,
  term,
  offering,
  excludeRegistrationId,
}) => {
  const query = {
    studentId,
    term,
    status: { $in: ["pending", "registered"] },
  };

  if (excludeRegistrationId) {
    query._id = { $ne: excludeRegistrationId };
  }

  const registrations = await Registration.find(query).populate({
    path: "offeringId",
    populate: { path: "courseId" },
  });

  return registrations.find(
    (registration) =>
      registration.offeringId &&
      hasScheduleConflict(offering, registration.offeringId),
  );
};

const describeScheduleConflict = (registration) => {
  const offering = registration.offeringId;
  const courseCode = offering.courseId?.code || "another course";
  return `This course has the same day and time as ${courseCode} on ${offering.day} (${offering.startTime}-${offering.endTime}).`;
};

module.exports = {
  describeScheduleConflict,
  findScheduleConflict,
  hasScheduleConflict,
};
