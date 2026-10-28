require("dotenv").config();

const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const path = require("path");

const app = express();
const dataDir = path.join(__dirname, "data");
const publicDir = path.join(__dirname, "public");

const {
  PORT = 3000,
  NODE_ENV = "development",
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  SESSION_SECRET,
  MFA_ENCRYPTION_KEY
} = process.env;

if (
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  !SESSION_SECRET ||
  SESSION_SECRET.length < 32 ||
  !/^[a-f0-9]{64}$/i.test(MFA_ENCRYPTION_KEY || "")
) {
  throw new Error("Check ADMIN_EMAIL, ADMIN_PASSWORD and both secrets in .env");
}

const encryptionKey = Buffer.from(MFA_ENCRYPTION_KEY, "hex");
const db = new Database(path.join(dataDir, "auth.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_mfa (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    secret_iv TEXT NOT NULL,
    secret_tag TEXT NOT NULL,
    secret_data TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0
  );
`);

// Projects added through the private dashboard appear on the public portfolio.
db.exec(`
  CREATE TABLE IF NOT EXISTS portfolio_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    github_url TEXT NOT NULL DEFAULT '',
    demo_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: encrypted.toString("hex") };
}

function decryptSecret(row) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(row.secret_iv, "hex"));
  decipher.setAuthTag(Buffer.from(row.secret_tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(row.secret_data, "hex")), decipher.final()]).toString("utf8");
}

const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
app.disable("x-powered-by");

// CSP allows the external stylesheets, fonts and Bootstrap bundle used by the original portfolio.
const cspDirectives = {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  "default-src": ["'self'"],
  "script-src": ["'self'", "https://cdn.jsdelivr.net"],
  "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"]
};
if (NODE_ENV === "production") cspDirectives["upgrade-insecure-requests"] = [];
app.use(helmet({ contentSecurityPolicy: { directives: cspDirectives } }));
app.use(express.json({ limit: "10kb" }));

app.use(session({
  name: "portfolio.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: "sessions.db", dir: dataDir }),
  cookie: { httpOnly: true, sameSite: "strict", secure: NODE_ENV === "production", maxAge: 30 * 60 * 1000 }
}));

app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    const expectedOrigin = `${req.protocol}://${req.get("host")}`;
    if (!origin || origin !== expectedOrigin) return res.status(403).json({ error: "Invalid request origin" });
  }
  next();
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const regenerateSession = req => new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
const saveSession = req => new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

function requirePendingMfa(req, res, next) {
  if (!req.session.pendingMfa) return res.status(401).json({ error: "Sign in again" });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.authenticated) return res.status(401).json({ error: "Authentication required" });
  next();
}

app.post("/api/login", loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (email !== ADMIN_EMAIL.trim().toLowerCase() || !bcrypt.compareSync(password, passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const row = db.prepare("SELECT enabled FROM admin_mfa WHERE id = 1").get();
    await regenerateSession(req);
    req.session.pendingMfa = true;
    req.session.mfaSetup = !row || row.enabled !== 1;
    await saveSession(req);
    res.set("Cache-Control", "no-store");
    res.json({ next: req.session.mfaSetup ? "setup" : "verify" });
  } catch (err) { next(err); }
});

app.post("/api/mfa/setup", requirePendingMfa, async (req, res, next) => {
  try {
    if (!req.session.mfaSetup) return res.status(403).json({ error: "MFA is already configured" });
    if (!req.session.setupSecret) {
      req.session.setupSecret = authenticator.generateSecret();
      await saveSession(req);
    }
    const uri = authenticator.keyuri(ADMIN_EMAIL, "My Web Portfolio", req.session.setupSecret);
    res.set("Cache-Control", "no-store");
    res.json({ qr: await QRCode.toDataURL(uri) });
  } catch (err) { next(err); }
});

app.post("/api/mfa/verify-setup", requirePendingMfa, loginLimiter, async (req, res, next) => {
  try {
    const token = String(req.body.token || "");
    const secret = req.session.setupSecret;
    if (!req.session.mfaSetup || !secret || !/^\d{6}$/.test(token) || !authenticator.check(token, secret)) {
      return res.status(400).json({ error: "Invalid MFA code" });
    }
    const encrypted = encryptSecret(secret);
    db.prepare(`INSERT INTO admin_mfa (id, secret_iv, secret_tag, secret_data, enabled) VALUES (1, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET secret_iv=excluded.secret_iv, secret_tag=excluded.secret_tag, secret_data=excluded.secret_data, enabled=1`)
      .run(encrypted.iv, encrypted.tag, encrypted.data);
    delete req.session.setupSecret;
    delete req.session.pendingMfa;
    delete req.session.mfaSetup;
    await regenerateSession(req);
    req.session.authenticated = true;
    await saveSession(req);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post("/api/mfa/verify", requirePendingMfa, loginLimiter, async (req, res, next) => {
  try {
    if (req.session.mfaSetup) return res.status(403).json({ error: "Complete MFA setup first" });
    const row = db.prepare("SELECT * FROM admin_mfa WHERE id = 1 AND enabled = 1").get();
    const token = String(req.body.token || "");
    if (!row || !/^\d{6}$/.test(token) || !authenticator.check(token, decryptSecret(row))) {
      return res.status(401).json({ error: "Invalid MFA code" });
    }
    delete req.session.pendingMfa;
    delete req.session.mfaSetup;
    await regenerateSession(req);
    req.session.authenticated = true;
    await saveSession(req);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/api/me", requireAdmin, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ authenticated: true, email: ADMIN_EMAIL });
});


function projectPayload(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const rawTags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || "").split(",");
  const tags = rawTags
    .map(tag => String(tag).trim())
    .filter(Boolean)
    .slice(0, 10);

  function cleanUrl(value, fieldName) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const parsed = new URL(text);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("invalid protocol");
      }
      return parsed.href;
    } catch {
      throw new Error(`${fieldName} must be a valid http or https URL.`);
    }
  }

  if (!title || title.length > 100) {
    throw new Error("Project title is required and must be 100 characters or fewer.");
  }
  if (!description || description.length > 1200) {
    throw new Error("Description is required and must be 1,200 characters or fewer.");
  }
  if (tags.some(tag => tag.length > 32)) {
    throw new Error("Each technology tag must be 32 characters or fewer.");
  }

  return {
    title,
    description,
    tags: [...new Set(tags)],
    githubUrl: cleanUrl(body.githubUrl, "GitHub URL"),
    demoUrl: cleanUrl(body.demoUrl, "Demo URL")
  };
}

function projectForClient(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: JSON.parse(row.tags_json),
    githubUrl: row.github_url,
    demoUrl: row.demo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Public, read-only project feed. Existing featured projects remain untouched.
app.get("/api/projects", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM portfolio_projects ORDER BY created_at DESC, id DESC"
  ).all();
  res.set("Cache-Control", "no-store");
  res.json(rows.map(projectForClient));
});

// Private dashboard overview.
app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const customProjects = db.prepare(
    "SELECT COUNT(*) AS count FROM portfolio_projects"
  ).get().count;
  const mfa = db.prepare(
    "SELECT enabled FROM admin_mfa WHERE id = 1"
  ).get();
  res.set("Cache-Control", "no-store");
  res.json({
    email: ADMIN_EMAIL,
    customProjects,
    featuredProjects: 3 + customProjects,
    mfaEnabled: Boolean(mfa && mfa.enabled === 1)
  });
});

app.get("/api/admin/projects", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM portfolio_projects ORDER BY created_at DESC, id DESC"
  ).all();
  res.set("Cache-Control", "no-store");
  res.json(rows.map(projectForClient));
});

app.post("/api/admin/projects", requireAdmin, (req, res) => {
  let payload;
  try {
    payload = projectPayload(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const result = db.prepare(`
    INSERT INTO portfolio_projects (title, description, tags_json, github_url, demo_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    payload.title,
    payload.description,
    JSON.stringify(payload.tags),
    payload.githubUrl,
    payload.demoUrl
  );
  const created = db.prepare(
    "SELECT * FROM portfolio_projects WHERE id = ?"
  ).get(result.lastInsertRowid);
  res.status(201).json(projectForClient(created));
});

app.put("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid project ID." });
  }
  let payload;
  try {
    payload = projectPayload(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const result = db.prepare(`
    UPDATE portfolio_projects
    SET title = ?, description = ?, tags_json = ?, github_url = ?, demo_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.title,
    payload.description,
    JSON.stringify(payload.tags),
    payload.githubUrl,
    payload.demoUrl,
    id
  );
  if (!result.changes) {
    return res.status(404).json({ error: "Project not found." });
  }
  const updated = db.prepare(
    "SELECT * FROM portfolio_projects WHERE id = ?"
  ).get(id);
  res.json(projectForClient(updated));
});

app.delete("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid project ID." });
  }
  const result = db.prepare(
    "DELETE FROM portfolio_projects WHERE id = ?"
  ).run(id);
  if (!result.changes) {
    return res.status(404).json({ error: "Project not found." });
  }
  res.json({ ok: true });
});

app.post("/api/logout", (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie("portfolio.sid", { httpOnly: true, sameSite: "strict", secure: NODE_ENV === "production" });
    res.json({ ok: true });
  });
});

// IMPORTANT: protect dashboard HTML before serving public static files.
app.get("/admin", requireAdmin, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(publicDir, "admin.html"));
});
app.get("/admin.html", (req, res) => res.redirect(302, "/admin"));

// The portfolio homepage, CSS, JS and login page are public.
app.use(express.static(publicDir, { index: "index.html", dotfiles: "deny" }));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Portfolio server listening on http://127.0.0.1:${PORT}`);
});
