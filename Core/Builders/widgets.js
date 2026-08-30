const WidgetCoreSystem = (() => {
  const STORE = "settings";
  const RECORD_ID = "builder-widgets";
  const TYPES = ["latestPosts", "latestThreads", "upcomingEvents", "activityFeed", "featuredContent", "customHtml"];

  let widgets = [];
  let ready = false;

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function canAdmin() {
    return window.UserCoreSystem?.can?.("platform.admin.access") === true;
  }

  function normalizeType(type) {
    return TYPES.includes(type) ? type : "customHtml";
  }

  function normalizeWidget(record = {}) {
    const type = normalizeType(record.type);
    return {
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `widget-${Date.now()}`,
      title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : labelForType(type),
      type,
      enabled: record.enabled !== false,
      limit: Number.isFinite(Number(record.limit)) ? Math.max(1, Math.min(12, Number(record.limit))) : 4,
      content: typeof record.content === "string" ? record.content : "",
      createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
    };
  }

  function labelForType(type) {
    const labels = {
      latestPosts: "Latest Posts",
      latestThreads: "Latest Threads",
      upcomingEvents: "Upcoming Events",
      activityFeed: "Activity Feed",
      featuredContent: "Featured Content",
      customHtml: "Custom Block"
    };
    return labels[type] || "Widget";
  }

  function safeHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    const allowedTags = new Set(["A", "B", "BR", "EM", "I", "LI", "OL", "P", "STRONG", "UL"]);
    const allowedAttrs = new Set(["href", "title", "target", "rel"]);

    Array.from(template.content.querySelectorAll("*")).forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (!allowedAttrs.has(name) || (name === "href" && !/^https?:|^#|^\//.test(attr.value))) {
          node.removeAttribute(attr.name);
        }
      });
      if (node.tagName === "A") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    });

    return template.innerHTML;
  }

  async function loadWidgets() {
    if (!window.DataCoreSystem?.get) return [];
    try {
      const record = await window.DataCoreSystem.get(STORE, RECORD_ID);
      widgets = Array.isArray(record?.widgets) ? record.widgets.map(normalizeWidget) : [];
    } catch (error) {
      Diagnostics?.warn?.("[WidgetCoreSystem] failed to load widgets", error);
      widgets = [];
    }
    return getWidgets();
  }

  async function persistWidgets() {
    if (!canAdmin()) throw new Error("Admin access is required to manage widgets.");
    if (!window.DataCoreSystem?.put) throw new Error("DataCoreSystem is unavailable for widgets.");
    await window.DataCoreSystem.put(STORE, {
      id: RECORD_ID,
      widgets: widgets.map(normalizeWidget)
    });
    window.Runtime?.updateRuntimeState?.({ widgetReady: true, widgetCount: widgets.length });
  }

  async function saveWidget(payload) {
    if (!canAdmin()) throw new Error("Admin access is required to manage widgets.");
    const next = normalizeWidget({
      ...payload,
      updatedAt: new Date().toISOString()
    });
    const index = widgets.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      widgets[index] = { ...widgets[index], ...next, createdAt: widgets[index].createdAt };
    } else {
      widgets.push(next);
    }
    await persistWidgets();
    return next;
  }

  async function removeWidget(id) {
    if (!canAdmin()) throw new Error("Admin access is required to manage widgets.");
    widgets = widgets.filter((item) => item.id !== id);
    await persistWidgets();
    return true;
  }

  function getWidgets() {
    return widgets.map((item) => ({ ...item }));
  }

  async function listContent(type, criteria = {}, limit = 4) {
    const records = await window.ContentCoreSystem?.listContent?.(type, criteria).catch(() => []);
    return (Array.isArray(records) ? records : [])
      .filter((item) => item.status !== "trash")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, limit);
  }

  function renderItems(items, emptyLabel, link) {
    if (!Array.isArray(items) || !items.length) return `<div class="builder-empty">${escape(emptyLabel)}</div>`;
    return `
      <ul class="widget-list">
        ${items.map((item) => `<li><a href="${escape(link)}">${escape(item.title || item.message || item.name || "Untitled")}</a></li>`).join("")}
      </ul>
    `;
  }

  async function renderWidget(widgetOrId) {
    const widget = typeof widgetOrId === "string"
      ? widgets.find((item) => item.id === widgetOrId)
      : normalizeWidget(widgetOrId || {});
    if (!widget || widget.enabled === false) return "";

    let body = "";
    if (widget.type === "latestPosts") {
      body = renderItems(await listContent("blogPost", { status: "published" }, widget.limit), "No posts yet.", "#blog");
    } else if (widget.type === "latestThreads") {
      body = renderItems(await listContent("forumThread", {}, widget.limit), "No threads yet.", "#forums");
    } else if (widget.type === "upcomingEvents") {
      const events = await window.ContentCoreSystem?.listContent?.("calendarEvent", { status: "published" }).catch(() => []);
      body = renderItems((Array.isArray(events) ? events : [])
        .sort((a, b) => new Date(a.metadata?.eventDate || a.createdAt || 0).getTime() - new Date(b.metadata?.eventDate || b.createdAt || 0).getTime())
        .slice(0, widget.limit), "No upcoming events.", "#calendar");
    } else if (widget.type === "activityFeed") {
      const items = await window.ActivityFeedCoreSystem?.listRecent?.(widget.limit).catch(() => []);
      body = window.ActivityFeedCoreSystem?.renderActivityFeed?.(items) || `<div class="builder-empty">No activity yet.</div>`;
    } else if (widget.type === "featuredContent") {
      const items = await window.SearchCoreSystem?.trending?.(widget.limit).catch(() => []);
      body = window.SearchCoreSystem?.renderResults?.(items) || `<div class="builder-empty">No featured content.</div>`;
    } else {
      body = `<div class="widget-custom">${safeHtml(widget.content || "")}</div>`;
    }

    return `
      <article class="cms-card widget-block" data-widget-id="${escape(widget.id)}">
        <h3>${escape(widget.title)}</h3>
        ${body}
      </article>
    `;
  }

  async function renderWidgets(ids = []) {
    const selected = Array.isArray(ids) && ids.length
      ? ids.map((id) => widgets.find((item) => item.id === id)).filter(Boolean)
      : widgets.filter((item) => item.enabled !== false);
    const html = await Promise.all(selected.map(renderWidget));
    return html.join("");
  }

  async function init() {
    await loadWidgets();
    ready = true;
    window.Runtime?.updateRuntimeState?.({ widgetReady: true, widgetCount: widgets.length });
  }

  return {
    init,
    loadWidgets,
    getWidgets,
    saveWidget,
    removeWidget,
    renderWidget,
    renderWidgets,
    getTypes: () => [...TYPES],
    labelForType,
    isReady: () => ready
  };
})();

window.WidgetCoreSystem = WidgetCoreSystem;
