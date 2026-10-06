const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    offeringId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offering",
      required: true,
    },
    term: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "registered", "dropped"],
      default: "registered",
    },
  },
  { timestamps: true },
);

registrationSchema.index({ studentId: 1, term: 1, status: 1, offeringId: 1 });

module.exports = mongoose.model("Registration", registrationSchema);
