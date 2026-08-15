# QuickSnap

> Share files & text with a 4-digit code. No accounts. No links. No email.

QuickSnap is a full-stack file & text sharing app that combines the best of
[QuickShare](https://v-max.lovable.app/) (file sharing via a short code) and
[InfoPA / SnapDrop](https://infopa.lovable.app/) (text & code sharing). Drop in
up to **50 files (500 MB total)** or paste text/code, get a **4-digit code**,
and the recipient opens everything **right inside the app** — images, video,
audio, PDFs and code preview inline. Codes are **one-time use** and
**auto-expire after 24 hours**.

Built with a Framer-inspired dark UI: animated gradient orbs, glassmorphism,
scroll-reveal, animated counters, and confetti on success.

---

## ✨ Features

- **Multi-file upload** — share up to 50 files at once (500 MB total).
- **Text & code sharing** — paste snippets, logs, or long text.
- **Inline preview** — images, video, audio, PDFs and text/code open in the app.
- **4-digit codes** — short, easy to read over the phone or chat.
- **One-time use** — a code is consumed the moment it is opened.
- **Self-destructing** — transfers auto-expire after 24 hours (configurable).
- **Zero accounts** — no sign-up, no email, no tracking.
- **Animated UI** — glass cards, gradient orbs, smooth scroll animations.

---

## 🧱 Tech Stack

| Layer      | Technology                                   |
| ---------- | --------------------------------------------- |
| Backend    | Node.js, Express 4                            |
| Database   | MongoDB (via Mongoose)                        |
| File upload | Multer 2.x (disk storage)                    |
| Frontend   | Vanilla HTML + CSS + JavaScript (no build step) |
| Security   | Helmet, CORS, rate-limiting ready             |

No frontend framework or bundler is required — the UI is served statically.

---

## 📋 Prerequisites

- **Node.js** v18 or newer (developed on v25)
- **MongoDB** — a local instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- **Git** (for deploying to GitHub)

---

## 🚀 Local Setup

```bash
# 1. Clone / open the project
cd QuickSnap

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env        # then edit values if needed

# 4. Make sure MongoDB is running, then start the server
npm start
```

Open **http://localhost:5001** in your browser.

### Development mode (auto-restart)

```bash
npm run dev
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/quicksnap
MAX_FILE_SIZE_MB=500
TRANSFER_TTL_HOURS=24
NODE_ENV=development
```

| Variable             | Default                              | Description                                 |
| -------------------- | ------------------------------------ | ------------------------------------------- |
| `PORT`               | `5001`                               | Port the server listens on                  |
| `MONGODB_URI`        | `mongodb://127.0.0.1:27017/quicksnap`| MongoDB connection string                   |
| `MAX_FILE_SIZE_MB`   | `500`                                | Max size per file (total capped at 500 MB)  |
| `TRANSFER_TTL_HOURS` | `24`                                 | How long a code stays valid (hours)         |
| `NODE_ENV`           | `development`                        | `production` for tighter logging            |

---

## 📡 API Reference

Base URL: `/api`

| Method | Endpoint                          | Description                                          |
| ------ | --------------------------------- | ---------------------------------------------------- |
| GET    | `/health`                         | Health check (returns config + status)              |
| POST   | `/transfer/file`                  | Upload files (`multipart/form-data`, field `files`)  |
| POST   | `/transfer/text`                  | Share text (`{ content }`)                           |
| GET    | `/transfer/:code`                 | Claim a code → returns metadata + `retrievalId`      |
| GET    | `/transfer/:code/view/:index`     | Open a file inline (requires `?rid=`)                |
| GET    | `/transfer/:code/download/:index` | Download a file (requires `?rid=`)                   |

### Example — upload two files

```bash
curl -F "files=@a.png" -F "files=@notes.txt" http://localhost:5001/api/transfer/file
# => { "code": "1336", "type": "file", "fileCount": 2, ... }
```

### Example — retrieve & preview

```bash
# claim the code (returns retrievalId, marks code used)
curl http://localhost:5001/api/transfer/1336
# => { ..., "retrievalId": "ab12cd34...", "files": [ ... ] }

# open the first file inline in the browser/app
curl "http://localhost:5001/api/transfer/1336/view/0?rid=ab12cd34..."
```

> Codes are **one-time**: the first successful `GET /transfer/:code` consumes the
> code. Each file view/download must include the `rid` returned at claim time.

---

## 📁 Project Structure

```
QuickSnap/
├── .env                      # configuration (do not commit secrets)
├── package.json
├── public/                   # static frontend
│   ├── index.html            # single-page app
│   ├── style.css             # Framer-inspired styles + animations
│   └── app.js                # UI logic (tabs, upload, preview, confetti)
├── server/
│   ├── index.js              # Express app + static serving
│   ├── config/db.js          # MongoDB connection
│   ├── models/Transfer.js    # transfer schema (files[] or text)
│   ├── routes/transfer.js    # upload / share / claim / view / download
│   └── middleware/errorHandler.js
└── uploads/                  # uploaded files (git-ignored)
```

---

## 🌐 Deploying to GitHub

This app needs a Node server **and** a MongoDB database, so a static host won't
work — use a Node-capable platform (Render, Railway, Fly.io, Koyeb, Heroku, or
your own VPS).

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: QuickSnap file & text sharing"
git branch -M main
git remote add origin https://github.com/<your-username>/QuickSnap.git
git push -u origin main
```

> The repository already ships a `.gitignore` that excludes `node_modules/`,
> `uploads/`, `server.log` and `.env`. **Never commit your `.env` or uploaded
> files.**

### 2. Create a MongoDB database

- Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas), create a free
  cluster, add a database user, and whitelist `0.0.0.0/0`.
- Copy the connection string and use it as `MONGODB_URI`.

### 3. Deploy (example: Render)

1. New → **Web Service** → connect your GitHub repo.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables: `MONGODB_URI`, `PORT`, `MAX_FILE_SIZE_MB`,
   `TRANSFER_TTL_HOURS`, `NODE_ENV=production`.
5. Deploy. Your app will be live at `https://quicksnap.onrender.com`.

The same steps apply to Railway, Fly.io, or Koyeb — all read `npm start` and
the env vars above.

---

## 📝 Notes & Limitations

- Uploaded files are stored on disk in `uploads/`. On most PaaS platforms this
  folder is **ephemeral** (reset on redeploy) — for production, mount a
  persistent volume or switch storage to S3/GridFS.
- Codes are one-time and expire after `TRANSFER_TTL_HOURS`; expired transfers
  and their files are purged every 30 minutes.
- `MAX_FILE_SIZE_MB` caps each file; the total of all files in one share is also
  capped at 500 MB.

---

## 📄 License

MIT
