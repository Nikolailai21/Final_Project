const mongoose = require("mongoose");

const addDropRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    advisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    term: { type: String, required: true },
    requestType: {
      type: String,
      enum: ["drop", "change_section"],
      required: true,
    },
    targetOfferingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offering",
    },
    message: { type: String, required: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["pending", "processing", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AddDropRequest", addDropRequestSchema);
