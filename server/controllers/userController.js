const User = require("../models/User");
const bcrypt = require("bcrypt");
const Registration = require("../models/Registration");
const Record = require("../models/Record");

exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter)
      .select("-passwordHash")
      .populate("advisorId", "name email telegramChatId");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      studentId,
      advisorId,
      telegramChatId,
    } = req.body;
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const normalizedStudentId =
      typeof studentId === "string" ? studentId.trim() : studentId;
    if (role === "student" && normalizedStudentId) {
      const existingStudentId = await User.findOne({
        role: "student",
        studentId: normalizedStudentId,
      });
      if (existingStudentId) {
        return res.status(400).json({ message: "Student ID already exists" });
      }
    }
    const normalizedTelegramChatId =
      typeof telegramChatId === "string" ? telegramChatId.trim() : "";
    if (
      role === "advisor" &&
      normalizedTelegramChatId &&
      !/^-?\d+$/.test(normalizedTelegramChatId)
    ) {
      return res.status(400).json({ message: "Enter a valid Telegram chat ID" });
    }

    const passwordHash = await bcrypt.hash(password || "password123", 10);
    const user = await User.create({
      name,
      email,
      telegramChatId:
        role === "advisor" ? normalizedTelegramChatId : "",
      passwordHash,
      role,
      studentId: normalizedStudentId,
      advisorId,
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name,
      email,
      role,
      active,
      studentId,
      advisorId,
      telegramChatId,
    } = req.body;
    const normalizedStudentId =
      typeof studentId === "string" ? studentId.trim() : studentId;
    const updatedRole = role ?? user.role;
    const updatedStudentId =
      studentId === undefined ? user.studentId : normalizedStudentId;
    if (
      updatedRole === "student" &&
      updatedStudentId &&
      (role !== undefined || studentId !== undefined)
    ) {
      const existingStudentId = await User.findOne({
        role: "student",
        studentId: updatedStudentId,
        _id: { $ne: user._id },
      });
      if (existingStudentId) {
        return res.status(400).json({ message: "Student ID already exists" });
      }
    }
    if (telegramChatId !== undefined || updatedRole !== user.role) {
      const normalizedTelegramChatId =
        typeof telegramChatId === "string"
          ? telegramChatId.trim()
          : "";
      if (
        updatedRole === "advisor" &&
        normalizedTelegramChatId &&
        !/^-?\d+$/.test(normalizedTelegramChatId)
      ) {
        return res
          .status(400)
          .json({ message: "Enter a valid Telegram chat ID" });
      }
      user.telegramChatId =
        updatedRole === "advisor" ? normalizedTelegramChatId : "";
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (active !== undefined) user.active = active;
    if (studentId !== undefined) user.studentId = normalizedStudentId;
    if (advisorId !== undefined) user.advisorId = advisorId;
    await user.save();
    res.json(await User.findById(user._id).select("-passwordHash"));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (String(targetUser._id) === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    if (targetUser.role === "admin" && targetUser.active) {
      const adminCount = await User.countDocuments({
        role: "admin",
        active: true,
      });
      if (adminCount <= 1) {
        return res
          .status(400)
          .json({ message: "Cannot delete the last active admin account." });
      }
    }

    await Promise.all([
      Registration.deleteMany({ studentId: targetUser._id }),
      Record.deleteMany({ studentId: targetUser._id }),
      User.updateMany(
        { advisorId: targetUser._id },
        { $set: { advisorId: null } },
      ),
    ]);
    await User.findByIdAndDelete(targetUser._id);
    res.json({
      message: "User account and related student records deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
