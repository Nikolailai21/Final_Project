const mongoose = require("mongoose");
const Registration = require("../models/Registration");
const User = require("../models/User");

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

  try {
    const { registrationId, message } = req.body;
    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ message: "A valid registration is required" });
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
        message: "Withdrawal requests are closed for this course",
      });
    }

    const course = offering.courseId;
    const text = [
      "🗿COURSE WITHDRAWAL REQUEST",
      `Student: ${student.name} (${student.studentId || "ID not set"})`,
      `Term: ${registration.term}`,
      `Course: ${course.code} — ${course.title}`,
      `Section: ${offering.section}`,
      `Schedule: ${offering.day} ${offering.startTime}-${offering.endTime}`,
      "",
      "Student message:",
      message.trim(),
    ].join("\n");

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
      message: "Withdrawal request sent to your advisor on Telegram",
      advisorName: advisor.name,
    });
  } catch (err) {
    console.error("Failed to send Telegram withdrawal request:", err.message);
    res.status(500).json({
      message: "Unable to send the Telegram withdrawal request",
    });
  }
};
