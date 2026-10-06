const mongoose = require("mongoose");
const AddDropRequest = require("../models/AddDropRequest");
const Offering = require("../models/Offering");
const Registration = require("../models/Registration");
const User = require("../models/User");
const {
  describeScheduleConflict,
  findScheduleConflict,
} = require("../utils/schedule");

exports.reviewAddDropRequest = async (req, res) => {
  let processingRequestId;
  try {
    const { id } = req.params;
    const { decision } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "A valid add/drop request is required" });
    }
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be approved or rejected" });
    }

    let request = await AddDropRequest.findById(id);
    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Pending add/drop request not found" });
    }
    if (String(request.advisorId) !== String(req.user.id)) {
      return res.status(403).json({
        message: "You can only review add/drop requests assigned to you",
      });
    }

    request = await AddDropRequest.findOneAndUpdate(
      { _id: request._id, status: "pending" },
      { $set: { status: "processing" } },
      { new: true },
    );
    if (!request) {
      return res.status(409).json({ message: "Request is already being reviewed" });
    }
    processingRequestId = request._id;

    const registration = await Registration.findOne({
      _id: request.registrationId,
      studentId: request.studentId,
      term: request.term,
      status: "registered",
    }).populate({
      path: "offeringId",
      populate: { path: "courseId" },
    });
    if (!registration?.offeringId) {
      await AddDropRequest.updateOne(
        { _id: processingRequestId, status: "processing" },
        { $set: { status: "pending" } },
      );
      processingRequestId = null;
      return res.status(409).json({
        message: "The student's registered course has changed since this request",
      });
    }

    if (decision === "rejected") {
      const rejected = await AddDropRequest.findOneAndUpdate(
        { _id: request._id, status: "processing" },
        { $set: { status: "rejected" } },
        { new: true },
      );
      if (!rejected) {
        return res.status(409).json({ message: "Request has already been reviewed" });
      }
      return res.json({ status: rejected.status });
    }

    const currentOffering = registration.offeringId;
    if (!currentOffering.addDropOpen) {
      await AddDropRequest.updateOne(
        { _id: processingRequestId, status: "processing" },
        { $set: { status: "pending" } },
      );
      processingRequestId = null;
      return res.status(409).json({
        message: "The Add/Drop window for the current section is closed",
      });
    }

    if (request.requestType === "change_section") {
      const targetOffering = await Offering.findOne({
        _id: request.targetOfferingId,
        courseId: currentOffering.courseId?._id || currentOffering.courseId,
        term: registration.term,
        addDropOpen: true,
        $expr: { $lt: ["$seatsTaken", "$seats"] },
      });
      if (!targetOffering) {
        await AddDropRequest.updateOne(
          { _id: processingRequestId, status: "processing" },
          { $set: { status: "pending" } },
        );
        processingRequestId = null;
        return res.status(409).json({
          message: "The preferred section is closed or no longer has seats",
        });
      }

      const scheduleConflict = await findScheduleConflict({
        studentId: request.studentId,
        term: registration.term,
        offering: targetOffering,
        excludeRegistrationId: registration._id,
      });
      if (scheduleConflict) {
        await AddDropRequest.updateOne(
          { _id: processingRequestId, status: "processing" },
          { $set: { status: "pending" } },
        );
        processingRequestId = null;
        return res.status(409).json({
          message: describeScheduleConflict(scheduleConflict),
        });
      }

      const reservedTarget = await Offering.findOneAndUpdate(
        {
          _id: targetOffering._id,
          addDropOpen: true,
          $expr: { $lt: ["$seatsTaken", "$seats"] },
        },
        { $inc: { seatsTaken: 1 } },
        { new: true },
      );
      if (!reservedTarget) {
        await AddDropRequest.updateOne(
          { _id: processingRequestId, status: "processing" },
          { $set: { status: "pending" } },
        );
        processingRequestId = null;
        return res.status(409).json({
          message: "The preferred section just became full or closed",
        });
      }

      const updatedRegistration = await Registration.findOneAndUpdate(
        {
          _id: registration._id,
          status: "registered",
          offeringId: currentOffering._id,
        },
        { $set: { offeringId: reservedTarget._id } },
        { new: true },
      );
      if (!updatedRegistration) {
        await Offering.updateOne(
          { _id: reservedTarget._id, seatsTaken: { $gt: 0 } },
          { $inc: { seatsTaken: -1 } },
        );
        await AddDropRequest.updateOne(
          { _id: processingRequestId, status: "processing" },
          { $set: { status: "pending" } },
        );
        processingRequestId = null;
        return res.status(409).json({
          message: "The student's registration changed before this request was approved",
        });
      }

      await Offering.updateOne(
        { _id: currentOffering._id, seatsTaken: { $gt: 0 } },
        { $inc: { seatsTaken: -1 } },
      );
    } else {
      const droppedRegistration = await Registration.findOneAndUpdate(
        {
          _id: registration._id,
          status: "registered",
          offeringId: currentOffering._id,
        },
        { $set: { status: "dropped" } },
        { new: true },
      );
      if (!droppedRegistration) {
        await AddDropRequest.updateOne(
          { _id: processingRequestId, status: "processing" },
          { $set: { status: "pending" } },
        );
        processingRequestId = null;
        return res.status(409).json({
          message: "The student's registration changed before this request was approved",
        });
      }
      await Offering.updateOne(
        { _id: currentOffering._id, seatsTaken: { $gt: 0 } },
        { $inc: { seatsTaken: -1 } },
      );
    }

    const approved = await AddDropRequest.findOneAndUpdate(
      { _id: request._id, status: "processing" },
      { $set: { status: "approved" } },
      { new: true },
    );
    if (!approved) {
      return res.status(409).json({ message: "Request has already been reviewed" });
    }
    processingRequestId = null;
    res.json({ status: approved.status, requestType: request.requestType });
  } catch (err) {
    if (processingRequestId) {
      await AddDropRequest.updateOne(
        { _id: processingRequestId, status: "processing" },
        { $set: { status: "pending" } },
      );
    }
    res.status(500).json({ message: err.message });
  }
};
