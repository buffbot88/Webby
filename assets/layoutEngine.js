const LayoutEngine = (() => {

  const loading = new Set();

  const RAIL_ORDER = ["home", "forums", "blog", "calendar", "messages", "activity", "account", "admin"];

  /* Inline SVG icon set. Icons inherit color so the active state can tint them. */
  const ICONS = {
    home: '<path d="M4 10.6 12 4l8 6.6"/><path d="M6.4 9.6V20h11.2V9.6"/><path d="M10 20v-5.4h4V20"/>',
    forums: '<path d="M20 12.4c0 3.9-3.6 7-8 7-.9 0-1.8-.1-2.6-.4L4 21l1.3-3.4C4.5 16.4 4 14.5 4 12.4 4 8.5 7.6 5.4 12 5.4s8 3.1 8 7z"/>',
    blog: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 15.6 15.2 9.4l1.6 1.6L10.6 17.2 8.6 17.6z"/><path d="M8 8h4"/>',
    calendar: '<rect x="4" y="6" width="16" height="14" rx="3"/><path d="M4 10.5h16"/><path d="M9 4.4v3.2M15 4.4v3.2"/>',
    messages: '<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M4.8 7.6 12 13l7.2-5.4"/>',
    activity: '<path d="M4 13h3.4l2-5 3.2 9 2-4h5.4"/>',
    account: '<circle cx="12" cy="9" r="3.4"/><path d="M5.2 20c.8-3.4 3.6-5.2 6.8-5.2s6 1.8 6.8 5.2"/>',
    admin: '<path d="M12 4.2 19 6.4v5.2c0 3.9-2.8 6.6-7 8.2-4.2-1.6-7-4.3-7-8.2V6.4z"/><path d="M9.4 12.2l1.9 1.9 3.5-3.6"/>',
    default: '<circle cx="12" cy="12" r="3"/><path d="M12 4.6v-1.6M12 21v-1.6M4.6 12H3M21 12h-1.6M6.8 6.8 5.7 5.7M18.3 18.3l-1.1-1.1M17.2 6.8l1.1-1.1M5.7 18.3l1.1-1.1"/>'
  };

  const TOOLTIPS = {
    home: "Home",
    forums: "Forums",
    blog: "Blog",
    calendar: "Calendar",
    messages: "Messages",
    activity: "Activity",
    account: "Account",
    admin: "Admin"
  };

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function iconSvg(name) {
    return `<svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.default}</svg>`;
  }

  function resolveItems() {
    const builderItems = window.NavigationBuilderSystem?.getPublicItems?.();

    if (Array.isArray(builderItems) && builderItems.length) {
      return builderItems
        .map((item) => ({ route: String(item.route || item.id || ""), label: String(item.label || item.route || "") }))
        .filter((item) => item.route);
    }

    return Object.values(window.RegistryEngine?.getAll?.() || {})
      .filter((route) =>
        route &&
        route.type === "page" &&
        route.enabled !== false &&
        route.nav !== false
      )
      .map((route) => ({
        route: String(route.id),
        label: String(route.label || route.title || route.id)
      }));
  }

  function sortItems(items) {
    return [...items].sort((a, b) => {
      const ai = RAIL_ORDER.indexOf(a.route);
      const bi = RAIL_ORDER.indexOf(b.route);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.label.localeCompare(b.label);
    });
  }

  function currentUser() {
    return window.UserCoreSystem?.getCurrentUser?.() || null;
  }

  function railLink(item, activeRoute) {
    const active = item.route === activeRoute;
    const tip = TOOLTIPS[item.route] || item.label;
    return `
      <button
        type="button"
        class="nav-item${active ? " is-active" : ""}"
        data-route="${escape(item.route)}"
        aria-current="${active ? "page" : "false"}"
        aria-label="${escape(tip)}"
        data-tooltip="${escape(tip)}"
        onclick="Runtime.navigate('${escape(item.route)}')">
        ${iconSvg(item.route)}
      </button>
    `;
  }

  function renderRail(activeRoute) {
    const items = sortItems(resolveItems());
    const primary = items.filter((item) => ["home", "forums", "blog", "calendar", "messages"].includes(item.route));
    const secondary = items.filter((item) => !primary.includes(item));

    return `
      ${primary.map((item) => railLink(item, activeRoute)).join("")}
      ${secondary.length ? `<div class="rail-divider" role="presentation"></div>` : ""}
      ${secondary.map((item) => railLink(item, activeRoute)).join("")}
    `;
  }

  function renderRailLogo() {
    return `
      <a class="rail-logo-link" href="#home" aria-label="Webby home" onclick="Runtime.navigate('home')">
        <img src="./assets/brand/webby-crystal.svg" alt="" width="38" height="38" />
      </a>
    `;
  }

  function renderBrand() {
    const config = ConfigLoader?.get?.() || {};
    const theme = config.themeSettings || {};
    const logoText = theme.logoText || config.siteName || "WebbyOS";
    const wordmark = String(logoText).split(" ")[0];

    return `
      <a class="wordmark" href="#home" onclick="Runtime.navigate('home')">
        <span class="wordmark-mark" aria-hidden="true">
          <img src="./assets/brand/webby-crystal.svg" alt="" width="26" height="26" />
        </span>
        <span class="wordmark-text">${escape(wordmark)}</span>
      </a>
    `;
  }

  function renderSearch() {
    const items = sortItems(resolveItems());
    const targets = escape(JSON.stringify(items));

    return `
      <form class="search-palette" role="search" autocomplete="off"
            data-targets="${targets}"
            onsubmit="return LayoutEngine.submitSearch(event)">
        <span class="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="11" cy="11" r="6"/><path d="M15.6 15.6 20 20"/>
          </svg>
        </span>
        <input id="webbySearch" type="search" name="q" placeholder="Search Webby..."
               aria-label="Search Webby"
               oninput="LayoutEngine.updateSearch()"
               onkeydown="LayoutEngine.searchKeydown(event)" />
        <kbd class="search-kbd">Ctrl <span>K</span></kbd>
        <div id="webbySearchResults" class="search-results" hidden></div>
      </form>
    `;
  }

  function searchTargets() {
    const form = document.querySelector(".search-palette");
    if (!form) return [];
    try {
      const raw = JSON.parse(form.dataset.targets || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      return [];
    }
  }

  function updateSearch() {
    const input = document.getElementById("webbySearch");
    const panel = document.getElementById("webbySearchResults");
    if (!input || !panel) return;

    const query = input.value.trim().toLowerCase();
    if (!query) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    const matches = searchTargets()
      .filter((item) => item && (item.label || "").toLowerCase().includes(query))
      .slice(0, 6);

    if (!matches.length) {
      panel.hidden = false;
      panel.innerHTML = `<button type="button" class="search-empty" disabled>No matches</button>`;
      return;
    }

    panel.hidden = false;
    panel.innerHTML = matches
      .map((item) => `<button type="button" class="search-result" onclick="LayoutEngine.goToSearch('${escape(item.route)}')">${escape(item.label)}</button>`)
      .join("");
  }

  function goToSearch(route) {
    const input = document.getElementById("webbySearch");
    const panel = document.getElementById("webbySearchResults");
    if (input) input.value = "";
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (route) Runtime.navigate(route);
  }

  function submitSearch(event) {
    event.preventDefault();
    const input = document.getElementById("webbySearch");
    const query = input?.value?.trim().toLowerCase() || "";
    if (!query) return false;

    const match = searchTargets().find((item) => (item.label || "").toLowerCase().includes(query));
    goToSearch(match ? match.route : "forums");
    return false;
  }

  function searchKeydown(event) {
    if (event.key === "Escape") {
      event.target.value = "";
      updateSearch();
    }
  }

  function focusSearch() {
    document.getElementById("webbySearch")?.focus();
  }

  function renderActions() {
    const user = currentUser();
    const avatar = user?.avatar || "./assets/brand/webby-avatar.svg";
    const name = user?.displayName || user?.username || "Guest";
    const unread = window.NotificationCoreSystem?.getUnreadCount?.();

    return `
      <button type="button" class="action-button" aria-label="Notifications"
              onclick="Runtime.navigate('account')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.4 1.5 5.4H5S6.5 14 6.5 10z"/>
          <path d="M10.2 18.4a2 2 0 0 0 3.6 0"/>
        </svg>
        ${Number(unread) > 0 ? `<span class="action-dot" aria-hidden="true"></span>` : ""}
      </button>

      <button type="button" class="topbar-account" aria-label="Account" onclick="Runtime.navigate('account')">
        <img class="topbar-avatar" src="${escape(avatar)}" alt="" width="34" height="34" />
        <span class="topbar-name">${escape(name)}</span>
        <svg class="topbar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M7 10l5 5 5-5"/>
        </svg>
      </button>
    `;
  }

  async function load(name = "default") {
    const layoutName = typeof name === "string" && name.trim()
      ? name.trim()
      : "default";

    if (loading.has(layoutName)) {
      Diagnostics?.warn?.("[LayoutEngine] recursive layout load blocked", { layoutName });
      return fallbackLayout();
    }

    loading.add(layoutName);

    try {
      const override = ConfigLoader?.get?.()?.settings?.templateOverrides?.[`layouts/${layoutName}.html`];
      if (typeof override === "string" && override.trim()) {
        return ensureMainSlot(override, layoutName);
      }

      const res = await fetch(`./layouts/${layoutName}.html`);

      if (!res.ok) {
        Diagnostics?.warn?.("[LayoutEngine] layout missing, using fallback", { layoutName });
        return fallbackLayout();
      }

      const html = await res.text();

      Lifecycle?.emit?.("layout:mount", {
        layout: layoutName
      });

      return ensureMainSlot(html, layoutName);

    } catch (err) {
      Diagnostics?.error?.("[LayoutEngine] layout load failed", {
        layoutName,
        error: err?.message || String(err)
      });

      return fallbackLayout();

    } finally {
      loading.delete(layoutName);
    }
  }

  function ensureMainSlot(html, layoutName) {
    if (String(html || "").includes("{{slot:main}}")) {
      return html;
    }

    Diagnostics?.warn?.("[LayoutEngine] layout missing main slot", { layoutName });
    return `${html}<main id="layout-slot">{{slot:main}}</main>`;
  }

  function fallbackLayout() {
    return `
      <div class="app-shell">
        <div class="app-background" aria-hidden="true"><div class="app-background-art"></div></div>

        <nav class="nav-rail" aria-label="Primary">
          <div class="rail-logo">{{slot:railLogo}}</div>
          <div class="rail-items">{{slot:rail}}</div>
        </nav>

        <div class="app-main">
          <header class="topbar">
            <div class="topbar-brand">{{slot:brand}}</div>
            <div class="topbar-search">{{slot:search}}</div>
            <div class="topbar-actions">{{slot:nav}}</div>
          </header>

          <main id="layout-slot">
            {{slot:main}}
          </main>
        </div>

        <nav class="bottom-nav" aria-label="Primary mobile">{{slot:rail}}</nav>
      </div>
    `;
  }

  function inject(layout, content, context = {}) {
    const route = typeof context.route === "string" ? context.route : "";

    return String(layout || fallbackLayout())
      .replace(/{{slot:main}}/g, content || "")
      .replace(/{{slot:brand}}/g, renderBrand())
      .replace(/{{slot:nav}}/g, renderActions())
      .replace(/{{slot:railLogo}}/g, renderRailLogo())
      .replace(/{{slot:rail}}/g, renderRail(route))
      .replace(/{{slot:search}}/g, renderSearch())
      .replace(/{{slot:route}}/g, escape(route));
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
      }
    });
  }

  return {
    load,
    inject,
    renderSearch,
    renderRail,
    updateSearch,
    submitSearch,
    searchKeydown,
    goToSearch,
    focusSearch
  };

})();

window.LayoutEngine = LayoutEngine;
