const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Transfer = require("../models/Transfer");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const MAX_SIZE = Number(process.env.MAX_FILE_SIZE_MB || 500) * 1024 * 1024;
const MAX_FILES = 50;
const TTL_HOURS = Number(process.env.TRANSFER_TTL_HOURS || 24);

function generateCode() {
  let code = "";
  do {
    code = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  } while (code.length !== 4);
  return code;
}

async function uniqueCode() {
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    const exists = await Transfer.findOne({ code });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique code. Try again.");
}

function expiryDate() {
  return new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._\- ]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
});

function cleanupFiles(fileList) {
  (fileList || []).forEach((f) => fs.unlink(f.path, () => {}));
}

/* ---------- Upload multiple files ---------- */
router.post("/file", upload.array("files", MAX_FILES), async (req, res, next) => {
  try {
    const received = req.files || [];
    if (!received.length) {
      return res.status(400).json({ message: "No files were uploaded." });
    }

    const totalSize = received.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_SIZE) {
      cleanupFiles(received);
      return res.status(413).json({
        message: `Total size exceeds the ${process.env.MAX_FILE_SIZE_MB || 500}MB limit.`,
      });
    }

    const code = await uniqueCode();
    const files = received.map((f) => ({
      name: f.originalname,
      path: f.path,
      mimeType: f.mimetype,
      size: f.size,
    }));

    const transfer = await Transfer.create({
      code,
      type: "file",
      files,
      size: totalSize,
      expiresAt: expiryDate(),
    });

    res.status(201).json({
      code,
      type: "file",
      fileCount: files.length,
      files: files.map((f) => ({ name: f.name, size: f.size, mimeType: f.mimeType })),
      size: totalSize,
      expiresAt: transfer.expiresAt,
      ttlHours: TTL_HOURS,
      message: "Files uploaded. Share this 4-digit code.",
    });
  } catch (err) {
    cleanupFiles(req.files);
    if (err instanceof multer.MulterError) {
      const maxMB = process.env.MAX_FILE_SIZE_MB || 500;
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `File too large. Maximum size per file is ${maxMB}MB.`
          : err.code === "LIMIT_FILE_COUNT"
          ? `Too many files. Maximum is ${MAX_FILES} files.`
          : err.message;
      return res.status(413).json({ message: msg });
    }
    next(err);
  }
});

/* ---------- Share text/code ---------- */
router.post("/text", async (req, res, next) => {
  try {
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "Text content is required." });
    }
    const text = String(content);

    const code = await uniqueCode();
    const transfer = await Transfer.create({
      code,
      type: "text",
      content: text,
      size: Buffer.byteLength(text, "utf8"),
      expiresAt: expiryDate(),
    });

    res.status(201).json({
      code,
      type: "text",
      size: transfer.size,
      expiresAt: transfer.expiresAt,
      ttlHours: TTL_HOURS,
      message: "Text saved. Share this 4-digit code.",
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- Expiry cleanup ---------- */
async function purgeExpired() {
  const expired = await Transfer.find({ expiresAt: { $lte: new Date() } });
  for (const t of expired) {
    (t.files || []).forEach((f) => fs.unlink(f.path, () => {}));
  }
  await Transfer.deleteMany({ expiresAt: { $lte: new Date() } });
  if (expired.length) console.log(`Purged ${expired.length} expired transfers`);
}

async function claimByCode(code) {
  await purgeExpired();
  const transfer = await Transfer.findOne({ code });
  if (!transfer) return null;
  if (transfer.expiresAt <= new Date()) return "expired";
  if (transfer.used) return "used";
  return transfer;
}

/* ---------- Retrieve (claim) ---------- */
router.get("/:code", async (req, res, next) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!/^\d{4}$/.test(code)) {
      return res.status(400).json({ message: "Code must be exactly 4 digits." });
    }

    const result = await claimByCode(code);
    if (result === null) return res.status(404).json({ message: "Code not found. It may have expired." });
    if (result === "expired") return res.status(410).json({ message: "This code has expired." });
    if (result === "used") return res.status(410).json({ message: "This code was already used." });

    const transfer = result;

    if (transfer.type === "file") {
      const missing = transfer.files.find((f) => !fs.existsSync(f.path));
      if (missing) {
        cleanupFiles(transfer.files);
        await Transfer.deleteOne({ _id: transfer._id });
        return res.status(404).json({ message: "Files are no longer available on the server." });
      }

      transfer.used = true;
      transfer.retrievalId = crypto.randomBytes(16).toString("hex");
      await transfer.save();

      return res.json({
        code: transfer.code,
        type: "file",
        fileCount: transfer.files.length,
        files: transfer.files.map((f, i) => ({
          index: i,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
        })),
        size: transfer.size,
        expiresAt: transfer.expiresAt,
        retrievalId: transfer.retrievalId,
      });
    }

    transfer.used = true;
    await transfer.save();

    res.json({
      code: transfer.code,
      type: "text",
      content: transfer.content,
      size: transfer.size,
      expiresAt: transfer.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- Validate a view/download request ---------- */
async function authorizeFile(req, res) {
  const code = String(req.params.code || "").trim();
  const index = Number(req.params.index);
  const rid = String(req.query.rid || "");

  if (!/^\d{4}$/.test(code) || !Number.isInteger(index) || index < 0) return null;
  await purgeExpired();

  const transfer = await Transfer.findOne({ code });
  if (!transfer) {
    res.status(404).json({ message: "Code not found. It may have expired." });
    return null;
  }
  if (transfer.expiresAt <= new Date()) {
    res.status(410).json({ message: "This code has expired." });
    return null;
  }
  if (transfer.type !== "file") {
    res.status(400).json({ message: "This code is for text, not files." });
    return null;
  }
  if (!transfer.retrievalId || rid !== transfer.retrievalId) {
    res.status(403).json({ message: "Not authorized. Re-enter the code to open these files." });
    return null;
  }

  const file = transfer.files[index];
  if (!file) {
    res.status(404).json({ message: "File not found." });
    return null;
  }
  if (!fs.existsSync(file.path)) {
    res.status(404).json({ message: "File no longer available on the server." });
    return null;
  }

  return { transfer, file };
}

/* ---------- Open file inline (preview in the app) ---------- */
router.get("/:code/view/:index", async (req, res, next) => {
  try {
    const auth = await authorizeFile(req, res);
    if (!auth) return;
    const { file } = auth;
    res.type(file.mimeType);
    res.sendFile(path.resolve(file.path));
  } catch (err) {
    next(err);
  }
});

/* ---------- Download a file ---------- */
router.get("/:code/download/:index", async (req, res, next) => {
  try {
    const auth = await authorizeFile(req, res);
    if (!auth) return;
    const { file } = auth;
    res.download(file.path, file.name, (err) => {
      if (err && !res.headersSent) return next(err);
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.purgeExpired = purgeExpired;
