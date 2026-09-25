"use strict";

/**
 * Shell + theme contract tests.
 *
 * Run with no dependencies (node:test only); lock in the layout slots, theme tokens, brand art, and entrypoint wiring so the shell cannot silently regress.
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function slotsIn(source) {
  return [...source.matchAll(/\{\{slot:([a-zA-Z]+)\}\}/g)].map((match) => match[1]);
}

test("layout template declares the main slot", () => {
  const layout = read("layouts/default.html");
  assert.ok(layout.includes("{{slot:main}}"), "layout must expose {{slot:main}}");
});

test("every layout slot is filled by LayoutEngine.inject", () => {
  const layout = read("layouts/default.html");
  const engine = read("assets/layoutEngine.js");
  const filled = new Set(slotsIn(engine));

  const missing = [...new Set(slotsIn(layout))].filter((slot) => !filled.has(slot));
  assert.deepEqual(missing, [], `LayoutEngine does not fill: ${missing.join(", ")}`);
});

test("shell renders the icon rail, glass header and background layer", () => {
  const layout = read("layouts/default.html");

  for (const marker of [
    "class=\"app-shell\"",
    "class=\"nav-rail\"",
    "class=\"rail-logo\"",
    "class=\"topbar\"",
    "class=\"topbar-search\"",
    "class=\"topbar-actions\"",
    "class=\"app-background\"",
    "class=\"bottom-nav\"",
    "id=\"layout-slot\""
  ]) {
    assert.ok(layout.includes(marker), `layout missing ${marker}`);
  }
});

test("theme exposes the Midnight Glass Fantasy tokens", () => {
  const css = read("assets/theme.css");

  for (const token of [
    "--bg-deep: #030914",
    "--bg-navy: #061426",
    "--surface-glass: rgba(8, 27, 51, 0.68)",
    "--surface-glass-heavy: rgba(7, 23, 44, 0.84)",
    "--border-glass: rgba(135, 192, 255, 0.22)",
    "--border-bright: rgba(105, 194, 255, 0.55)",
    "--text-primary: #eef5ff",
    "--text-secondary: #b5c4da",
    "--text-muted: #7187a3",
    "--cyan: #55dcff",
    "--gold: #e1bc72",
    "--rose: #ff849b",
    "--rail-width: 84px",
    "--content-max: 1380px"
  ]) {
    assert.ok(css.includes(token), `theme missing token ${token}`);
  }
});

test("theme implements the three glass strengths and the rail", () => {
  const css = read("assets/theme.css");

  assert.ok(css.includes(".glass-subtle"), "missing subtle glass");
  assert.ok(css.includes(".glass-strong"), "missing strong glass");
  assert.ok(/\.nav-item\.is-active/.test(css), "missing rail active state");
  assert.ok(/\.nav-item::after/.test(css), "missing rail tooltip");
  assert.ok(css.includes(".bottom-nav"), "missing mobile bottom navigation");
  assert.ok(
    css.includes("background-image: url(\"./brand/webby-night.svg\")"),
    "background layer must reference the fantasy environment"
  );
});

test("forums browse exposes category cards wired to the filter", () => {
  const forums = read("Core/Modules/Forums/index.js");
  const css = read("assets/theme.css");

  assert.ok(forums.includes("renderCategoryGrid()"), "browse view must render the category grid");
  assert.ok(forums.includes("setCategory,"), "ForumModuleUI must expose setCategory");
  assert.ok(css.includes(".forum-category-grid"), "missing category grid styles");
  assert.ok(css.includes(".forum-category-card"), "missing category card styles");
});

test("brand and environment artwork exist", () => {
  for (const asset of [
    "assets/brand/webby-crystal.svg",
    "assets/brand/webby-avatar.svg",
    "assets/brand/webby-empty.svg",
    "assets/brand/webby-night.svg",
    "assets/brand/webby-night-portrait.svg",
    "assets/brand/webby-night-ultrawide.svg",
    "assets/brand/webby-auth.svg"
  ]) {
    assert.ok(exists(asset), `missing artwork ${asset}`);
  }
});

test("environment art swaps for ultrawide and auth surfaces", () => {
  const css = read("assets/theme.css");

  assert.ok(
    css.includes('url("./brand/webby-night-ultrawide.svg")'),
    "ultrawide displays must get the natively authored wide scene"
  );
  assert.ok(
    css.includes('url("./brand/webby-auth.svg")'),
    "authentication surfaces must get the alternate composition"
  );
  assert.ok(
    /@media \(min-width: 2200px\)/.test(css),
    "the ultrawide swap must be gated on a wide viewport"
  );
});

test("the theme is one stylesheet, with the glass parity rules folded in", () => {
  const css = read("assets/theme.css");

  for (const marker of [
    ":root .module-empty-state,",
    ":root .portal-empty-state {",
    ":root .social-count,",
    ":root .forum-index-panel {",
    ":root .forum-index-row {",
    ":root .forum-row-chevron {",
    ":root .forum-tag {",
    ":root .hero-actions {"
  ]) {
    assert.ok(css.includes(marker), `theme.css must own the folded glass parity rule ${marker}`);
  }

  // the folded selectors carry an extra :root ancestor so they keep winning the
  // cascade without depending on loading after theme.css
  assert.ok(
    !/^\.forum-index-panel/m.test(css),
    "glass parity selectors must carry the :root specificity prefix"
  );

  assert.ok(
    !exists("assets/theme-glass-parity.css"),
    "the parity sheet must be gone now that theme.css owns its rules"
  );

  for (const entry of ["index.html", "src/index.html"]) {
    assert.ok(
      !read(entry).includes("theme-glass-parity"),
      `${entry} must not link the retired parity sheet`
    );
  }
});

test("both entrypoints load the theme, fonts and brand mark", () => {
  for (const entry of ["index.html", "src/index.html"]) {
    const html = read(entry);
    assert.ok(html.includes("family=Cinzel"), `${entry} must load the display font`);
    assert.ok(html.includes("family=Inter"), `${entry} must load the interface font`);
    assert.ok(html.includes("webby-crystal.svg"), `${entry} must use the Webby mark as favicon`);
    assert.ok(/assets\/theme\.css/.test(html), `${entry} must load the theme stylesheet`);
  }
});

test("both entrypoints load the same runtime scripts", () => {
  const classic = [...read("index.html").matchAll(/src="\.\/([^"]+)"/g)].map((m) => m[1]).sort();
  const vite = [...read("src/main.jsx").matchAll(/"([A-Za-z][^"]*\.js)"/g)].map((m) => m[1]).sort();

  assert.ok(classic.length && vite.length, "both entrypoints must declare runtime scripts");
  assert.deepEqual(
    classic.filter((src) => !vite.includes(src)),
    [],
    "scripts the classic entrypoint loads but the Vite entrypoint skips"
  );
  assert.deepEqual(
    vite.filter((src) => !classic.includes(src)),
    [],
    "scripts the Vite entrypoint loads but the classic entrypoint skips"
  );
});

test("the live runtime hands the active route to the shell", () => {
  const runtime = read("Core/Runtime/index.js");
  const engine = read("assets/layoutEngine.js");

  assert.ok(
    /LayoutEngine\.inject\(layout, moduleHTML, \{\s*route:\s*route\.id\s*\}\)/.test(runtime),
    "Core/Runtime must pass { route } or the rail never marks the active item"
  );
  assert.ok(
    engine.includes("context.route"),
    "LayoutEngine.inject must read the route from its context"
  );
});
