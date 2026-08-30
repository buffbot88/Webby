(() => {
  const state = {
    posts: [],
    filters: {
      query: "",
      category: "All",
      authorId: ""
    },
    view: "reader",
    loaded: false,
    loading: false,
    message: "",
    messageTone: "info"
  };

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function jsArg(value) {
    return escape(JSON.stringify(String(value == null ? "" : value)));
  }

  function formatDate(iso) {
    if (!iso) return "Unknown";
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
  }

  function can(capability) {
    return !!window.UserCoreSystem?.can?.(capability);
  }

  function setMessage(message, tone = "info") {
    state.message = message || "";
    state.messageTone = tone;
  }

  function renderStatusMessage() {
    if (!state.message) return "";
    return `<div class="blog-alert" data-tone="${escape(state.messageTone)}">${escape(state.message)}</div>`;
  }

  function getAuthorName(authorId) {
    if (!authorId) return "Unknown author";
    const profile = window.UserCoreSystem?.getProfile?.(authorId);
    return profile?.displayName || profile?.username || authorId;
  }

  function normalizeTags(tags) {
    if (Array.isArray(tags)) {
      return tags.map((tag) => String(tag).trim()).filter(Boolean);
    }
    if (typeof tags === "string") {
      return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
    return [];
  }

  function normalizePost(post) {
    const metadata = post.metadata && typeof post.metadata === "object" ? post.metadata : {};
    const tags = normalizeTags(metadata.tags);
    return {
      ...post,
      excerpt: typeof post.excerpt === "string" ? post.excerpt : metadata.excerpt || "",
      status: ["draft", "published", "trash"].includes(post.status) ? post.status : "draft",
      metadata: {
        ...metadata,
        tags,
        featured: metadata.featured === true,
        publishedAt: typeof metadata.publishedAt === "string" ? metadata.publishedAt : "",
        scheduledAt: typeof metadata.scheduledAt === "string" ? metadata.scheduledAt : "",
        category: typeof metadata.category === "string" ? metadata.category : "General",
        coverImageUrl: typeof metadata.coverImageUrl === "string" ? metadata.coverImageUrl : "",
        coverMediaId: typeof metadata.coverMediaId === "string" ? metadata.coverMediaId : ""
      }
    };
  }

  function visiblePosts() {
    const canManage = can("blog.post.edit") || can("blog.post.publish") || can("blog.post.moveTrash") || can("blog.post.feature");
    const now = Date.now();
    const query = state.filters.query.trim().toLowerCase();
    return state.posts
      .filter((post) => post.status !== "trash")
      .filter((post) => canManage || post.status === "published")
      .filter((post) => canManage || !post.metadata?.scheduledAt || new Date(post.metadata.scheduledAt).getTime() <= now)
      .filter((post) => state.filters.category === "All" || post.metadata?.category === state.filters.category)
      .filter((post) => !state.filters.authorId || post.authorId === state.filters.authorId)
      .filter((post) => !query || [post.title, post.body, post.excerpt, post.metadata?.category, normalizeTags(post.metadata?.tags).join(" ")].join(" ").toLowerCase().includes(query))
      .sort((a, b) => {
        const featuredDelta = Number(b.metadata?.featured === true) - Number(a.metadata?.featured === true);
        if (featuredDelta !== 0) return featuredDelta;
        const aDate = new Date(a.metadata?.publishedAt || a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.metadata?.publishedAt || b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });
  }

  function renderBadges(post) {
    const badges = [];
    if (post.status === "draft") {
      badges.push(`<span class="blog-badge blog-badge-draft">Draft</span>`);
    }
    if (post.status === "published") {
      badges.push(`<span class="blog-badge blog-badge-published">Published</span>`);
    }
    if (post.metadata?.featured) {
      badges.push(`<span class="blog-badge blog-badge-featured">Featured</span>`);
    }
    if (post.metadata?.scheduledAt && new Date(post.metadata.scheduledAt).getTime() > Date.now()) {
      badges.push(`<span class="blog-badge">Scheduled</span>`);
    }
    return badges.join("");
  }

  function renderTags(post) {
    const tags = normalizeTags(post.metadata?.tags);
    if (!tags.length) return "";
    return `
      <div class="blog-tag-row">
        ${tags.map((tag) => `<span class="blog-badge">${escape(tag)}</span>`).join("")}
      </div>
    `;
  }

  function renderCover(post, compact = false) {
    if (post.metadata?.coverImageUrl) {
      return `<img class="cover-image ${compact ? "cover-image-compact" : ""}" src="${escape(post.metadata.coverImageUrl)}" alt="${escape(post.title || "Blog cover")}" loading="lazy" />`;
    }

    return `
      <div class="cover-placeholder ${compact ? "cover-placeholder-compact" : ""}" aria-hidden="true">
        <span>${escape((post.metadata?.category || "Article").slice(0, 1).toUpperCase())}</span>
      </div>
    `;
  }

  function renderActionBar(post) {
    const actions = [];
    const nextStatus = post.status === "published" ? "draft" : "published";

    if (can("blog.post.edit")) {
      actions.push(`<button type="button" onclick="window.BlogModuleUI.editPost(${jsArg(post.id)})">Edit</button>`);
      actions.push(`<button type="button" onclick="window.BlogModuleUI.uploadPostCover(${jsArg(post.id)})">Cover</button>`);
    }
    if (can("blog.post.publish")) {
      actions.push(`<button type="button" onclick="window.BlogModuleUI.togglePostStatus(${jsArg(post.id)}, ${jsArg(nextStatus)})">${post.status === "published" ? "Unpublish" : "Publish"}</button>`);
    }
    if (can("blog.post.feature")) {
      actions.push(`<button type="button" onclick="window.BlogModuleUI.toggleFeatured(${jsArg(post.id)}, ${post.metadata?.featured ? "false" : "true"})">${post.metadata?.featured ? "Unfeature" : "Feature"}</button>`);
    }
    if (can("blog.post.moveTrash")) {
      actions.push(`<button type="button" onclick="window.BlogModuleUI.movePostTrash(${jsArg(post.id)})">Move to Trash</button>`);
    }

    return actions.length ? `<div class="blog-action-bar">${actions.join("")}</div>` : "";
  }

  function renderSocialBar(post) {
    if (post.status !== "published") return "";
    const reactions = window.ReactionCoreSystem?.renderReactionBar
      ? window.ReactionCoreSystem.renderReactionBar("blogPost", post.id)
      : "";
    const bookmark = window.BookmarkCoreSystem?.renderBookmarkButton
      ? window.BookmarkCoreSystem.renderBookmarkButton("blogPost", post.id, post.title || "Blog post", "#blog")
      : "";
    return reactions || bookmark ? `<div class="blog-action-bar">${reactions}${bookmark}</div>` : "";
  }

  function renderPost(post, featured = false) {
    const publishedDate = post.metadata?.publishedAt || post.createdAt;
    return `
      <article class="blog-post-card editorial-post-card ${featured ? "editorial-featured-card" : ""}">
        ${renderCover(post, !featured)}
        <header>
          <div class="blog-post-topline">
            <div>
              <div class="section-eyebrow">${escape(post.metadata?.category || "General")}</div>
              <h2>${escape(post.title || "Untitled post")}</h2>
              <div class="blog-post-meta">
                <span>${escape(getAuthorName(post.authorId))}</span>
                <span>${escape(formatDate(publishedDate))}</span>
                <span>${escape(post.status || "draft")}</span>
              </div>
            </div>
            <div class="blog-badge-row">${renderBadges(post)}</div>
          </div>
        </header>
        ${post.excerpt ? `<p class="blog-excerpt">${escape(post.excerpt)}</p>` : ""}
        <div class="blog-body">${escape(featured ? (post.body || "No content yet.") : ((post.body || "No content yet.").slice(0, 260) + ((post.body || "").length > 260 ? "..." : "")))}</div>
        <div class="blog-tag-row"><span class="blog-badge">${escape(post.metadata?.category || "General")}</span></div>
        <div class="blog-editorial-ledger">
          <span>Status: ${escape(post.status || "published")}</span>
          <span>${post.metadata?.scheduledAt ? `Scheduled ${escape(formatDate(post.metadata.scheduledAt))}` : "Live editorial item"}</span>
          <span>${post.metadata?.featured ? "Featured" : "Standard"}</span>
        </div>
        ${renderTags(post)}
        ${renderSocialBar(post)}
        ${renderActionBar(post)}
      </article>
    `;
  }

  function renderPostList() {
    if (state.loading && !state.loaded) {
      return `<div class="blog-empty">Loading blog posts...</div>`;
    }

    const posts = visiblePosts();
    if (!posts.length) {
      return `
        <div class="blog-empty module-empty-state">
          <strong>No articles published yet.</strong>
          <p>Drafts and published posts will appear here with editorial metadata, tags, and cover media.</p>
        </div>
      `;
    }

    const featured = posts.find((post) => post.metadata?.featured) || posts[0];
    const remaining = posts.filter((post) => post !== featured);

    return `
      <div class="blog-editorial-layout">
        ${renderPost(featured, true)}
        ${remaining.length ? `<div class="blog-post-grid">${remaining.map((post) => renderPost(post, false)).join("")}</div>` : ""}
      </div>
    `;
  }

  function setView(view) {
    if (!["reader", "compose"].includes(view)) return;
    state.view = view;
    updateBlogPage();
  }

  function renderViewNav() {
    const items = [
      ["reader", "Articles"],
      ["compose", "Write"]
    ];
    return `
      <nav class="module-subnav" aria-label="Blog views">
        ${items.map(([view, label]) => `
          <button type="button" class="${state.view === view ? "active" : ""}" onclick="window.BlogModuleUI.setView('${escape(view)}')">
            ${escape(label)}
          </button>
        `).join("")}
      </nav>
    `;
  }

  function renderActiveView() {
    if (state.view === "compose") {
      return `<div id="blogEditorContainer">${renderEditor()}</div>`;
    }

    return `
      <div id="blogListContainer">
        ${renderFilters()}
        ${renderPostList()}
      </div>
    `;
  }

  function renderFilters() {
    const categories = Array.from(new Set(state.posts.map((post) => post.metadata?.category || "General"))).sort();
    return `
      <div class="search-tools">
        <input id="blogSearchQuery" type="search" placeholder="Search posts" value="${escape(state.filters.query)}" oninput="window.BlogModuleUI.updateFilters()" />
        <select id="blogCategoryFilter" onchange="window.BlogModuleUI.updateFilters()">
          <option value="All">All categories</option>
          ${categories.map((category) => `<option value="${escape(category)}" ${state.filters.category === category ? "selected" : ""}>${escape(category)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function renderEditor() {
    if (!can("blog.post.create")) {
      return `<div class="blog-empty">Sign in with publishing permissions to create blog posts.</div>`;
    }

    return `
      <article class="blog-editor">
        <h2>Create Blog Post</h2>
        <form id="blogCreateForm" onsubmit="window.BlogModuleUI.createPost(event)">
          <div class="form-row">
            <label for="blogCreateTitle">Title</label>
            <input id="blogCreateTitle" type="text" placeholder="Post title" required />
          </div>
          <div class="form-row">
            <label for="blogCreateExcerpt">Excerpt</label>
            <textarea id="blogCreateExcerpt" rows="3" placeholder="Short summary"></textarea>
          </div>
          <div class="form-row">
            <label for="blogCreateBody">Body</label>
            <textarea id="blogCreateBody" rows="8" placeholder="Post body" required></textarea>
          </div>
          <div class="form-row">
            <label for="blogCreateTags">Tags</label>
            <input id="blogCreateTags" type="text" placeholder="updates, release notes" />
          </div>
          <div class="form-row">
            <label for="blogCreateCategory">Category</label>
            <input id="blogCreateCategory" type="text" placeholder="General" />
          </div>
          <div class="form-row">
            <label for="blogCreateScheduledAt">Schedule</label>
            <input id="blogCreateScheduledAt" type="datetime-local" />
          </div>
          <div class="form-row media-upload">
            <label for="blogCreateCover">Cover image</label>
            <input id="blogCreateCover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </div>
          <div class="form-row">
            <label for="blogCreateStatus">Status</label>
            <select id="blogCreateStatus">
              <option value="draft">Draft</option>
              ${can("blog.post.publish") ? `<option value="published">Published</option>` : ""}
            </select>
          </div>
          <button class="primary" type="submit">Save Post</button>
        </form>
      </article>
    `;
  }

  async function refreshPosts() {
    const contentSystem = window.ContentCoreSystem;
    const userSystem = window.UserCoreSystem;

    if (!contentSystem || !userSystem) {
      state.loaded = true;
      state.loading = false;
      setMessage("Blog system is unavailable.", "error");
      updateBlogPage();
      return;
    }

    state.loading = true;

    try {
      const posts = await contentSystem.listContent("blogPost", {});
      state.posts = Array.isArray(posts) ? posts.map(normalizePost) : [];
      state.loaded = true;
      state.loading = false;
    } catch (error) {
      state.loaded = true;
      state.loading = false;
      setMessage("Unable to load blog posts.", "error");
    }

    updateBlogPage();
  }

  function updateBlogPage() {
    const navContainer = document.getElementById("blogViewNav");
    if (navContainer) {
      navContainer.innerHTML = renderViewNav();
    }

    const contentContainer = document.getElementById("blogContentContainer");
    if (contentContainer) {
      contentContainer.innerHTML = renderActiveView();
    }

    const statusEl = document.getElementById("blogStatusMessage");
    if (statusEl) {
      statusEl.innerHTML = renderStatusMessage();
    }

    window.ReactionCoreSystem?.hydrateReactionBars?.();
    window.BookmarkCoreSystem?.hydrateBookmarkButtons?.();
  }

  async function reloadWithMessage(message, tone = "info") {
    setMessage(message, tone);
    await refreshPosts();
    setMessage(message, tone);
    updateBlogPage();

    if (window.HomeModuleUI?.refresh) {
      window.HomeModuleUI.refresh();
    }
  }

  function findPost(id) {
    return state.posts.find((post) => String(post.id) === String(id)) || null;
  }

  window.BlogModuleUI = {
    refresh: refreshPosts,
    setView,

    async createPost(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();

      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      if (!contentSystem || !userSystem?.can("blog.post.create")) {
        setMessage("You do not have permission to create blog posts.", "error");
        updateBlogPage();
        return false;
      }

      const title = document.getElementById("blogCreateTitle")?.value?.trim() || "";
      const excerpt = document.getElementById("blogCreateExcerpt")?.value?.trim() || "";
      const body = document.getElementById("blogCreateBody")?.value?.trim() || "";
      const tags = normalizeTags(document.getElementById("blogCreateTags")?.value || "");
      const category = document.getElementById("blogCreateCategory")?.value?.trim() || "General";
      const scheduledAtRaw = document.getElementById("blogCreateScheduledAt")?.value || "";
      const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : "";
      const requestedStatus = document.getElementById("blogCreateStatus")?.value || "draft";
      const status = requestedStatus === "published" && can("blog.post.publish") ? "published" : "draft";

      if (!title || !body) {
        setMessage("Post title and body are required.", "error");
        updateBlogPage();
        return false;
      }

      const currentUser = userSystem.getCurrentUser?.();
      const now = new Date().toISOString();

      try {
        let saved = await contentSystem.createContent("blogPost", {
          title,
          body,
          excerpt,
          status,
          authorId: currentUser?.id || currentUser?.username || "",
          metadata: {
            tags,
            category,
            featured: false,
            publishedAt: status === "published" ? now : "",
            scheduledAt
          }
        });
        window.CategoryCoreSystem?.ensureCategory?.(category, "blogPost").catch(() => null);
        const coverInput = document.getElementById("blogCreateCover");
        if (coverInput?.files?.[0] && window.MediaCoreSystem?.uploadFromInput) {
          const media = await window.MediaCoreSystem.uploadFromInput(coverInput, {
            targetType: "blogPost",
            targetId: saved.id,
            metadata: { purpose: "cover" }
          });
          saved = await contentSystem.updateContent("blogPost", saved.id, {
            metadata: {
              ...(saved.metadata || {}),
              coverMediaId: media.id,
              coverImageUrl: media.url
            }
          });
        }
        if (status === "published") {
          window.ActivityFeedCoreSystem?.recordBlogPostPublished?.(saved).catch((error) => {
            Diagnostics?.warn?.("[BlogModule] failed to record publish activity", error);
          });
          window.ReputationCoreSystem?.recordBlogPostPublished?.(saved.authorId).catch((error) => {
            Diagnostics?.warn?.("[BlogModule] failed to record blog reputation", error);
          });
        }
        document.getElementById("blogCreateForm")?.reset();
        state.view = "reader";
        await reloadWithMessage(status === "published" ? "Blog post published." : "Blog draft saved.");
      } catch (error) {
        setMessage("Unable to save the blog post.", "error");
        updateBlogPage();
      }

      return false;
    },

    async togglePostStatus(id, status) {
      const contentSystem = window.ContentCoreSystem;
      const post = findPost(id);

      if (!contentSystem || !can("blog.post.publish")) {
        setMessage("You do not have permission to update post status.", "error");
        updateBlogPage();
        return;
      }

      if (!post || post.status === "trash") {
        setMessage("Blog post not found.", "error");
        updateBlogPage();
        return;
      }

      if (!["draft", "published"].includes(status)) {
        setMessage("Invalid post status.", "error");
        updateBlogPage();
        return;
      }

      try {
        const saved = await contentSystem.updateContent("blogPost", id, {
          status,
          metadata: {
            ...(post.metadata || {}),
            publishedAt: status === "published" ? (post.metadata?.publishedAt || new Date().toISOString()) : ""
          }
        });
        if (status === "published" && post.status !== "published") {
          window.ActivityFeedCoreSystem?.recordBlogPostPublished?.(saved).catch((error) => {
            Diagnostics?.warn?.("[BlogModule] failed to record publish activity", error);
          });
          window.ReputationCoreSystem?.recordBlogPostPublished?.(saved.authorId).catch((error) => {
            Diagnostics?.warn?.("[BlogModule] failed to record blog reputation", error);
          });
        }
        await reloadWithMessage(status === "published" ? "Blog post published." : "Blog post unpublished.");
      } catch (error) {
        setMessage("Unable to update post status.", "error");
        updateBlogPage();
      }
    },

    async toggleFeatured(id, featured) {
      const contentSystem = window.ContentCoreSystem;
      const post = findPost(id);

      if (!contentSystem || !can("blog.post.feature")) {
        setMessage("You do not have permission to feature posts.", "error");
        updateBlogPage();
        return;
      }

      if (!post || post.status === "trash") {
        setMessage("Blog post not found.", "error");
        updateBlogPage();
        return;
      }

      try {
        await contentSystem.updateContent("blogPost", id, {
          metadata: {
            ...(post.metadata || {}),
            featured: featured === true
          }
        });
        await reloadWithMessage(featured ? "Blog post featured." : "Blog post unfeatured.");
      } catch (error) {
        setMessage("Unable to update featured state.", "error");
        updateBlogPage();
      }
    },

    async movePostTrash(id) {
      const contentSystem = window.ContentCoreSystem;

      if (!contentSystem || !can("blog.post.moveTrash")) {
        setMessage("You do not have permission to move posts to trash.", "error");
        updateBlogPage();
        return;
      }

      if (!findPost(id)) {
        setMessage("Blog post not found.", "error");
        updateBlogPage();
        return;
      }

      if (!window.confirm("Move this blog post to trash?")) {
        return;
      }

      try {
        await contentSystem.updateContent("blogPost", id, { status: "trash" });
        await reloadWithMessage("Blog post moved to trash.");
      } catch (error) {
        setMessage("Unable to move post to trash.", "error");
        updateBlogPage();
      }
    },

    async editPost(id) {
      const contentSystem = window.ContentCoreSystem;
      const post = findPost(id);

      if (!contentSystem || !can("blog.post.edit")) {
        setMessage("You do not have permission to edit this post.", "error");
        updateBlogPage();
        return;
      }

      if (!post || post.status === "trash") {
        setMessage("Blog post not found.", "error");
        updateBlogPage();
        return;
      }

      const title = window.prompt("Update post title:", post.title) ?? post.title;
      const excerpt = window.prompt("Update excerpt:", post.excerpt || "") ?? (post.excerpt || "");
      const body = window.prompt("Update post body:", post.body) ?? post.body;
      const tagsText = window.prompt("Update tags, comma separated:", normalizeTags(post.metadata?.tags).join(", ")) ?? normalizeTags(post.metadata?.tags).join(", ");
      const category = window.prompt("Update category:", post.metadata?.category || "General") ?? (post.metadata?.category || "General");
      const scheduledAt = window.prompt("Update scheduled publish ISO date:", post.metadata?.scheduledAt || "") ?? (post.metadata?.scheduledAt || "");

      if (!String(title).trim() || !String(body).trim()) {
        setMessage("Post title and body are required.", "error");
        updateBlogPage();
        return;
      }

      try {
        await contentSystem.updateContent("blogPost", id, {
          title: String(title).trim(),
          excerpt: String(excerpt).trim(),
          body: String(body).trim(),
          metadata: {
            ...(post.metadata || {}),
            tags: normalizeTags(tagsText),
            category: String(category).trim() || "General",
            scheduledAt: String(scheduledAt).trim()
          }
        });
        window.CategoryCoreSystem?.ensureCategory?.(String(category).trim() || "General", "blogPost").catch(() => null);
        await reloadWithMessage("Blog post updated.");
      } catch (error) {
        setMessage("Unable to update the blog post.", "error");
        updateBlogPage();
      }
    },

    async uploadPostCover(id) {
      const contentSystem = window.ContentCoreSystem;
      const post = findPost(id);
      if (!contentSystem || !post || !can("blog.post.edit")) {
        setMessage("You do not have permission to update this cover image.", "error");
        updateBlogPage();
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.onchange = async () => {
        try {
          const media = await window.MediaCoreSystem.uploadFromInput(input, {
            targetType: "blogPost",
            targetId: id,
            metadata: { purpose: "cover" }
          });
          await contentSystem.updateContent("blogPost", id, {
            metadata: {
              ...(post.metadata || {}),
              coverMediaId: media.id,
              coverImageUrl: media.url
            }
          });
          await reloadWithMessage("Cover image updated.");
        } catch (error) {
          setMessage(error?.message || "Unable to upload cover image.", "error");
          updateBlogPage();
        }
      };
      input.click();
    },

    updateFilters() {
      state.filters.query = document.getElementById("blogSearchQuery")?.value || "";
      state.filters.category = document.getElementById("blogCategoryFilter")?.value || "All";
      updateBlogPage();
    }
  };

  ModuleSDK.registerPage("blog", {
    title: "Blog",
    render: () => {
      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      state.view = "reader";

      if (!contentSystem || !userSystem) {
        return `
          <section class="page-shell blog-shell">
            <h1>Blog</h1>
            <div class="blog-alert" data-tone="error">Blog system is unavailable.</div>
          </section>
        `;
      }

      if (!state.loaded && !state.loading) {
        refreshPosts().catch(() => {
          state.loaded = true;
          state.loading = false;
          setMessage("Unable to load blog content.", "error");
          updateBlogPage();
        });
      }

      return `
        <section class="page-shell blog-shell">
          <header class="page-header blog-header">
            <div>
              <h1 class="page-title">Blog</h1>
              <p class="page-subtitle">Editorial publishing with drafts, schedules, cover images, authors, categories, and tags.</p>
            </div>
            <button class="button-secondary" type="button" onclick="window.BlogModuleUI.refresh()">Refresh</button>
          </header>

          <div id="blogStatusMessage">${renderStatusMessage()}</div>
          <div id="blogViewNav">${renderViewNav()}</div>
          <div id="blogContentContainer">${renderActiveView()}</div>
        </section>
      `;
    }
  });
})();
