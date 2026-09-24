const SearchCoreSystem = (() => {
  const STORE = "searchIndex";
  const TYPES = ["blogPost", "forumThread", "forumPost", "calendarEvent", "page"];
  const INDEX_TTL_MS = 5000;
  let cachedIndex = [];
  let lastBuiltAt = 0;
  let buildInFlight = null;

  function text(value) {
    return String(value == null ? "" : value).toLowerCase();
  }

  function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags.map((item) => String(item).trim()).filter(Boolean);
    return String(tags || "").split(",").map((item) => item.trim()).filter(Boolean);
  }

  function normalizeContentRecord(item) {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    return {
      id: item.id,
      contentType: item.contentType,
      title: item.title || "",
      body: item.body || "",
      status: item.status || "",
      authorId: item.authorId || "",
      category: metadata.category || "General",
      tags: normalizeTags(metadata.tags),
      featured: metadata.featured === true,
      publishedAt: metadata.publishedAt || item.createdAt || "",
      updatedAt: item.updatedAt || item.createdAt || "",
      link: linkFor(item.contentType)
    };
  }

  function linkFor(type) {
    if (type === "blogPost") return "#blog";
    if (type === "calendarEvent") return "#calendar";
    if (type === "forumThread" || type === "forumPost") return "#forums";
    return "#home";
  }

  function matches(item, criteria = {}) {
    if (criteria.contentType && item.contentType !== criteria.contentType) return false;
    if (criteria.status && item.status !== criteria.status) return false;
    if (criteria.category && criteria.category !== "All" && item.category !== criteria.category) return false;
    if (criteria.authorId && item.authorId !== criteria.authorId) return false;
    if (criteria.tag && !item.tags.includes(criteria.tag)) return false;
    const q = text(criteria.query);
    if (q) {
      const haystack = text([item.title, item.body, item.category, item.tags.join(" "), item.authorId].join(" "));
      if (!haystack.includes(q)) return false;
    }
    return true;
  }

  function score(item, criteria = {}) {
    let value = 0;
    const q = text(criteria.query);
    if (q && text(item.title).includes(q)) value += 5;
    if (item.featured) value += 3;
    value += Math.max(0, new Date(item.updatedAt || item.publishedAt || 0).getTime() / 10000000000000);
    return value;
  }

  async function buildIndex(options = {}) {
    const now = Date.now();
    if (!options.force && cachedIndex.length && now - lastBuiltAt < INDEX_TTL_MS) {
      return cachedIndex.slice();
    }

    if (buildInFlight) {
      return buildInFlight;
    }

    if (!window.ContentCoreSystem?.listContent) return [];

    buildInFlight = (async () => {
      const groups = await Promise.all(TYPES.map((type) => window.ContentCoreSystem.listContent(type, {}).catch(() => [])));
      const index = groups.flat().map(normalizeContentRecord);
      if (window.DataCoreSystem?.clear && window.DataCoreSystem?.put) {
        // Only rewrite the store when the index actually differs. A clear+put
        // cycle on every build bumps timestamps and dirties the store file on
        // every boot even when no content changed. Stored records carry extra
        // server-side keys (createdAt/updatedAt), so compare on the indexed
        // fields only.
        const existing = await window.DataCoreSystem.list(STORE).catch(() => null);
        const INDEX_FIELDS = [
          "contentType", "title", "body", "status", "authorId", "category",
          "tags", "featured", "publishedAt", "updatedAt", "link"
        ];
        const unchanged =
          Array.isArray(existing) &&
          existing.length === index.length &&
          index.every((item) => {
            const current = existing.find((entry) => entry?.id === item.id);
            if (!current) return false;
            return INDEX_FIELDS.every((field) =>
              JSON.stringify(current[field]) === JSON.stringify(item[field])
            );
          });
        if (!unchanged) {
          await window.DataCoreSystem.clear(STORE).catch(() => false);
          for (const item of index) {
            await window.DataCoreSystem.put(STORE, { id: `${item.contentType}-${item.id}`, ...item }).catch(() => null);
          }
        }
      }
      cachedIndex = index;
      lastBuiltAt = Date.now();
      return cachedIndex.slice();
    })();

    try {
      return await buildInFlight;
    } finally {
      buildInFlight = null;
    }
  }

  async function search(criteria = {}) {
    const index = await buildIndex();
    return index
      .filter((item) => matches(item, criteria))
      .sort((a, b) => score(b, criteria) - score(a, criteria));
  }

  async function trending(limit = 6) {
    const results = await search({});
    return results
      .filter((item) => item.status === "published" || item.status === "open")
      .sort((a, b) => {
        const featuredDelta = Number(b.featured) - Number(a.featured);
        if (featuredDelta !== 0) return featuredDelta;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      })
      .slice(0, Number(limit) || 6);
  }

  function renderResults(items) {
    if (!Array.isArray(items) || !items.length) return `<div class="search-empty">No matching content.</div>`;
    return `
      <div class="search-results">
        ${items.map((item) => `
          <a class="search-result" href="${item.link}">
            <strong>${Diagnostics.escapeText(item.title || "Untitled")}</strong>
            <span>${Diagnostics.escapeText(item.contentType)} · ${Diagnostics.escapeText(item.category || "General")}</span>
          </a>
        `).join("")}
      </div>
    `;
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ searchReady: true });
    }
  }

  return {
    init,
    buildIndex,
    search,
    trending,
    renderResults,
    getIndexHealth: () => ({
      cachedRecords: cachedIndex.length,
      lastBuiltAt: lastBuiltAt ? new Date(lastBuiltAt).toISOString() : null,
      ttlMs: INDEX_TTL_MS,
      buildInFlight: !!buildInFlight
    })
  };
})();

window.SearchCoreSystem = SearchCoreSystem;
