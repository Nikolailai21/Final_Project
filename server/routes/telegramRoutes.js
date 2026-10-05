const express = require("express");
const router = express.Router();
const telegramController = require("../controllers/telegramController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.get(
  "/chats",
  verifyToken,
  authorizeRoles("admin"),
  telegramController.getRecentChats,
);

module.exports = router;
