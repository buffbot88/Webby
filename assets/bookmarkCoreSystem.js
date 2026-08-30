const BookmarkCoreSystem = (() => {
  const STORE = "bookmarks";
  const TARGET_TYPES = new Set(["blogPost", "forumThread", "calendarEvent"]);

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function currentUserId() {
    const user = window.UserCoreSystem?.getCurrentUser?.();
    return user?.id || user?.username || "";
  }

  function isAuthenticated() {
    return window.UserCoreSystem?.isAuthenticated?.() === true;
  }

  function validateTarget(targetType, targetId) {
    if (!TARGET_TYPES.has(targetType)) throw new Error("Unsupported bookmark target.");
    if (targetId == null || String(targetId).trim() === "") throw new Error("Bookmark target id is required.");
  }

  function normalizeBookmark(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      userId: typeof record.userId === "string" ? record.userId : "",
      targetType: typeof record.targetType === "string" ? record.targetType : "",
      targetId: String(record.targetId || ""),
      title: typeof record.title === "string" ? record.title : "Bookmark",
      link: typeof record.link === "string" ? record.link : "",
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function listAll() {
    if (!window.DataCoreSystem?.list) return [];
    const records = await window.DataCoreSystem.list(STORE);
    return Array.isArray(records) ? records.map(normalizeBookmark) : [];
  }

  async function findBookmark(targetType, targetId) {
    validateTarget(targetType, targetId);
    const userId = currentUserId();
    if (!userId) return null;
    const records = await listAll();
    return records.find((item) =>
      item.userId === userId &&
      item.targetType === targetType &&
      String(item.targetId) === String(targetId)
    ) || null;
  }

  async function addBookmark(payload) {
    if (!isAuthenticated()) throw new Error("Authentication is required to bookmark.");
    validateTarget(payload?.targetType, payload?.targetId);

    const existing = await findBookmark(payload.targetType, payload.targetId);
    if (existing) return existing;

    return window.DataCoreSystem.put(STORE, normalizeBookmark({
      ...payload,
      userId: currentUserId()
    }));
  }

  async function removeBookmark(targetType, targetId) {
    if (!isAuthenticated()) throw new Error("Authentication is required to remove bookmarks.");
    const existing = await findBookmark(targetType, targetId);
    if (!existing) return false;
    return window.DataCoreSystem.remove(STORE, existing.id);
  }

  async function toggleBookmark(payload) {
    const existing = await findBookmark(payload?.targetType, payload?.targetId);
    if (existing) {
      await removeBookmark(payload.targetType, payload.targetId);
      return { active: false };
    }
    const bookmark = await addBookmark(payload);
    return { active: true, bookmark };
  }

  async function listCurrentUserBookmarks() {
    const userId = currentUserId();
    if (!userId) return [];
    const records = await listAll();
    return records
      .filter((item) => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async function isBookmarked(targetType, targetId) {
    return !!(await findBookmark(targetType, targetId));
  }

  function renderBookmarkButton(targetType, targetId, title, link = "") {
    validateTarget(targetType, targetId);
    const disabled = isAuthenticated() ? "" : "disabled";
    return `
      <button class="bookmark-button" type="button" ${disabled}
        data-target-type="${escape(targetType)}"
        data-target-id="${escape(targetId)}"
        data-title="${escape(title || "Bookmark")}"
        data-link="${escape(link)}"
        onclick="window.BookmarkCoreSystem.toggleBookmarkFromUI(this)">
        Bookmark
      </button>
    `;
  }

  async function hydrateBookmarkButtons(root = document) {
    const buttons = Array.from(root.querySelectorAll(".bookmark-button[data-target-type][data-target-id]"));
    await Promise.all(buttons.map(async (button) => {
      const active = await isBookmarked(button.dataset.targetType, button.dataset.targetId);
      button.classList.toggle("active", active);
      button.textContent = active ? "Bookmarked" : "Bookmark";
      button.disabled = !isAuthenticated();
      button.title = isAuthenticated() ? "Toggle bookmark" : "Sign in to bookmark";
    }).map((task) => task.catch((error) => {
      Diagnostics?.warn?.("[BookmarkCoreSystem] failed to hydrate bookmark button", error);
    })));
  }

  async function toggleBookmarkFromUI(button) {
    if (!button) return;
    try {
      await toggleBookmark({
        targetType: button.dataset.targetType,
        targetId: button.dataset.targetId,
        title: button.dataset.title || "Bookmark",
        link: button.dataset.link || "",
        metadata: {}
      });
      await hydrateBookmarkButtons();
      window.AccountModuleUI?.refreshSocial?.();
    } catch (error) {
      window.alert(error?.message || "Unable to update bookmark.");
    }
  }

  function renderBookmarkList(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="activity-item">No bookmarks yet.</div>`;
    }
    return items.map((item) => `
      <article class="activity-item">
        <div>
          <strong>${escape(item.title)}</strong>
          <div class="muted">${escape(item.targetType)}</div>
        </div>
        ${item.link ? `<a href="${escape(item.link)}">Open</a>` : ""}
      </article>
    `).join("");
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ bookmarkReady: true });
    }
  }

  return {
    init,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    listCurrentUserBookmarks,
    isBookmarked,
    renderBookmarkButton,
    renderBookmarkList,
    hydrateBookmarkButtons,
    toggleBookmarkFromUI,
    getTargetTypes: () => Array.from(TARGET_TYPES)
  };
})();

window.BookmarkCoreSystem = BookmarkCoreSystem;
