const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
  clientId: String,
  platform: String, // whatsapp | instagram
  name: String,
  phone: String,
  message: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Lead", LeadSchema);