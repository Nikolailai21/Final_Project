const mongoose = require("mongoose");
const Registration = require("../models/Registration");
const Offering = require("../models/Offering");
const AddDropRequest = require("../models/AddDropRequest");
const User = require("../models/User");
const {
  describeScheduleConflict,
  findScheduleConflict,
} = require("../utils/schedule");

const telegramApi = (method) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

const getBotToken = (res) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(503).json({
      message:
        "Telegram is not configured. Set TELEGRAM_BOT_TOKEN in the server environment and restart the server.",
    });
    return null;
  }
  return process.env.TELEGRAM_BOT_TOKEN;
};

exports.getRecentChats = async (_req, res) => {
  if (!getBotToken(res)) return;

  try {
    const response = await fetch(telegramApi("getUpdates"));
    const result = await response.json();
    if (!response.ok || !result.ok) {
      console.error(
        "Telegram getUpdates failed:",
        result.description || response.status,
      );
      return res.status(502).json({
        message:
          "Telegram could not list recent bot chats. Check the bot token and whether a webhook is configured.",
      });
    }

    const chatsById = new Map();
    for (const update of result.result || []) {
      const message = update.message || update.edited_message;
      const chat = message?.chat;
      if (chat?.type !== "private" || !chat.id) continue;
      const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ");
      chatsById.set(String(chat.id), {
        chatId: String(chat.id),
        name: name || chat.username || "Telegram user",
        username: chat.username || "",
      });
    }
    res.json([...chatsById.values()]);
  } catch (err) {
    console.error("Failed to retrieve Telegram chats:", err.message);
    res.status(502).json({ message: "Unable to connect to Telegram" });
  }
};

exports.sendAddDropNotification = async (req, res) => {
  const token = getBotToken(res);
  if (!token) return;

  let addDropRequestId;
  try {
    const { registrationId, requestType, targetOfferingId, message } = req.body;
    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ message: "A valid registration is required" });
    }
    if (!["drop", "change_section"].includes(requestType)) {
      return res.status(400).json({ message: "Select a valid course request type" });
    }
    if (
      requestType === "change_section" &&
      !mongoose.Types.ObjectId.isValid(targetOfferingId)
    ) {
      return res.status(400).json({ message: "Select a valid target section" });
    }
    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 3000
    ) {
      return res.status(400).json({
        message: "Enter a request message of no more than 3,000 characters",
      });
    }

    const student = await User.findOne({
      _id: req.user.id,
      role: "student",
      active: true,
    }).populate("advisorId", "name telegramChatId");
    if (!student) {
      return res.status(404).json({ message: "Student account not found" });
    }
    const advisor = student.advisorId;
    if (!advisor?.telegramChatId) {
      return res.status(400).json({
        message:
          "Your assigned advisor has not connected Telegram. Contact an administrator.",
      });
    }

    const registration = await Registration.findOne({
      _id: registrationId,
      studentId: student._id,
      status: "registered",
    }).populate({
      path: "offeringId",
      populate: { path: "courseId" },
    });
    if (!registration?.offeringId?.courseId) {
      return res.status(404).json({
        message: "Registered course not found for this withdrawal request",
      });
    }
    const offering = registration.offeringId;
    if (!offering.addDropOpen) {
      return res.status(400).json({
        message: "Course change requests are closed for this section",
      });
    }
    const activeAddDropRequest = await AddDropRequest.exists({
      registrationId: registration._id,
      status: { $in: ["pending", "processing"] },
    });
    if (activeAddDropRequest) {
      return res.status(409).json({
        message: "An add/drop request for this course is already awaiting review",
      });
    }

    const course = offering.courseId;
    let targetOffering = null;
    if (requestType === "change_section") {
      targetOffering = await Offering.findOne({
        _id: targetOfferingId,
        courseId: course._id,
        term: registration.term,
        addDropOpen: true,
        $expr: { $lt: ["$seatsTaken", "$seats"] },
      }).populate("courseId");
      if (!targetOffering || String(targetOffering._id) === String(offering._id)) {
        return res.status(400).json({
          message: "Select another open section of this course with available seats",
        });
      }

      const scheduleConflict = await findScheduleConflict({
        studentId: student._id,
        term: registration.term,
        offering: targetOffering,
        excludeRegistrationId: registration._id,
      });
      if (scheduleConflict) {
        return res.status(409).json({
          message: describeScheduleConflict(scheduleConflict),
        });
      }
    } else if (targetOfferingId) {
      return res.status(400).json({
        message: "A target section is only allowed for a section-change request",
      });
    }

    const text = [
      requestType === "drop"
        ? "📤 COURSE DROP REQUEST"
        : "🔄 COURSE SECTION CHANGE REQUEST",
      `Student: ${student.name} (${student.studentId || "ID not set"})`,
      `Term: ${registration.term}`,
      `Course: ${course.code} — ${course.title}`,
      `Current section: ${offering.section} (${offering.day} ${offering.startTime}-${offering.endTime})`,
      ...(targetOffering
        ? [
            `Preferred section: ${targetOffering.section} (${targetOffering.day} ${targetOffering.startTime}-${targetOffering.endTime})`,
            `Room: ${targetOffering.room}`,
            `Instructor: ${targetOffering.instructor}`,
          ]
        : []),
      "",
      "Student message:",
      message.trim(),
    ].join("\n");

    const addDropRequest = await AddDropRequest.create({
      studentId: student._id,
      advisorId: advisor._id,
      registrationId: registration._id,
      term: registration.term,
      requestType,
      ...(targetOffering ? { targetOfferingId: targetOffering._id } : {}),
      message: message.trim(),
    });
    addDropRequestId = addDropRequest._id;

    const response = await fetch(telegramApi("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: advisor.telegramChatId,
        text,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      await AddDropRequest.deleteOne({
        _id: addDropRequest._id,
        status: "pending",
      });
      addDropRequestId = null;
      console.error(
        "Telegram sendMessage failed:",
        result.description || response.status,
      );
      if (result.error_code === 400 || result.error_code === 403) {
        return res.status(400).json({
          message:
            "Telegram could not deliver this notification. Ask the advisor to start the bot and verify their Telegram chat ID.",
        });
      }
      return res.status(502).json({
        message:
          "Telegram could not send the withdrawal request. Try again later.",
      });
    }

    res.json({
      message: "Course request sent to your advisor on Telegram",
      advisorName: advisor.name,
      requestId: addDropRequest._id,
    });
  } catch (err) {
    if (addDropRequestId) {
      await AddDropRequest.deleteOne({
        _id: addDropRequestId,
        status: "pending",
      });
    }
    console.error("Failed to send Telegram add/drop request:", err.message);
    res.status(500).json({
      message: "Unable to send the Telegram add/drop request",
    });
  }
};
