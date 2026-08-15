const API = "/api";
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILE_COUNT = 50;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- Helpers ---------- */
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  el.classList.toggle("error", isError);
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2800);
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "0 B";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fileIconFor(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: "📕", doc: "📄", docx: "📄", txt: "📝", md: "📝",
    zip: "🗜️", rar: "🗜️", "7z": "🗜️",
    mp3: "🎵", wav: "🎵", mp4: "🎬", mov: "🎬", avi: "🎬",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", svg: "🖼️", webp: "🖼️",
    js: "💻", ts: "💻", json: "🧾", py: "🐍", html: "🌐", css: "🎨",
    exe: "⚙️", dmg: "⚙️", apk: "📱",
  };
  return map[ext] || "📦";
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- Scroll reveal ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
$$(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- Animated counters ---------- */
const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count || 0);
      const suffix = target === 100 ? "%" : "";
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target + suffix;
      }
      requestAnimationFrame(tick);
      countObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
$$(".count").forEach((el) => countObserver.observe(el));

/* ---------- Typing effect ---------- */
const typedEl = $("#typed");
const phrases = [
  "Drop in up to 50 files — 500MB total — or paste text & code.",
  "We hand you a 4-digit code, valid for 24 hours.",
  "Recipients open the files right here in the app.",
  "Free forever. No accounts. No links. No email.",
];
let phraseIdx = 0, charIdx = 0, deleting = false;
function typeLoop() {
  const current = phrases[phraseIdx];
  const speed = deleting ? 28 : 46;
  if (!deleting) {
    charIdx++;
    typedEl.innerHTML = current.slice(0, charIdx) + '<span class="cursor">|</span>';
    if (charIdx === current.length) {
      deleting = true;
      setTimeout(typeLoop, 2200);
      return;
    }
  } else {
    charIdx--;
    typedEl.innerHTML = current.slice(0, charIdx) + '<span class="cursor">|</span>';
    if (charIdx === 0) {
      deleting = false;
      phraseIdx = (phraseIdx + 1) % phrases.length;
      setTimeout(typeLoop, 350);
      return;
    }
  }
  setTimeout(typeLoop, speed);
}
setTimeout(typeLoop, 600);

/* ---------- Confetti ---------- */
function confetti() {
  const colors = ["#a78bfa", "#818cf8", "#60a5fa", "#e879f9", "#34d399", "#fbbf24"];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.animationDuration = 2 + Math.random() * 2.2 + "s";
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    piece.style.opacity = 0.8;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5200);
  }
}

/* ---------- Tabs ---------- */
let activeTab = "file";
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    $("#panel-file").classList.toggle("hidden", activeTab !== "file");
    $("#panel-text").classList.toggle("hidden", activeTab !== "text");
  });
});

/* ---------- Multi-file selection ---------- */
const dropzone = $("#dropzone");
const fileInput = $("#fileInput");
let selectedFiles = [];

function renderSelectedFiles() {
  const container = $("#dzFiles");
  const total = selectedFiles.reduce((s, f) => s + f.size, 0);
  $("#dzInner").classList.toggle("hidden", selectedFiles.length > 0);
  container.classList.toggle("hidden", selectedFiles.length === 0);

  if (!selectedFiles.length) {
    $("#uploadBtn").disabled = true;
    return;
  }

  container.innerHTML = selectedFiles
    .map(
      (f, i) => `
      <div class="dz-file">
        <div class="file-icon">${fileIconFor(f.name)}</div>
        <div class="file-meta">
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-size">${formatBytes(f.size)}</div>
        </div>
        <button class="icon-btn" data-remove="${i}" title="Remove file">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`
    )
    .join("");

  const sizeLine = document.createElement("div");
  sizeLine.className = "dz-total";
  sizeLine.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} · ${formatBytes(total)} of ${MAX_FILE_SIZE_MB}MB`;
  container.appendChild(sizeLine);

  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFiles.splice(Number(btn.dataset.remove), 1);
      renderSelectedFiles();
    });
  });

  const over = total > MAX_FILE_SIZE;
  $("#uploadBtn").disabled = over;
  if (over) toast("Total size exceeds 500MB. Remove some files.", true);
}

function addFiles(fileList) {
  const arr = Array.from(fileList || []).filter(
    (f) => !selectedFiles.some((s) => s.name === f.name && s.size === f.size && s.lastModified === f.lastModified)
  );
  if (!arr.length) return;
  if (selectedFiles.length + arr.length > MAX_FILE_COUNT) {
    toast(`Maximum ${MAX_FILE_COUNT} files per share.`, true);
    return;
  }
  const tooBig = arr.find((f) => f.size > MAX_FILE_SIZE);
  if (tooBig) {
    toast(`"${tooBig.name}" is over ${MAX_FILE_SIZE_MB}MB.`, true);
    return;
  }
  selectedFiles.push(...arr);
  renderSelectedFiles();
}

dropzone.addEventListener("click", () => fileInput.click());
$("#browseLink").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });

["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); })
);
dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

/* ---------- File upload ---------- */
function uploadFiles(files) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));

  const prog = $("#fileProgress");
  const bar = prog.querySelector(".progress-bar span");
  const label = $("#fileProgressLabel");
  prog.classList.remove("hidden");
  bar.style.width = "0%";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/transfer/file`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        bar.style.width = pct + "%";
        label.textContent = `Uploading… ${pct}%`;
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.message || "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}

$("#uploadBtn").addEventListener("click", async () => {
  if (!selectedFiles.length) return;
  const btn = $("#uploadBtn");
  btn.disabled = true;
  btn.textContent = "Uploading…";
  try {
    const data = await uploadFiles(selectedFiles);
    showResult(data);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Upload & get code";
  }
});

/* ---------- Text share ---------- */
$("#generateBtn").addEventListener("click", async () => {
  const content = $("#textInput").value;
  if (!content.trim()) {
    toast("Please paste some text or code first.", true);
    return;
  }
  const btn = $("#generateBtn");
  btn.disabled = true;
  btn.textContent = "Generating…";
  try {
    const data = await api("/transfer/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    showResult(data);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate code";
  }
});

$("#clearText").addEventListener("click", () => {
  $("#textInput").value = "";
  $("#charCount").textContent = "0 characters";
});
$("#textInput").addEventListener("input", (e) => {
  const len = e.target.value.length;
  $("#charCount").textContent = `${len.toLocaleString()} ${len === 1 ? "character" : "characters"}`;
});

/* ---------- Result display ---------- */
let countdownTimer = null;
function showResult(data) {
  const result = $("#result");
  $("#codeDisplay").textContent = data.code;
  const meta =
    data.type === "file"
      ? `${data.fileCount} file${data.fileCount > 1 ? "s" : ""} · ${formatBytes(data.size)} total · one-time use · valid 24h`
      : `${formatBytes(data.size)} of text/code · one-time use · valid 24h`;
  $("#resultMeta").textContent = meta;
  result.classList.remove("hidden");
  startCountdown(data.expiresAt);
  result.scrollIntoView({ behavior: "smooth", block: "center" });
  confetti();
}

function startCountdown(expiresAt) {
  clearInterval(countdownTimer);
  const el = $("#countdownVal");
  const end = new Date(expiresAt).getTime();
  function tick() {
    const diff = end - Date.now();
    if (diff <= 0) { el.textContent = "00:00:00"; clearInterval(countdownTimer); return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

$("#copyCode").addEventListener("click", () => {
  const code = $("#codeDisplay").textContent;
  navigator.clipboard.writeText(code).then(
    () => toast(`Code ${code} copied to clipboard!`),
    () => {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast(`Code ${code} copied to clipboard!`);
    }
  );
});

$("#shareAgain").addEventListener("click", () => {
  $("#result").classList.add("hidden");
  selectedFiles = [];
  renderSelectedFiles();
  $("#textInput").value = "";
  $("#charCount").textContent = "0 characters";
  clearInterval(countdownTimer);
});

/* ---------- Receive ---------- */
$("#receiveBtn").addEventListener("click", receiveTransfer);
$("#receiveInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") receiveTransfer();
});
$("#receiveInput").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
});

async function receiveTransfer() {
  const code = $("#receiveInput").value.trim();
  const result = $("#receiveResult");
  const loading = $("#receiveLoading");
  result.classList.add("hidden");
  if (!/^\d{4}$/.test(code)) {
    toast("Please enter a valid 4-digit code.", true);
    return;
  }
  loading.classList.remove("hidden");
  try {
    const data = await api(`/transfer/${code}`);
    loading.classList.add("hidden");
    renderReceived(data);
  } catch (err) {
    loading.classList.add("hidden");
    result.classList.remove("hidden");
    result.innerHTML = `<div class="recv-error"><strong>${escapeHtml(err.message)}</strong></div>`;
  }
}

function renderReceived(data) {
  const result = $("#receiveResult");
  result.classList.remove("hidden");
  result.innerHTML = "";
  const card = document.createElement("div");
  card.className = "recv-card";

  if (data.type === "text") {
    card.innerHTML = `
      <div class="recv-head">${formatBytes(data.size)} of text · one-time use</div>
      <div class="recv-text"></div>
      <div class="recv-actions">
        <button class="btn btn-primary" id="copyText">Copy text</button>
      </div>`;
    card.querySelector(".recv-text").textContent = data.content;
    result.appendChild(card);
    $("#copyText").addEventListener("click", () => {
      navigator.clipboard.writeText(data.content).then(
        () => toast("Text copied to clipboard!"),
        () => toast("Could not copy text.", true)
      );
    });
  } else {
    const head = document.createElement("div");
    head.className = "recv-head";
    head.textContent = `${data.fileCount} file${data.fileCount > 1 ? "s" : ""} · ${formatBytes(data.size)} total · one-time use`;
    card.appendChild(head);

    const list = document.createElement("div");
    list.className = "file-list";
    data.files.forEach((f) => {
      const viewUrl = `${API}/transfer/${data.code}/view/${f.index}?rid=${encodeURIComponent(data.retrievalId)}`;
      const dlUrl = `${API}/transfer/${data.code}/download/${f.index}?rid=${encodeURIComponent(data.retrievalId)}`;

      const row = document.createElement("div");
      row.className = "file-row";
      const rowHead = document.createElement("div");
      rowHead.className = "file-row-head";
      rowHead.innerHTML = `
        <span class="recv-file-icon">${fileIconFor(f.name)}</span>
        <div class="file-row-meta">
          <div class="recv-file-name">${escapeHtml(f.name)}</div>
          <div class="recv-file-size">${formatBytes(f.size)}</div>
        </div>
        <a class="btn btn-ghost btn-sm" href="${dlUrl}" download>⬇ Save</a>`;
      row.appendChild(rowHead);

      const preview = previewFor(f, viewUrl);
      if (preview) row.appendChild(preview);
      list.appendChild(row);
    });
    card.appendChild(list);
    result.appendChild(card);
  }

  result.scrollIntoView({ behavior: "smooth", block: "center" });
}

function previewFor(file, viewUrl) {
  const mime = file.mimeType || "";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const box = document.createElement("div");
  box.className = "preview-box";

  if (mime.startsWith("image/") || mime === "image/svg+xml") {
    box.innerHTML = `<img class="preview-media" src="${viewUrl}" alt="${escapeHtml(file.name)}" loading="lazy" />`;
    return box;
  }
  if (mime.startsWith("video/")) {
    box.innerHTML = `<video class="preview-media" src="${viewUrl}" controls preload="metadata"></video>`;
    return box;
  }
  if (mime.startsWith("audio/")) {
    box.innerHTML = `<audio class="preview-media" src="${viewUrl}" controls></audio>`;
    return box;
  }
  if (mime === "application/pdf") {
    box.innerHTML = `<iframe class="preview-frame" src="${viewUrl}" title="PDF preview"></iframe>`;
    return box;
  }

  const textLikes = ["text/", "application/json", "application/javascript", "application/xml", "application/x-httpd-php"];
  const codeExts = ["js", "ts", "py", "json", "html", "css", "md", "txt", "xml", "yml", "yaml", "sh", "bat", "java", "c", "cpp", "go", "rs", "sql", "log", "ini", "env", "gitignore"];
  if (textLikes.some((p) => mime.startsWith(p)) || codeExts.includes(ext)) {
    const pre = document.createElement("pre");
    pre.className = "preview-text";
    pre.textContent = "Loading preview…";
    fetch(viewUrl)
      .then((r) => r.text())
      .then((t) => { pre.textContent = t.slice(0, 50000) + (t.length > 50000 ? "\n…(truncated)" : ""); })
      .catch(() => { box.classList.add("hidden"); });
    box.appendChild(pre);
    return box;
  }

  return null;
}

/* ---------- Tilt effect on cards ---------- */
if (window.matchMedia("(pointer: fine)").matches) {
  $$(".feature-card, .step").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg) translateY(-6px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}
