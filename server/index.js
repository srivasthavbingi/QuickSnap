require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const transferRoutes = require("./routes/transfer");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = "0.0.0.0";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "connecting",
    maxFileSizeMB: process.env.MAX_FILE_SIZE_MB || 500,
    ttlHours: process.env.TRANSFER_TTL_HOURS || 24,
    time: new Date().toISOString(),
  });
});

app.use("/api/transfer", transferRoutes);

app.use(express.static(path.join(__dirname, "../public")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use(notFound);
app.use(errorHandler);

const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

setInterval(() => {
  transferRoutes.purgeExpired && transferRoutes.purgeExpired().catch(() => {});
}, 30 * 60 * 1000);

async function connectWithRetry(retries = 12, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await connectDB();
      return true;
    } catch (err) {
      console.error(`MongoDB connect attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

async function start() {
  app.listen(PORT, HOST, () => {
    console.log(`QuickSnap running at http://${HOST}:${PORT}`);
  });

  const ok = await connectWithRetry();
  if (!ok) {
    console.error("WARNING: MongoDB still unreachable. Server is up, but DB features will not work until it connects.");
  }
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
