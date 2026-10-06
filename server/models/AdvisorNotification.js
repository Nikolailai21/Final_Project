const mongoose = require("mongoose");

const advisorNotificationSchema = new mongoose.Schema(
  {
    advisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestType: {
      type: String,
      enum: ["course", "section", "add_drop"],
      required: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    read: { type: Boolean, default: false },
    dismissed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

advisorNotificationSchema.index(
  { advisorId: 1, requestType: 1, requestId: 1 },
  { unique: true },
);

module.exports = mongoose.model("AdvisorNotification", advisorNotificationSchema);
