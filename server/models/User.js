const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telegramChatId: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "advisor", "student"],
      required: true,
    },
    studentId: { type: String, default: null },
    advisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ advisorId: 1, role: 1, active: 1 });

module.exports = mongoose.model("User", userSchema);
