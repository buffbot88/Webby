const CategoryCoreSystem = (() => {
  const STORE = "contentCategories";

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function canManage() {
    return window.UserCoreSystem?.can?.("cms.taxonomy.manage") === true;
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category";
  }

  function normalize(record) {
    const name = String(record.name || record.title || "General").trim() || "General";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : slugify(name),
      name,
      slug: slugify(record.slug || name),
      description: typeof record.description === "string" ? record.description : "",
      contentTypes: Array.isArray(record.contentTypes) ? record.contentTypes : [],
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function listCategories(criteria = {}) {
    const records = await window.DataCoreSystem.list(STORE);
    let categories = Array.isArray(records) ? records.map(normalize) : [];
    if (criteria.contentType) {
      categories = categories.filter((item) => !item.contentTypes.length || item.contentTypes.includes(criteria.contentType));
    }
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function saveCategory(payload) {
    if (!canManage()) throw new Error("You do not have permission to manage categories.");
    return window.DataCoreSystem.put(STORE, normalize(payload || {}));
  }

  async function deleteCategory(id) {
    if (!canManage()) throw new Error("You do not have permission to manage categories.");
    return window.DataCoreSystem.remove(STORE, id);
  }

  async function ensureCategory(name, contentType = "") {
    const normalized = normalize({ name, contentTypes: contentType ? [contentType] : [] });
    const existing = (await listCategories()).find((item) => item.slug === normalized.slug);
    if (existing) return existing;
    if (!window.UserCoreSystem?.isAuthenticated?.()) return normalized;
    try {
      return await window.DataCoreSystem.put(STORE, normalized);
    } catch {
      return normalized;
    }
  }

  function renderCategoryOptions(categories, selected = "") {
    const values = Array.isArray(categories) && categories.length ? categories : [normalize({ name: "General" })];
    return values.map((item) => `<option value="${escape(item.name)}" ${item.name === selected ? "selected" : ""}>${escape(item.name)}</option>`).join("");
  }

  function renderCategoryChips(categories) {
    if (!Array.isArray(categories) || !categories.length) return `<div class="taxonomy-empty">No categories yet.</div>`;
    return `<div class="taxonomy-list">${categories.map((item) => `<span class="taxonomy-chip">${escape(item.name)}</span>`).join("")}</div>`;
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ categoryReady: true });
    }
  }

  return {
    init,
    listCategories,
    saveCategory,
    deleteCategory,
    ensureCategory,
    renderCategoryOptions,
    renderCategoryChips,
    slugify
  };
})();

window.CategoryCoreSystem = CategoryCoreSystem;
