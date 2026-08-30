const TagCoreSystem = (() => {
  const STORE = "contentTags";

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function canManage() {
    return window.UserCoreSystem?.can?.("cms.taxonomy.manage") === true;
  }

  function normalizeTagName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function slugify(value) {
    return normalizeTagName(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag";
  }

  function parseTags(value) {
    if (Array.isArray(value)) return value.map(normalizeTagName).filter(Boolean);
    return String(value || "").split(",").map(normalizeTagName).filter(Boolean);
  }

  function normalize(record) {
    const name = normalizeTagName(record.name || record.title || "tag") || "tag";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : slugify(name),
      name,
      slug: slugify(record.slug || name),
      usageCount: Number.isFinite(Number(record.usageCount)) ? Number(record.usageCount) : 0,
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function listTags() {
    const records = await window.DataCoreSystem.list(STORE);
    return (Array.isArray(records) ? records.map(normalize) : []).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function saveTag(payload) {
    if (!canManage()) throw new Error("You do not have permission to manage tags.");
    return window.DataCoreSystem.put(STORE, normalize(payload || {}));
  }

  async function syncTags(tags) {
    const names = parseTags(tags);
    const existing = await listTags();
    const saved = [];
    for (const name of names) {
      const slug = slugify(name);
      const match = existing.find((item) => item.slug === slug);
      if (match) {
        saved.push(await window.DataCoreSystem.update(STORE, match.id, { usageCount: Number(match.usageCount || 0) + 1 }));
      } else if (window.UserCoreSystem?.isAuthenticated?.()) {
        saved.push(await window.DataCoreSystem.put(STORE, normalize({ name, usageCount: 1 })));
      }
    }
    return saved;
  }

  function renderTagChips(tags) {
    const values = Array.isArray(tags) ? tags : [];
    if (!values.length) return `<div class="taxonomy-empty">No tags yet.</div>`;
    return `<div class="taxonomy-list">${values.map((item) => `<span class="taxonomy-chip">${escape(item.name || item)}</span>`).join("")}</div>`;
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ tagReady: true });
    }
  }

  return {
    init,
    listTags,
    saveTag,
    syncTags,
    parseTags,
    renderTagChips,
    slugify
  };
})();

window.TagCoreSystem = TagCoreSystem;
