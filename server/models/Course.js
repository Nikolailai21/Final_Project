const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    credits: { type: Number, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Course", courseSchema);
