// ContentCoreSystem stores content records through DataCoreSystem into the encrypted PHP file DB.
// This is a lightweight local development content layer. Production content workflows require hardened server-side content APIs.
const ContentCoreSystem = (() => {

  const STORE = "moduleData";
  const DEFAULT_CONTENT = [
    {
      contentType: "page",
      slug: "welcome",
      title: "Welcome to WebbyOS",
      body: "<p>Welcome to the WebbyOS demo. This content is stored through DataCoreSystem into the encrypted PHP file DB.</p>",
      status: "published",
      authorId: "admin"
    }
  ];

  let ready = false;
  let contentList = [];

  function logWarn(message, data) {
    Diagnostics?.warn?.("[ContentCoreSystem] " + message, data || {});
  }

  function logError(message, data) {
    Diagnostics?.error?.("[ContentCoreSystem] " + message, data || {});
  }

  function normalizeSlug(value) {
    if (typeof value !== "string") return "";
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/--+/g, "-");
  }

  function normalizeStatus(contentType, status) {
    const value = typeof status === "string" ? status.trim() : "";
    const allowedByType = {
      blogPost: ["draft", "published", "trash"],
      calendarEvent: ["draft", "published", "cancelled", "trash"],
      forumThread: ["open", "closed", "trash"],
      forumPost: ["visible", "trash"]
    };

    if (Array.isArray(allowedByType[contentType])) {
      return allowedByType[contentType].includes(value) ? value : allowedByType[contentType][0];
    }

    return value === "published" ? "published" : "draft";
  }

  function normalizeContent(raw, fallbackType = "page") {
    const type = typeof raw.contentType === "string" && raw.contentType.trim() ? raw.contentType.trim() : fallbackType;
    const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled";
    const slug = normalizeSlug(raw.slug || title || String(raw.id || "content"));

    return {
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined,
      contentType: type,
      title,
      slug,
      body: typeof raw.body === "string" ? raw.body : "",
      status: normalizeStatus(type, raw.status),
      authorId: typeof raw.authorId === "string" ? raw.authorId : "",
      metadata: typeof raw.metadata === "object" && raw.metadata !== null ? { ...raw.metadata } : {},
      createdAt: typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt.trim() ? raw.updatedAt : new Date().toISOString()
    };
  }

  async function loadContent() {
    if (!window.DataCoreSystem?.list) {
      logWarn("DataCoreSystem is unavailable for content loading.");
      contentList = [];
      return [];
    }

    try {
      const stored = await window.DataCoreSystem.list(STORE);
      contentList = Array.isArray(stored) ? stored.map((item) => normalizeContent(item, item.contentType || "page")) : [];
      return contentList;
    } catch (err) {
      logWarn("Failed to load content store.", err);
      contentList = [];
      return [];
    }
  }

  async function persistContent() {
    if (!window.DataCoreSystem?.clear || !window.DataCoreSystem?.put) {
      logWarn("DataCoreSystem is unavailable for content persistence.");
      return false;
    }

    try {
      await window.DataCoreSystem.clear(STORE);
      for (const item of contentList) {
        await window.DataCoreSystem.put(STORE, item);
      }
      return true;
    } catch (err) {
      logError("Failed to persist content.", err);
      return false;
    }
  }

  function ensureContentId(item) {
    if (item.id) return item.id;
    const fallback = item.slug || `${item.contentType}-${Date.now()}`;
    return normalizeSlug(fallback) || `content-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function seedDefaultContent() {
    await loadContent();
    if (contentList.length > 0) return;

    contentList = DEFAULT_CONTENT.map((entry) => {
      const normalized = normalizeContent(entry, entry.contentType || "page");
      normalized.id = ensureContentId(normalized);
      return normalized;
    });

    await persistContent();
  }

  function filterByType(items, contentType) {
    if (!contentType) return items;
    return items.filter((item) => item.contentType === contentType);
  }

  function filterByCriteria(items, criteria = {}) {
    let results = items;

    if (criteria.status) {
      results = results.filter((item) => item.status === criteria.status);
    }

    if (criteria.authorId) {
      results = results.filter((item) => item.authorId === criteria.authorId);
    }

    if (criteria.slug) {
      results = results.filter((item) => item.slug === criteria.slug);
    }

    if (criteria.query) {
      const query = String(criteria.query).trim().toLowerCase();
      if (query) {
        results = results.filter((item) =>
          item.title.toLowerCase().includes(query) ||
          item.body.toLowerCase().includes(query) ||
          item.slug.toLowerCase().includes(query)
        );
      }
    }

    return results;
  }

  async function init() {
    await seedDefaultContent();
    ready = true;
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ contentReady: ready, contentTypes: getContentTypes() });
    }
    return {
      contentReady: ready,
      contentTypes: getContentTypes()
    };
  }

  function getContentTypes() {
    return Array.from(new Set(contentList.map((item) => item.contentType))).sort();
  }

  async function listContent(contentType, criteria = {}) {
    await loadContent();
    const results = filterByType(contentList, contentType);
    return filterByCriteria(results, criteria);
  }

  async function getContent(contentType, idOrSlug) {
    if (!idOrSlug) return null;
    await loadContent();
    const normalized = String(idOrSlug).trim();
    return contentList.find((item) =>
      item.contentType === contentType &&
      (String(item.id) === normalized || item.slug === normalized)
    ) || null;
  }

  async function createContent(contentType, payload) {
    if (typeof contentType !== "string" || !contentType.trim()) {
      throw new Error("Content type is required.");
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Content payload is required.");
    }

    await loadContent();

    const record = normalizeContent({ ...payload, contentType }, contentType);
    record.id = ensureContentId(record);
    record.createdAt = new Date().toISOString();
    record.updatedAt = record.createdAt;

    try {
      const saved = await window.DataCoreSystem.put(STORE, record);
      if (window.TagCoreSystem?.syncTags && saved?.metadata?.tags) {
        window.TagCoreSystem.syncTags(saved.metadata.tags).catch((err) => logWarn("Failed to sync content tags.", err));
      }
      await loadContent();
      return saved;
    } catch (err) {
      logError("Failed to create content.", err);
      throw err;
    }
  }

  async function updateContent(contentType, id, patch) {
    if (typeof contentType !== "string" || !contentType.trim()) {
      throw new Error("Content type is required.");
    }
    if (!id) {
      throw new Error("Content id is required.");
    }
    if (!patch || typeof patch !== "object") {
      throw new Error("Content patch is required.");
    }

    await loadContent();
    const existing = contentList.find((item) => item.contentType === contentType && String(item.id) === String(id));
    if (!existing) {
      throw new Error("Content item not found.");
    }

    if (window.RevisionCoreSystem?.createRevision) {
      await window.RevisionCoreSystem.createRevision(contentType, existing.id, existing, patch.changeSummary || "Content updated")
        .catch((err) => logWarn("Failed to create content revision.", err));
    }

    const { changeSummary, ...contentPatch } = patch;
    const updatePatch = {
      ...contentPatch,
      contentType: existing.contentType,
      updatedAt: new Date().toISOString()
    };

    try {
      const saved = await window.DataCoreSystem.update(STORE, existing.id, updatePatch);
      if (window.TagCoreSystem?.syncTags && saved?.metadata?.tags) {
        window.TagCoreSystem.syncTags(saved.metadata.tags).catch((err) => logWarn("Failed to sync content tags.", err));
      }
      await loadContent();
      return saved;
    } catch (err) {
      logError("Failed to update content.", err);
      throw err;
    }
  }

  async function deleteContent(contentType, id) {
    if (typeof contentType !== "string" || !contentType.trim()) {
      throw new Error("Content type is required.");
    }
    if (!id) {
      throw new Error("Content id is required.");
    }

    await loadContent();
    const existing = contentList.find((item) => item.contentType === contentType && String(item.id) === String(id));
    if (!existing) {
      throw new Error("Content item not found.");
    }

    try {
      const success = await window.DataCoreSystem.remove(STORE, existing.id);
      await loadContent();
      return success;
    } catch (err) {
      logError("Failed to delete content.", err);
      throw err;
    }
  }

  async function clearContent(contentType) {
    await loadContent();
    if (!contentType) {
      await window.DataCoreSystem.clear(STORE);
      contentList = [];
      return true;
    }

    const remaining = contentList.filter((item) => item.contentType !== contentType);
    contentList = remaining;
    await persistContent();
    return true;
  }

  async function exportContent(contentType) {
    await loadContent();
    return listContent(contentType);
  }

  return {
    init,
    listContent,
    getContent,
    createContent,
    updateContent,
    deleteContent,
    clearContent,
    exportContent,
    getContentTypes,
    isReady: () => ready
  };

})();

window.ContentCoreSystem = ContentCoreSystem;
