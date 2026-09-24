#!/usr/bin/env node
/**
 * WebbyOS Node runtime.
 *
 * WebbyOS ships as vanilla JS plus a small PHP persistence bridge
 * (api/data.php and api/upload.php). Node-only hosts (including this
 * Freebuff workspace) have no PHP interpreter, so this server provides
 * drop-in replacements for both endpoints and serves the static site.
 *
 * The frontend contract is intentionally left untouched: DataCoreSystem
 * still calls ./api/data.php and MediaCoreSystem still calls
 * ./api/upload.php, so the same build runs on this server or on a classic
 * PHP host without any source changes.
 *
 * Storage compatibility:
 * - The encrypted store envelope format is byte-identical to api/data.php.
 * - Writes use aes-256-gcm (the cipher current PHP builds select).
 * - Reads accept aes-256-gcm *and* legacy aes-256-cbc envelopes, because
 *   stores written by older PHP installs are still readable on disk.
 *
 * Configuration:
 * - server.config.json is the primary configuration file. Recognized keys:
 *   `port`, `host`, `storageSecret`, `dataDir`, `uploadsDir`, `nodeEnv`.
 *   Empty string / missing values fall through to the documented defaults.
 * - Environment variables override the config file when both are set
 *   (WEBBYOS_STORAGE_SECRET, WEBBYOS_DATA_DIR, WEBBYOS_UPLOADS_DIR, PORT,
 *   HOST, NODE_ENV), so hosted platforms that inject values keep working.
 * - WEBBYOS_STORAGE_SECRET (or `storageSecret`) must match the secret used
 *   by api/data.php for existing stores to decrypt. When unset, the server
 *   generates and persists a random secret (database/.storage-secret) for
 *   fresh installs, and refuses to boot in production without an explicit
 *   secret. Committed stores encrypted with the historical public default
 *   are therefore unreadable to any new deployment.
 * - WEBBYOS_DATA_DIR / WEBBYOS_UPLOADS_DIR (or `dataDir` / `uploadsDir`)
 *   relocate the encrypted stores and the upload directory (useful when
 *   data must live outside the app root).
 * - PORT / HOST (or `port` / `host`) control the listen address (defaults
 *   8080 / 0.0.0.0).
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");

const ROOT = __dirname;

// ---------------------------------------------------------------------------
// Configuration: server.config.json with environment-variable overrides.
// Precedence per key: process.env > server.config.json > built-in default.
// ---------------------------------------------------------------------------
const CONFIG_FILE = path.join(ROOT, "server.config.json");

function readConfigFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      // A malformed config file should be loud, never silently ignored.
      console.error(`[webbyos] WARNING: ${path.basename(CONFIG_FILE)} is not valid JSON (${error.message}); using defaults.`);
    }
    return {};
  }
}

const FILE_CONFIG = readConfigFile();

function configValue(envName, fileKey) {
  const fromEnv = process.env[envName];
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const fromFile = FILE_CONFIG[fileKey];
  if (fromFile !== undefined && fromFile !== null && fromFile !== "") return String(fromFile);
  return "";
}

function configPort() {
  const raw = configValue("PORT", "port");
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 8080;
}

function configHost() {
  return configValue("HOST", "host") || "0.0.0.0";
}

function configDataDir() {
  const override = configValue("WEBBYOS_DATA_DIR", "dataDir");
  return override ? path.resolve(override) : path.join(ROOT, "database");
}

function configUploadsDir() {
  const override = configValue("WEBBYOS_UPLOADS_DIR", "uploadsDir");
  return override ? path.resolve(override) : path.join(ROOT, "uploads");
}

function configNodeEnv() {
  return configValue("NODE_ENV", "nodeEnv") || "development";
}

const LEGACY_PUBLIC_SECRET = "CHANGE_THIS_SECRET_BEFORE_PRODUCTION";

// Resolved lazily so deployments (and tests) can relocate storage via env
// or the config file.
function databaseDir() {
  return configDataDir();
}

function uploadsDir() {
  return configUploadsDir();
}

// The historical hardcoded secret is public knowledge (it ships in the repo),
// so stores written with it are readable by anyone. Resolution order:
//   1. WEBBYOS_STORAGE_SECRET (explicit, always wins).
//   2. A previously generated random secret persisted to database/.storage-secret.
//   3. Otherwise: generate a random secret and persist it. This rotates away
//      from the public default, so stores committed to the repo cannot be
//      decrypted by a new deployment - they are treated as empty and the app
//      re-seeds itself.
// Production (NODE_ENV=production) never reaches 3: it refuses to boot without
// an explicit secret, because a generated one cannot survive redeploys on
// ephemeral filesystems.
function resolveStorageSecret() {
  const fromEnv = configValue("WEBBYOS_STORAGE_SECRET", "storageSecret");
  if (fromEnv) return fromEnv;

  const isProduction = configNodeEnv() === "production";
  const secretFile = path.join(databaseDir(), ".storage-secret");

  try {
    const persisted = fs.readFileSync(secretFile, "utf8").trim();
    if (persisted) return persisted;
  } catch {
    // No persisted secret yet; fall through.
  }

  if (isProduction) {
    throw new Error(
      "Refusing to start in production without WEBBYOS_STORAGE_SECRET " +
        "(or server.config.json storageSecret). The built-in default is " +
        "public and must not protect real data."
    );
  }

  let hasLegacyStores = false;
  try {
    hasLegacyStores = fs
      .readdirSync(databaseDir())
      .some((entry) => entry.endsWith(".enc"));
  } catch {
    hasLegacyStores = false;
  }
  if (hasLegacyStores) {
    console.error(
      "[webbyos] WARNING: rotating the storage secret. Existing stores were " +
        "encrypted with the public default and will be treated as empty; the " +
        "app re-seeds itself. Set WEBBYOS_STORAGE_SECRET or server.config.json " +
        "storageSecret to read them instead."
    );
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(databaseDir(), { recursive: true });
    fs.writeFileSync(secretFile, `${generated}\n`, { mode: 0o600 });
  } catch (error) {
    // A secret that cannot be persisted would change on every restart and
    // orphan every store, so this is fatal even in development.
    throw new Error(`Unable to persist the generated storage secret: ${error}`);
  }
  return generated;
}

const STORAGE_SECRET = resolveStorageSecret();
void LEGACY_PUBLIC_SECRET;
const KEY = crypto.createHash("sha256").update(STORAGE_SECRET).digest();
const WRITE_CIPHER = "aes-256-gcm";
const GCM_CIPHER = "aes-256-gcm";
const CBC_CIPHER = "aes-256-cbc";

const STORE_FILES = [
  "users",
  "profiles",
  "sessions",
  "forumThreads",
  "forumPosts",
  "blogPosts",
  "calendarEvents",
  "notifications",
  "reactions",
  "bookmarks",
  "activityFeed",
  "conversations",
  "messages",
  "reports",
  "moderationLogs",
  "userWarnings",
  "userSuspensions",
  "reputation",
  "userBadges",
  "mediaLibrary",
  "contentCategories",
  "contentTags",
  "contentRevisions",
  "searchIndex",
  "settings",
  "moduleData",
  "packages"
];

const ALLOWED_ACTIONS = new Set([
  "list",
  "get",
  "put",
  "update",
  "remove",
  "clear",
  "export"
]);
const READ_ONLY_ACTIONS = new Set(["list", "get", "export", "clear"]);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;
// The 5 MB file limit plus multipart overhead (headers, action fields).
const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

/* --------------------------------------------------------------------------
 * Crypto / store helpers (mirror api/data.php)
 * ------------------------------------------------------------------------ */

function encryptStore(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(WRITE_CIPHER, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  return JSON.stringify({
    cipher: WRITE_CIPHER,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64")
  });
}

// Attempt decryption strictly against the resolved runtime key.
function decryptStoreWithCurrentKey(payload) {
  return decryptStore(payload, KEY);
}

function decryptStore(payload, keyOverride) {
  const activeKey = keyOverride || KEY;
  let envelope;
  try {
    envelope = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!envelope || typeof envelope !== "object") return null;

  const { cipher, iv, data, tag } = envelope;
  if (
    typeof cipher !== "string" ||
    typeof iv !== "string" ||
    typeof data !== "string"
  ) {
    return null;
  }

  const ivBuffer = Buffer.from(iv, "base64");
  const dataBuffer = Buffer.from(data, "base64");

  try {
    if (cipher === GCM_CIPHER) {
      if (typeof tag !== "string") return null;
      const decipher = crypto.createDecipheriv(cipher, activeKey, ivBuffer);
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([
        decipher.update(dataBuffer),
        decipher.final()
      ]).toString("utf8");
    }
    if (cipher === CBC_CIPHER) {
      const decipher = crypto.createDecipheriv(cipher, activeKey, ivBuffer);
      return Buffer.concat([
        decipher.update(dataBuffer),
        decipher.final()
      ]).toString("utf8");
    }
  } catch {
    return null;
  }

  return null;
}

// Expected store failures carry a fixed, client-safe message plus the status
// api/data.php returns for the same condition, so internal errno values and
// absolute filesystem paths never reach a client.
class StoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "StoreError";
    this.status = status;
  }
}

// Unexpected failures are reported here instead of in the HTTP response.
function logServerError(context, error) {
  const detail = error && error.stack ? error.stack : String(error);
  console.error(`[webbyos] ${context}: ${detail}`);
}

function storePath(store) {
  return path.join(databaseDir(), `${store}.enc`);
}

// api/data.php locks each read and each write individually, but still loses
// updates when two requests interleave a read-modify-write cycle. Serializing
// every operation for a given store closes that window (and the temp-file
// collision that interleaving used to cause).
const storeQueues = new Map();

function acquireStoreLock(store) {
  const previous = storeQueues.get(store) || Promise.resolve();

  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });

  const tail = previous.then(() => current);
  storeQueues.set(store, tail);
  tail.then(() => {
    if (storeQueues.get(store) === tail) storeQueues.delete(store);
  });

  return previous.then(() => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseCurrent();
    };
  });
}

async function readStore(store, allowUnreadable) {
  let payload;
  try {
    payload = await fsp.readFile(storePath(store), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return { records: [] };
    throw new StoreError("Unable to read store data.");
  }

  const plaintext = decryptStoreWithCurrentKey(payload);
  if (plaintext === null) {
    // Committed stores were encrypted with the historical public default
    // secret. They are unreadable (by design) for any deployment using a
    // rotated or generated secret, so treat them as an empty store instead of
    // failing every request - the app re-seeds itself on first boot.
    if (allowUnreadable) return { records: [], storeWarning: "unreadable" };
    return { records: [] };
  }

  let decoded;
  try {
    decoded = JSON.parse(plaintext);
  } catch {
    return { records: [] };
  }
  if (!decoded || !Array.isArray(decoded.records)) return { records: [] };
  return { records: decoded.records };
}

async function writeStore(store, records) {
  let json;
  try {
    json = JSON.stringify({ records });
  } catch {
    throw new StoreError("Failed to serialize store data.");
  }

  const encrypted = encryptStore(json);
  await fsp.mkdir(databaseDir(), { recursive: true });

  // Atomic replace through a unique temp file: readers only ever observe a
  // complete envelope, and concurrent writers cannot stage through one path.
  const target = storePath(store);
  const temp = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fsp.writeFile(temp, encrypted, { mode: 0o600 });
    await fsp.rename(temp, target);
  } catch {
    await fsp.rm(temp, { force: true }).catch(() => {});
    throw new StoreError("Failed to write store data.");
  }
}

function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

// Mirrors PHP date('c') in a UTC default timezone.
function phpNow() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}+00:00`
  );
}

/* --------------------------------------------------------------------------
 * HTTP helpers
 * ------------------------------------------------------------------------ */

// Security headers applied to every response, JSON and static alike. The CSP
// must keep 'unsafe-inline' for scripts and styles: the app ships an inline
// boot script in index.html and module templates rely on inline event handlers.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer"
};

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, limit) {
  // Reject an oversized *declared* body before reading anything. Once the
  // server starts consuming a body and then stops, the client can no longer
  // reliably receive a response. Bodies without a usable length (chunked) are
  // caught by the running total below.
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limit) {
    req.resume();
    const error = new Error("Request body is too large.");
    error.code = "BODY_TOO_LARGE";
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("Request body is too large.");
        error.code = "BODY_TOO_LARGE";
        // Undeclared or understated length: a response is not reliably
        // deliverable mid-upload, so close the connection instead.
        req.destroy();
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    // Never surface the raw socket error text to a client.
    req.on("error", () => reject(new Error("Unable to read request body.")));
  });
}

function isBlockedPath(relativePath) {
  const lower = relativePath.toLowerCase();
  if (!lower) return false;

  const segments = lower.split("/");
  if (
    segments.some(
      (segment) =>
        segment === "database" ||
        segment === "node_modules" ||
        segment === ".git" ||
        // Any dotfile segment is blocked: .gitignore, .gitattributes, .env*,
        // .htaccess, etc. are install/configuration details, not site content.
        segment.startsWith(".")
    )
  ) {
    return true;
  }

  return (
    lower.endsWith(".php") ||
    lower.endsWith(".enc") ||
    lower.endsWith(".bak")
  );
}

async function serveStatic(req, res, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname);
  } catch {
    // Malformed percent-encoding is a bad request, not a server error.
    return sendJson(res, 400, { error: "Invalid request path." });
  }

  relativePath = relativePath.replace(/^\/+/, "");
  if (relativePath === "" || relativePath.endsWith("/")) {
    relativePath += "index.html";
  }

  const target = path.resolve(ROOT, relativePath);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return sendJson(res, 404, { error: "Not found." });
  }

  // Check the RESOLVED path as well: encoded separators such as "%2f" survive
  // URL parsing and let a blocked extension (e.g. api/data.php%2f.) hide from
  // the raw-path check while path.resolve still normalises it to the real file.
  const resolvedRelative = path.relative(ROOT, target).split(path.sep).join("/");
  if (isBlockedPath(relativePath) || isBlockedPath(resolvedRelative)) {
    return sendJson(res, 404, { error: "Not found." });
  }

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    return sendJson(res, 404, { error: "Not found." });
  }

  let filePath = target;
  if (stat.isDirectory()) {
    filePath = path.join(target, "index.html");
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return sendJson(res, 404, { error: "Not found." });
    }
  }
  if (!stat.isFile()) return sendJson(res, 404, { error: "Not found." });

  const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": type,
    "Content-Length": stat.size,
    "Cache-Control": "no-cache"
  });

  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}

/* --------------------------------------------------------------------------
 * api/data.php replacement
 * ------------------------------------------------------------------------ */

// api/data.php validates the put/update payloads with a falsy check
// (`if (!$record)` / `if (!$patch)`), and an empty PHP array - what `{}`
// decodes to - is falsy there. Treating `{}` as a valid payload would let
// the Node runtime create junk records and bump timestamps where PHP answers
// 400, so an object payload must also carry at least one key. Array payloads
// are rejected as well: PHP would coerce a non-empty JSON list into a broken
// record, and a 400 is the safer, still client-safe answer.
function isNonEmptyObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
  );
}

async function handleDataApi(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Only POST requests are allowed." });
  }

  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return sendJson(res, 400, { error: "Content-Type must be application/json." });
  }

  let raw;
  try {
    raw = await readBody(req, MAX_JSON_BODY_BYTES);
  } catch (error) {
    const tooLarge = error && error.code === "BODY_TOO_LARGE";
    return sendJson(res, 400, {
      error: tooLarge ? "Request body is too large." : "Invalid request body."
    });
  }
  if (!raw || raw.length === 0) {
    return sendJson(res, 400, { error: "Request body is empty." });
  }

  let data;
  try {
    data = JSON.parse(raw.toString("utf8"));
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON payload." });
  }
  if (!data || typeof data !== "object") {
    return sendJson(res, 400, { error: "Invalid JSON payload." });
  }

  const action = data.action;
  const store = data.store;

  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return sendJson(res, 400, { error: "Unknown action." });
  }
  if (typeof store !== "string" || !STORE_FILES.includes(store)) {
    return sendJson(res, 400, { error: "Invalid store name." });
  }

  try {
    await fsp.mkdir(databaseDir(), { recursive: true });
  } catch {
    return sendJson(res, 500, { error: "Unable to initialize database directory." });
  }

  const allowUnreadable = READ_ONLY_ACTIONS.has(action);

  // Hold the store lock across the read-modify-write below so concurrent
  // requests cannot interleave and drop records.
  const releaseLock = await acquireStoreLock(store);

  let storeData;
  try {
    storeData = await readStore(store, allowUnreadable);
  } catch (error) {
    releaseLock();
    if (error instanceof StoreError) {
      return sendJson(res, error.status, { error: error.message });
    }
    logServerError(`data ${action} ${store} (read)`, error);
    return sendJson(res, 500, { error: "Store operation failed." });
  }

  let records = Array.isArray(storeData.records) ? storeData.records : [];

  try {
    switch (action) {
      case "list":
        return sendJson(res, 200, { records: records.slice() });

      case "get": {
        const id = data.id;
        if (typeof id !== "string" && typeof id !== "number") {
          return sendJson(res, 400, { error: "Missing record id for get action." });
        }
        const found = records.find((record) => String(record.id) === String(id));
        return sendJson(res, 200, { record: found || null });
      }

      case "put": {
        const record = isNonEmptyObject(data.record) ? data.record : null;
        if (!record) {
          return sendJson(res, 400, { error: "Missing record payload for put action." });
        }

        const id =
          record.id !== undefined && record.id !== null && typeof record.id !== "object"
            ? String(record.id)
            : generateId();
        const now = phpNow();
        const next = {
          ...record,
          id,
          createdAt: record.createdAt !== undefined && record.createdAt !== null
            ? record.createdAt
            : now,
          updatedAt: now
        };

        const index = records.findIndex((existing) => String(existing.id) === id);
        if (index === -1) {
          records = records.concat([next]);
        } else {
          records = records.map((existing, position) =>
            position === index ? next : existing
          );
        }

        await writeStore(store, records);
        return sendJson(res, 200, { record: next });
      }

      case "update": {
        const id = data.id;
        const patch = isNonEmptyObject(data.patch) ? data.patch : null;
        if ((typeof id !== "string" && typeof id !== "number") || !patch) {
          return sendJson(res, 400, {
            error: "Missing id or patch payload for update action."
          });
        }

        const index = records.findIndex((record) => String(record.id) === String(id));
        if (index === -1) {
          return sendJson(res, 400, { error: "Record not found for update action." });
        }

        const existing = records[index];
        const now = phpNow();
        const updated = {
          ...existing,
          ...patch,
          id: existing.id,
          createdAt:
            existing.createdAt !== undefined && existing.createdAt !== null
              ? existing.createdAt
              : now,
          updatedAt: now
        };
        records = records.map((record, position) =>
          position === index ? updated : record
        );

        await writeStore(store, records);
        return sendJson(res, 200, { record: updated });
      }

      case "remove": {
        const id = data.id;
        if (typeof id !== "string" && typeof id !== "number") {
          return sendJson(res, 400, { error: "Missing record id for remove action." });
        }
        const found = records.some((record) => String(record.id) === String(id));
        if (!found) {
          return sendJson(res, 400, { error: "Record not found for remove action." });
        }
        records = records.filter((record) => String(record.id) !== String(id));
        await writeStore(store, records);
        return sendJson(res, 200, { success: true });
      }

      case "clear":
        await writeStore(store, []);
        return sendJson(res, 200, { success: true });

      case "export":
        return sendJson(res, 200, { store: { records: records.slice() } });

      default:
        return sendJson(res, 400, { error: "Unhandled action." });
    }
  } catch (error) {
    if (error instanceof StoreError) {
      return sendJson(res, error.status, { error: error.message });
    }
    logServerError(`data ${action} ${store}`, error);
    return sendJson(res, 500, { error: "Store operation failed." });
  } finally {
    releaseLock();
  }
}

/* --------------------------------------------------------------------------
 * api/upload.php replacement
 * ------------------------------------------------------------------------ */

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return "";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

// Beyond the magic-byte sniff, verify the payload is structurally a real
// image - the closest equivalent of PHP's getimagesize() gate in api/upload.php,
// which a bare PNG header followed by garbage would have failed. Each parser
// checks enough of the container structure to reject header-only fakes.
function looksLikeRealImage(buffer, mime) {
  if (mime === "image/png") {
    if (buffer.length < 33) return false;
    // Signature + IHDR chunk (length, type) + fixed IHDR fields.
    if (buffer.readUInt32BE(8) !== 13) return false;
    if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return false;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width === 0 || height === 0) return false;
    if (width > 65535 || height > 65535) return false;
    const bitDepth = buffer[24];
    const colorType = buffer[25];
    const validDepths = colorType === 3 ? [1, 2, 4, 8] : [8, 16];
    return validDepths.includes(bitDepth) && [0, 2, 3, 4, 6].includes(colorType);
  }
  if (mime === "image/jpeg") {
    // Walk the marker segments to a mandatory SOFn frame header.
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) return false;
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) return false;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return offset + 2 + length <= buffer.length;
      }
      offset += 2 + length;
    }
    return false;
  }
  if (mime === "image/gif") {
    if (buffer.length < 14) return false;
    // Logical screen descriptor must declare a non-zero canvas.
    return buffer.readUInt16LE(6) > 0 || buffer.readUInt16LE(8) > 0;
  }
  if (mime === "image/webp") {
    if (buffer.length < 30) return false;
    const chunk = buffer.subarray(12, 16).toString("ascii");
    // VP8 (lossy) carries a frame header; VP8L (lossless) a signature byte.
    if (chunk === "VP8 ") return buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a;
    if (chunk === "VP8L") return buffer[21] === 0x2f;
    if (chunk === "VP8X") return true;
    return false;
  }
  return false;
}

function timestampStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

// Cap the raw upload request body BEFORE formData() parses it. Undici's
// formData() consumes the entire stream before any field is validated, so
// without a byte cap an attacker can stream unbounded data. Two layers:
//   1. Reject an oversized declared Content-Length before reading anything
//      (the connection stays healthy and the client gets a clean 413).
//   2. A counting transform in the stream aborts when an undeclared or
//      understated body exceeds the limit mid-flight.
function uploadBodyTooLarge(res) {
  return sendJson(res, 413, { error: "Upload is too large." });
}

function enforceUploadBodyCap(req, res) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BODY_BYTES) {
    req.resume();
    uploadBodyTooLarge(res);
    return false;
  }

  let seen = 0;
  req.on("data", (chunk) => {
    seen += chunk.length;
    if (seen > MAX_UPLOAD_BODY_BYTES) {
      // A response is not reliably deliverable mid-multipart, so close the
      // connection rather than continue buffering the rest of the body.
      req.destroy();
    }
  });
  return true;
}

async function handleUploadApi(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Only POST requests are allowed." });
  }

  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return sendJson(res, 400, { error: "Uploads must use multipart/form-data." });
  }

  if (!enforceUploadBodyCap(req, res)) return;

  let form;
  try {
    const request = new Request("http://localhost/api/upload.php", {
      method: "POST",
      headers: { "content-type": contentType },
      body: Readable.toWeb(req),
      duplex: "half"
    });
    form = await request.formData();
  } catch {
    // Covers both malformed payloads and the destroyed-socket case from the
    // byte counter above (the client is gone, so a response attempt is a no-op).
    if (!res.writableEnded) return sendJson(res, 400, { error: "Invalid upload payload." });
    return;
  }

  const action = String(form.get("action") || "upload");

  if (action === "delete") {
    // Deleting uploads is a capability-gated operation. The requester identity
    // is NOT taken from the form (it would be trivially spoofed): the server
    // reads its own sessions store to find the active user, then allows the
    // delete only for admins/moderators or the uploader of the media record
    // that references the file.
    const filename = String(form.get("filename") || "")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/^.*[/\\]/, "");
    if (!filename) {
      return sendJson(res, 400, { error: "Missing filename." });
    }

    let allowed = false;
    try {
      const [{ records: sessions }, { records: users }, { records: media }] = await Promise.all([
        readStore("sessions", false),
        readStore("users", false),
        readStore("mediaLibrary", false)
      ]);

      const session = sessions.find(
        (entry) => entry && typeof entry === "object" && entry.active === true
      );
      const requestingUser = session
        ? users.find(
            (entry) =>
              entry && typeof entry === "object" &&
              (entry.id === session.userId || entry.username === session.userId)
          )
        : null;
      const role = requestingUser?.role || "";
      const canManageMedia = role === "admin" || role === "moderator";

      const owningRecord = media.find(
        (entry) => entry && typeof entry === "object" && entry.filename === filename
      );
      if (canManageMedia) {
        allowed = true;
      } else if (owningRecord) {
        allowed =
          Boolean(requestingUser?.id) &&
          requestingUser.id === owningRecord.uploaderId;
      }
      // Orphaned file with no owning record: only admins/moderators may clean up.
    } catch (error) {
      if (error instanceof StoreError) {
        return sendJson(res, error.status, { error: error.message });
      }
      logServerError("upload delete (media lookup)", error);
      return sendJson(res, 500, { error: "Store operation failed." });
    }

    if (!allowed) {
      return sendJson(res, 403, {
        error: "You do not have permission to delete this media file."
      });
    }

    const target = path.resolve(uploadsDir(), filename);
    if (!target.startsWith(uploadsDir() + path.sep)) {
      return sendJson(res, 400, { error: "Invalid filename." });
    }
    let existed = true;
    try {
      await fsp.rm(target, { force: false });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        existed = false;
      } else {
        logServerError("upload delete (file remove)", error);
        return sendJson(res, 500, { error: "Unable to delete media file." });
      }
    }
    return sendJson(res, 200, { success: true, deleted: existed });
  }

  if (action !== "upload") {
    return sendJson(res, 400, { error: "Unknown upload action." });
  }

  const file = form.get("media");
  if (!file || typeof file === "string") {
    return sendJson(res, 400, { error: "Missing media file." });
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return sendJson(res, 400, { error: "File is too large." });
  }

  let buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return sendJson(res, 400, { error: "Upload failed." });
  }

  const mime = detectImageMime(buffer);
  if (!mime || !ALLOWED_IMAGE_TYPES[mime]) {
    return sendJson(res, 400, { error: "Unsupported file type." });
  }
  // Magic bytes alone are not enough: a few forged header bytes wrapped around
  // garbage must fail exactly like PHP's getimagesize() check did.
  if (!looksLikeRealImage(buffer, mime)) {
    return sendJson(res, 400, { error: "File is not a valid image." });
  }

  try {
    await fsp.mkdir(uploadsDir(), { recursive: true });
  } catch {
    return sendJson(res, 500, { error: "Unable to initialize upload directory." });
  }

  const original = path.basename(String(file.name || "upload"));
  const filename = `${timestampStamp()}-${crypto.randomBytes(12).toString("hex")}.${ALLOWED_IMAGE_TYPES[mime]}`;

  try {
    await fsp.writeFile(path.join(uploadsDir(), filename), buffer, { mode: 0o644 });
  } catch {
    return sendJson(res, 500, { error: "Unable to store uploaded file." });
  }

  return sendJson(res, 200, {
    media: {
      filename,
      originalName: original,
      mimeType: mime,
      size: buffer.length,
      url: `./uploads/${filename}`
    }
  });
}

/* --------------------------------------------------------------------------
 * Server
 * ------------------------------------------------------------------------ */

function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      return sendJson(res, 400, { error: "Invalid request." });
    }

    const route = pathname.replace(/\/+$/, "") || "/";

    if (route === "/api/data.php" || route === "/api/data") {
      return void handleDataApi(req, res).catch(() =>
        sendJson(res, 500, { error: "Unexpected server error." })
      );
    }
    if (route === "/api/upload.php" || route === "/api/upload") {
      return void handleUploadApi(req, res).catch(() =>
        sendJson(res, 500, { error: "Unexpected server error." })
      );
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    return void serveStatic(req, res, pathname).catch(() =>
      sendJson(res, 500, { error: "Unexpected server error." })
    );
  });
}

function start() {
  const port = configPort();
  const host = configHost();
  const server = createServer();
  server.listen(port, host, () => {
    process.stdout.write(`WebbyOS runtime listening on http://${host}:${port}\n`);
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = {
  createServer,
  start,
  encryptStore,
  decryptStore,
  readStore,
  writeStore,
  detectImageMime,
  STORE_FILES,
  databaseDir,
  uploadsDir,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_BODY_BYTES
};
