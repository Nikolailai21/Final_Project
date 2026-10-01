const Offering = require("../models/Offering");

exports.getOfferings = async (req, res) => {
  try {
    const term = req.query.term || "2026-1";
    const offerings = await Offering.find({ term }).populate("courseId");
    res.json(offerings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createOffering = async (req, res) => {
  try {
    const offering = await Offering.create(req.body);
    const populated = await offering.populate("courseId");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOffering = async (req, res) => {
  try {
    const offering = await Offering.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("courseId");
    res.json(offering);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteOffering = async (req, res) => {
  try {
    await Offering.findByIdAndDelete(req.params.id);
    res.json({ message: "Offering deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
