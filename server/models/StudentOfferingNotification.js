const mongoose = require("mongoose");

const studentOfferingNotificationSchema = new mongoose.Schema(
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
    read: { type: Boolean, default: false },
    dismissed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

studentOfferingNotificationSchema.index(
  { studentId: 1, offeringId: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "StudentOfferingNotification",
  studentOfferingNotificationSchema,
);
