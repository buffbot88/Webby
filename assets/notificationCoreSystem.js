const NotificationCoreSystem = (() => {
  const STORE = "notifications";

  function clone(value) {
    if (value === null || typeof value !== "object") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function currentUserId() {
    const user = window.UserCoreSystem?.getCurrentUser?.();
    return user?.id || user?.username || "";
  }

  function canManage() {
    return window.UserCoreSystem?.can?.("platform.admin.access") === true;
  }

  function normalizeNotification(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      userId: typeof record.userId === "string" ? record.userId : "",
      type: typeof record.type === "string" && record.type ? record.type : "system",
      title: typeof record.title === "string" ? record.title : "Notification",
      message: typeof record.message === "string" ? record.message : "",
      link: typeof record.link === "string" ? record.link : "",
      read: record.read === true,
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? clone(record.metadata) : {}
    };
  }

  async function listAll() {
    if (!window.DataCoreSystem?.list) return [];
    const records = await window.DataCoreSystem.list(STORE);
    return Array.isArray(records) ? records.map(normalizeNotification) : [];
  }

  async function createNotification(payload) {
    if (!window.DataCoreSystem?.put) {
      throw new Error("DataCoreSystem is unavailable for notifications.");
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Notification payload is required.");
    }
    if (!payload.userId) {
      throw new Error("Notification userId is required.");
    }
    return window.DataCoreSystem.put(STORE, normalizeNotification(payload));
  }

  async function listNotifications(options = {}) {
    const requestedUserId = String(options.userId || currentUserId() || "");
    if (!requestedUserId) return [];

    const records = await listAll();
    return records
      .filter((item) => canManage() || item.userId === requestedUserId)
      .filter((item) => item.userId === requestedUserId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async function markRead(id) {
    if (!id || !window.DataCoreSystem?.update) return null;
    const notification = (await listAll()).find((item) => String(item.id) === String(id));
    if (!notification || (notification.userId !== currentUserId() && !canManage())) return null;
    return window.DataCoreSystem.update(STORE, notification.id, { read: true });
  }

  async function markAllRead() {
    const notifications = await listNotifications();
    const updated = [];
    for (const item of notifications.filter((entry) => !entry.read)) {
      updated.push(await window.DataCoreSystem.update(STORE, item.id, { read: true }));
    }
    return updated;
  }

  async function countUnread() {
    const notifications = await listNotifications();
    return notifications.filter((item) => !item.read).length;
  }

  async function deleteNotification(id) {
    if (!id || !window.DataCoreSystem?.remove) return false;
    const notification = (await listAll()).find((item) => String(item.id) === String(id));
    if (!notification || (notification.userId !== currentUserId() && !canManage())) return false;
    return window.DataCoreSystem.remove(STORE, notification.id);
  }

  async function notifyForumReply(thread, reply) {
    if (!thread?.authorId || thread.authorId === reply?.authorId) return null;
    return createNotification({
      userId: thread.authorId,
      type: "forum.reply",
      title: "New forum reply",
      message: `Someone replied to ${thread.title || "your thread"}.`,
      link: "#forums",
      read: false,
      metadata: { threadId: thread.id, postId: reply?.id || "" }
    });
  }

  async function notifyCurrentUser(type, title, message, metadata = {}) {
    const userId = currentUserId();
    if (!userId) return null;
    return createNotification({ userId, type, title, message, link: "#account", read: false, metadata });
  }

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function renderNotificationList(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="notification-item">No notifications yet.</div>`;
    }
    return items.map((item) => `
      <article class="notification-item ${item.read ? "" : "notification-unread"}">
        <div>
          <strong>${escape(item.title)}</strong>
          <p>${escape(item.message)}</p>
          <div class="muted">${escape(formatDate(item.createdAt))}</div>
        </div>
        <div class="notification-actions">
          ${item.link ? `<a href="${escape(item.link)}">Open</a>` : ""}
          ${item.read ? "" : `<button type="button" onclick="window.AccountModuleUI?.markNotificationRead?.('${escape(item.id)}')">Read</button>`}
          <button type="button" onclick="window.AccountModuleUI?.deleteNotification?.('${escape(item.id)}')">Delete</button>
        </div>
      </article>
    `).join("");
  }

  async function init() {
    Lifecycle?.on?.("user:profile:update", ({ user }) => {
      notifyCurrentUser("account.profile", "Profile updated", "Your profile changes were saved.", { userId: user?.id || "" })
        .catch((error) => Diagnostics?.warn?.("[NotificationCoreSystem] failed to create profile notification", error));
    });
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ notificationReady: true });
    }
  }

  return {
    init,
    createNotification,
    listNotifications,
    markRead,
    markAllRead,
    countUnread,
    deleteNotification,
    notifyForumReply,
    notifyCurrentUser,
    renderNotificationList
  };
})();

window.NotificationCoreSystem = NotificationCoreSystem;
