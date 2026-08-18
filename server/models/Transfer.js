const mongoose = require("mongoose");

const fileItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["file", "text"], required: true },
    files: { type: [fileItemSchema], default: [] },
    content: { type: String, default: "" },
    size: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transfer", transferSchema);
