// Live verification of server.config.json behavior. Child processes run with
// explicitly controlled env so no parent-shell assumptions are made.
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync, execFile } = require("child_process");

let pass = 0, fail = 0;
const check = (label, ok, detail) => ok
  ? (pass++, console.log(`  ok   ${label}`))
  : (fail++, console.log(`  FAIL ${label} :: ${detail}`));

const ENV_PROTO = { PATH: "/usr/bin:/bin", HOME: "/tmp" };

const cfgDir = fs.mkdtempSync("/tmp/cfgtest-");
fs.copyFileSync(path.join(__dirname, "..", "..", "server.js"), path.join(cfgDir, "server.js"));

// 1. dataDir + storageSecret from server.config.json (no env at all).
const dataDirFromConfig = path.join(cfgDir, "db");
fs.writeFileSync(path.join(cfgDir, "server.config.json"), JSON.stringify({
  dataDir: dataDirFromConfig,
  storageSecret: "file-secret-123"
}));
const out = execFileSync("node", ["-e", `
  const rt = require("./server.js");
  console.log(JSON.stringify({ dir: rt.databaseDir(), uploads: rt.uploadsDir() }));
`], { cwd: cfgDir, env: ENV_PROTO });
const parsed = JSON.parse(String(out).trim());
check("dataDir read from server.config.json (no env)", parsed.dir === dataDirFromConfig, parsed.dir);
check("uploadsDir defaults inside app root when unset",
  parsed.uploads.startsWith(cfgDir) && parsed.uploads.endsWith("uploads"), parsed.uploads);
check("storageSecret from config used (no generated file)",
  !fs.existsSync(path.join(dataDirFromConfig, ".storage-secret")));

// 2. Env var beats the config file.
const out2 = execFileSync("node", ["-e", `
  const rt = require("./server.js");
  console.log(JSON.stringify({ dir: rt.databaseDir() }));
`], { cwd: cfgDir, env: { ...ENV_PROTO, WEBBYOS_DATA_DIR: "/tmp/env-wins" } });
const parsed2 = JSON.parse(String(out2).trim());
check("env var overrides config file", parsed2.dir === "/tmp/env-wins", parsed2.dir);

// 3. Malformed config: loud fallback to defaults.
fs.writeFileSync(path.join(cfgDir, "server.config.json"), "{ broken");
const out3 = execFileSync("node", ["-e", `
  const rt = require("./server.js");
  console.log(JSON.stringify({ dir: rt.databaseDir() }));
`], { cwd: cfgDir, env: ENV_PROTO });
const parsed3 = JSON.parse(String(out3).trim());
check("malformed config falls back to defaults",
  parsed3.dir === path.join(cfgDir, "database"), parsed3.dir);

// 4. start() honors config port/host.
fs.writeFileSync(path.join(cfgDir, "server.config.json"),
  JSON.stringify({ port: 3987, host: "127.0.0.1" }));
const child = execFile("node", ["server.js"], { cwd: cfgDir, env: ENV_PROTO });
setTimeout(() => {
  const http = require("http");
  const req = http.get({ port: 3987, host: "127.0.0.1", path: "/" }, (res) => {
    check("start() listens on config port/host", [200, 404].includes(res.statusCode), String(res.statusCode) + " (connection succeeded = config host/port honored)");
    child.kill();
    finish();
  });
  req.on("error", (e) => {
    check("start() listens on config port/host", false, e.message);
    child.kill();
    finish();
  });
}, 700);

function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
