const mongoose = require("mongoose");

const offeringOptionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["section", "room", "instructor"],
      required: true,
    },
    value: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

offeringOptionSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("OfferingOption", offeringOptionSchema);
