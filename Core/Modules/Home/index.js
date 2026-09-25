(() => {
  const state = {
    posts: [],
    threads: [],
    events: [],
    activities: [],
    trending: [],
    counts: { posts: 0, threads: 0, events: 0 },
    loaded: false,
    widgetHtml: {}
  };

  const FEED_LIMIT = 4;

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function formatDate(iso) {
    if (!iso) return "Unknown";
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
  }

  function excerptFrom(record) {
    const meta = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const raw = typeof record?.excerpt === "string" && record.excerpt.trim()
      ? record.excerpt
      : typeof meta.excerpt === "string" && meta.excerpt.trim()
        ? meta.excerpt
        : typeof record?.body === "string"
          ? record.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          : "";
    if (!raw) return "";
    return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
  }

  function builderConfig() {
    return window.HomepageBuilderSystem?.getConfig?.() || window.HomepageBuilderSystem?.getDefaults?.() || {
      hero: {
        kicker: "WebbyOS Community Portal",
        title: "Welcome to our community hub",
        body: "Explore the latest articles, discussions, events, and community activities."
      },
      sections: []
    };
  }

  function sectionHeader(title, subtitle, route, routeLabel) {
    const action = route
      ? `<button type="button" class="home-section-action" onclick="Runtime.navigate('${escape(route)}')">${escape(routeLabel || "View all")}</button>`
      : "";
    return `
      <header class="home-section-header">
        <div>
          <h3 class="panel-title">${escape(title)}</h3>
          ${subtitle ? `<p class="home-section-subtitle">${escape(subtitle)}</p>` : ""}
        </div>
        ${action}
      </header>
    `;
  }

  function renderSectionBlock(title, subtitle, bodyHtml, sectionId = "", options = {}) {
    return `
      <section class="home-section-block cms-card module-card" ${sectionId ? `data-home-section="${escape(sectionId)}"` : ""}>
        ${sectionHeader(title, subtitle, options.route, options.routeLabel)}
        <div class="home-section-body">${bodyHtml}</div>
      </section>
    `;
  }

  function renderPortalEmpty(title, body, route, actionLabel) {
    return `
      <div class="portal-empty-state glass-subtle">
        <strong>${escape(title)}</strong>
        <p>${escape(body)}</p>
        ${route ? `<button type="button" class="button-secondary" onclick="Runtime.navigate('${escape(route)}')">${escape(actionLabel || "Open")}</button>` : ""}
      </div>
    `;
  }

  function renderFeedList(items, emptyTitle, emptyMessage, badgeLabel, linkPrefix) {
    if (!state.loaded) return `<div class="portal-empty-state is-loading glass-subtle"><strong>Loading</strong><p>Collecting the latest public updates.</p></div>`;
    if (!items.length) return renderPortalEmpty(emptyTitle, emptyMessage, linkPrefix.replace("#", ""), "Open section");
    return `
      <ul class="home-feed-list">
        ${items
          .map((item) => {
            const excerpt = excerptFrom(item);
            const href = `${linkPrefix}`;
            return `
              <li class="home-feed-item glass-subtle">
                <div class="home-feed-meta">
                  <span class="home-feed-badge">${escape(badgeLabel)}</span>
                  <time class="muted">${escape(formatDate(item.createdAt))}</time>
                </div>
                <a class="home-feed-title" href="${escape(href)}">${escape(item.title || "Untitled")}</a>
                ${excerpt ? `<p class="home-feed-excerpt">${escape(excerpt)}</p>` : ""}
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  async function refreshHome() {
    const contentSystem = window.ContentCoreSystem;
    if (!contentSystem) {
      state.loaded = true;
      return;
    }

    try {
      const [posts, threads, events, activities, trending] = await Promise.all([
        contentSystem.listContent("blogPost", { status: "published" }),
        contentSystem.listContent("forumThread", {}),
        contentSystem.listContent("calendarEvent", { status: "published" }),
        window.ActivityFeedCoreSystem?.listRecent?.(6) || Promise.resolve([]),
        window.SearchCoreSystem?.trending?.(5) || Promise.resolve([])
      ]);

      const publishedPosts = Array.isArray(posts)
        ? posts.filter((post) => post.status === "published")
        : [];
      const activeThreads = Array.isArray(threads)
        ? threads.filter((thread) => thread.status !== "trash")
        : [];
      const publishedEvents = Array.isArray(events)
        ? events.filter((event) => event.status === "published")
        : [];

      state.counts = {
        posts: publishedPosts.length,
        threads: activeThreads.length,
        events: publishedEvents.length
      };

      state.posts = publishedPosts
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, FEED_LIMIT);

      state.threads = activeThreads
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, FEED_LIMIT);

      state.events = publishedEvents
        .sort((a, b) => new Date(a.metadata?.eventDate || a.createdAt).getTime() - new Date(b.metadata?.eventDate || b.createdAt).getTime())
        .slice(0, FEED_LIMIT);

      state.activities = Array.isArray(activities) ? activities : [];
      state.trending = Array.isArray(trending) ? trending : [];
      await refreshWidgets();

      state.loaded = true;
    } catch (error) {
      state.loaded = true;
    }

    updateHomePage();
  }

  async function refreshWidgets() {
    const sections = builderConfig().sections || [];
    const widgetSections = sections.filter((section) => section.enabled !== false && section.type === "widget" && section.widgetId);
    const entries = await Promise.all(widgetSections.map(async (section) => {
      const html = await window.WidgetCoreSystem?.renderWidget?.(section.widgetId).catch(() => "");
      return [section.id, html || `<div class="builder-empty">Widget is unavailable.</div>`];
    }));
    state.widgetHtml = Object.fromEntries(entries);
  }

  function renderBlogSummary() {
    return renderFeedList(
      state.posts,
      "No articles yet",
      "Published stories will appear here as the editorial area grows.",
      "Article",
      "#blog"
    );
  }

  function renderForumSummary() {
    return renderFeedList(
      state.threads,
      "No discussions yet",
      "Public threads will appear here once the community starts posting.",
      "Discussion",
      "#forums"
    );
  }

  function renderEventSummary() {
    if (!state.loaded) return `<div class="portal-empty-state is-loading glass-subtle"><strong>Loading</strong><p>Checking upcoming events.</p></div>`;
    if (!state.events.length) {
      return renderPortalEmpty(
        "No events scheduled",
        "Published events will appear here with dates, times, and locations.",
        "calendar",
        "Open calendar"
      );
    }
    return `
      <ul class="home-feed-list">
        ${state.events
          .map((event) => {
            const eventDate = formatDate(event.metadata?.eventDate || event.createdAt);
            const location = typeof event.metadata?.location === "string" ? event.metadata.location : "";
            return `
              <li class="home-feed-item glass-subtle">
                <div class="home-feed-meta">
                  <span class="home-feed-badge">Event</span>
                  <time class="muted">${escape(eventDate)}</time>
                </div>
                <a class="home-feed-title" href="#calendar">${escape(event.title || "Untitled event")}</a>
                ${location ? `<p class="home-feed-excerpt">${escape(location)}</p>` : ""}
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderActivitySummary() {
    if (!state.loaded) return `<div class="portal-empty-state is-loading glass-subtle"><strong>Loading</strong><p>Preparing recent community activity.</p></div>`;
    if (window.ActivityFeedCoreSystem?.renderActivityFeed) {
      if (!state.activities.length) {
        return renderPortalEmpty("No activity yet", "New posts, replies, events, and social actions will collect here.", "", "");
      }
      return `<div class="home-activity-panel">${window.ActivityFeedCoreSystem.renderActivityFeed(state.activities)}</div>`;
    }
    return renderPortalEmpty("Activity unavailable", "The activity feed is not available in this runtime.", "", "");
  }

  function renderTrendingSummary() {
    if (!state.loaded) return `<div class="portal-empty-state is-loading glass-subtle"><strong>Loading</strong><p>Looking for featured public content.</p></div>`;
    if (window.SearchCoreSystem?.renderResults) {
      if (!state.trending.length) {
        return renderPortalEmpty("No featured content yet", "Featured and frequently updated items will appear here.", "", "");
      }
      return `<div class="home-featured-panel">${window.SearchCoreSystem.renderResults(state.trending)}</div>`;
    }
    return renderPortalEmpty("Discovery unavailable", "Featured content tools are not available in this runtime.", "", "");
  }

  function renderSpotlight() {
    const latestPost = state.posts[0];
    const latestThread = state.threads[0];
    const nextEvent = state.events[0];
    const spotlightItems = [
      latestPost && ["Latest article", latestPost.title || "Untitled article", excerptFrom(latestPost), "blog"],
      latestThread && ["Active discussion", latestThread.title || "Untitled thread", excerptFrom(latestThread), "forums"],
      nextEvent && ["Next event", nextEvent.title || "Untitled event", nextEvent.metadata?.location || formatDate(nextEvent.metadata?.eventDate || nextEvent.createdAt), "calendar"]
    ].filter(Boolean);

    if (!state.loaded) {
      return `<div class="home-spotlight-grid">${[1, 2, 3].map(() => `<div class="home-spotlight-card portal-empty-state is-loading glass"><strong>Loading</strong><p>Preparing portal highlights.</p></div>`).join("")}</div>`;
    }

    // The Explore row below already covers module discovery, so an empty
    // spotlight would add boxes without adding information.
    if (!spotlightItems.length) {
      return "";
    }

    return `
      <div class="home-spotlight-grid">
        ${spotlightItems.map(([label, title, body, route]) => `
          <button type="button" class="home-spotlight-card glass" onclick="Runtime.navigate('${escape(route)}')">
            <span>${escape(label)}</span>
            <strong>${escape(title)}</strong>
            ${body ? `<small>${escape(body)}</small>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderHeroStats() {
    if (!state.loaded) return "";
    const stats = [
      ["Articles", state.counts.posts],
      ["Discussions", state.counts.threads],
      ["Events", state.counts.events]
    ];
    return `
      <div class="home-hero-stats" aria-label="Community overview">
        ${stats
          .map(([label, count]) => `
            <div class="home-hero-stat glass">
              <strong>${escape(String(count))}</strong>
              <span>${escape(label)}</span>
            </div>
          `)
          .join("")}
      </div>
    `;
  }

  function renderHero() {
    const hero = builderConfig().hero || {};
    return `
      <section class="home-portal-hero">
        <header class="page-header home-header">
          <div class="home-hero-copy">
            <span class="section-eyebrow">${escape(hero.kicker || "Community portal")}</span>
            <h1 class="page-title">${escape(hero.title || "Welcome to our community hub")}</h1>
            <p class="page-subtitle">${escape(hero.body || "Explore the latest articles, discussions, events, and community activities.")}</p>
          </div>
          <div class="hero-actions">
            <button class="button-primary" type="button" onclick="Runtime.navigate('blog')">Read news</button>
            <button class="button-secondary" type="button" onclick="Runtime.navigate('forums')">Join discussions</button>
            <button class="button-secondary" type="button" onclick="Runtime.navigate('calendar')">See events</button>
          </div>
        </header>
        ${renderHeroStats()}
        ${renderSpotlight()}
      </section>
    `;
  }

  function renderModuleLinks() {
    const routes = (window.NavigationBuilderSystem?.getPublicItems?.() || [])
      .filter((item) => ["blog", "forums", "calendar", "account"].includes(item.route));
    const fallback = [
      ["blog", "Blog", "Editorial stories, updates, drafts, categories, and author-driven publishing."],
      ["forums", "Forums", "Threaded community discussion with replies, moderation, reputation, and attachments."],
      ["calendar", "Calendar", "Published events, featured dates, locations, images, and community scheduling."],
      ["account", "Account", "Social profiles, inbox, bookmarks, reputation, notifications, and account standing."]
    ];
    const items = routes.length
      ? routes.map((item) => [item.route, item.label, descriptionForRoute(item.route)])
      : fallback;

    return `
      <div class="home-quicknav-grid">
        ${items.map(([route, label, description]) => `
          <button type="button" class="home-quicknav-card glass" onclick="Runtime.navigate('${escape(route)}')">
            <span class="home-quicknav-label">${escape(label)}</span>
            <span class="home-quicknav-copy">${escape(description)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function descriptionForRoute(route) {
    const descriptions = {
      blog: "Editorial stories, updates, drafts, categories, and author-driven publishing.",
      forums: "Threaded community discussion with replies, moderation, reputation, and attachments.",
      calendar: "Published events, featured dates, locations, images, and community scheduling.",
      account: "Social profiles, inbox, bookmarks, reputation, notifications, and account standing."
    };
    return descriptions[route] || "Open this section.";
  }

  function renderSection(section) {
    if (!section || section.enabled === false) return "";
    if (section.type === "hero") return renderHero();
    if (section.type === "moduleLinks") {
      return `
        <nav class="home-portal-quicknav" aria-label="Explore community areas">
          <div class="section-eyebrow">Explore</div>
          ${renderModuleLinks()}
        </nav>
      `;
    }
    if (section.type === "blogPreview") {
      return renderSectionBlock(
        section.title || "Latest Articles",
        "Recent published articles from the community blog.",
        `<div id="homeBlogSummary">${renderBlogSummary()}</div>`,
        section.id,
        { route: "blog", routeLabel: "All Articles" }
      );
    }
    if (section.type === "forumPreview") {
      return renderSectionBlock(
        section.title || "Latest discussions",
        "Active threads and conversations across the forums.",
        `<div id="homeForumSummary">${renderForumSummary()}</div>`,
        section.id,
        { route: "forums", routeLabel: "All threads" }
      );
    }
    if (section.type === "calendarPreview") {
      return renderSectionBlock(
        section.title || "Upcoming events",
        "Published dates, locations, and community scheduling.",
        `<div id="homeEventSummary">${renderEventSummary()}</div>`,
        section.id,
        { route: "calendar", routeLabel: "Full calendar" }
      );
    }
    if (section.type === "activityFeed") {
      return renderSectionBlock(
        section.title || "Community activity",
        "Recent public actions across blog, forums, and calendar.",
        `<div id="homeActivitySummary">${renderActivitySummary()}</div>`,
        section.id
      );
    }
    if (section.type === "featuredContent") {
      return renderSectionBlock(
        section.title || "Featured & trending",
        "Highlighted and recently updated community content.",
        `<div id="homeTrendingSummary">${renderTrendingSummary()}</div>`,
        section.id
      );
    }
    if (section.type === "widget") {
      return `
        <div class="home-widget-slot" data-home-section="${escape(section.id)}">
          ${state.widgetHtml[section.id] || `<div class="cms-card builder-empty">Loading widget...</div>`}
        </div>
      `;
    }
    return "";
  }

  function zoneForSection(section) {
    if (!section) return "";
    if (section.type === "hero") return "hero";
    if (section.type === "moduleLinks") return "nav";
    if (["blogPreview", "forumPreview", "calendarPreview"].includes(section.type)) return "main";
    if (["activityFeed", "featuredContent"].includes(section.type)) return "aside";
    if (section.type === "widget") return "widgets";
    return "";
  }

  function renderPortalLayout(sections) {
    const zones = { hero: [], nav: [], main: [], aside: [], widgets: [] };
    sections.forEach((section) => {
      const zone = zoneForSection(section);
      if (zone && zones[zone]) zones[zone].push(section);
    });

    const mainHtml = zones.main.map((section) => renderSection(section)).filter(Boolean).join("");
    const asideHtml = zones.aside.map((section) => renderSection(section)).filter(Boolean).join("");
    const widgetsHtml = zones.widgets.map((section) => renderSection(section)).filter(Boolean).join("");

    return `
      <div class="home-portal">
        ${zones.hero.map((section) => renderSection(section)).join("")}
        ${zones.nav.length ? zones.nav.map((section) => renderSection(section)).join("") : ""}
        ${mainHtml || asideHtml ? `
          <div class="home-portal-body">
            ${mainHtml ? `<div class="home-portal-main">${mainHtml}</div>` : ""}
            ${asideHtml ? `<aside class="home-portal-aside">${asideHtml}</aside>` : ""}
          </div>
        ` : ""}
        ${widgetsHtml ? `
          <section class="home-portal-widgets" aria-label="Widget areas">
            <div class="section-eyebrow">Widgets</div>
            <div class="home-widget-grid">${widgetsHtml}</div>
          </section>
        ` : ""}
      </div>
    `;
  }

  function updateHomePage() {
    const root = document.getElementById("homeBuilderRoot");
    if (root) root.innerHTML = renderHome();
  }

  function renderHome() {
    const sections = (builderConfig().sections || [])
      .filter((section) => section.enabled !== false)
      .sort((a, b) => a.order - b.order);
    return renderPortalLayout(sections);
  }

  window.HomeModuleUI = {
    refresh: refreshHome
  };

  ModuleSDK.registerPage("home", {
    title: "Home",
    render: () => {
      if (!state.loaded) {
        refreshHome().catch(() => {
          state.loaded = true;
          updateHomePage();
        });
      } else {
        refreshWidgets().then(updateHomePage).catch(() => null);
      }

      return `<div id="homeBuilderRoot" class="page-shell community-home-shell">${renderHome()}</div>`;
    }
  });
})();
