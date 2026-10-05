const mongoose = require("mongoose");
const dotenv = require("dotenv");
const OfferingOption = require("./models/OfferingOption");

dotenv.config();

const defaults = [
  ...[1, 2, 3, 4].map((value) => ({ type: "section", value: String(value) })),
  ...[
    "1101",
    "1102",
    "1103",
    "1104",
    "1105",
    "1201",
    "1202",
    "1203",
    "1204",
    "1205",
  ].map((value) => ({ type: "room", value })),
  ...[
    "Dr.Lanka",
    "Dr.Nay",
    "Ajarn Shurva",
    "Ajarn Wendy",
    "Ajarn Zak",
    "Ajarn Susanta",
  ].map((value) => ({ type: "instructor", value })),
];

const seedOfferingOptions = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/csc220_db",
    );

    const result = await OfferingOption.bulkWrite(
      defaults.map((option) => ({
        updateOne: {
          filter: option,
          update: { $setOnInsert: option },
          upsert: true,
        },
      })),
    );
    console.log(
      `Offering options ready (${result.upsertedCount} new options added).`,
    );
  } catch (err) {
    console.error("Failed to seed offering options:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedOfferingOptions();
