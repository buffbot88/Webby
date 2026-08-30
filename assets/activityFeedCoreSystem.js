const ActivityFeedCoreSystem = (() => {
  const STORE = "activityFeed";
  const RECENT_LIMIT = 8;
  const ACTION_TYPES = new Set([
    "user.registered",
    "blog.post.published",
    "forum.thread.created",
    "forum.reply.created",
    "calendar.event.published",
    "reaction.added"
  ]);

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

  function now() {
    return new Date().toISOString();
  }

  function getActorName(actorId, fallback = "Community member") {
    const profile = window.UserCoreSystem?.getProfile?.(actorId);
    return profile?.displayName || profile?.username || fallback;
  }

  function currentActor() {
    const user = window.UserCoreSystem?.getCurrentUser?.();
    return {
      actorId: user?.id || user?.username || "",
      actorName: user?.displayName || user?.username || "Community member"
    };
  }

  function normalizeActivity(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : now();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      actorId: typeof record.actorId === "string" ? record.actorId : "",
      actorName: typeof record.actorName === "string" && record.actorName ? record.actorName : getActorName(record.actorId),
      type: typeof record.type === "string" && record.type ? record.type : "activity",
      title: typeof record.title === "string" ? record.title : "",
      message: typeof record.message === "string" ? record.message : "",
      link: typeof record.link === "string" ? record.link : "",
      public: record.public !== false,
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? clone(record.metadata) : {}
    };
  }

  function sortRecent(items) {
    return [...items].sort((a, b) =>
      new Date(b.createdAt || b.updatedAt || 0).getTime() -
      new Date(a.createdAt || a.updatedAt || 0).getTime()
    );
  }

  async function listAll() {
    if (!window.DataCoreSystem?.list) return [];
    const records = await window.DataCoreSystem.list(STORE);
    return Array.isArray(records) ? records.map(normalizeActivity) : [];
  }

  async function createActivity(payload) {
    if (!window.DataCoreSystem?.put) {
      throw new Error("DataCoreSystem is unavailable for activity feed.");
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Activity payload is required.");
    }

    const actor = currentActor();
    const record = normalizeActivity({
      ...payload,
      actorId: payload.actorId || actor.actorId,
      actorName: payload.actorName || actor.actorName,
      public: payload.public !== false
    });

    return window.DataCoreSystem.put(STORE, record);
  }

  async function listGlobalPublic(limit = RECENT_LIMIT) {
    const records = await listAll();
    return sortRecent(records.filter((item) => item.public !== false)).slice(0, Number(limit) || RECENT_LIMIT);
  }

  async function listByUser(userId, limit = RECENT_LIMIT) {
    const id = String(userId || "").trim();
    if (!id) return [];
    const records = await listAll();
    return sortRecent(records.filter((item) => String(item.actorId) === id)).slice(0, Number(limit) || RECENT_LIMIT);
  }

  async function listRecent(limit = RECENT_LIMIT) {
    return listGlobalPublic(limit);
  }

  async function recordUserRegistered(user) {
    if (!user) return null;
    return createActivity({
      actorId: user.id || user.username || "",
      actorName: user.displayName || user.username || "New member",
      type: "user.registered",
      title: "New member joined",
      message: `${user.displayName || user.username || "A member"} joined the community.`,
      link: "#account",
      public: true,
      metadata: { userId: user.id || user.username || "" }
    });
  }

  async function recordBlogPostPublished(post) {
    return createActivity({
      actorId: post.authorId || "",
      actorName: getActorName(post.authorId),
      type: "blog.post.published",
      title: "Blog post published",
      message: post.title || "A new blog post was published.",
      link: "#blog",
      public: true,
      metadata: { targetType: "blogPost", targetId: post.id }
    });
  }

  async function recordForumThreadCreated(thread) {
    return createActivity({
      actorId: thread.authorId || "",
      actorName: getActorName(thread.authorId),
      type: "forum.thread.created",
      title: "Forum thread created",
      message: thread.title || "A new forum thread was created.",
      link: "#forums",
      public: true,
      metadata: { targetType: "forumThread", targetId: thread.id }
    });
  }

  async function recordForumReplyCreated(reply, thread) {
    return createActivity({
      actorId: reply.authorId || "",
      actorName: getActorName(reply.authorId),
      type: "forum.reply.created",
      title: "Forum reply posted",
      message: thread?.title ? `Reply in ${thread.title}` : "A new forum reply was posted.",
      link: "#forums",
      public: true,
      metadata: { targetType: "forumPost", targetId: reply.id, threadId: thread?.id || reply.metadata?.threadId || "" }
    });
  }

  async function recordCalendarEventPublished(event) {
    return createActivity({
      actorId: event.authorId || "",
      actorName: getActorName(event.authorId),
      type: "calendar.event.published",
      title: "Calendar event published",
      message: event.title || "A new calendar event was published.",
      link: "#calendar",
      public: true,
      metadata: { targetType: "calendarEvent", targetId: event.id }
    });
  }

  async function recordReactionAdded(reaction) {
    return createActivity({
      actorId: reaction.userId || "",
      actorName: getActorName(reaction.userId),
      type: "reaction.added",
      title: "Reaction added",
      message: `${getActorName(reaction.userId)} reacted ${reaction.reactionType}.`,
      link: targetLink(reaction.targetType),
      public: true,
      metadata: {
        targetType: reaction.targetType,
        targetId: reaction.targetId,
        reactionType: reaction.reactionType
      }
    });
  }

  function targetLink(targetType) {
    if (targetType === "blogPost") return "#blog";
    if (targetType === "calendarEvent") return "#calendar";
    return "#forums";
  }

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function renderActivityList(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="activity-item">No public activity yet.</div>`;
    }
    return items.map((item) => `
      <article class="activity-item">
        <div>
          <strong>${escape(item.title || "Activity")}</strong>
          <p>${escape(item.message || "")}</p>
          <div class="muted">${escape(item.actorName || "Community")} · ${escape(formatDate(item.createdAt))}</div>
        </div>
        ${item.link ? `<a href="${escape(item.link)}">Open</a>` : ""}
      </article>
    `).join("");
  }

  function renderActivityFeed(items) {
    return `<div class="activity-feed">${renderActivityList(items)}</div>`;
  }

  function updateRuntimeState() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ activityFeedReady: true });
    }
  }

  async function init() {
    Lifecycle?.on?.("user:register", ({ user }) => {
      recordUserRegistered(user).catch((error) => {
        Diagnostics?.warn?.("[ActivityFeedCoreSystem] failed to record registration activity", error);
      });
    });
    updateRuntimeState();
  }

  return {
    init,
    createActivity,
    listGlobalPublic,
    listByUser,
    listRecent,
    recordUserRegistered,
    recordBlogPostPublished,
    recordForumThreadCreated,
    recordForumReplyCreated,
    recordCalendarEventPublished,
    recordReactionAdded,
    renderActivityFeed,
    getSupportedTypes: () => Array.from(ACTION_TYPES)
  };
})();

window.ActivityFeedCoreSystem = ActivityFeedCoreSystem;
