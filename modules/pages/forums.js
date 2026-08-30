(() => {
  const state = {
    threads: [],
    posts: [],
    filters: {
      query: "",
      category: "All"
    },
    view: "browse",
    selectedThreadId: "",
    loaded: false,
    loading: false,
    message: "",
    messageTone: "info"
  };

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function safeId(value) {
    return String(value || "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  function jsArg(value) {
    return escape(JSON.stringify(String(value == null ? "" : value)));
  }

  function formatDate(iso) {
    if (!iso) return "Unknown";
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
  }

  function setMessage(message, tone = "info") {
    state.message = message || "";
    state.messageTone = tone;
  }

  function renderStatusMessage() {
    if (!state.message) return "";
    return `<div class="forum-alert" data-tone="${escape(state.messageTone)}">${escape(state.message)}</div>`;
  }

  function getCurrentUserId() {
    return window.UserCoreSystem?.getCurrentUser?.()?.id || "";
  }

  function can(capability) {
    return !!window.UserCoreSystem?.can?.(capability);
  }

  function getAuthorName(authorId) {
    if (!authorId) return "Unknown author";
    const profile = window.UserCoreSystem?.getProfile?.(authorId);
    return profile?.displayName || profile?.username || authorId;
  }

  function renderAuthor(authorId) {
    return `
      <span>${escape(getAuthorName(authorId))}</span>
      <span class="user-reputation" data-user-id="${escape(authorId || "")}"></span>
    `;
  }

  function normalizeThread(thread) {
    const metadata = thread.metadata && typeof thread.metadata === "object" ? thread.metadata : {};
    return {
      ...thread,
      status: ["open", "closed", "trash"].includes(thread.status) ? thread.status : "open",
      metadata: {
        pinned: metadata.pinned === true,
        category: typeof metadata.category === "string" ? metadata.category : "General",
        lastReplyAt: typeof metadata.lastReplyAt === "string" ? metadata.lastReplyAt : "",
        replyCount: Number.isFinite(Number(metadata.replyCount)) ? Number(metadata.replyCount) : 0,
        attachments: Array.isArray(metadata.attachments) ? metadata.attachments : []
      }
    };
  }

  function normalizePost(post) {
    const metadata = post.metadata && typeof post.metadata === "object" ? post.metadata : {};
    return {
      ...post,
      status: post.status === "trash" ? "trash" : "visible",
      metadata: {
        ...metadata,
        threadId: metadata.threadId || "",
        attachments: Array.isArray(metadata.attachments) ? metadata.attachments : []
      }
    };
  }

  function getVisibleThreads() {
    const query = state.filters.query.trim().toLowerCase();
    return state.threads
      .filter((thread) => thread.status !== "trash")
      .filter((thread) => state.filters.category === "All" || thread.metadata?.category === state.filters.category)
      .filter((thread) => !query || [thread.title, thread.body, thread.metadata?.category].join(" ").toLowerCase().includes(query))
      .sort((a, b) => {
        const pinnedDelta = Number(b.metadata?.pinned === true) - Number(a.metadata?.pinned === true);
        if (pinnedDelta !== 0) return pinnedDelta;
        const aDate = new Date(a.metadata?.lastReplyAt || a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.metadata?.lastReplyAt || b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });
  }

  function getVisibleReplies(threadId) {
    return state.posts
      .filter((post) => post.metadata?.threadId === threadId && post.status !== "trash")
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }

  function getAllReplies(threadId) {
    return state.posts.filter((post) => post.metadata?.threadId === threadId && post.status !== "trash");
  }

  async function updateThreadReplyMetadata(threadId) {
    const contentSystem = window.ContentCoreSystem;
    const thread = state.threads.find((item) => String(item.id) === String(threadId));
    if (!contentSystem || !thread) return;

    const replies = getAllReplies(threadId);
    const replyDates = replies
      .map((reply) => reply.createdAt || reply.updatedAt)
      .filter(Boolean)
      .sort();
    const lastReplyAt = replyDates.length ? replyDates[replyDates.length - 1] : "";

    await contentSystem.updateContent("forumThread", threadId, {
      metadata: {
        ...(thread.metadata || {}),
        replyCount: replies.length,
        lastReplyAt
      }
    });
  }

  function renderGuestPrompt() {
    return `
      <div class="forum-empty">
        Sign in or create an account to join the conversation.
      </div>
    `;
  }

  function renderCreateThreadPanel() {
    if (!can("forum.thread.create")) {
      return renderGuestPrompt();
    }

    return `
      <article class="auth-card">
        <h2>Start a Thread</h2>
        <form id="forumThreadForm" onsubmit="window.ForumModuleUI.createThread(event)">
          <div class="form-row">
            <label for="forumThreadTitle">Title</label>
            <input id="forumThreadTitle" type="text" placeholder="Thread subject" required />
          </div>
          <div class="form-row">
            <label for="forumThreadCategory">Category</label>
            <input id="forumThreadCategory" type="text" placeholder="General" />
          </div>
          <div class="form-row">
            <label for="forumThreadBody">Message</label>
            <textarea id="forumThreadBody" rows="5" placeholder="Start the discussion" required></textarea>
          </div>
          <div class="form-row media-upload">
            <label for="forumThreadAttachment">Image attachment</label>
            <input id="forumThreadAttachment" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </div>
          <button class="primary" type="submit">Publish Thread</button>
        </form>
      </article>
    `;
  }

  function renderBadges(thread) {
    const badges = [];
    if (thread.metadata?.pinned) {
      badges.push(`<span class="forum-badge forum-badge-pinned">Pinned</span>`);
    }
    if (thread.status === "closed") {
      badges.push(`<span class="forum-badge forum-badge-closed">Closed</span>`);
    }
    if (thread.metadata?.category) {
      badges.push(`<span class="forum-badge">${escape(thread.metadata.category)}</span>`);
    }
    return badges.join("");
  }

  function renderThreadActionBar(thread) {
    const pinned = thread.metadata?.pinned === true;
    const closed = thread.status === "closed";
    const actions = [];

    if (can("forum.thread.edit")) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.editThread(${jsArg(thread.id)})">Edit Thread</button>`);
      actions.push(`<button type="button" onclick="window.ForumModuleUI.uploadThreadAttachment(${jsArg(thread.id)})">Attach Image</button>`);
    }
    if (can("forum.thread.close")) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.toggleThreadStatus(${jsArg(thread.id)}, ${jsArg(closed ? "open" : "closed")})">${closed ? "Open Thread" : "Close Thread"}</button>`);
    }
    if (pinned && can("forum.thread.unpin")) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.toggleThreadPin(${jsArg(thread.id)}, false)">Unpin</button>`);
    }
    if (!pinned && can("forum.thread.pin")) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.toggleThreadPin(${jsArg(thread.id)}, true)">Pin</button>`);
    }
    if (can("forum.thread.moveTrash")) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.moveThreadTrash(${jsArg(thread.id)})">Move to Trash</button>`);
    }
    if (window.ModerationCoreSystem?.renderReportButton) {
      actions.push(window.ModerationCoreSystem.renderReportButton("forumThread", thread.id));
    }

    return actions.length ? `<div class="forum-action-bar">${actions.join("")}</div>` : "";
  }

  function renderPostActionBar(post) {
    const currentUserId = getCurrentUserId();
    const canEditAny = can("forum.post.edit");
    const canEditOwn = can("forum.post.editOwn") && currentUserId && post.authorId === currentUserId;
    const actions = [];

    if (canEditAny || canEditOwn) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.editPost(${jsArg(post.id)})">Edit Reply</button>`);
      actions.push(`<button type="button" onclick="window.ForumModuleUI.uploadPostAttachment(${jsArg(post.id)})">Attach Image</button>`);
    }
    if (can("forum.post.moveTrash")) {
      actions.push(`<button type="button" onclick="window.ForumModuleUI.movePostTrash(${jsArg(post.id)})">Move to Trash</button>`);
    }
    if (window.ModerationCoreSystem?.renderReportButton) {
      actions.push(window.ModerationCoreSystem.renderReportButton("forumPost", post.id));
    }

    return actions.length ? `<div class="forum-action-bar">${actions.join("")}</div>` : "";
  }

  function renderThreadSocialBar(thread) {
    const reactions = window.ReactionCoreSystem?.renderReactionBar
      ? window.ReactionCoreSystem.renderReactionBar("forumThread", thread.id)
      : "";
    const bookmark = window.BookmarkCoreSystem?.renderBookmarkButton
      ? window.BookmarkCoreSystem.renderBookmarkButton("forumThread", thread.id, thread.title || "Forum thread", "#forums")
      : "";
    return reactions || bookmark ? `<div class="forum-action-bar">${reactions}${bookmark}</div>` : "";
  }

  function renderPostSocialBar(post) {
    const reactions = window.ReactionCoreSystem?.renderReactionBar
      ? window.ReactionCoreSystem.renderReactionBar("forumPost", post.id)
      : "";
    return reactions ? `<div class="forum-action-bar">${reactions}</div>` : "";
  }

  function renderReplies(thread) {
    const replies = getVisibleReplies(thread.id);

    if (!replies.length) {
      return `<div class="forum-empty">No replies yet.</div>`;
    }

    return `
      <div class="forum-replies">
        ${replies.map((reply) => `
          <article class="forum-reply-card">
            <div class="forum-thread-meta">
              ${renderAuthor(reply.authorId)}
              <span>${escape(formatDate(reply.createdAt))}</span>
            </div>
            <div class="forum-body">${escape(reply.body || "")}</div>
            ${window.MediaCoreSystem?.renderAttachmentList?.(reply.metadata?.attachments || []) || ""}
            ${renderPostSocialBar(reply)}
            ${renderPostActionBar(reply)}
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderReplyForm(thread) {
    const closed = thread.status === "closed";
    const fieldId = `forumReplyBody-${safeId(thread.id)}`;

    if (closed) {
      return `<div class="forum-empty">This thread is closed for replies.</div>`;
    }

    if (!can("forum.post.create")) {
      return renderGuestPrompt();
    }

    return `
      <form class="forum-reply-form" onsubmit="window.ForumModuleUI.createReply(event, ${jsArg(thread.id)})">
        <div class="form-row">
          <label for="${escape(fieldId)}">Reply</label>
          <textarea id="${escape(fieldId)}" rows="4" placeholder="Write your reply" required></textarea>
        </div>
        <div class="form-row media-upload">
          <label for="${escape(fieldId)}-attachment">Image attachment</label>
          <input id="${escape(fieldId)}-attachment" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        </div>
        <button class="primary" type="submit">Post Reply</button>
      </form>
    `;
  }

  function renderThread(thread) {
    const replies = getVisibleReplies(thread.id);
    const lastActivity = thread.metadata?.lastReplyAt || thread.updatedAt || thread.createdAt;

    return `
      <article class="forum-thread-card forum-detail-card">
        <button type="button" class="button-secondary forum-back-button" onclick="window.ForumModuleUI.setView('browse')">Back to threads</button>
        <header>
          <div class="forum-thread-topline">
            <div>
              <h2>${escape(thread.title || "Untitled thread")}</h2>
              <div class="forum-thread-meta">
                ${renderAuthor(thread.authorId)}
                <span>${escape(formatDate(thread.createdAt))}</span>
                <span>${escape(replies.length)} replies</span>
                <span>Last activity ${escape(formatDate(lastActivity))}</span>
              </div>
            </div>
            <div class="forum-badge-row">${renderBadges(thread)}</div>
          </div>
        </header>

        <div class="forum-body">${escape(thread.body || "No description.")}</div>
        <div class="forum-thread-ledger">
          <span>Thread ID ${escape(thread.id)}</span>
          <span>${escape(thread.metadata?.category || "General")}</span>
          <span>${thread.metadata?.pinned ? "Pinned" : "Standard"}</span>
          <span>${thread.metadata?.locked ? "Locked" : "Open"}</span>
        </div>
        ${window.MediaCoreSystem?.renderAttachmentList?.(thread.metadata?.attachments || []) || ""}

        ${renderThreadSocialBar(thread)}
        ${renderThreadActionBar(thread)}

        <section>
          <h3>Replies</h3>
          ${renderReplies(thread)}
          ${renderReplyForm(thread)}
        </section>
      </article>
    `;
  }

  function renderThreadList() {
    if (state.loading && !state.loaded) {
      return `<div class="forum-empty">Loading forum conversations...</div>`;
    }

    const threads = getVisibleThreads();
    if (!threads.length) {
      return `
        <div class="forum-empty module-empty-state">
          <strong>No public threads yet.</strong>
          <p>Forum discussions will appear here with categories, reply counts, and last activity.</p>
        </div>
      `;
    }

    return `<div class="forum-thread-list forum-index-list">${threads.map(renderThreadPreview).join("")}</div>`;
  }

  function renderThreadPreview(thread) {
    const replies = getVisibleReplies(thread.id);
    const lastActivity = thread.metadata?.lastReplyAt || thread.updatedAt || thread.createdAt;
    const excerpt = String(thread.body || "No description.").replace(/\s+/g, " ").trim();
    return `
      <article class="forum-thread-card forum-index-card">
        <div class="forum-index-main">
          <div class="forum-thread-topline">
            <div>
              <div class="section-eyebrow">${escape(thread.metadata?.category || "General")}</div>
              <h2>
                <button type="button" class="link-button" onclick="window.ForumModuleUI.openThread(${jsArg(thread.id)})">
                  ${escape(thread.title || "Untitled thread")}
                </button>
              </h2>
              <div class="forum-thread-meta">
                ${renderAuthor(thread.authorId)}
                <span>Started ${escape(formatDate(thread.createdAt))}</span>
                <span>Last activity ${escape(formatDate(lastActivity))}</span>
              </div>
            </div>
            <div class="forum-badge-row">${renderBadges(thread)}</div>
          </div>
          <p class="forum-index-excerpt">${escape(excerpt.length > 180 ? `${excerpt.slice(0, 177)}...` : excerpt)}</p>
          ${renderThreadSocialBar(thread)}
        </div>
        <aside class="forum-index-stats" aria-label="Thread activity">
          <strong>${escape(String(replies.length))}</strong>
          <span>Replies</span>
          <strong>${thread.metadata?.pinned ? "Pinned" : thread.status === "closed" ? "Closed" : "Open"}</strong>
          <span>Status</span>
        </aside>
        ${renderThreadActionBar(thread)}
      </article>
    `;
  }

  function setView(view) {
    if (!["browse", "thread", "start", "moderation"].includes(view)) return;
    if (view === "moderation" && !can("moderation.report.review")) return;
    if (view !== "thread") state.selectedThreadId = "";
    state.view = view;
    updateForumPage();
  }

  function openThread(threadId) {
    state.selectedThreadId = String(threadId || "");
    state.view = "thread";
    updateForumPage();
  }

  function renderViewNav() {
    const items = [
      ["browse", "Threads"],
      ["start", "Start Thread"]
    ];
    if (can("moderation.report.review")) {
      items.push(["moderation", "Moderation"]);
    }

    return `
      <nav class="module-subnav" aria-label="Forum views">
        ${items.map(([view, label]) => `
          <button type="button" class="${state.view === view ? "active" : ""}" onclick="window.ForumModuleUI.setView('${escape(view)}')">
            ${escape(label)}
          </button>
        `).join("")}
      </nav>
    `;
  }

  function renderActiveView() {
    if (state.view === "thread") {
      const thread = findThread(state.selectedThreadId);
      return thread
        ? `<div id="forumThreadContainer">${renderThread(thread)}</div>`
        : `<div class="forum-empty module-empty-state"><strong>Thread not found.</strong><p>The selected discussion is unavailable.</p></div>`;
    }

    if (state.view === "start") {
      return `<div id="forumCreateThreadPanel">${renderCreateThreadPanel()}</div>`;
    }

    if (state.view === "moderation") {
      return renderModerationPanel();
    }

    return `
      <div id="forumThreadContainer">
        ${renderFilters()}
        ${renderThreadList()}
      </div>
    `;
  }

  function renderFilters() {
    const categories = Array.from(new Set(state.threads.map((thread) => thread.metadata?.category || "General"))).sort();
    return `
      <div class="search-tools">
        <input id="forumSearchQuery" type="search" placeholder="Search threads" value="${escape(state.filters.query)}" oninput="window.ForumModuleUI.updateFilters()" />
        <select id="forumCategoryFilter" onchange="window.ForumModuleUI.updateFilters()">
          <option value="All">All categories</option>
          ${categories.map((category) => `<option value="${escape(category)}" ${state.filters.category === category ? "selected" : ""}>${escape(category)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function renderModerationPanel() {
    if (!can("moderation.report.review")) return "";
    return `
      <article class="auth-card">
        <h2>Moderation Reports</h2>
        <div id="forumModerationReports" class="moderation-panel">
          <div class="moderation-report">Loading reports...</div>
        </div>
      </article>
    `;
  }

  async function refreshForum() {
    const contentSystem = window.ContentCoreSystem;
    const userSystem = window.UserCoreSystem;

    if (!contentSystem || !userSystem) {
      state.loaded = true;
      state.loading = false;
      setMessage("The forum system is unavailable.", "error");
      updateForumPage();
      return;
    }

    state.loading = true;

    try {
      const [threads, posts] = await Promise.all([
        contentSystem.listContent("forumThread", {}),
        contentSystem.listContent("forumPost", {})
      ]);

      state.threads = Array.isArray(threads) ? threads.map(normalizeThread) : [];
      state.posts = Array.isArray(posts) ? posts.map(normalizePost) : [];
      state.loaded = true;
      state.loading = false;
    } catch (error) {
      state.loaded = true;
      state.loading = false;
      setMessage("Unable to load forum data.", "error");
    }

    updateForumPage();
  }

  function updateForumPage() {
    if (state.view === "moderation" && !can("moderation.report.review")) {
      state.view = "browse";
    }

    const navContainer = document.getElementById("forumViewNav");
    if (navContainer) {
      navContainer.innerHTML = renderViewNav();
    }

    const contentContainer = document.getElementById("forumContentContainer");
    if (contentContainer) {
      contentContainer.innerHTML = renderActiveView();
    }

    const statusEl = document.getElementById("forumStatusMessage");
    if (statusEl) {
      statusEl.innerHTML = renderStatusMessage();
    }

    window.ReactionCoreSystem?.hydrateReactionBars?.();
    window.BookmarkCoreSystem?.hydrateBookmarkButtons?.();
    hydrateReputationBadges();
    refreshModerationReports();
  }

  async function hydrateReputationBadges() {
    const nodes = Array.from(document.querySelectorAll(".user-reputation[data-user-id]"));
    await Promise.all(nodes.map(async (node) => {
      const userId = node.dataset.userId;
      if (!userId || !window.ReputationCoreSystem?.renderUserReputation) return;
      node.innerHTML = await window.ReputationCoreSystem.renderUserReputation(userId);
    }));
  }

  async function refreshModerationReports() {
    const container = document.getElementById("forumModerationReports");
    if (!container || !window.ModerationCoreSystem?.listReports) return;
    try {
      const reports = await window.ModerationCoreSystem.listReports();
      container.innerHTML = window.ModerationCoreSystem.renderReports(reports);
    } catch (error) {
      container.innerHTML = `<div class="moderation-report">Moderation reports are unavailable.</div>`;
    }
  }

  async function reloadWithMessage(message, tone = "info") {
    setMessage(message, tone);
    await refreshForum();
    setMessage(message, tone);
    updateForumPage();
  }

  function findThread(threadId) {
    return state.threads.find((item) => String(item.id) === String(threadId)) || null;
  }

  function findPost(postId) {
    return state.posts.find((item) => String(item.id) === String(postId)) || null;
  }

  window.ForumModuleUI = {
    refresh: refreshForum,
    setView,
    openThread,

    async createThread(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();

      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      if (!contentSystem || !userSystem?.can("forum.thread.create")) {
        setMessage("You do not have permission to create a thread.", "error");
        updateForumPage();
        return false;
      }

      const title = document.getElementById("forumThreadTitle")?.value?.trim() || "";
      const body = document.getElementById("forumThreadBody")?.value?.trim() || "";
      const category = document.getElementById("forumThreadCategory")?.value?.trim() || "General";

      if (!title || !body) {
        setMessage("Thread title and message are required.", "error");
        updateForumPage();
        return false;
      }

      const currentUser = userSystem.getCurrentUser?.();

      try {
        let saved = await contentSystem.createContent("forumThread", {
          title,
          body,
          status: "open",
          authorId: currentUser?.id || currentUser?.username || "",
          metadata: {
            pinned: false,
            category,
            lastReplyAt: "",
            replyCount: 0
          }
        });
        const attachmentInput = document.getElementById("forumThreadAttachment");
        if (attachmentInput?.files?.[0] && window.MediaCoreSystem?.uploadFromInput) {
          const media = await window.MediaCoreSystem.uploadFromInput(attachmentInput, {
            targetType: "forumThread",
            targetId: saved.id,
            metadata: { purpose: "attachment" }
          });
          saved = await contentSystem.updateContent("forumThread", saved.id, {
            metadata: {
              ...(saved.metadata || {}),
              attachments: [...(saved.metadata?.attachments || []), media]
            }
          });
        }
        window.ActivityFeedCoreSystem?.recordForumThreadCreated?.(saved).catch((error) => {
          Diagnostics?.warn?.("[ForumModule] failed to record thread activity", error);
        });
        window.CategoryCoreSystem?.ensureCategory?.(category, "forumThread").catch(() => null);
        window.ReputationCoreSystem?.recordThreadCreated?.(saved.authorId).catch((error) => {
          Diagnostics?.warn?.("[ForumModule] failed to record thread reputation", error);
        });
        document.getElementById("forumThreadForm")?.reset();
        state.view = "browse";
        await reloadWithMessage("Thread created successfully.");
      } catch (error) {
        setMessage("Unable to create thread.", "error");
        updateForumPage();
      }

      return false;
    },

    async createReply(event, threadId) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();

      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      const thread = findThread(threadId);

      if (!contentSystem || !userSystem?.can("forum.post.create")) {
        setMessage("You do not have permission to reply.", "error");
        updateForumPage();
        return false;
      }

      if (!thread || thread.status === "trash") {
        setMessage("Thread not found.", "error");
        updateForumPage();
        return false;
      }

      if (thread.status === "closed") {
        setMessage("This thread is closed for replies.", "error");
        updateForumPage();
        return false;
      }

      const field = document.getElementById(`forumReplyBody-${safeId(threadId)}`);
      const body = field?.value?.trim() || "";
      if (!body) {
        setMessage("Reply content is required.", "error");
        updateForumPage();
        return false;
      }

      const currentUser = userSystem.getCurrentUser?.();
      try {
        let saved = await contentSystem.createContent("forumPost", {
          title: `Reply to ${thread.title || threadId}`,
          body,
          status: "visible",
          authorId: currentUser?.id || currentUser?.username || "",
          metadata: {
            threadId
          }
        });
        const attachmentInput = document.getElementById(`forumReplyBody-${safeId(threadId)}-attachment`);
        if (attachmentInput?.files?.[0] && window.MediaCoreSystem?.uploadFromInput) {
          const media = await window.MediaCoreSystem.uploadFromInput(attachmentInput, {
            targetType: "forumPost",
            targetId: saved.id,
            metadata: { purpose: "attachment" }
          });
          saved = await contentSystem.updateContent("forumPost", saved.id, {
            metadata: {
              ...(saved.metadata || {}),
              attachments: [...(saved.metadata?.attachments || []), media]
            }
          });
        }
        window.ActivityFeedCoreSystem?.recordForumReplyCreated?.(saved, thread).catch((error) => {
          Diagnostics?.warn?.("[ForumModule] failed to record reply activity", error);
        });
        window.NotificationCoreSystem?.notifyForumReply?.(thread, saved).catch((error) => {
          Diagnostics?.warn?.("[ForumModule] failed to create reply notification", error);
        });
        await refreshForum();
        await updateThreadReplyMetadata(threadId);
        if (field) field.value = "";
        await reloadWithMessage("Reply posted successfully.");
      } catch (error) {
        setMessage("Unable to post reply.", "error");
        updateForumPage();
      }

      return false;
    },

    async editThread(threadId) {
      const contentSystem = window.ContentCoreSystem;
      const thread = findThread(threadId);

      if (!contentSystem || !can("forum.thread.edit")) {
        setMessage("You do not have permission to edit this thread.", "error");
        updateForumPage();
        return;
      }

      if (!thread) {
        setMessage("Thread not found.", "error");
        updateForumPage();
        return;
      }

      const title = window.prompt("Update thread title:", thread.title) ?? thread.title;
      const body = window.prompt("Update thread message:", thread.body) ?? thread.body;
      if (!String(title).trim() || !String(body).trim()) {
        setMessage("Thread title and message are required.", "error");
        updateForumPage();
        return;
      }

      try {
        await contentSystem.updateContent("forumThread", threadId, {
          title: String(title).trim(),
          body: String(body).trim()
        });
        await reloadWithMessage("Thread updated.");
      } catch (error) {
        setMessage("Unable to update the thread.", "error");
        updateForumPage();
      }
    },

    async toggleThreadStatus(threadId, status) {
      const contentSystem = window.ContentCoreSystem;
      if (!contentSystem || !can("forum.thread.close")) {
        setMessage("You do not have permission to change thread status.", "error");
        updateForumPage();
        return;
      }

      if (!["open", "closed"].includes(status)) {
        setMessage("Invalid thread status.", "error");
        updateForumPage();
        return;
      }

      try {
        await contentSystem.updateContent("forumThread", threadId, { status });
        window.ModerationCoreSystem?.createModerationLog?.({
          action: `forum.thread.${status}`,
          targetType: "forumThread",
          targetId: threadId,
          reason: `Thread marked ${status}.`
        }).catch((error) => Diagnostics?.warn?.("[ForumModule] failed to create moderation log", error));
        await reloadWithMessage(status === "closed" ? "Thread closed." : "Thread opened.");
      } catch (error) {
        setMessage("Unable to update thread status.", "error");
        updateForumPage();
      }
    },

    async toggleThreadPin(threadId, pinned) {
      const contentSystem = window.ContentCoreSystem;
      const permission = pinned ? "forum.thread.pin" : "forum.thread.unpin";
      const thread = findThread(threadId);

      if (!contentSystem || !can(permission)) {
        setMessage("You do not have permission to change pin state.", "error");
        updateForumPage();
        return;
      }

      if (!thread) {
        setMessage("Thread not found.", "error");
        updateForumPage();
        return;
      }

      try {
        await contentSystem.updateContent("forumThread", threadId, {
          metadata: {
            ...(thread.metadata || {}),
            pinned: pinned === true
          }
        });
        await reloadWithMessage(pinned ? "Thread pinned." : "Thread unpinned.");
      } catch (error) {
        setMessage("Unable to change pin state.", "error");
        updateForumPage();
      }
    },

    async moveThreadTrash(threadId) {
      const contentSystem = window.ContentCoreSystem;
      if (!contentSystem || !can("forum.thread.moveTrash")) {
        setMessage("You do not have permission to move this thread to trash.", "error");
        updateForumPage();
        return;
      }

      if (!window.confirm("Move this thread to trash?")) {
        return;
      }

      try {
        await contentSystem.updateContent("forumThread", threadId, { status: "trash" });
        window.ModerationCoreSystem?.createModerationLog?.({
          action: "forum.thread.trash",
          targetType: "forumThread",
          targetId: threadId,
          reason: "Thread moved to trash."
        }).catch((error) => Diagnostics?.warn?.("[ForumModule] failed to create moderation log", error));
        await reloadWithMessage("Thread moved to trash.");
      } catch (error) {
        setMessage("Unable to move thread to trash.", "error");
        updateForumPage();
      }
    },

    async editPost(postId) {
      const contentSystem = window.ContentCoreSystem;
      const post = findPost(postId);
      const currentUserId = getCurrentUserId();
      const canEditAny = can("forum.post.edit");
      const canEditOwn = can("forum.post.editOwn") && currentUserId && post?.authorId === currentUserId;

      if (!contentSystem || (!canEditAny && !canEditOwn)) {
        setMessage("You do not have permission to edit this reply.", "error");
        updateForumPage();
        return;
      }

      if (!post) {
        setMessage("Reply not found.", "error");
        updateForumPage();
        return;
      }

      const body = window.prompt("Update reply:", post.body) ?? post.body;
      if (!String(body).trim()) {
        setMessage("Reply content is required.", "error");
        updateForumPage();
        return;
      }

      try {
        await contentSystem.updateContent("forumPost", postId, { body: String(body).trim() });
        await reloadWithMessage("Reply updated.");
      } catch (error) {
        setMessage("Unable to update reply.", "error");
        updateForumPage();
      }
    },

    async movePostTrash(postId) {
      const contentSystem = window.ContentCoreSystem;
      const post = findPost(postId);

      if (!contentSystem || !can("forum.post.moveTrash")) {
        setMessage("You do not have permission to move this reply to trash.", "error");
        updateForumPage();
        return;
      }

      if (!post) {
        setMessage("Reply not found.", "error");
        updateForumPage();
        return;
      }

      if (!window.confirm("Move this reply to trash?")) {
        return;
      }

      try {
        await contentSystem.updateContent("forumPost", postId, { status: "trash" });
        window.ModerationCoreSystem?.createModerationLog?.({
          action: "forum.post.trash",
          targetType: "forumPost",
          targetId: postId,
          reason: "Reply moved to trash."
        }).catch((error) => Diagnostics?.warn?.("[ForumModule] failed to create moderation log", error));
        await refreshForum();
        await updateThreadReplyMetadata(post.metadata?.threadId);
        await reloadWithMessage("Reply moved to trash.");
      } catch (error) {
        setMessage("Unable to move reply to trash.", "error");
        updateForumPage();
      }
    },

    async reportTarget(targetType, targetId) {
      const reason = window.prompt("Why are you reporting this?");
      if (!String(reason || "").trim()) return;
      try {
        await window.ModerationCoreSystem?.createReport?.({ targetType, targetId, reason });
        await reloadWithMessage("Report submitted for review.");
      } catch (error) {
        setMessage(error?.message || "Unable to submit report.", "error");
        updateForumPage();
      }
    },

    async updateReportStatus(reportId, status) {
      const note = window.prompt("Add a moderation note:", status) || "";
      try {
        await window.ModerationCoreSystem?.updateReportStatus?.(reportId, status, note);
        await refreshModerationReports();
      } catch (error) {
        setMessage(error?.message || "Unable to update report.", "error");
        updateForumPage();
      }
    },

    async uploadThreadAttachment(threadId) {
      const thread = findThread(threadId);
      if (!thread || !can("forum.thread.edit")) return;
      await uploadAttachment("forumThread", threadId, thread, "Thread attachment updated.");
    },

    async uploadPostAttachment(postId) {
      const post = findPost(postId);
      const currentUserId = getCurrentUserId();
      const canEditAny = can("forum.post.edit");
      const canEditOwn = can("forum.post.editOwn") && currentUserId && post?.authorId === currentUserId;
      if (!post || (!canEditAny && !canEditOwn)) return;
      await uploadAttachment("forumPost", postId, post, "Reply attachment updated.");
    },

    updateFilters() {
      state.filters.query = document.getElementById("forumSearchQuery")?.value || "";
      state.filters.category = document.getElementById("forumCategoryFilter")?.value || "All";
      updateForumPage();
    }
  };

  async function uploadAttachment(contentType, id, item, successMessage) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      try {
        const media = await window.MediaCoreSystem.uploadFromInput(input, {
          targetType: contentType,
          targetId: id,
          metadata: { purpose: "attachment" }
        });
        await window.ContentCoreSystem.updateContent(contentType, id, {
          metadata: {
            ...(item.metadata || {}),
            attachments: [...(item.metadata?.attachments || []), media]
          }
        });
        await reloadWithMessage(successMessage);
      } catch (error) {
        setMessage(error?.message || "Unable to upload attachment.", "error");
        updateForumPage();
      }
    };
    input.click();
  }

  ModuleSDK.registerPage("forums", {
    title: "Forums",
    render: () => {
      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      state.view = "browse";
      state.selectedThreadId = "";

      if (!contentSystem || !userSystem) {
        return `
          <section class="page-shell forum-shell">
            <h1>Forums</h1>
            <div class="forum-alert" data-tone="error">Forum system is unavailable.</div>
          </section>
        `;
      }

      if (!state.loaded && !state.loading) {
        refreshForum().catch(() => {
          state.loaded = true;
          state.loading = false;
          setMessage("Unable to load forum content.", "error");
          updateForumPage();
        });
      }

      return `
        <section class="page-shell forum-shell">
          <header class="page-header forum-header">
            <div>
              <h1 class="page-title">Forums</h1>
              <p class="page-subtitle">Structured community discussions with threaded replies, reputation, moderation, and attachments.</p>
            </div>
            <button class="button-secondary" type="button" onclick="window.ForumModuleUI.refresh()">Refresh</button>
          </header>

          <div id="forumStatusMessage">${renderStatusMessage()}</div>
          <div id="forumViewNav">${renderViewNav()}</div>
          <div id="forumContentContainer">${renderActiveView()}</div>
        </section>
      `;
    }
  });
})();
