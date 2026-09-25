"use strict";

/**
 * Shell + theme contract tests.
 *
 * These lock in the Midnight Glass Fantasy shell: the layout template, the
 * slots LayoutEngine knows how to fill, the theme tokens, and the brand art.
 * They run with no dependencies (node:test only) so the design system cannot
 * silently regress into unresolved slots or a missing background layer.
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
    "assets/brand/webby-night-portrait.svg"
  ]) {
    assert.ok(exists(asset), `missing artwork ${asset}`);
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
