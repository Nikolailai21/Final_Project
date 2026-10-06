const mongoose = require("mongoose");

const offeringSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    term: { type: String, required: true },
    section: { type: Number, required: true },
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, required: true },
    instructor: { type: String, required: true },
    seats: { type: Number, required: true },
    seatsTaken: { type: Number, default: 0 },
    addDropOpen: { type: Boolean, default: false },
  },
  { timestamps: true },
);

offeringSchema.index({ term: 1, courseId: 1, section: 1 });
offeringSchema.index({ term: 1, day: 1 });

module.exports = mongoose.model("Offering", offeringSchema);
