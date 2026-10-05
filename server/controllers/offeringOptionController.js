const OfferingOption = require("../models/OfferingOption");

exports.getOfferingOptions = async (req, res) => {
  try {
    const options = await OfferingOption.find()
      .sort({ type: 1, value: 1 })
      .lean();

    res.json({
      sections: options
        .filter((option) => option.type === "section")
        .map((option) => Number(option.value)),
      rooms: options
        .filter((option) => option.type === "room")
        .map((option) => option.value),
      instructors: options
        .filter((option) => option.type === "instructor")
        .map((option) => option.value),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
