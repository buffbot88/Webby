const AdminSystemCore = (() => {

  const state = {
    visible: false,
    activeTab: "runtime",
    activeCategory: "overview",
    activeSub: "overview.dashboard",
    statusMessage: null
  };

  const editableTemplates = window.AdminCoreTemplates || [
    {
      id: "layouts/default.html",
      label: "Default Layout",
      type: "layout",
      path: "./layouts/default.html",
      requiredToken: "{{slot:main}}"
    },
    {
      id: "assets/theme.css",
      label: "Theme Stylesheet",
      type: "css",
      path: "./assets/theme.css"
    }
  ];

  const adminSections = window.AdminCoreSections || {
    overview: {
      label: "Overview",
      subs: [
        { id: "overview.dashboard", label: "Dashboard", render: "overviewDashboard" }
      ]
    },
    site: {
      label: "Site",
      subs: [
        { id: "site.general", label: "General Settings", render: "siteGeneral" },
        { id: "site.navigation", label: "Navigation", render: "builderNavigation" },
        { id: "site.features", label: "Feature Toggles", render: "siteFeatures" },
        { id: "site.mode", label: "Site Mode", render: "siteMode" }
      ]
    },
    community: {
      label: "Community",
      subs: [
        { id: "community.forums", label: "Forums", render: "communityForums" },
        { id: "community.messaging", label: "Messaging", render: "communityMessaging" },
        { id: "community.notifications", label: "Notifications", render: "communityNotifications" },
        { id: "community.reputation", label: "Reputation", render: "communityReputation" },
        { id: "community.moderation", label: "Moderation", render: "communityModeration" },
        { id: "community.activity", label: "Activity Feed", render: "communityActivity" }
      ]
    },
    content: {
      label: "Content",
      subs: [
        { id: "content.blog", label: "Blog", render: "contentBlog" },
        { id: "content.calendar", label: "Calendar", render: "contentCalendar" },
        { id: "content.categories", label: "Categories", render: "contentCategories" },
        { id: "content.tags", label: "Tags", render: "contentTags" },
        { id: "content.revisions", label: "Revisions", render: "contentRevisions" },
        { id: "content.search", label: "Search Index", render: "contentSearch" },
        { id: "content.publishing", label: "Publishing Rules", render: "contentPublishing" }
      ]
    },
    users: {
      label: "Users & Roles",
      subs: [
        { id: "users.list", label: "Users", render: "usersList" },
        { id: "users.profiles", label: "Profiles", render: "usersProfiles" },
        { id: "users.roles", label: "Roles", render: "usersRoles" },
        { id: "users.status", label: "Account Status", render: "usersStatus" },
        { id: "users.warnings", label: "Warnings / Suspensions", render: "usersWarnings" }
      ]
    },
    permissions: {
      label: "Permissions",
      subs: [
        { id: "permissions.capabilities", label: "Capabilities", render: "permissionsCapabilities" },
        { id: "permissions.routes", label: "Route Permissions", render: "permissionsRoutes" },
        { id: "permissions.modules", label: "Module Permissions", render: "permissionsModules" },
        { id: "permissions.roles", label: "Role Mapping", render: "permissionsRoles" },
        { id: "permissions.review", label: "Access Review", render: "permissionsReview" }
      ]
    },
    appearance: {
      label: "Appearance",
      subs: [
        { id: "appearance.theme", label: "Style Manager", render: "appearanceTheme" },
        { id: "appearance.stylevars", label: "StyleVars", render: "appearanceStyleVars" },
        { id: "appearance.css", label: "CSS Editor", render: "appearanceCss" },
        { id: "appearance.templates", label: "Template Editor", render: "appearanceTemplates" },
        { id: "appearance.replacements", label: "Replacement Variables", render: "appearanceReplacements" },
        { id: "appearance.colors", label: "Colors", render: "appearanceColors" },
        { id: "appearance.typography", label: "Typography", render: "appearanceTypography" },
        { id: "appearance.brand", label: "Brand Visuals", render: "appearanceBrand" },
        { id: "appearance.density", label: "Spacing / Density", render: "appearanceDensity" }
      ]
    },
    builders: {
      label: "Builders",
      subs: [
        { id: "builders.homepage", label: "Homepage", render: "builderHomepage" },
        { id: "builders.widgets", label: "Widgets", render: "builderWidgets" },
        { id: "builders.visibility", label: "Module Visibility", render: "builderVisibility" },
        { id: "builders.layouts", label: "Layouts", render: "builderLayouts" }
      ]
    },
    extensions: {
      label: "Extensions",
      subs: [
        { id: "extensions.packages", label: "Packages", render: "extensionsPackages" },
        { id: "extensions.modules", label: "Modules", render: "extensionsModules" },
        { id: "extensions.plugins", label: "Plugins", render: "extensionsPlugins" },
        { id: "extensions.themes", label: "Themes", render: "extensionsThemes" },
        { id: "extensions.widgets", label: "Widgets", render: "extensionsWidgets" },
        { id: "extensions.diagnostics", label: "Package Diagnostics", render: "extensionsDiagnostics" }
      ]
    },
    maintenance: {
      label: "Maintenance",
      subs: [
        { id: "maintenance.cleanup", label: "Cleanup", render: "maintenanceCleanup" },
        { id: "maintenance.cache", label: "Cache / Search Rebuild", render: "maintenanceCache" },
        { id: "maintenance.diagnostics", label: "Diagnostics Export", render: "maintenanceDiagnostics" },
        { id: "maintenance.database", label: "Database / Stores", render: "maintenanceDatabase" },
        { id: "maintenance.media", label: "Media Health", render: "maintenanceMedia" },
        { id: "maintenance.repair", label: "Repair Tools", render: "maintenanceRepair" }
      ]
    },
    system: {
      label: "System",
      subs: [
        { id: "system.runtime", label: "Runtime", render: "systemRuntime" },
        { id: "system.registry", label: "Registry", render: "systemRegistry" },
        { id: "system.modules", label: "Modules", render: "systemModules" },
        { id: "system.plugins", label: "Plugins", render: "systemPlugins" },
        { id: "system.safeMode", label: "Safe Mode", render: "systemSafeMode" },
        { id: "system.diagnostics", label: "Diagnostics", render: "systemDiagnostics" },
        { id: "system.inspector", label: "RuntimeInspector", render: "systemInspector" }
      ]
    }
  };

  let panel = null;
  let button = null;

  // Settings forms rendered in the current panel. Each entry records where the
  // values are persisted so the Save handler can rebuild the exact group.
  const settingsForms = new Map();

  const TYPOGRAPHY_FONT_OPTIONS = [
    ["inherit", "Theme default"],
    ["Cinzel, serif", "Cinzel (display)"],
    ["Inter, system-ui, sans-serif", "Inter (interface)"],
    ["Georgia, 'Times New Roman', serif", "Georgia"],
    ["'Courier New', monospace", "Courier New"],
    ["system-ui, sans-serif", "System UI"]
  ];

  const TYPOGRAPHY_BASE_FONT = 16;
  const LAYOUT_CONTENT_MAX = 1380;

  function readSettingsGroup(path) {
    const settings = window.ConfigLoader?.get?.()?.settings || {};
    let cursor = settings;
    for (const segment of path) {
      cursor = cursor ? cursor[segment] : undefined;
      if (!cursor) break;
    }
    return cursor && typeof cursor === "object" ? cursor : {};
  }

  function applyNestedSettingsUpdate(path, value) {
    const current = window.ConfigLoader?.get?.() || {};
    const settings = { ...(current.settings || {}) };
    let cursor = settings;
    path.forEach((segment, index) => {
      if (index === path.length - 1) {
        cursor[segment] = value;
        return;
      }
      cursor[segment] = { ...(cursor[segment] || {}) };
      cursor = cursor[segment];
    });
    const next = window.ConfigLoader?.mergeConfig?.(current, { settings }) || current;
    return window.ConfigLoader?.apply?.(next) || { success: false, error: "ConfigLoader unavailable" };
  }

  function settingsFieldId(formId, key) {
    return `adminSet_${formId}_${key}`;
  }

  function renderSettingsControl(formId, field) {
    const id = settingsFieldId(formId, field.key);
    const inputStyle = "width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f8fafc;";
    if (field.type === "checkbox") {
      return `<label class="admin-builder-check admin-builder-card"><input id="${id}" type="checkbox" ${field.value ? "checked" : ""} /> ${escapeText(field.label)}</label>`;
    }
    if (field.type === "select") {
      return `<label style="display:grid;gap:6px;font-size:12px;color:#cbd5e1;">${escapeText(field.label)}
        <select id="${id}" style="${inputStyle}">
          ${(field.options || []).map(([optionValue, optionLabel]) => `<option value="${escapeText(optionValue)}" ${optionValue === field.value ? "selected" : ""}>${escapeText(optionLabel)}</option>`).join("")}
        </select></label>`;
    }
    if (field.type === "textarea") {
      return `<label style="display:grid;gap:6px;font-size:12px;color:#cbd5e1;">${escapeText(field.label)}
        <textarea id="${id}" rows="3" style="${inputStyle}">${escapeText(field.value)}</textarea></label>`;
    }
    const type = field.type === "number" ? "number" : "text";
    const range = field.type === "number" ? ` min="${field.min ?? 0}" max="${field.max ?? 100000}"` : "";
    return `<label style="display:grid;gap:6px;font-size:12px;color:#cbd5e1;">${escapeText(field.label)}
      <input id="${id}" type="${type}"${range} value="${escapeText(String(field.value))}" placeholder="${escapeText(field.placeholder || "")}" style="${inputStyle}" /></label>`;
  }

  function renderSettingsCard(spec) {
    const group = readSettingsGroup(spec.path);
    const resolved = {
      ...spec,
      fields: spec.fields.map((field) => ({ ...field, value: group[field.key] ?? field.default }))
    };
    settingsForms.set(resolved.id, resolved);
    return `
      <div class="admin-builder-card">
        <div class="admin-builder-title">${escapeText(resolved.title)}</div>
        <div class="admin-builder-note">${escapeText(resolved.note)}</div>
        ${resolved.fields.map((field) => renderSettingsControl(resolved.id, field)).join("")}
        <button onclick="window.AdminCoreActions.saveSettingsForm(${jsAttrArg(resolved.id)})">Save ${escapeText(resolved.title)}</button>
      </div>
    `;
  }

  function saveSettingsForm(formId) {
    if (!requireAdminMutation("settings save")) return;
    const spec = settingsForms.get(formId);
    if (!spec) {
      state.statusMessage = `Settings save failed: unknown form ${formId}.`;
      renderPanel();
      return;
    }
    const value = {};
    spec.fields.forEach((field) => {
      const element = document.getElementById(settingsFieldId(formId, field.key));
      if (!element) {
        value[field.key] = field.value;
        return;
      }
      if (field.type === "checkbox") value[field.key] = element.checked === true;
      else if (field.type === "number") value[field.key] = Number(element.value);
      else value[field.key] = element.value;
    });
    const result = applyNestedSettingsUpdate(spec.path, value);
    if (spec.id === "appearance-typography") applyTypographySettings();
    state.statusMessage = result.success ? `${spec.title} saved.` : `Settings save failed: ${result.error}`;
    renderPanel();
  }

  // Actions introduced alongside the settings forms. Declaring them early keeps
  // inline handlers working even though the main action surface is assembled at
  // the end of the module.
  function installActionSurface() {
    window.AdminCoreActions = {
      saveSettingsForm,
      runCleanupPurgeTrash,
      runCleanupSessions,
      runRepairSearchIndex,
      runRepairPackages,
      runRepairConfig,
      issueWarning,
      issueSuspension,
      liftModerationRecord
    };
  }

  function attachActionSurface() {
    if (window.AdminSystemCore) {
      Object.assign(window.AdminSystemCore, window.AdminCoreActions || {});
    }
  }

  installActionSurface();

  function escapeText(value) {
    if (window.AdminCoreUtils?.escapeText) {
      return window.AdminCoreUtils.escapeText(value);
    }
    if (typeof window.Diagnostics?.escapeText === "function") {
      return window.Diagnostics.escapeText(value);
    }
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function jsArg(value) {
    if (window.AdminCoreUtils?.jsArg) {
      return window.AdminCoreUtils.jsArg(value);
    }
    return JSON.stringify(String(value ?? "")).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  }

  function jsAttrArg(value) {
    return escapeText(jsArg(value));
  }

  function toArray(value) {
    if (window.AdminCoreUtils?.toArray) {
      return window.AdminCoreUtils.toArray(value);
    }
    return Array.isArray(value) ? value : [];
  }

  function getDiagnostics() {
    if (window.AdminCoreUtils?.getDiagnostics) {
      return window.AdminCoreUtils.getDiagnostics();
    }
    return window.Diagnostics || {
      getErrors: () => [],
      getWarnings: () => [],
      getLogs: () => [],
      escapeText
    };
  }

  function getOverlayRoot() {
    return document.getElementById("overlayLayer") || document.body;
  }

  function createPanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "adminControlPanel";
    getOverlayRoot().appendChild(panel);
    return panel;
  }

  function hasAdminAccess() {
    return window.UserCoreSystem?.can?.("platform.admin.access") === true;
  }

  function createButton() {
    if (button) return button;
    button = document.createElement("button");
    button.id = "adminControlToggle";
    button.type = "button";
    button.textContent = "Admin Panel";
    button.addEventListener("click", () => {
      if (!hasAdminAccess()) {
        return;
      }
      togglePanel();
    });
    getOverlayRoot().appendChild(button);
    return button;
  }

  function init() {
    createPanel();
    createButton();
    updateButtonState();
    applyTypographySettings();
    attachActionSurface();
    window.Lifecycle?.on?.("user:login", updateButtonState);
    window.Lifecycle?.on?.("user:logout", updateButtonState);
    window.Lifecycle?.on?.("user:register", updateButtonState);
  }

  function updateButtonState() {
    if (!button) return;
    const enabled = getSharedState().config?.admin?.enabled !== false;
    const hasAccess = hasAdminAccess();
    button.style.display = enabled && hasAccess ? "block" : "none";
    if (button.style.display === "block") {
      button.textContent = "Admin Panel";
    }
    if (!hasAccess) {
      hidePanel();
    }
  }

  function requireAuth(route) {
    if (!route) return true;
    return window.UserCoreSystem?.isRouteAccessible(route) ?? true;
  }

  function logout() {
    if (window.UserCoreSystem?.logout) {
      window.UserCoreSystem.logout();
    }
    state.visible = false;
    if (panel) panel.style.display = "none";
    updateButtonState();
  }

  function openPanel() {
    const shared = getSharedState();
    if (!shared.config?.admin?.enabled) return;
    if (!hasAdminAccess()) {
      updateButtonState();
      return;
    }
    if (!panel) createPanel();
    panel.style.display = "block";
    state.visible = true;
    renderPanel();
  }

  function togglePanel() {
    state.visible = !state.visible;
    if (state.visible) {
      openPanel();
    } else {
      hidePanel();
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    if (state.visible) renderPanel();
  }

  function getSharedState() {
    return window.Runtime?.getSharedState?.() || { activeRoute: null, currentLayout: null, safeMode: {}, config: {}, registry: {}, moduleHealth: [], pluginHealth: [], booted: false };
  }

  function getSafeModeActive() {
    const safeMode = getSharedState().safeMode || {};
    return Object.values(safeMode).some((value) => !!value);
  }

  function canEditRegistry() {
    return hasAdminAccess() || getSharedState().safeMode?.safeBoot;
  }

  function requireAdminMutation(actionLabel = "action") {
    if (hasAdminAccess() || getSharedState().safeMode?.safeBoot) {
      return true;
    }
    state.statusMessage = `Admin ${actionLabel} denied: admin access is required.`;
    if (state.visible) renderPanel();
    return false;
  }

  function renderPanel() {
    if (!panel) createPanel();
    ensureActiveSub();

    const shared = getSharedState();
    const runtime = {
      route: shared.activeRoute,
      booted: shared.booted,
      safeMode: shared.safeMode,
      recovery: window.Runtime?.getState?.()?.recovery || {}
    };
    const config = shared.config || {};
    const registryRoutes = shared.registry || {};
    const modules = shared.moduleHealth || [];
    const plugins = shared.pluginHealth || [];
    const diagnostics = getDiagnostics();
    const errors = diagnostics.getErrors().slice(-8);
    const warnings = diagnostics.getWarnings().slice(-8);
    const logs = diagnostics.getLogs().slice(-8);
    const safeModeActive = getSafeModeActive();
    const canEditRoutes = canEditRegistry();

    // New fullscreen admin console shell: sidebar + main workspace
    panel.innerHTML = `
      <div class="admin-console">
        <aside class="admin-console-sidebar">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div class="admin-console-title">WebbyOS Admin Console</div>
              <div class="admin-console-subtitle">Control panel for runtime, registry, modules, and site settings</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
              <button class="admin-button-danger" onclick="window.AdminSystemCore.logout()">Logout</button>
              <button class="admin-button-secondary" onclick="window.AdminSystemCore.hidePanel()">Close</button>
            </div>
          </div>
          <div style="margin-top:8px;">
            ${Object.entries(adminSections).map(([id, section]) => renderCategoryItem(id, section.label)).join("")}
          </div>
        </aside>
        <main class="admin-console-main">
          <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div class="admin-console-toolbar">
              <div class="admin-console-title" style="font-size:15px;margin-bottom:4px;">${escapeText(state.activeCategory.toUpperCase())}</div>
              <div class="admin-console-subtitle">${escapeText(state.activeSub || "Overview")}</div>
            </div>
            <div class="admin-actions">
              <div class="admin-badge">Booted: ${runtime.booted ? "Yes" : "No"}</div>
              <div class="admin-badge">Route: ${escapeText(runtime.route || "none")}</div>
              <div class="admin-badge">Safe mode: ${safeModeActive ? "enabled" : "disabled"}</div>
            </div>
          </div>
          <div id="adminConsoleContent" style="min-height:400px;">
            ${renderCategoryContent(state.activeCategory)}
          </div>
          <div style="margin-top:12px;">
            <div class="admin-muted">Action state</div>
            <div class="${state.statusMessage?.includes("failed") ? "admin-badge admin-badge-danger" : "admin-badge admin-badge-success"}">${escapeText(state.statusMessage || "Ready")}</div>
          </div>
        </main>
      </div>
    `;
  }

  function renderCategoryItem(id, label) {
    const isActive = state.activeCategory === id;
    const subnav = isActive && adminSections[id]?.subs?.length ? `
      <div class="admin-console-subnav">
        ${adminSections[id].subs.map((s) => `<div class="admin-console-subnav-item ${state.activeSub === s.id ? 'active' : ''}" onclick="window.AdminSystemCore.switchSub(${jsAttrArg(s.id)})">${escapeText(s.label)}</div>`).join("")}
      </div>
    ` : "";

    return `<div>
      <div class="admin-console-category ${isActive ? 'active' : ''}" onclick="window.AdminSystemCore.switchCategory(${jsAttrArg(id)})">${escapeText(label)}</div>
      ${subnav}
    </div>`;
  }

  function getDefaultSub(category) {
    return adminSections[category]?.subs?.[0]?.id || null;
  }

  function getSubRecord(subId) {
    return Object.values(adminSections)
      .flatMap((section) => section.subs || [])
      .find((sub) => sub.id === subId);
  }

  function ensureActiveSub() {
    if (!adminSections[state.activeCategory]) {
      state.activeCategory = "overview";
    }

    const section = adminSections[state.activeCategory];
    if (!section.subs.some((sub) => sub.id === state.activeSub)) {
      state.activeSub = getDefaultSub(state.activeCategory);
    }
  }

  function switchCategory(cat) {
    if (!adminSections[cat]) return;
    state.activeCategory = cat;
    state.activeSub = getDefaultSub(cat);
    if (state.visible) renderPanel();
  }

  function switchSub(sub) {
    const record = getSubRecord(sub);
    if (!record) return;
    state.activeCategory = sub.split(".")[0];
    state.activeSub = sub;
    if (state.visible) renderPanel();
  }

  function renderCategoryContent(category) {
    ensureActiveSub();
    const sub = getSubRecord(state.activeSub);
    if (!sub) return renderComingSoonCard("Unknown section", "This admin section is not registered.");
    return renderSubContent(sub.render);
  }

  function getAdminContext() {
    const shared = getSharedState();
    return {
      shared,
      runtime: {
        route: shared.activeRoute,
        booted: shared.booted,
        safeMode: shared.safeMode,
        recovery: window.Runtime?.getState?.()?.recovery || {}
      },
      config: shared.config || {},
      registryRoutes: shared.registry || {},
      modules: shared.moduleHealth || [],
      plugins: shared.pluginHealth || [],
      warnings: getDiagnostics().getWarnings().slice(-8),
      errors: getDiagnostics().getErrors().slice(-8),
      logs: getDiagnostics().getLogs().slice(-8),
      safeModeActive: getSafeModeActive(),
      canEditRoutes: canEditRegistry()
    };
  }

  function renderSubContent(renderKey) {
    const ctx = getAdminContext();
    switch (renderKey) {
      case "overviewDashboard":
        return renderOverviewDashboard(ctx);
      case "siteGeneral":
        return renderSiteGeneralTab(ctx);
      case "siteFeatures":
        return renderSiteFeaturesTab(ctx);
      case "siteMode":
        return renderSiteModeTab(ctx);
      case "communityForums":
        return renderCommunityForumTab();
      case "communityMessaging":
        return renderCommunityStoreSummary("Messaging", ["conversations", "messages"], "Direct message policy and delivery state for the community.", {
          id: "community-messaging",
          title: "Messaging Settings",
          note: "Direct message policy for the community.",
          path: ["community", "messaging"],
          fields: [
            { key: "enabled", label: "Enable direct messaging", type: "checkbox", default: true },
            { key: "maxParticipants", label: "Max participants per conversation", type: "number", default: 8, min: 2, max: 100 },
            { key: "allowAttachments", label: "Allow attachments", type: "checkbox", default: false },
            { key: "retentionDays", label: "Message retention (days, 0 = forever)", type: "number", default: 0, min: 0, max: 3650 },
            { key: "visibility", label: "New conversations visible to", type: "select", default: "participants", options: [["participants", "Participants only"], ["moderators", "Participants and moderators"]] }
          ]
        });
      case "communityNotifications":
        return renderCommunityStoreSummary("Notifications", ["notifications"], "Notification delivery and digest settings.", {
          id: "community-notifications",
          title: "Notification Settings",
          note: "Delivery rules for forum, content, and account notifications.",
          path: ["community", "notifications"],
          fields: [
            { key: "enabled", label: "Enable notifications", type: "checkbox", default: true },
            { key: "digestFrequency", label: "Digest frequency", type: "select", default: "instant", options: [["instant", "Instant"], ["hourly", "Hourly digest"], ["daily", "Daily digest"], ["off", "Off"]] },
            { key: "forumReplies", label: "Notify on forum replies", type: "checkbox", default: true },
            { key: "mentions", label: "Notify on mentions", type: "checkbox", default: true },
            { key: "announcements", label: "Notify on announcements", type: "checkbox", default: true },
            { key: "maxPerDigest", label: "Max notifications per digest", type: "number", default: 25, min: 1, max: 200 }
          ]
        });
      case "communityReputation":
        return renderCommunityStoreSummary("Reputation", ["reputation", "userBadges", "reactions"], "Reputation rules, badges, and scoring controls.", {
          id: "community-reputation",
          title: "Reputation Settings",
          note: "Score weights and badge milestones for community participation.",
          path: ["community", "reputation"],
          fields: [
            { key: "enabled", label: "Enable reputation scoring", type: "checkbox", default: true },
            { key: "threadCreatedPoints", label: "Points per new thread", type: "number", default: 5, min: 0, max: 100 },
            { key: "replyPoints", label: "Points per reply", type: "number", default: 2, min: 0, max: 100 },
            { key: "helpfulReceivedPoints", label: "Points per helpful mark", type: "number", default: 10, min: 0, max: 100 },
            { key: "blogPostPoints", label: "Points per published article", type: "number", default: 15, min: 0, max: 100 },
            { key: "badgeMilestones", label: "Badge milestones", type: "text", default: "trusted:100, elder:500", placeholder: "badge:score, badge:score" },
            { key: "showOnProfiles", label: "Show reputation on public profiles", type: "checkbox", default: true }
          ]
        });
      case "communityModeration":
        return renderCommunityStoreSummary("Moderation", ["reports", "moderationLogs", "userWarnings", "userSuspensions"], "Moderation queues, report policy, and reviewer summaries.", {
          id: "community-moderation",
          title: "Moderation Settings",
          note: "Report intake and reviewer defaults. Account state lives under Users & Roles.",
          path: ["community", "moderation"],
          fields: [
            { key: "requireReportReason", label: "Require a reason on every report", type: "checkbox", default: true },
            { key: "autoHideThreshold", label: "Reports before content is auto-hidden (0 = never)", type: "number", default: 3, min: 0, max: 50 },
            { key: "defaultSuspensionHours", label: "Default suspension length (hours)", type: "number", default: 24, min: 1, max: 8760 },
            { key: "allowSelfReview", label: "Allow reporters to close their own report", type: "checkbox", default: false },
            { key: "notifyOnReport", label: "Notify moderators on new reports", type: "checkbox", default: true },
            { key: "reportQueueSize", label: "Reports shown per queue page", type: "number", default: 50, min: 10, max: 200 }
          ]
        });
      case "communityActivity":
        return renderCommunityStoreSummary("Activity Feed", ["activityFeed"], "Activity feed visibility and aggregation settings.", {
          id: "community-activity",
          title: "Activity Feed Settings",
          note: "Which events enter the feed and how much of it stays visible.",
          path: ["community", "activity"],
          fields: [
            { key: "enabled", label: "Enable the activity feed", type: "checkbox", default: true },
            { key: "publicFeed", label: "Public visitors can read the feed", type: "checkbox", default: true },
            { key: "showReactions", label: "Include reactions", type: "checkbox", default: true },
            { key: "showForumReplies", label: "Include forum replies", type: "checkbox", default: true },
            { key: "showRegistrations", label: "Include new member joins", type: "checkbox", default: false },
            { key: "retentionDays", label: "Feed retention (days, 0 = forever)", type: "number", default: 0, min: 0, max: 3650 },
            { key: "pageSize", label: "Feed items per page", type: "number", default: 20, min: 5, max: 100 }
          ]
        });
      case "contentBlog":
        return renderContentWorkflowSummary("Blog", "Blog publishing workflow settings and post defaults.", {
          id: "content-blog",
          title: "Blog Defaults",
          note: "Defaults applied when authors write new articles.",
          path: ["content", "blog"],
          fields: [
            { key: "requireApproval", label: "Require reviewer approval", type: "checkbox", default: false },
            { key: "defaultStatus", label: "Default status", type: "select", default: "draft", options: [["draft", "Draft"], ["published", "Published"]] },
            { key: "allowComments", label: "Allow comments", type: "checkbox", default: true },
            { key: "allowScheduling", label: "Allow scheduled posts", type: "checkbox", default: true },
            { key: "postsPerPage", label: "Articles per page", type: "number", default: 10, min: 3, max: 50 },
            { key: "defaultCategory", label: "Default category", type: "text", default: "general" }
          ]
        });
      case "contentCalendar":
        return renderContentWorkflowSummary("Calendar", "Calendar publishing workflow settings and event defaults.", {
          id: "content-calendar",
          title: "Calendar Defaults",
          note: "Defaults applied when members create new events.",
          path: ["content", "calendar"],
          fields: [
            { key: "requireApproval", label: "Require reviewer approval", type: "checkbox", default: false },
            { key: "defaultStatus", label: "Default status", type: "select", default: "draft", options: [["draft", "Draft"], ["published", "Published"]] },
            { key: "defaultDurationMinutes", label: "Default event length (minutes)", type: "number", default: 60, min: 15, max: 1440 },
            { key: "allowPublicSubmission", label: "Members may submit events", type: "checkbox", default: true },
            { key: "allowRecurring", label: "Allow recurring events", type: "checkbox", default: true },
            { key: "weekStartsOn", label: "Week starts on", type: "select", default: "sunday", options: [["sunday", "Sunday"], ["monday", "Monday"]] }
          ]
        });
      case "contentCategories":
        return renderCmsTab("categories");
      case "contentTags":
        return renderCmsTab("tags");
      case "contentRevisions":
        return renderRevisionsTab();
      case "contentSearch":
        return renderSearchIndexTab();
      case "contentPublishing":
        return renderContentPublishingTab(ctx);
      case "usersList":
        return renderUsersListTab();
      case "usersProfiles":
        return renderUsersProfilesTab();
      case "usersRoles":
        return renderUsersRolesTab();
      case "usersStatus":
        return renderAccountStatusTab(ctx);
      case "usersWarnings":
        return renderUsersWarningsTab();
      case "permissionsCapabilities":
      case "permissionsRoles":
        return renderPermissionsTab();
      case "permissionsRoutes":
        return renderRoutePermissionsTab(ctx);
      case "permissionsModules":
        return renderModulePermissionsTab();
      case "permissionsReview":
        return renderAccessReviewTab();
      case "appearanceTheme":
        return renderStyleManagerTab(ctx);
      case "appearanceStyleVars":
        return renderStyleVarsTab(ctx);
      case "appearanceCss":
        return renderCssEditorTab(ctx);
      case "appearanceTemplates":
        return renderTemplateEditorTab(ctx);
      case "appearanceReplacements":
        return renderReplacementVariablesTab(ctx);
      case "appearanceColors":
        return renderThemeColorsTab(ctx);
      case "appearanceTypography":
        return renderTypographyTab(ctx);
      case "appearanceBrand":
        return renderBrandVisualsTab(ctx);
      case "appearanceDensity":
        return renderThemeDensityTab(ctx);
      case "builderHomepage":
        return renderHomepageTab();
      case "builderNavigation":
        return renderNavigationTab();
      case "builderWidgets":
        return renderWidgetsTab();
      case "builderVisibility":
        return renderModuleVisibilityTab();
      case "builderLayouts":
        return renderLayoutsTab(ctx);
      case "extensionsPackages":
        return renderPackagesTab();
      case "extensionsModules":
        return renderPackageTypeTab("module");
      case "extensionsPlugins":
        return renderPackageTypeTab("plugin");
      case "extensionsWidgets":
        return renderPackageTypeTab("widget");
      case "extensionsThemes":
        return renderPackageTypeTab("theme");
      case "extensionsDiagnostics":
        return renderPackageDiagnosticsTab();
      case "maintenanceCleanup":
        return renderCleanupToolsTab(ctx);
      case "maintenanceCache":
        return renderSearchIndexTab("Cache / Search Rebuild");
      case "maintenanceDiagnostics":
        return renderDiagnosticsExportTab(ctx);
      case "maintenanceDatabase":
        return renderDatabaseSummaryTab();
      case "maintenanceMedia":
        return renderMediaTab();
      case "maintenanceRepair":
        return renderRepairToolsTab(ctx);
      case "systemRuntime":
        return renderRuntimeTab(ctx);
      case "systemRegistry":
        return renderRegistryTab(ctx);
      case "systemModules":
        return renderModulesTab({ modules: ctx.modules, registry: ctx.registryRoutes });
      case "systemPlugins":
        return renderPluginsTab({ plugins: ctx.plugins });
      case "systemSafeMode":
        return renderSafeModeTab(ctx);
      case "systemDiagnostics":
        return renderDiagnosticsTab(ctx);
      case "systemInspector":
        return renderRuntimeInspectorLauncher();
      default:
        return renderComingSoonCard("Admin Section", "Coming later: this admin section is registered but has no implemented workflow yet.");
    }
  }

  function renderTabButton(tab, label) {
    return `<button class="admin-tab ${state.activeTab === tab ? "active" : ""}" onclick="window.AdminSystemCore.switchTab(${jsAttrArg(tab)})">${escapeText(label)}</button>`;
  }

  function renderTabContent(tab, context) {
    switch (tab) {
      case "runtime":
        return renderRuntimeTab(context);
      case "registry":
        return renderRegistryTab(context);
      case "modules":
        return renderModulesTab(context);
      case "plugins":
        return renderPluginsTab(context);
      case "media":
        return renderMediaTab();
      case "cms":
        return renderCmsTab();
      case "theme":
        return renderThemeTab(context);
      case "navigation":
        return renderNavigationTab();
      case "homepage":
        return renderHomepageTab();
      case "widgets":
        return renderWidgetsTab();
      case "visibility":
        return renderModuleVisibilityTab();
      case "permissions":
        return renderPermissionsTab();
      default:
        return "";
    }
  }

  function renderComingSoonCard(title, body) {
    return `
      <div class="admin-panel admin-coming-soon">
        <div class="admin-panel-title">${escapeText(title)}</div>
        <div class="admin-muted">${escapeText(body)}</div>
      </div>
    `;
  }

  function renderOverviewDashboard({ runtime, config, registryRoutes, modules, plugins, warnings, errors }) {
    const users = window.UserCoreSystem?.listUsers?.() || [];
    const mediaCount = window.MediaCoreSystem?.getCachedCount?.() || getSharedState().mediaCount || 0;
    const packageSummary = window.PackageCoreSystem?.getPackageSummary?.() || {};
    return `
      <div class="admin-row-list">
        <div class="admin-panel">
          <div class="admin-panel-title">System Summary</div>
          <div class="admin-status-strip">
            <div class="admin-status-item">Site<br><span class="admin-badge">${escapeText(config.siteName || "WebbyOS")}</span></div>
            <div class="admin-status-item">Booted<br><span class="admin-badge">${runtime.booted ? "complete" : "pending"}</span></div>
            <div class="admin-status-item">Route<br><span class="admin-badge">${escapeText(runtime.route || "none")}</span></div>
            <div class="admin-status-item">Routes<br><span class="admin-badge">${Object.keys(registryRoutes || {}).length}</span></div>
            <div class="admin-status-item">Users<br><span class="admin-badge">${users.length}</span></div>
            <div class="admin-status-item">Media<br><span class="admin-badge">${mediaCount}</span></div>
            <div class="admin-status-item">Packages<br><span class="admin-badge">${packageSummary.total || getPackageRecords().length}</span></div>
            <div class="admin-status-item">Module health<br><span class="admin-badge">${modules.length}</span></div>
            <div class="admin-status-item">Plugin health<br><span class="admin-badge">${plugins.length}</span></div>
          </div>
        </div>
        <div class="admin-panel-grid">
          <div class="admin-panel">
            <div class="admin-panel-title">Recent Diagnostics</div>
            <div class="admin-actions">
              <span class="admin-badge admin-badge-warning">Warnings: ${warnings.length}</span>
              <span class="admin-badge admin-badge-danger">Errors: ${errors.length}</span>
            </div>
          </div>
          <div class="admin-panel">
            <div class="admin-panel-title">Quick Links</div>
            <div class="admin-actions">
              <button onclick="window.AdminSystemCore.switchCategory('site')">Site Settings</button>
              <button onclick="window.AdminSystemCore.switchCategory('builders')">Builders</button>
              <button onclick="window.AdminSystemCore.switchCategory('extensions')">Packages</button>
              <button onclick="window.AdminSystemCore.switchCategory('system')">System</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSiteGeneralTab({ config, registryRoutes }) {
    const settings = config.settings || {};
    const defaultRoute = settings.defaultRoute || "home";
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">General Site Settings</div>
          <div class="admin-builder-note">Site identity and default behavior. Visual design lives under Appearance.</div>
        </div>
        <div class="admin-builder-card">
          ${renderThemeField("Site name", "adminSiteName", config.siteName || "")}
          ${renderThemeField("Tagline", "adminSiteTagline", config.tagline || "")}
          <label style="display:grid;gap:6px;font-size:12px;color:#cbd5e1;">
            Default landing route
            <select id="adminDefaultRoute" style="width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f8fafc;">
              ${Object.keys(registryRoutes || {}).map((routeId) => `<option value="${escapeText(routeId)}" ${routeId === defaultRoute ? "selected" : ""}>${escapeText(routeId)}</option>`).join("")}
            </select>
          </label>
          <button onclick="window.AdminSystemCore.saveSiteSettings()">Save Site Settings</button>
        </div>
      </div>
    `;
  }

  function renderSiteFeaturesTab({ config }) {
    const features = config.features || {};
    const keys = Object.keys(features);
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Global Feature Toggles</div>
          <div class="admin-builder-note">Runtime feature flags that affect the public site.</div>
        </div>
        ${keys.length ? keys.map((key) => `
          <label class="admin-builder-check admin-builder-card">
            <input id="featureToggle_${key}" type="checkbox" ${features[key] ? "checked" : ""} />
            ${escapeText(key)}
          </label>
        `).join("") : renderComingSoonCard("No Feature Toggles", "No global feature flags are currently registered.")}
        ${keys.length ? `<button onclick="window.AdminSystemCore.saveFeatureToggles()">Save Feature Toggles</button>` : ""}
      </div>
    `;
  }

  function renderCommunityForumTab() {
    const registry = getSharedState().registry || {};
    setTimeout(() => loadContentInventoryPanel("adminForumInventory", [
      ["forumThread", "Threads"],
      ["forumPost", "Replies"]
    ]), 0);
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Forums ACP</div>
          <div class="admin-muted">Structured forum operations view: route state, content counts, moderation stores, and module refresh hooks.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Route<br><span class="admin-badge">${registry.forums ? "registered" : "missing"}</span></div>
            <div class="admin-status-item">Enabled<br><span class="admin-badge">${registry.forums?.enabled === false ? "no" : "yes"}</span></div>
            <div class="admin-status-item">UI module<br><span class="admin-badge">${window.ForumModuleUI?.refresh ? "ready" : "not loaded"}</span></div>
            <div class="admin-status-item">Moderation<br><span class="admin-badge">${window.ModerationCoreSystem?.listReports ? "ready" : "not loaded"}</span></div>
          </div>
          <div id="adminForumInventory" class="admin-status-strip" style="margin-top:10px;"><div class="admin-muted">Loading forum inventory...</div></div>
          <div class="admin-actions" style="margin-top:10px;">
            <button onclick="window.ForumModuleUI?.refresh?.()">Refresh Forum Module</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderCommunityStoreSummary(title, stores, emptyText, settings = null) {
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">${escapeText(title)}</div>
          <div class="admin-muted">${escapeText(emptyText)}</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            ${stores.map((store) => `<div class="admin-status-item">${escapeText(store)}<br><span class="admin-badge">${window.DataCoreSystem?.getStores?.().includes(store) ? "store ready" : "store unavailable"}</span></div>`).join("")}
          </div>
        </div>
        ${settings ? renderSettingsCard(settings) : ""}
      </div>
    `;
  }

  function renderContentWorkflowSummary(title, body, settings = null) {
    const route = (getSharedState().registry || {})[title.toLowerCase()];
    const contentType = title === "Blog" ? "blogPost" : title === "Calendar" ? "calendarEvent" : null;
    const moduleReady = title === "Blog" ? window.BlogModuleUI?.refresh : title === "Calendar" ? window.CalendarModuleUI?.refresh : null;
    if (contentType) {
      setTimeout(() => loadContentInventoryPanel(`admin${title}Inventory`, [[contentType, `${title} records`]]), 0);
    }
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">${escapeText(title)} Workflow</div>
          <div class="admin-muted">${escapeText(body)}</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Route<br><span class="admin-badge">${route ? "registered" : "missing"}</span></div>
            <div class="admin-status-item">Enabled<br><span class="admin-badge">${route?.enabled === false ? "no" : "yes"}</span></div>
            <div class="admin-status-item">Module UI<br><span class="admin-badge">${moduleReady ? "ready" : "not loaded"}</span></div>
            <div class="admin-status-item">Publishing<br><span class="admin-badge">${window.ContentCoreSystem?.listContent ? "ContentCore" : "unavailable"}</span></div>
          </div>
          ${contentType ? `<div id="admin${title}Inventory" class="admin-status-strip" style="margin-top:10px;"><div class="admin-muted">Loading ${escapeText(title.toLowerCase())} inventory...</div></div>` : ""}
          <div class="admin-actions" style="margin-top:10px;">
            <button onclick="window.${title === "Blog" ? "BlogModuleUI" : "CalendarModuleUI"}?.refresh?.()">Refresh ${escapeText(title)} Module</button>
          </div>
        </div>
        ${settings ? renderSettingsCard(settings) : ""}
      </div>
    `;
  }

  function renderSiteModeTab({ registryRoutes }) {
    const mode = readSettingsGroup(["siteMode"]);
    const currentMode = mode.mode || "public";
    const routes = Object.keys(registryRoutes || {}).length;
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Site Mode</div>
          <div class="admin-muted">Availability policy for the public site. The saved mode is read back here, so operators always see the live value instead of the last form submission.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Current mode<br><span class="admin-badge">${escapeText(currentMode)}</span></div>
            <div class="admin-status-item">Registered routes<br><span class="admin-badge">${routes}</span></div>
            <div class="admin-status-item">Admin access<br><span class="admin-badge">${hasAdminAccess() ? "verified" : "limited"}</span></div>
          </div>
        </div>
        ${renderSettingsCard({
          id: "site-mode",
          title: "Site Mode",
          note: "Public serves every visitor, Private requires a signed-in account, Maintenance shows the notice below to non-admin visitors.",
          path: ["siteMode"],
          fields: [
            { key: "mode", label: "Mode", type: "select", default: "public", options: [["public", "Public"], ["private", "Private (sign-in required)"], ["maintenance", "Maintenance"]] },
            { key: "notice", label: "Maintenance notice", type: "textarea", default: "WebbyOS is undergoing scheduled maintenance. Please check back shortly." },
            { key: "allowAdminBypass", label: "Keep admin access during maintenance", type: "checkbox", default: true },
            { key: "expectedReturn", label: "Expected return", type: "text", default: "", placeholder: "2026-01-01 09:00 UTC" }
          ]
        })}
      </div>
    `;
  }

  function renderContentPublishingTab() {
    const rules = readSettingsGroup(["publishing"]);
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Publishing Rules</div>
          <div class="admin-muted">Editorial defaults applied to new content across the Blog, Calendar, and CMS modules.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Approvals<br><span class="admin-badge">${rules.requireApproval ? "required" : "optional"}</span></div>
            <div class="admin-status-item">Default status<br><span class="admin-badge">${escapeText(rules.defaultStatus || "draft")}</span></div>
            <div class="admin-status-item">Scheduling<br><span class="admin-badge">${rules.allowScheduling === false ? "disabled" : "enabled"}</span></div>
            <div class="admin-status-item">ContentCore<br><span class="admin-badge">${window.ContentCoreSystem?.listContent ? "ready" : "unavailable"}</span></div>
          </div>
        </div>
        ${renderSettingsCard({
          id: "content-publishing",
          title: "Publishing Rules",
          note: "Cross-module editorial approvals and publishing defaults.",
          path: ["publishing"],
          fields: [
            { key: "requireApproval", label: "Require reviewer approval before publishing", type: "checkbox", default: false },
            { key: "defaultStatus", label: "Default status for new content", type: "select", default: "draft", options: [["draft", "Draft"], ["published", "Published"]] },
            { key: "allowScheduling", label: "Allow scheduled publishing", type: "checkbox", default: true },
            { key: "allowBackdating", label: "Allow backdated publish times", type: "checkbox", default: true },
            { key: "editorRoles", label: "Roles allowed to publish", type: "text", default: "admin, moderator" },
            { key: "maxDraftsPerAuthor", label: "Max drafts per author (0 = unlimited)", type: "number", default: 0, min: 0, max: 1000 }
          ]
        })}
      </div>
    `;
  }

  function renderAccountStatusTab() {
    setTimeout(() => loadAccountStatusPanel(), 0);
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Account Status</div>
          <div class="admin-muted">Verification, lockout, and suspension state per account, derived from the user store and the moderation stores.</div>
          <div id="adminAccountStatusPanel" class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-muted">Loading account state...</div>
          </div>
        </div>
        ${renderSettingsCard({
          id: "account-status",
          title: "Account Policy",
          note: "Lockout and verification policy stored in the settings store.",
          path: ["accountStatus"],
          fields: [
            { key: "requireVerification", label: "Require account verification", type: "checkbox", default: false },
            { key: "lockoutThreshold", label: "Failed logins before lockout", type: "number", default: 5, min: 0, max: 50 },
            { key: "lockoutMinutes", label: "Lockout duration (minutes)", type: "number", default: 15, min: 1, max: 1440 },
            { key: "autoSuspend", label: "Auto-suspend on repeated reports", type: "checkbox", default: false },
            { key: "reportsBeforeSuspend", label: "Reports before auto-suspend", type: "number", default: 3, min: 1, max: 50 }
          ]
        })}
      </div>
    `;
  }

  async function loadAccountStatusPanel() {
    const container = document.getElementById("adminAccountStatusPanel");
    if (!container) return;
    const users = window.UserCoreSystem?.listUsers?.() || [];
    const [warnings, suspensions] = await Promise.all([readStoreSafe("userWarnings"), readStoreSafe("userSuspensions")]);
    const activeWarnings = warnings.filter((item) => item.active !== false);
    const suspendedIds = new Set(suspensions.filter((item) => item.active !== false).map((item) => item.userId));
    container.innerHTML = users.length ? users.map((user) => {
      const warningCount = activeWarnings.filter((item) => item.userId === user.id).length;
      const state = suspendedIds.has(user.id) ? "suspended" : warningCount > 0 ? "warned" : "active";
      const badge = state === "suspended" ? "admin-badge admin-badge-danger" : state === "warned" ? "admin-badge admin-badge-warning" : "admin-badge admin-badge-success";
      return `
        <div class="admin-status-item">
          ${escapeText(user.displayName || user.username)}<br>
          <span class="${badge}">${escapeText(state)}</span>
          <span class="admin-badge">${escapeText(user.role || "user")}</span>
          <span class="admin-badge">${warningCount} warnings</span>
        </div>
      `;
    }).join("") : `<div class="admin-muted">No accounts available.</div>`;
  }

  async function readStoreSafe(store) {
    if (!window.DataCoreSystem?.list) return [];
    try {
      const records = await window.DataCoreSystem.list(store);
      return Array.isArray(records) ? records : [];
    } catch (err) {
      return [];
    }
  }

  function renderTypographyTab() {
    const typography = readSettingsGroup(["typography"]);
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Typography</div>
          <div class="admin-muted">Font families and scale for the public site and Admin CP. Saved values are applied to the document root; "Theme default" keeps the Midnight Glass tokens untouched.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Display font<br><span class="admin-badge">${escapeText(typography.displayFont && typography.displayFont !== "inherit" ? typography.displayFont : "theme default")}</span></div>
            <div class="admin-status-item">Interface font<br><span class="admin-badge">${escapeText(typography.uiFont && typography.uiFont !== "inherit" ? typography.uiFont : "theme default")}</span></div>
            <div class="admin-status-item">Base size<br><span class="admin-badge">${escapeText(String(typography.baseFontSize || TYPOGRAPHY_BASE_FONT))}px</span></div>
          </div>
        </div>
        ${renderSettingsCard({
          id: "appearance-typography",
          title: "Typography",
          note: "Values are applied live through CSS custom properties on the document root.",
          path: ["typography"],
          fields: [
            { key: "displayFont", label: "Display font (titles)", type: "select", default: "inherit", options: TYPOGRAPHY_FONT_OPTIONS },
            { key: "uiFont", label: "Interface font (body)", type: "select", default: "inherit", options: TYPOGRAPHY_FONT_OPTIONS },
            { key: "baseFontSize", label: "Base font size (px)", type: "number", default: TYPOGRAPHY_BASE_FONT, min: 12, max: 20 },
            { key: "headingScale", label: "Heading scale", type: "select", default: "balanced", options: [["compact", "Compact"], ["balanced", "Balanced"], ["dramatic", "Dramatic"]] },
            { key: "lineHeight", label: "Body line height", type: "select", default: "normal", options: [["tight", "Tight"], ["normal", "Normal"], ["relaxed", "Relaxed"]] },
            { key: "headingTracking", label: "Letter-spacing on headings", type: "select", default: "theme", options: [["theme", "Theme default"], ["tight", "Tight"], ["wide", "Wide"]] }
          ]
        })}
      </div>
    `;
  }

  function applyTypographySettings() {
    if (!document || !document.documentElement) return;
    const typography = readSettingsGroup(["typography"]);
    const root = document.documentElement;
    if (typography.displayFont && typography.displayFont !== "inherit") {
      root.style.setProperty("--font-display", typography.displayFont);
    } else {
      root.style.removeProperty("--font-display");
    }
    if (typography.uiFont && typography.uiFont !== "inherit") {
      root.style.setProperty("--font-ui", typography.uiFont);
    } else {
      root.style.removeProperty("--font-ui");
    }
    const size = Number(typography.baseFontSize);
    if (Number.isFinite(size) && size >= 12 && size <= 20) {
      root.style.fontSize = `${size}px`;
    } else {
      root.style.removeProperty("font-size");
    }
  }

  function renderLayoutsTab({ registryRoutes }) {
    const layouts = readSettingsGroup(["layouts"]);
    const routes = Object.values(registryRoutes || {});
    const layoutIds = Array.from(new Set(routes.map((route) => route.layout).filter(Boolean)));
    const layoutOptions = [["default", "Default (theme shell)"]].concat(layoutIds.filter((id) => id !== "default").map((id) => [id, id]));
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Layouts</div>
          <div class="admin-muted">Layout-slot composition for the application shell. Route-level layout assignment stays in the registry; these values set the shared defaults.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Default layout<br><span class="admin-badge">${escapeText(layouts.defaultLayout || "default")}</span></div>
            <div class="admin-status-item">Rail position<br><span class="admin-badge">${escapeText(layouts.railPosition || "left")}</span></div>
            <div class="admin-status-item">Content width<br><span class="admin-badge">${escapeText(String(layouts.contentMaxWidth || LAYOUT_CONTENT_MAX))}px</span></div>
            <div class="admin-status-item">Routes<br><span class="admin-badge">${routes.length}</span></div>
          </div>
        </div>
        ${renderSettingsCard({
          id: "builder-layouts",
          title: "Layout Composition",
          note: "Shared shell defaults. Per-route layout assignments remain under System > Registry.",
          path: ["layouts"],
          fields: [
            { key: "defaultLayout", label: "Default layout", type: "select", default: "default", options: layoutOptions },
            { key: "railPosition", label: "Navigation rail", type: "select", default: "left", options: [["left", "Left rail"], ["right", "Right rail"], ["bottom", "Bottom (mobile style)"]] },
            { key: "contentMaxWidth", label: "Max content width (px)", type: "number", default: LAYOUT_CONTENT_MAX, min: 900, max: 1920 },
            { key: "stickyTopbar", label: "Sticky top bar", type: "checkbox", default: true },
            { key: "showBreadcrumbs", label: "Show breadcrumbs above content", type: "checkbox", default: false },
            { key: "footerSlots", label: "Footer slots (comma separated)", type: "text", default: "main", placeholder: "main, legal" }
          ]
        })}
        <div class="admin-builder-card">
          <div class="admin-builder-title">Registered Routes</div>
          ${routes.map((route) => `<div class="admin-builder-row"><div><div class="admin-builder-title">${escapeText(route.label || route.id)}</div><div class="admin-builder-note">${escapeText(route.id)} → ${escapeText(route.layout || "default")}</div></div></div>`).join("") || `<div class="admin-builder-empty">No routes registered.</div>`}
        </div>
      </div>
    `;
  }

  function renderCleanupToolsTab() {
    const cleanup = readSettingsGroup(["cleanup"]);
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Cleanup Tools</div>
          <div class="admin-muted">Bulk housekeeping actions. Each action reports exactly what it removed and never touches account records.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Last cleanup<br><span class="admin-badge">${escapeText(cleanup.lastCleanupAt || "never")}</span></div>
            <div class="admin-status-item">ContentCore<br><span class="admin-badge">${window.ContentCoreSystem?.listContent ? "ready" : "unavailable"}</span></div>
            <div class="admin-status-item">DataCore<br><span class="admin-badge">${window.DataCoreSystem?.list ? "ready" : "unavailable"}</span></div>
          </div>
          <div class="admin-actions" style="margin-top:10px;">
            <button onclick="window.AdminCoreActions.runCleanupPurgeTrash()">Purge Trashed Content</button>
            <button onclick="window.AdminCoreActions.runCleanupSessions()">Clear Orphaned Sessions</button>
          </div>
        </div>
        ${renderSettingsCard({
          id: "maintenance-cleanup",
          title: "Retention",
          note: "Retention windows are recorded for operators. Nothing on this page deletes content automatically.",
          path: ["cleanup"],
          fields: [
            { key: "trashRetentionDays", label: "Trashed content retention (days)", type: "number", default: 30, min: 0, max: 365 },
            { key: "activityRetentionDays", label: "Activity feed retention (days, 0 = forever)", type: "number", default: 0, min: 0, max: 3650 },
            { key: "sessionRetentionDays", label: "Inactive session retention (days)", type: "number", default: 30, min: 1, max: 365 }
          ]
        })}
      </div>
    `;
  }

  async function runCleanupPurgeTrash() {
    if (!requireAdminMutation("cleanup")) return;
    const content = window.ContentCoreSystem;
    if (!content?.listContent || !content?.deleteContent) {
      state.statusMessage = "Cleanup failed: ContentCoreSystem unavailable.";
      renderPanel();
      return;
    }
    try {
      // Force a load so getContentTypes() can report every type in the store.
      await content.listContent("blogPost", {}).catch(() => []);
      const types = content.getContentTypes?.() || [];
      let removed = 0;
      for (const type of types) {
        const records = await content.listContent(type, {}).catch(() => []);
        for (const record of toArray(records)) {
          if (record.status !== "trash") continue;
          await content.deleteContent(type, record.id);
          removed += 1;
        }
      }
      markCleanupRun();
      state.statusMessage = removed ? `Cleanup removed ${removed} trashed record(s).` : "Cleanup found no trashed content.";
    } catch (err) {
      state.statusMessage = `Cleanup failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function runCleanupSessions() {
    if (!requireAdminMutation("cleanup")) return;
    try {
      const sessions = await readStoreSafe("sessions");
      const userIds = new Set((window.UserCoreSystem?.listUsers?.() || []).map((user) => user.id));
      let removed = 0;
      for (const session of sessions) {
        if (!session?.id || userIds.has(session.userId)) continue;
        await window.DataCoreSystem?.remove?.("sessions", session.id);
        removed += 1;
      }
      markCleanupRun();
      state.statusMessage = removed ? `Cleanup removed ${removed} orphaned session(s).` : "Cleanup found no orphaned sessions.";
    } catch (err) {
      state.statusMessage = `Cleanup failed: ${err.message || err}`;
    }
    renderPanel();
  }

  function markCleanupRun() {
    const cleanup = readSettingsGroup(["cleanup"]);
    applyNestedSettingsUpdate(["cleanup"], {
      trashRetentionDays: cleanup.trashRetentionDays ?? 30,
      activityRetentionDays: cleanup.activityRetentionDays ?? 0,
      sessionRetentionDays: cleanup.sessionRetentionDays ?? 30,
      lastCleanupAt: new Date().toISOString()
    });
  }

  function renderRepairToolsTab({ registryRoutes }) {
    const health = window.SearchCoreSystem?.getIndexHealth?.() || {};
    const packages = getPackageRecords();
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Repair Tools</div>
          <div class="admin-muted">Recovery actions for the derived stores and runtime state. None of these actions delete authored content.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Index records<br><span class="admin-badge">${health.cachedRecords ?? 0}</span></div>
            <div class="admin-status-item">Last index build<br><span class="admin-badge">${escapeText(health.lastBuiltAt || "never")}</span></div>
            <div class="admin-status-item">Installed packages<br><span class="admin-badge">${packages.length}</span></div>
            <div class="admin-status-item">Routes<br><span class="admin-badge">${Object.keys(registryRoutes || {}).length}</span></div>
          </div>
          <div class="admin-actions" style="margin-top:10px;">
            <button onclick="window.AdminCoreActions.runRepairSearchIndex()">Rebuild Search Index</button>
            <button onclick="window.AdminCoreActions.runRepairPackages()">Validate Package Manifests</button>
            <button onclick="window.AdminCoreActions.runRepairConfig()">Re-apply Saved Configuration</button>
          </div>
        </div>
        ${renderSettingsCard({
          id: "maintenance-repair",
          title: "Repair Policy",
          note: "Boot-time recovery behavior stored in the settings store.",
          path: ["repair"],
          fields: [
            { key: "rebuildIndexOnBoot", label: "Rebuild the search index on boot", type: "checkbox", default: false },
            { key: "verifyStoresOnBoot", label: "Verify encrypted stores on boot", type: "checkbox", default: true },
            { key: "autoRepairSessions", label: "Drop orphaned sessions automatically", type: "checkbox", default: true },
            { key: "bootFailureAction", label: "On repeated boot failure", type: "select", default: "safe-mode", options: [["safe-mode", "Enter safe mode"], ["retry", "Retry normally"], ["report", "Report only"]] }
          ]
        })}
      </div>
    `;
  }

  async function runRepairSearchIndex() {
    if (!requireAdminMutation("repair")) return;
    try {
      const index = await window.SearchCoreSystem?.buildIndex?.({ force: true });
      state.statusMessage = `Search index rebuilt (${toArray(index).length} record(s)).`;
    } catch (err) {
      state.statusMessage = `Search index rebuild failed: ${err.message || err}`;
    }
    renderPanel();
  }

  function runRepairPackages() {
    if (!requireAdminMutation("repair")) return;
    const validate = window.PackageCoreSystem?.validatePackageSet;
    if (!validate) {
      state.statusMessage = "Package validation failed: PackageCoreSystem unavailable.";
      renderPanel();
      return;
    }
    const manifests = getPackageRecords().map((record) => record.manifest).filter(Boolean);
    const report = validate(manifests) || {};
    const issues = toArray(report.errors).concat(toArray(report.warnings));
    state.statusMessage = issues.length
      ? `Package validation reported ${issues.length} issue(s).`
      : `Package validation passed for ${manifests.length} manifest(s).`;
    renderPanel();
  }

  function runRepairConfig() {
    if (!requireAdminMutation("repair")) return;
    const loader = window.ConfigLoader;
    if (!loader?.get || !loader?.apply) {
      state.statusMessage = "Config re-apply failed: ConfigLoader unavailable.";
      renderPanel();
      return;
    }
    const result = loader.apply(loader.get());
    state.statusMessage = result.success ? "Saved configuration re-applied." : `Config re-apply failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  async function issueWarning() {
    if (!requireAdminMutation("warning issue")) return;
    const userId = fieldValue("adminWarnUser");
    const reason = fieldValue("adminWarnReason");
    if (!userId) {
      state.statusMessage = "Warning failed: select an account first.";
      renderPanel();
      return;
    }
    try {
      await window.ModerationCoreSystem?.warnUser?.(userId, reason);
      state.statusMessage = `Warning issued for ${userId}.`;
    } catch (err) {
      state.statusMessage = `Warning failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function issueSuspension() {
    if (!requireAdminMutation("suspension issue")) return;
    const userId = fieldValue("adminSuspendUser");
    const reason = fieldValue("adminSuspendReason");
    const hours = Number(fieldValue("adminSuspendHours"));
    if (!userId) {
      state.statusMessage = "Suspension failed: select an account first.";
      renderPanel();
      return;
    }
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : "";
    try {
      await window.ModerationCoreSystem?.suspendUser?.(userId, reason, expiresAt);
      state.statusMessage = hours > 0 ? `Suspension issued for ${userId} (${hours}h).` : `Indefinite suspension issued for ${userId}.`;
    } catch (err) {
      state.statusMessage = `Suspension failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function liftModerationRecord(store, id) {
    if (!requireAdminMutation("moderation clear")) return;
    try {
      await window.DataCoreSystem?.update?.(store, id, { active: false });
      state.statusMessage = "Moderation record cleared.";
    } catch (err) {
      state.statusMessage = `Clear failed: ${err.message || err}`;
    }
    renderPanel();
  }

  function renderRevisionsTab() {
    const revisions = window.RevisionCoreSystem?.listRecent?.() || [];
    return `<div class="admin-panel"><div class="admin-panel-title">Content Revisions</div>${renderList(revisions.map((r) => `${r.id} ${r.message || ""}`), "No revisions")}</div>`;
  }

  function renderSearchIndexTab(title = "Search Index") {
    const status = window.SearchCoreSystem?.indexStatus?.();
    return `<div class="admin-panel"><div class="admin-panel-title">${escapeText(title)}</div>${renderList(status ? ["Index available"] : [], "Search status unknown")}</div>`;
  }

  function renderUsersListTab() {
    const users = (window.UserCoreSystem?.listUsers?.() || []).slice(0, 50);
    return `<div class="admin-panel"><div class="admin-panel-title">Users</div>${renderList(users.map((u) => u.id || u.username || JSON.stringify(u)), "No users")}</div>`;
  }

  function renderUsersProfilesTab() {
    const users = (window.UserCoreSystem?.listUsers?.() || []).slice(0, 50);
    const rows = users.map((user) => {
      const name = user.displayName || user.username || user.id;
      const role = user.role || "user";
      const bio = user.bio ? String(user.bio).slice(0, 140) : "No public bio";
      return `
        <div class="admin-builder-row">
          <div>
            <div class="admin-builder-title">${escapeText(name)}</div>
            <div class="admin-builder-note">${escapeText(user.id || user.username || "unknown")} / ${escapeText(role)}</div>
            <div class="admin-muted">${escapeText(bio)}</div>
          </div>
          <div class="admin-builder-actions">
            <span class="admin-badge">${user.avatarUrl ? "avatar" : "no avatar"}</span>
            <span class="admin-badge">${toArray(user.capabilities).length || toArray(window.UserCoreSystem?.getRoleCapabilities?.(role)).length} capabilities</span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Social Profiles</div>
          <div class="admin-builder-note">ACP profile inventory for public identity, account details, messaging readiness, and moderation-adjacent signals.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Profiles<br><span class="admin-badge">${users.length}</span></div>
            <div class="admin-status-item">Account UI<br><span class="admin-badge">${window.AccountModuleUI?.refreshSocial ? "ready" : "not loaded"}</span></div>
            <div class="admin-status-item">Messaging<br><span class="admin-badge">${window.MessagingCoreSystem?.listConversations ? "ready" : "not loaded"}</span></div>
          </div>
        </div>
        ${rows || `<div class="admin-builder-empty">No profiles available.</div>`}
      </div>
    `;
  }

  function renderUsersRolesTab() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-title">Roles</div>
        <div class="admin-muted">Role summaries live here. Capability mapping and access rules live under Permissions.</div>
        ${renderList(["guest", "user", "moderator", "admin"], "No roles")}
      </div>
    `;
  }

  function renderUsersWarningsTab() {
    setTimeout(() => loadWarningsPanel(), 0);
    const users = window.UserCoreSystem?.listUsers?.() || [];
    const userOptions = users.map((user) => `<option value="${escapeText(user.id)}">${escapeText(user.displayName || user.username)}</option>`).join("");
    return `
      <div class="admin-builder-stack">
        <div class="admin-panel">
          <div class="admin-panel-title">Warnings / Suspensions</div>
          <div class="admin-muted">Account-level moderation state. Warnings and suspensions live in their own stores, so moderation never rewrites roles or capability rules.</div>
          <div id="adminWarningsPanel" class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-muted">Loading moderation state...</div>
          </div>
        </div>
        <div class="admin-builder-card">
          <div class="admin-builder-title">Issue Warning</div>
          <div class="admin-builder-note">Records an active warning against an account. Warnings are advisory and never revoke access.</div>
          <label>Account
            <select id="adminWarnUser">${userOptions}</select>
          </label>
          <label>Reason<input id="adminWarnReason" placeholder="Repeated off-topic posts" /></label>
          <button onclick="window.AdminSystemCore.issueWarning()">Issue Warning</button>
        </div>
        <div class="admin-builder-card">
          <div class="admin-builder-title">Suspend Account</div>
          <div class="admin-builder-note">Suspensions stay reversible: clearing one only deactivates the record.</div>
          <label>Account
            <select id="adminSuspendUser">${userOptions}</select>
          </label>
          <label>Reason<input id="adminSuspendReason" placeholder="Terms of service violation" /></label>
          <label>Duration (hours, 0 = indefinite)<input id="adminSuspendHours" type="number" value="24" min="0" max="8760" /></label>
          <button onclick="window.AdminSystemCore.issueSuspension()">Suspend Account</button>
        </div>
      </div>
    `;
  }

  async function loadWarningsPanel() {
    const container = document.getElementById("adminWarningsPanel");
    if (!container) return;
    const [warnings, suspensions] = await Promise.all([readStoreSafe("userWarnings"), readStoreSafe("userSuspensions")]);
    const activeWarnings = warnings.filter((item) => item.active !== false);
    const activeSuspensions = suspensions.filter((item) => item.active !== false);
    const renderRecord = (item, kind) => `
      <div class="admin-builder-row">
        <div>
          <div class="admin-builder-title">${escapeText(item.userId || "unknown")}</div>
          <div class="admin-builder-note">${escapeText(kind)} · ${escapeText(item.reason || "no reason recorded")}</div>
          <div class="admin-muted">By ${escapeText(item.moderatorId || "system")}${item.expiresAt ? ` · expires ${escapeText(item.expiresAt)}` : ""}</div>
        </div>
        <div class="admin-builder-actions">
          <button onclick="window.AdminSystemCore.liftModerationRecord(${jsAttrArg(kind === "warning" ? "userWarnings" : "userSuspensions")}, ${jsAttrArg(item.id)})">Clear</button>
        </div>
      </div>
    `;
    container.innerHTML = (activeSuspensions.length || activeWarnings.length)
      ? [
          ...activeSuspensions.map((item) => renderRecord(item, "suspension")),
          ...activeWarnings.map((item) => renderRecord(item, "warning"))
        ].join("")
      : `<div class="admin-muted">No active warnings or suspensions.</div>`;
  }

  function renderRoutePermissionsTab({ registryRoutes }) {
    const rows = Object.values(registryRoutes || {}).map((route) => `${route.id}: ${route.auth ? "authenticated" : "public"}${route.capability ? ` / ${route.capability}` : ""}`);
    return `<div class="admin-panel"><div class="admin-panel-title">Route Permissions</div>${renderList(rows, "No route permissions")}</div>`;
  }

  function renderModulePermissionsTab() {
    const records = getPackageRecords("module");
    return `<div class="admin-panel"><div class="admin-panel-title">Module Permissions</div>${renderList(records.flatMap((record) => record.manifest?.capabilities || []), "No module capabilities")}</div>`;
  }

  function renderAccessReviewTab() {
    return `<div class="admin-panel"><div class="admin-panel-title">Access Review</div><div class="admin-muted">Review admin, moderator, user, and guest capability coverage here.</div>${renderPermissionsTab()}</div>`;
  }

  function renderStyleManagerTab({ config }) {
    const theme = config.themeSettings || {};
    const templateOverrides = config.settings?.templateOverrides || {};
    const replacementVariables = config.settings?.replacementVariables || {};
    return `
      <div class="admin-row-list">
        <div class="admin-panel">
          <div class="admin-panel-title">Style Manager</div>
          <div class="admin-muted">Style control center for variables, CSS templates, replacement variables, and editable templates. Use the focused sublinks for actual editing.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Logo<br><span class="admin-badge">${escapeText(theme.logoText || config.siteName || "WebbyOS")}</span></div>
            <div class="admin-status-item">Primary<br><span class="admin-badge">${escapeText(theme.primaryColor || "#3b82f6")}</span></div>
            <div class="admin-status-item">Accent<br><span class="admin-badge">${escapeText(theme.accentColor || "#16a34a")}</span></div>
            <div class="admin-status-item">Custom CSS<br><span class="admin-badge">${theme.customCss ? "enabled" : "empty"}</span></div>
            <div class="admin-status-item">Template overrides<br><span class="admin-badge">${Object.keys(templateOverrides).length}</span></div>
            <div class="admin-status-item">Replacement variables<br><span class="admin-badge">${Object.keys(replacementVariables).length}</span></div>
          </div>
        </div>
        <div class="admin-panel-grid">
          <button class="admin-button-primary" onclick="window.AdminSystemCore.switchSub('appearance.stylevars')">Edit StyleVars</button>
          <button class="admin-button-primary" onclick="window.AdminSystemCore.switchSub('appearance.colors')">Edit Colors</button>
          <button class="admin-button-primary" onclick="window.AdminSystemCore.switchSub('appearance.css')">Edit CSS</button>
          <button class="admin-button-primary" onclick="window.AdminSystemCore.switchSub('appearance.templates')">Edit Templates</button>
          <button class="admin-button-primary" onclick="window.AdminSystemCore.switchSub('appearance.replacements')">Replacement Variables</button>
          <button class="admin-button-primary" onclick="window.AdminSystemCore.switchSub('appearance.brand')">Edit Brand</button>
        </div>
      </div>
    `;
  }

  function renderStyleVarsTab({ config }) {
    const theme = config.themeSettings || {};
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">StyleVars</div>
          <div class="admin-builder-note">Named theme variables used by CSS and templates. These values keep WebbyOS styling consistent across public pages and Admin CP.</div>
          ${renderThemeField("Logo text", "adminThemeLogoText", theme.logoText || config.siteName || "")}
          ${renderThemeField("Primary color", "adminThemePrimaryColor", theme.primaryColor || "#3b82f6", "color")}
          ${renderThemeField("Accent color", "adminThemeAccentColor", theme.accentColor || "#16a34a", "color")}
          ${renderThemeSelect("Background", "adminThemeBackgroundMode", theme.backgroundMode || "soft", [["soft", "Soft"], ["plain", "Plain"], ["contrast", "Contrast"]])}
          ${renderThemeSelect("Navigation", "adminThemeNavStyle", theme.navStyle || "pills", [["pills", "Pills"], ["underline", "Underline"], ["compact", "Compact"]])}
          ${renderThemeSelect("Density", "adminThemeLayoutDensity", theme.layoutDensity || "comfortable", [["comfortable", "Comfortable"], ["compact", "Compact"], ["spacious", "Spacious"]])}
          <button onclick="window.AdminSystemCore.applyThemeEditor()">Save StyleVars</button>
        </div>
      </div>
    `;
  }

  function renderThemeColorsTab({ config }) {
    const theme = config.themeSettings || {};
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Colors</div>
          <div class="admin-builder-note">Color variables used by the public theme.</div>
          ${renderThemeField("Primary color", "adminThemePrimaryColor", theme.primaryColor || "#3b82f6", "color")}
          ${renderThemeField("Accent color", "adminThemeAccentColor", theme.accentColor || "#16a34a", "color")}
          ${renderThemeSelect("Background", "adminThemeBackgroundMode", theme.backgroundMode || "soft", [["soft", "Soft"], ["plain", "Plain"], ["contrast", "Contrast"]])}
          <button onclick="window.AdminSystemCore.applyThemeEditor()">Save Colors</button>
        </div>
      </div>
    `;
  }

  function renderThemeDensityTab({ config }) {
    const theme = config.themeSettings || {};
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Spacing / Density</div>
          <div class="admin-builder-note">Global spacing and navigation density controls.</div>
          ${renderThemeSelect("Navigation", "adminThemeNavStyle", theme.navStyle || "pills", [["pills", "Pills"], ["underline", "Underline"], ["compact", "Compact"]])}
          ${renderThemeSelect("Density", "adminThemeLayoutDensity", theme.layoutDensity || "comfortable", [["comfortable", "Comfortable"], ["compact", "Compact"], ["spacious", "Spacious"]])}
          <button onclick="window.AdminSystemCore.applyThemeEditor()">Save Density</button>
        </div>
      </div>
    `;
  }

  function renderCssEditorTab({ config }) {
    const customCss = config.themeSettings?.customCss || "";
    setTimeout(() => loadTemplateSource("assets/theme.css", "adminCssSource"), 0);
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">CSS Editor</div>
          <div class="admin-builder-note">Edit a custom CSS override that loads after assets/theme.css. The original stylesheet is shown for reference.</div>
        </div>
        <div class="admin-template-grid">
          <label class="admin-field">Original assets/theme.css
            <textarea id="adminCssSource" class="admin-code-editor admin-template-textarea" rows="18" readonly>Loading source...</textarea>
          </label>
          <label class="admin-field">Custom CSS Override
            <textarea id="adminThemeCustomCss" class="admin-code-editor admin-template-textarea" rows="18">${escapeText(customCss)}</textarea>
          </label>
        </div>
        <div class="admin-actions">
          <button class="admin-button-primary" onclick="window.AdminSystemCore.saveCustomCss()">Save CSS Override</button>
          <button class="admin-button-secondary" onclick="window.AdminSystemCore.resetCustomCss()">Clear Override</button>
        </div>
      </div>
    `;
  }

  function getEditableTemplate(id) {
    return editableTemplates.find((template) => template.id === id) || editableTemplates[0];
  }

  function renderTemplateEditorTab({ config }) {
    const selectedId = state.activeTemplate || editableTemplates[0].id;
    const selected = getEditableTemplate(selectedId);
    const overrides = config.settings?.templateOverrides || {};
    const override = config.settings?.templateOverrides?.[selected.id] || "";
    setTimeout(() => loadTemplateSource(selected.id, "adminTemplateSource"), 0);
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Template Editor</div>
          <div class="admin-builder-note">Editable template list with source, override, and revert behavior. Overrides are saved through DataCoreSystem and applied at runtime where supported.</div>
        </div>
        <div class="admin-template-list">
          ${editableTemplates.map((template) => `
            <div class="admin-template-list-item ${selected.id === template.id ? "active" : ""}" onclick="window.AdminSystemCore.switchEditableTemplate(${jsAttrArg(template.id)})">
              <div>
                <div class="admin-record-title">${escapeText(template.label)}</div>
                <div class="admin-muted">${escapeText(template.id)}</div>
              </div>
              <span class="admin-badge ${overrides[template.id] || (template.type === "css" && config.themeSettings?.customCss) ? "admin-badge-warning" : ""}">${overrides[template.id] || (template.type === "css" && config.themeSettings?.customCss) ? "customized" : "default"}</span>
            </div>
          `).join("")}
        </div>
        <div class="admin-template-tabs">
          ${editableTemplates.map((template) => `<button class="${selected.id === template.id ? "admin-tab active" : "admin-tab"}" onclick="window.AdminSystemCore.switchEditableTemplate(${jsAttrArg(template.id)})">${escapeText(template.label)}</button>`).join("")}
        </div>
        <div class="admin-panel">
          <div class="admin-panel-title">${escapeText(selected.label)}</div>
          <div class="admin-muted">${escapeText(selected.id)}${selected.requiredToken ? ` requires ${selected.requiredToken}` : ""}</div>
        </div>
        <div class="admin-template-grid">
          <label class="admin-field">File Source
            <textarea id="adminTemplateSource" class="admin-code-editor admin-template-textarea" rows="18" readonly>Loading source...</textarea>
          </label>
          <label class="admin-field">Saved Override
            <textarea id="adminTemplateOverride" class="admin-code-editor admin-template-textarea" rows="18">${escapeText(override)}</textarea>
          </label>
        </div>
        <div class="admin-actions">
          <button class="admin-button-primary" onclick="window.AdminSystemCore.saveTemplateOverride(${jsAttrArg(selected.id)})">Save Template Override</button>
          <button class="admin-button-secondary" onclick="window.AdminSystemCore.copyTemplateSource()">Copy Source To Override</button>
          <button class="admin-button-danger" onclick="window.AdminSystemCore.resetTemplateOverride(${jsAttrArg(selected.id)})">Remove Override</button>
        </div>
      </div>
    `;
  }

  function renderReplacementVariablesTab({ config }) {
    const variables = config.settings?.replacementVariables || {};
    const entries = Object.entries(variables);
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Replacement Variables</div>
          <div class="admin-builder-note">Reusable text fragments for future template rendering. Runtime replacement is coming later, so this page stores definitions without pretending they are active yet.</div>
        </div>
        ${entries.map(([key, value]) => `
          <div class="admin-builder-row">
            <div class="admin-builder-fields">
              <label>Find<input id="replacementKey_${escapeText(key)}" value="${escapeText(key)}" /></label>
              <label>Replace with<input id="replacementValue_${escapeText(key)}" value="${escapeText(value)}" /></label>
            </div>
            <div class="admin-builder-actions">
              <button onclick="window.AdminSystemCore.removeReplacementVariable(${jsAttrArg(key)})">Remove</button>
            </div>
          </div>
        `).join("") || `<div class="admin-builder-empty">No replacement variables defined.</div>`}
        <div class="admin-builder-card">
          <div class="admin-builder-title">Add Replacement Variable</div>
          <label>Find<input id="replacementNewKey" placeholder="SITE_PHONE" /></label>
          <label>Replace with<input id="replacementNewValue" placeholder="555-0100" /></label>
          <button onclick="window.AdminSystemCore.saveReplacementVariable()">Save Replacement Variable</button>
        </div>
      </div>
    `;
  }

  function renderBrandVisualsTab({ config }) {
    const theme = config.themeSettings || {};
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Brand Visuals</div>
          <div class="admin-builder-note">Logo text and visual identity. Site name and tagline live under Site.</div>
          ${renderThemeField("Logo text", "adminThemeLogoText", theme.logoText || config.siteName || "")}
          <button onclick="window.AdminSystemCore.applyThemeEditor()">Save Brand Visuals</button>
        </div>
      </div>
    `;
  }

  function renderDiagnosticsExportTab({ warnings, errors, logs }) {
    return `<div class="admin-panel"><div class="admin-panel-title">Diagnostics Export</div><div class="admin-muted">Export packaging will come later. Current runtime counts are shown for operations.</div><div class="admin-actions"><span class="admin-badge admin-badge-warning">Warnings: ${warnings.length}</span><span class="admin-badge admin-badge-danger">Errors: ${errors.length}</span><span class="admin-badge">Logs: ${logs.length}</span></div></div>`;
  }

  function renderDatabaseSummaryTab() {
    const stores = window.DataCoreSystem?.getStores?.() || [];
    return `<div class="admin-panel"><div class="admin-panel-title">Database / Stores</div>${renderList(stores, "No stores registered")}</div>`;
  }

  function renderSafeModeTab({ runtime, safeModeActive }) {
    return `<div class="admin-panel"><div class="admin-panel-title">Safe Mode</div><div class="admin-status-strip"><div class="admin-status-item">Any safe mode<br><span class="admin-badge">${safeModeActive ? "yes" : "no"}</span></div><div class="admin-status-item">Safe boot<br><span class="admin-badge">${runtime.safeMode?.safeBoot ? "yes" : "no"}</span></div><div class="admin-status-item">Diagnostics boot<br><span class="admin-badge">${runtime.safeMode?.diagnosticsOnlyBoot ? "yes" : "no"}</span></div></div></div>`;
  }

  function renderDiagnosticsTab({ warnings, errors, logs }) {
    return `<div class="admin-panel-grid"><div class="admin-panel"><div class="admin-panel-title">Errors</div>${renderList(errors.map((item) => `${item.timestamp} - ${item.message}`), "No recent errors")}</div><div class="admin-panel"><div class="admin-panel-title">Warnings</div>${renderList(warnings.map((item) => `${item.timestamp} - ${item.message}`), "No recent warnings")}</div><div class="admin-panel"><div class="admin-panel-title">Logs</div>${renderList(logs.map((item) => `${item.timestamp} - ${item.message}`), "No recent logs")}</div></div>`;
  }

  function renderRuntimeInspectorLauncher() {
    return `<div class="admin-panel"><div class="admin-panel-title">RuntimeInspector</div><div class="admin-muted">Open the low-level runtime inspection overlay.</div><button onclick="window.AdminSystemCore.openRuntimeInspector()">Open RuntimeInspector</button></div>`;
  }

  function renderRuntimeTab({ runtime, config, warnings, errors, logs }) {
    return `
      <div class="admin-row-list">
        ${window.RuntimeInspector?.renderCard ? window.RuntimeInspector.renderCard() : ""}
        <div class="admin-panel">
          <div class="admin-panel-title">Runtime Dashboard</div>
          <div class="admin-status-strip">
            <div class="admin-status-item">Booted<br><span class="admin-badge">${runtime.booted ? "complete" : "pending"}</span></div>
            <div class="admin-status-item">Current route<br><span class="admin-badge">${escapeText(runtime.route || "none")}</span></div>
            <div class="admin-status-item">Crashes<br><span class="admin-badge">${runtime.recovery?.crashCount || 0}</span></div>
            <div class="admin-status-item">Recovery<br><span class="admin-badge">${runtime.recovery?.recoveryMode ? "active" : "inactive"}</span></div>
            <div class="admin-status-item">Safe boot<br><span class="admin-badge">${runtime.safeMode?.safeBoot ? "yes" : "no"}</span></div>
            <div class="admin-status-item">Diagnostics boot<br><span class="admin-badge">${runtime.safeMode?.diagnosticsOnlyBoot ? "yes" : "no"}</span></div>
          </div>
        </div>
        <div class="admin-panel">
          <div class="admin-panel-title">Recent diagnostics</div>
          <div class="admin-actions">
            <span class="admin-badge admin-badge-warning">Warnings: ${warnings.length}</span>
            <span class="admin-badge admin-badge-danger">Errors: ${errors.length}</span>
            <span class="admin-badge">Logs: ${logs.length}</span>
          </div>
        </div>
        <div class="admin-panel-grid">
          <div class="admin-panel">
            <div class="admin-panel-title">Runtime errors</div>
            ${renderList(errors.map(item => `${item.timestamp} - ${item.message}`), "No recent errors")}
          </div>
          <div class="admin-panel">
            <div class="admin-panel-title">Runtime warnings</div>
            ${renderList(warnings.map(item => `${item.timestamp} - ${item.message}`), "No recent warnings")}
          </div>
        </div>
      </div>
    `;
  }

  function renderRegistryTab({ registryRoutes, canEditRoutes, safeModeActive }) {
    const rows = Object.values(registryRoutes).map((route) => {
      const status = route.enabled === false ? "disabled" : "active";
      const buttonLabel = route.enabled === false ? "Enable" : "Disable";
      const action = canEditRoutes ? `<button onclick="window.AdminSystemCore.toggleRouteEnabled(${jsAttrArg(route.id)})" style="padding:6px 10px;border:none;border-radius:8px;background:${route.enabled === false ? `#16a34a` : `#dc2626`};color:#f8fafc;cursor:pointer;">${buttonLabel}</button>` : "";
      return `
        <tr>
          <td style="padding:8px;border:1px solid rgba(148,163,184,.2);">${escapeText(route.id)}</td>
          <td style="padding:8px;border:1px solid rgba(148,163,184,.2);">${escapeText(route.layout)}</td>
          <td style="padding:8px;border:1px solid rgba(148,163,184,.2);">${route.auth ? "yes" : "no"}</td>
          <td style="padding:8px;border:1px solid rgba(148,163,184,.2);">${escapeText(status)}</td>
          <td style="padding:8px;border:1px solid rgba(148,163,184,.2);">${action}</td>
        </tr>
      `;
    }).join("");

    return `
      <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
        <div style="font-weight:700;margin-bottom:10px;">Route Registry</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:10px;">Registry controls route availability, layout assignment, and authentication rules. Module health and package inventory live under System > Modules. Edit mode is ${canEditRoutes ? "enabled" : "disabled"}. ${canEditRoutes ? "" : "Admin login or safe mode is required to change route state."}</div>
        <div style="overflow:auto;max-height:300px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid rgba(148,163,184,.3);text-align:left;">Route</th>
                <th style="padding:8px;border:1px solid rgba(148,163,184,.3);text-align:left;">Layout</th>
                <th style="padding:8px;border:1px solid rgba(148,163,184,.3);text-align:left;">Auth</th>
                <th style="padding:8px;border:1px solid rgba(148,163,184,.3);text-align:left;">Status</th>
                <th style="padding:8px;border:1px solid rgba(148,163,184,.3);text-align:left;">Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:12px;font-size:12px;color:#cbd5e1;">Safe mode active: ${safeModeActive ? "yes" : "no"}</div>
      </div>
    `;
  }

  function renderModulesTab({ modules, registry } = {}) {
    modules = modules || [];
    registry = registry || {};
    const moduleHealthMap = (Array.isArray(modules) ? modules : Object.values(modules || {})).reduce((acc, rec) => {
      acc[rec.moduleId || rec.id] = rec;
      return acc;
    }, {});
    const packageRecords = getPackageRecords().filter((record) => ["module", "system"].includes(record.type));
    const inventory = new Map();

    Object.entries(registry).forEach(([routeId, route]) => {
      const moduleId = route.module || route.moduleId || route.id || routeId;
      inventory.set(moduleId, {
        id: moduleId,
        kind: "page",
        routeIds: [routeId],
        label: route.label || routeId,
        registryRoute: route
      });
    });

    packageRecords.forEach((record) => {
      const manifest = record.manifest || {};
      const existing = inventory.get(record.id) || { id: record.id, routeIds: [] };
      inventory.set(record.id, {
        ...existing,
        id: record.id,
        kind: record.type,
        label: record.name || manifest.name || record.id,
        packageRecord: record,
        routeIds: [...new Set([...(existing.routeIds || []), ...(manifest.routes || [])])]
      });
    });

    Object.keys(moduleHealthMap).forEach((moduleId) => {
      const existing = inventory.get(moduleId) || { id: moduleId, routeIds: [] };
      inventory.set(moduleId, { ...existing, healthRecord: moduleHealthMap[moduleId] });
    });

    const rows = [...inventory.values()].sort((a, b) => a.id.localeCompare(b.id)).map((item) => {
      const record = item.healthRecord || moduleHealthMap[item.id] || {};
      const recModuleId = record.moduleId || record.id || item.id;
      const status = record.quarantined ? "quarantined" : record.adminDisabled ? "disabled" : "healthy";
      const label = status === "disabled" ? "Enable" : "Disable";
      return `
        <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;margin-bottom:10px;">
          <div style="font-weight:700;">${escapeText(item.label || recModuleId)}</div>
          <div style="font-size:12px;color:#cbd5e1;">ID: ${escapeText(recModuleId)} / ${escapeText(item.kind || "module")}</div>
          <div style="font-size:12px;color:#94a3b8;">Routes: ${escapeText((item.routeIds || []).join(", ") || "none")}</div>
          <div style="font-size:12px;color:#94a3b8;">Package: ${escapeText(item.packageRecord?.id || "built-in route")}</div>
          <div style="font-size:12px;color:#cbd5e1;">Status: ${escapeText(status)}</div>
          <div style="font-size:12px;color:#94a3b8;">Failures: ${record.failureCount || record.failures || 0}</div>
          <div style="font-size:12px;color:#94a3b8;">Last error: ${escapeText(record.lastError?.message || record.lastError || "none")}</div>
          <div style="font-size:12px;color:#94a3b8;">Last loaded: ${record.lastLoaded ? new Date(record.lastLoaded).toLocaleString() : "never"}</div>
          ${record.id || record.moduleId ? `<button onclick="window.AdminSystemCore.toggleModuleEnabled(${jsAttrArg(recModuleId)})" style="margin-top:10px;padding:8px 12px;border:none;border-radius:8px;background:${status === "disabled" ? `#16a34a` : `#dc2626`};color:#f8fafc;cursor:pointer;">${label}</button>` : ""}
        </div>
      `;
    }).join("");
    return `
      <div style="display:grid;gap:12px;">
        <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <div style="font-weight:700;margin-bottom:10px;">Module Health & Inventory</div>
          <div class="admin-muted" style="margin-bottom:10px;">Modules show loaded page/system health, failures, package ownership, and route associations. Route enablement lives under System > Registry.</div>
          ${rows || `<div style="opacity:.7">No modules registered.</div>`}
        </div>
      </div>
    `;
  }

  function renderPluginsTab({ plugins }) {
    const rows = plugins.map((record) => {
      const status = record.quarantined ? "quarantined" : record.disabled ? "disabled" : record.status || "registered";
      const label = record.disabled ? "Enable" : "Disable";
      return `
        <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;margin-bottom:10px;">
          <div style="font-weight:700;">${escapeText(record.pluginId)}</div>
          <div style="font-size:12px;color:#cbd5e1;">Status: ${escapeText(status)}</div>
          <div style="font-size:12px;color:#94a3b8;">Failures: ${record.failureCount || 0}</div>
          <div style="font-size:12px;color:#94a3b8;">Last error: ${escapeText(record.lastError?.message || record.lastError || "none")}</div>
          <button onclick="window.AdminSystemCore.togglePluginEnabled(${jsAttrArg(record.pluginId)})" style="margin-top:10px;padding:8px 12px;border:none;border-radius:8px;background:${record.disabled ? `#16a34a` : `#dc2626`};color:#f8fafc;cursor:pointer;">${label}</button>
        </div>
      `;
    }).join("");

    return `
      <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
        <div style="font-weight:700;margin-bottom:10px;">Plugin control</div>
        ${rows || `<div style="opacity:.7">No plugin health records available.</div>`}
      </div>
    `;
  }

  function getPackageRecords(type = null) {
    const records = window.PackageCoreSystem?.getInstalledPackages?.() || getSharedState().installedPackages || [];
    return type ? records.filter((record) => record.type === type) : records;
  }

  function statusBadgeClass(status) {
    if (status === "healthy") return "admin-badge admin-badge-success";
    if (status === "warning") return "admin-badge admin-badge-warning";
    if (status === "invalid") return "admin-badge admin-badge-danger";
    return "admin-badge";
  }

  function renderPackageCards(records) {
    if (!records.length) {
      return `<div class="admin-muted">No packages found.</div>`;
    }

    return `
      <div class="package-list">
        ${records.map((record) => {
          const manifest = record.manifest || {};
          const warnings = record.health?.warnings || record.warnings || [];
          return `
            <div class="package-card">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                  <div class="admin-panel-title">${escapeText(record.name || record.id)}</div>
                  <div class="admin-muted">${escapeText(record.id)} / ${escapeText(record.type || "unknown")} / ${escapeText(record.version || "0.0.0")}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                  <span class="package-status ${statusBadgeClass(record.health?.status || "unknown")}">${escapeText(record.health?.status || "unknown")}</span>
                  <span class="admin-badge">${record.enabled === false ? "disabled" : "enabled"}</span>
                </div>
              </div>
              <div class="admin-muted" style="margin-top:8px;">${escapeText(record.description || manifest.description || "")}</div>
              <div class="admin-status-strip" style="margin-top:10px;">
                <div class="admin-status-item">Routes<br><span class="admin-badge">${(manifest.routes || []).length}</span></div>
                <div class="admin-status-item">Stores<br><span class="admin-badge">${(manifest.stores || []).length}</span></div>
                <div class="admin-status-item">Capabilities<br><span class="admin-badge">${(manifest.capabilities || []).length}</span></div>
                <div class="admin-status-item">Widgets<br><span class="admin-badge">${(manifest.widgets || []).length}</span></div>
                <div class="admin-status-item">Themes<br><span class="admin-badge">${(manifest.themes || []).length}</span></div>
              </div>
              ${warnings.length ? `<div class="package-warning">${renderList(warnings, "No warnings")}</div>` : ""}
              <details style="margin-top:10px;">
                <summary class="admin-muted" style="cursor:pointer;">Manifest</summary>
                <pre class="package-manifest-view admin-code-editor">${escapeText(JSON.stringify(manifest, null, 2))}</pre>
              </details>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderPackagesTab() {
    const records = getPackageRecords();
    const summary = window.PackageCoreSystem?.getPackageSummary?.() || {};
    return `
      <div class="admin-row-list">
        <div class="admin-panel">
          <div class="admin-panel-title">Installed Packages</div>
          <div class="admin-status-strip">
            <div class="admin-status-item">Total<br><span class="admin-badge">${summary.total || records.length}</span></div>
            <div class="admin-status-item">Healthy<br><span class="admin-badge admin-badge-success">${summary.healthy || 0}</span></div>
            <div class="admin-status-item">Warnings<br><span class="admin-badge admin-badge-warning">${summary.warning || 0}</span></div>
            <div class="admin-status-item">Invalid<br><span class="admin-badge admin-badge-danger">${summary.invalid || 0}</span></div>
            <div class="admin-status-item">Enabled<br><span class="admin-badge">${summary.enabled || 0}</span></div>
          </div>
        </div>
        ${renderPackageCards(records)}
      </div>
    `;
  }

  function renderPackageTypeTab(type) {
    return `
      <div class="admin-row-list">
        <div class="admin-panel">
          <div class="admin-panel-title">${escapeText(type[0].toUpperCase() + type.slice(1))} Packages</div>
          <div class="admin-muted">Local package declarations for future installable ${escapeText(type)} contracts.</div>
        </div>
        ${renderPackageCards(getPackageRecords(type))}
      </div>
    `;
  }

  function renderPackageDiagnosticsTab() {
    const shared = getSharedState();
    const warnings = window.PackageCoreSystem?.getPackageWarnings?.() || shared.packageWarnings || [];
    const errors = window.PackageCoreSystem?.getPackageErrors?.() || shared.packageErrors || [];
    return `
      <div class="admin-panel-grid">
        <div class="admin-panel">
          <div class="admin-panel-title">Package Diagnostics</div>
          <div class="admin-status-strip">
            <div class="admin-status-item">Ready<br><span class="admin-badge">${window.PackageCoreSystem?.isReady?.() ? "yes" : "no"}</span></div>
            <div class="admin-status-item">Routes<br><span class="admin-badge">${(window.PackageCoreSystem?.getPackageRoutes?.() || shared.packageRoutes || []).length}</span></div>
            <div class="admin-status-item">Capabilities<br><span class="admin-badge">${(window.PackageCoreSystem?.getPackageCapabilities?.() || shared.packageCapabilities || []).length}</span></div>
          </div>
        </div>
        <div class="admin-panel">
          <div class="admin-panel-title">Warnings</div>
          ${renderList(warnings, "No package warnings")}
        </div>
        <div class="admin-panel">
          <div class="admin-panel-title">Errors</div>
          ${renderList(errors, "No package errors")}
        </div>
      </div>
    `;
  }

  function renderNavigationTab() {
    const items = window.NavigationBuilderSystem?.getItems?.() || [];
    const visibilityOptions = window.NavigationBuilderSystem?.getVisibilityOptions?.() || ["public", "authenticated", "admin", "capability"];
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Navigation Builder</div>
          <div class="admin-builder-note">Order, labels, public visibility, and capability rules are stored through DataCoreSystem.</div>
        </div>
        ${items.map((item) => `
          <div class="admin-builder-row">
            <div class="admin-builder-fields">
              <label>Label<input id="navLabel_${item.route}" value="${escapeText(item.label)}" /></label>
              <label>Order<input id="navOrder_${item.route}" type="number" value="${escapeText(String(item.order))}" /></label>
              <label>Visibility
                <select id="navVisibility_${item.route}">
                  ${visibilityOptions.map((option) => `<option value="${escapeText(option)}" ${item.visibility === option ? "selected" : ""}>${escapeText(option)}</option>`).join("")}
                </select>
              </label>
              <label>Capability<input id="navCapability_${item.route}" value="${escapeText(item.capability || "")}" placeholder="required when visibility=capability" /></label>
            </div>
            <div class="admin-builder-actions">
              <label class="admin-builder-check"><input id="navShown_${item.route}" type="checkbox" ${item.nav ? "checked" : ""} /> In nav</label>
              <label class="admin-builder-check"><input id="navEnabled_${item.route}" type="checkbox" ${item.enabled ? "checked" : ""} /> Route enabled</label>
              <button onclick="window.AdminSystemCore.saveNavigationItem(${jsAttrArg(item.route)})">Save</button>
            </div>
          </div>
        `).join("") || `<div class="admin-builder-empty">No routes are available.</div>`}
      </div>
    `;
  }

  function renderHomepageTab() {
    const config = window.HomepageBuilderSystem?.getConfig?.() || {};
    const hero = config.hero || {};
    const sections = config.sections || [];
    const sectionTypes = window.HomepageBuilderSystem?.getSectionTypes?.() || [];
    const widgets = window.WidgetCoreSystem?.getWidgets?.() || [];
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Homepage Builder</div>
          <div class="admin-builder-note">Configure homepage content sections and widgets. Global colors, template overrides, and CSS live under Appearance.</div>
          <div class="admin-status-strip" style="margin-top:10px;">
            <div class="admin-status-item">Sections<br><span class="admin-badge">${sections.length}</span></div>
            <div class="admin-status-item">Widgets<br><span class="admin-badge">${widgets.length}</span></div>
            <div class="admin-status-item">Home UI<br><span class="admin-badge">${window.HomeModuleUI?.refresh ? "ready" : "not loaded"}</span></div>
          </div>
        </div>
        <div class="admin-builder-card">
          <div class="admin-builder-title">Hero</div>
          <label>Kicker<input id="homeHeroKicker" value="${escapeText(hero.kicker || "")}" /></label>
          <label>Title<input id="homeHeroTitle" value="${escapeText(hero.title || "")}" /></label>
          <label>Body<textarea id="homeHeroBody" rows="3">${escapeText(hero.body || "")}</textarea></label>
          <button onclick="window.AdminSystemCore.saveHomepageHero()">Save Hero</button>
        </div>
        <div class="admin-builder-card">
          <div class="admin-builder-title">Sections</div>
          ${sections.map((section) => `
            <div class="admin-builder-row">
              <div class="admin-builder-fields">
                <label>Title<input id="homeSectionTitle_${section.id}" value="${escapeText(section.title)}" /></label>
                <label>Order<input id="homeSectionOrder_${section.id}" type="number" value="${escapeText(String(section.order))}" /></label>
                <label>Type
                  <select id="homeSectionType_${section.id}">
                    ${sectionTypes.map((type) => `<option value="${escapeText(type)}" ${section.type === type ? "selected" : ""}>${escapeText(type)}</option>`).join("")}
                  </select>
                </label>
                <label>Widget
                  <select id="homeSectionWidget_${section.id}">
                    <option value="">None</option>
                    ${widgets.map((widget) => `<option value="${escapeText(widget.id)}" ${section.widgetId === widget.id ? "selected" : ""}>${escapeText(widget.title)}</option>`).join("")}
                  </select>
                </label>
              </div>
              <div class="admin-builder-actions">
                <label class="admin-builder-check"><input id="homeSectionEnabled_${section.id}" type="checkbox" ${section.enabled ? "checked" : ""} /> Enabled</label>
                <button onclick="window.AdminSystemCore.saveHomepageSection(${jsAttrArg(section.id)})">Save</button>
                <button onclick="window.AdminSystemCore.removeHomepageSection(${jsAttrArg(section.id)})">Remove</button>
              </div>
            </div>
          `).join("")}
          <div class="admin-builder-row">
            <div class="admin-builder-fields">
              <label>New title<input id="homeNewSectionTitle" placeholder="Custom widget block" /></label>
              <label>Type
                <select id="homeNewSectionType">
                  ${sectionTypes.map((type) => `<option value="${escapeText(type)}">${escapeText(type)}</option>`).join("")}
                </select>
              </label>
              <label>Widget
                <select id="homeNewSectionWidget">
                  <option value="">None</option>
                  ${widgets.map((widget) => `<option value="${escapeText(widget.id)}">${escapeText(widget.title)}</option>`).join("")}
                </select>
              </label>
            </div>
            <div class="admin-builder-actions">
              <button onclick="window.AdminSystemCore.addHomepageSection()">Add Section</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderWidgetsTab() {
    const widgets = window.WidgetCoreSystem?.getWidgets?.() || [];
    const types = window.WidgetCoreSystem?.getTypes?.() || [];
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Widget Library</div>
          <div class="admin-builder-note">Reusable blocks can be added to the homepage builder.</div>
        </div>
        ${widgets.map((widget) => `
          <div class="admin-builder-row">
            <div class="admin-builder-fields">
              <label>Title<input id="widgetTitle_${widget.id}" value="${escapeText(widget.title)}" /></label>
              <label>Type
                <select id="widgetType_${widget.id}">
                  ${types.map((type) => `<option value="${escapeText(type)}" ${widget.type === type ? "selected" : ""}>${escapeText(window.WidgetCoreSystem?.labelForType?.(type) || type)}</option>`).join("")}
                </select>
              </label>
              <label>Limit<input id="widgetLimit_${widget.id}" type="number" value="${escapeText(String(widget.limit || 4))}" /></label>
              <label>Safe HTML<textarea id="widgetContent_${widget.id}" rows="3">${escapeText(widget.content || "")}</textarea></label>
            </div>
            <div class="admin-builder-actions">
              <label class="admin-builder-check"><input id="widgetEnabled_${widget.id}" type="checkbox" ${widget.enabled ? "checked" : ""} /> Enabled</label>
              <button onclick="window.AdminSystemCore.saveWidgetFromPanel(${jsAttrArg(widget.id)})">Save</button>
              <button onclick="window.AdminSystemCore.removeWidgetFromPanel(${jsAttrArg(widget.id)})">Remove</button>
            </div>
          </div>
        `).join("") || `<div class="admin-builder-empty">No widgets yet.</div>`}
        <div class="admin-builder-card">
          <div class="admin-builder-title">Add Widget</div>
          <label>Title<input id="widgetNewTitle" placeholder="Homepage note" /></label>
          <label>Type
            <select id="widgetNewType">
              ${types.map((type) => `<option value="${escapeText(type)}">${escapeText(window.WidgetCoreSystem?.labelForType?.(type) || type)}</option>`).join("")}
            </select>
          </label>
          <label>Limit<input id="widgetNewLimit" type="number" value="4" /></label>
          <label>Safe HTML<textarea id="widgetNewContent" rows="4" placeholder="<p>Welcome message</p>"></textarea></label>
          <button onclick="window.AdminSystemCore.addWidgetFromPanel()">Add Widget</button>
        </div>
      </div>
    `;
  }

  function renderModuleVisibilityTab() {
    const routes = Object.values(getSharedState().registry || {});
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Module Visibility</div>
          <div class="admin-builder-note">Hide routes from navigation or disable route access without touching module files.</div>
        </div>
        ${routes.map((route) => `
          <div class="admin-builder-row">
            <div>
              <div class="admin-builder-title">${escapeText(route.label || route.id)}</div>
              <div class="admin-builder-note">${escapeText(route.id)} / ${escapeText(route.layout || "default")}</div>
            </div>
            <div class="admin-builder-actions">
              <button onclick="window.AdminSystemCore.toggleBuilderNav(${jsAttrArg(route.id)}, ${route.nav === false ? "true" : "false"})">${route.nav === false ? "Show in Nav" : "Hide from Nav"}</button>
              <button onclick="window.AdminSystemCore.toggleBuilderRoute(${jsAttrArg(route.id)}, ${route.enabled === false ? "true" : "false"})">${route.enabled === false ? "Enable Route" : "Disable Route"}</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderPermissionsTab() {
    const roles = ["guest", "user", "moderator", "admin"];
    return `
      <div class="admin-builder-stack">
        <div class="admin-builder-card">
          <div class="admin-builder-title">Roles & Permissions</div>
          <div class="admin-builder-note">Reference view for role capabilities. Route and builder controls should use capabilities instead of hard-coded role checks.</div>
        </div>
        ${roles.map((role) => {
          const capabilities = window.UserCoreSystem?.getRoleCapabilities?.(role) || [];
          return `
            <div class="admin-builder-card">
              <div class="admin-builder-title">${escapeText(role)}</div>
              <div class="capability-grid">
                ${capabilities.map((capability) => `<span class="capability-chip">${escapeText(capability)}</span>`).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderMediaTab() {
    setTimeout(() => loadMediaPanel(), 0);
    return `
      <div style="display:grid;gap:10px;">
        <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <div style="font-weight:700;margin-bottom:8px;">Media Library</div>
          <div style="font-size:12px;color:#94a3b8;">Uploaded images stored through MediaCoreSystem and DataCoreSystem.</div>
        </div>
        <div id="adminMediaLibrary" style="display:grid;gap:10px;">
          <div style="opacity:.7">Loading media...</div>
        </div>
      </div>
    `;
  }

  function renderCmsTab(mode = "all") {
    const showCategories = mode === "all" || mode === "categories";
    const showTags = mode === "all" || mode === "tags";
    const title = mode === "tags" ? "Tags" : mode === "categories" ? "Categories" : "CMS Organization";
    const note = mode === "tags"
      ? "Manage reusable tags used by content modules."
      : mode === "categories"
        ? "Manage content categories used by publishing modules."
        : "Manage categories and tags used by content modules.";
    setTimeout(() => loadCmsPanel(mode), 0);
    return `
      <div style="display:grid;gap:10px;">
        <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <div style="font-weight:700;margin-bottom:8px;">${escapeText(title)}</div>
          <div style="font-size:12px;color:#94a3b8;">${escapeText(note)}</div>
        </div>
        <div style="display:grid;gap:8px;padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          ${showCategories ? `
            <input id="adminCategoryName" placeholder="Category name" style="padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f8fafc;" />
            <button onclick="window.AdminSystemCore.saveCategoryFromPanel()" style="padding:8px 12px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">Save Category</button>
          ` : ""}
          ${showTags ? `
            <input id="adminTagName" placeholder="Tag name" style="padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f8fafc;" />
            <button onclick="window.AdminSystemCore.saveTagFromPanel()" style="padding:8px 12px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">Save Tag</button>
          ` : ""}
        </div>
        <div id="adminCmsTaxonomy" style="display:grid;gap:10px;">
          <div style="opacity:.7">Loading ${escapeText(title.toLowerCase())}...</div>
        </div>
      </div>
    `;
  }

  async function loadContentInventoryPanel(targetId, types) {
    const container = document.getElementById(targetId);
    if (!container) return;
    if (!window.ContentCoreSystem?.listContent) {
      container.innerHTML = `<div class="admin-status-item">ContentCore<br><span class="admin-badge admin-badge-danger">unavailable</span></div>`;
      return;
    }

    try {
      const rows = await Promise.all(types.map(async ([type, label]) => {
        const records = await window.ContentCoreSystem.listContent(type, {});
        const visible = toArray(records).filter((item) => item.status !== "trash");
        const drafts = toArray(records).filter((item) => item.status === "draft");
        const trash = toArray(records).filter((item) => item.status === "trash");
        return `
          <div class="admin-status-item">
            ${escapeText(label)}<br>
            <span class="admin-badge">${visible.length} visible</span>
            <span class="admin-badge admin-badge-warning">${drafts.length} draft</span>
            <span class="admin-badge admin-badge-danger">${trash.length} trash</span>
          </div>
        `;
      }));
      container.innerHTML = rows.join("");
    } catch (err) {
      container.innerHTML = `<div class="admin-status-item">Inventory<br><span class="admin-badge admin-badge-danger">${escapeText(err.message || err)}</span></div>`;
    }
  }

  async function loadCmsPanel(mode = "all") {
    const container = document.getElementById("adminCmsTaxonomy");
    if (!container) return;
    try {
      const [categories, tags] = await Promise.all([
        window.CategoryCoreSystem?.listCategories?.() || [],
        window.TagCoreSystem?.listTags?.() || []
      ]);
      const showCategories = mode === "all" || mode === "categories";
      const showTags = mode === "all" || mode === "tags";
      container.innerHTML = `
        ${showCategories ? `<div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <div style="font-weight:700;margin-bottom:8px;">Categories</div>
          ${window.CategoryCoreSystem?.renderCategoryChips?.(categories) || ""}
        </div>` : ""}
        ${showTags ? `<div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <div style="font-weight:700;margin-bottom:8px;">Tags</div>
          ${window.TagCoreSystem?.renderTagChips?.(tags) || ""}
        </div>` : ""}
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:#fecaca;">Unable to load CMS taxonomy.</div>`;
    }
  }

  async function saveCategoryFromPanel() {
    try {
      const name = document.getElementById("adminCategoryName")?.value || "";
      await window.CategoryCoreSystem?.saveCategory?.({ name });
      state.statusMessage = "Category saved.";
      await loadCmsPanel();
    } catch (err) {
      state.statusMessage = `Category save failed: ${err.message || err}`;
      renderPanel();
    }
  }

  async function saveTagFromPanel() {
    try {
      const name = document.getElementById("adminTagName")?.value || "";
      await window.TagCoreSystem?.saveTag?.({ name });
      state.statusMessage = "Tag saved.";
      await loadCmsPanel();
    } catch (err) {
      state.statusMessage = `Tag save failed: ${err.message || err}`;
      renderPanel();
    }
  }

  async function loadMediaPanel() {
    const container = document.getElementById("adminMediaLibrary");
    if (!container || !window.MediaCoreSystem?.listMedia) return;
    try {
      const media = await window.MediaCoreSystem.listMedia();
      const canDelete = window.UserCoreSystem?.can?.("media.manage") === true;
      if (!media.length) {
        container.innerHTML = `<div style="opacity:.7">No uploaded media.</div>`;
        return;
      }
      container.innerHTML = media.map((item) => `
        <div style="display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <img src="${escapeText(item.url)}" alt="${escapeText(item.originalName)}" style="width:72px;height:54px;object-fit:cover;border-radius:8px;border:1px solid rgba(148,163,184,.25);" />
          <div>
            <div style="font-weight:700;">${escapeText(item.originalName || item.filename)}</div>
            <div style="font-size:12px;color:#94a3b8;">${escapeText(item.mimeType)} · ${escapeText(String(item.size || 0))} bytes</div>
            <div style="font-size:12px;color:#94a3b8;">Uploader: ${escapeText(item.uploaderId || "unknown")} · ${escapeText(item.createdAt || "")}</div>
          </div>
          ${canDelete ? `<button onclick="window.AdminSystemCore.deleteMediaItem(${jsAttrArg(item.id)})" style="padding:7px 10px;border:none;border-radius:8px;background:#dc2626;color:#fff;cursor:pointer;">Delete</button>` : ""}
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = `<div style="color:#fecaca;">Unable to load media library.</div>`;
    }
  }

  async function deleteMediaItem(id) {
    if (!window.confirm("Delete this media item? This cannot be undone.")) {
      return;
    }

    try {
      await window.MediaCoreSystem?.deleteMedia?.(id);
      state.statusMessage = "Media deleted.";
      await loadMediaPanel();
    } catch (err) {
      state.statusMessage = `Media delete failed: ${err.message || err}`;
      renderPanel();
    }
  }

  function renderThemeTab({ config }) {
    const theme = config.themeSettings || {};
    return `
      <div style="display:grid;gap:10px;">
        <div style="padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          <div style="font-weight:700;margin-bottom:8px;">Legacy Theme Variables</div>
          <div style="font-size:12px;color:#94a3b8;">This render path is retained for older tab callers. Use Appearance > Style Manager, CSS Editor, and Template Editor for theme building.</div>
        </div>
        <div style="display:grid;gap:10px;padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#020617;">
          ${renderThemeField("Logo text", "adminThemeLogoText", theme.logoText || config.siteName || "")}
          ${renderThemeField("Primary color", "adminThemePrimaryColor", theme.primaryColor || "#3b82f6", "color")}
          ${renderThemeField("Accent color", "adminThemeAccentColor", theme.accentColor || "#16a34a", "color")}
          ${renderThemeSelect("Background", "adminThemeBackgroundMode", theme.backgroundMode || "soft", [["soft", "Soft"], ["plain", "Plain"], ["contrast", "Contrast"]])}
          ${renderThemeSelect("Navigation", "adminThemeNavStyle", theme.navStyle || "pills", [["pills", "Pills"], ["underline", "Underline"], ["compact", "Compact"]])}
          ${renderThemeSelect("Density", "adminThemeLayoutDensity", theme.layoutDensity || "comfortable", [["comfortable", "Comfortable"], ["compact", "Compact"], ["spacious", "Spacious"]])}
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button onclick="window.AdminSystemCore.applyThemeEditor()" style="padding:10px 14px;border:none;border-radius:10px;background:#16a34a;color:#f8fafc;cursor:pointer;">Save Theme</button>
            <button onclick="window.AdminSystemCore.resetThemeEditor()" style="padding:10px 14px;border:none;border-radius:10px;background:#334155;color:#f8fafc;cursor:pointer;">Reset Defaults</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderThemeField(label, id, value, type = "text") {
    return `
      <label style="display:grid;gap:6px;font-size:12px;color:#cbd5e1;">
        ${escapeText(label)}
        <input id="${id}" type="${type}" value="${escapeText(value)}" style="width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f8fafc;" />
      </label>
    `;
  }

  function renderThemeSelect(label, id, value, options) {
    return `
      <label style="display:grid;gap:6px;font-size:12px;color:#cbd5e1;">
        ${escapeText(label)}
        <select id="${id}" style="width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f8fafc;">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escapeText(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeText(optionLabel)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderList(items, emptyLabel = "None") {
    if (!items || !items.length) return `<div style="opacity:.7">${escapeText(emptyLabel)}</div>`;
    return `<ul style="padding-left:18px;margin:0;">${items.map(item => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
  }

  function toggleRouteEnabled(routeId) {
    if (!requireAdminMutation("route update")) return;
    const route = window.RegistryEngine?.getAll?.()?.[routeId];
    if (!route) return;
    const nextEnabled = route.enabled === false;
    const success = window.RegistryEngine?.setRouteEnabled?.(routeId, nextEnabled);
    state.statusMessage = success ? `Route ${routeId} ${nextEnabled ? "enabled" : "disabled"}` : `Failed to update route ${routeId}`;
    renderPanel();
  }

  function toggleModuleEnabled(moduleId) {
    if (!requireAdminMutation("module update")) return;
    const record = Object.values(window.ModuleLoader?.getHealth?.() || {}).find((item) => (item.moduleId || item.id) === moduleId);
    if (!record) return;
    const nextEnabled = record.adminDisabled === true;
    const success = window.ModuleLoader?.setModuleEnabled?.(moduleId, nextEnabled);
    state.statusMessage = success ? `Module ${moduleId} ${nextEnabled ? "enabled" : "disabled"}` : `Failed to update module ${moduleId}`;
    renderPanel();
  }

  function togglePluginEnabled(pluginId) {
    if (!requireAdminMutation("plugin update")) return;
    const record = toArray(window.PluginEngine?.getHealth?.()).find((item) => item.pluginId === pluginId);
    if (!record) return;
    const nextEnabled = record.disabled === true;
    const success = window.PluginEngine?.setPluginEnabled?.(pluginId, nextEnabled);
    state.statusMessage = success ? `Plugin ${pluginId} ${nextEnabled ? "enabled" : "disabled"}` : `Failed to update plugin ${pluginId}`;
    renderPanel();
  }

  function applyConfigEditor() {
    state.statusMessage = "Direct config editing is hidden. Use the Site, Appearance, and Builders panels to update settings.";
    renderPanel();
  }

  function resetConfigEditor() {
    state.statusMessage = "Direct config editing is hidden; no reset action is needed.";
    renderPanel();
  }

  function saveSiteSettings() {
    if (!requireAdminMutation("site settings save")) return;
    const loader = window.ConfigLoader;
    if (!loader?.get || !loader?.apply) {
      state.statusMessage = "Site settings save failed: ConfigLoader unavailable.";
      renderPanel();
      return;
    }
    const current = loader.get() || {};
    const next = loader.mergeConfig?.(current, {
      siteName: fieldValue("adminSiteName") || current.siteName,
      tagline: fieldValue("adminSiteTagline"),
      settings: {
        ...(current.settings || {}),
        defaultRoute: fieldValue("adminDefaultRoute") || current.settings?.defaultRoute || "home"
      }
    }) || current;

    const result = loader.apply(next);
    state.statusMessage = result.success ? "Site settings saved." : `Site settings save failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  function saveFeatureToggles() {
    if (!requireAdminMutation("feature toggle save")) return;
    const loader = window.ConfigLoader;
    if (!loader?.get || !loader?.apply) {
      state.statusMessage = "Feature toggles save failed: ConfigLoader unavailable.";
      renderPanel();
      return;
    }
    const current = loader.get() || {};
    const features = Object.keys(current.features || {}).reduce((acc, key) => {
      acc[key] = fieldChecked(`featureToggle_${key}`);
      return acc;
    }, {});
    const next = loader.mergeConfig?.(current, { features }) || current;
    const result = loader.apply(next);
    state.statusMessage = result.success ? "Feature toggles saved." : `Feature toggles save failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  function saveReplacementVariable() {
    if (!requireAdminMutation("replacement variable save")) return;
    const key = fieldValue("replacementNewKey").trim();
    const value = fieldValue("replacementNewValue");
    if (!key) {
      state.statusMessage = "Replacement variable save failed: find text is required.";
      renderPanel();
      return;
    }

    const current = window.ConfigLoader.get() || {};
    const replacementVariables = {
      ...(current.settings?.replacementVariables || {}),
      [key]: value
    };
    const result = applySettingsUpdate({ replacementVariables });
    state.statusMessage = result.success ? "Replacement variable saved." : `Replacement variable save failed: ${result.error}`;
    renderPanel();
  }

  function removeReplacementVariable(key) {
    if (!requireAdminMutation("replacement variable remove")) return;
    const current = window.ConfigLoader?.get?.() || {};
    const replacementVariables = { ...(current.settings?.replacementVariables || {}) };
    delete replacementVariables[key];
    const result = applySettingsUpdate({ replacementVariables });
    state.statusMessage = result.success ? "Replacement variable removed." : `Replacement variable remove failed: ${result.error}`;
    renderPanel();
  }

  function applyThemeEditor() {
    if (!requireAdminMutation("theme save")) return;
    const current = window.ConfigLoader?.get?.() || {};
    const theme = current.themeSettings || {};
    const next = window.ConfigLoader?.mergeConfig?.(current, {
      themeSettings: {
        ...theme,
        primaryColor: document.getElementById("adminThemePrimaryColor")?.value || theme.primaryColor,
        accentColor: document.getElementById("adminThemeAccentColor")?.value || theme.accentColor,
        backgroundMode: document.getElementById("adminThemeBackgroundMode")?.value || theme.backgroundMode,
        logoText: document.getElementById("adminThemeLogoText")?.value || theme.logoText || current.siteName,
        navStyle: document.getElementById("adminThemeNavStyle")?.value || theme.navStyle,
        layoutDensity: document.getElementById("adminThemeLayoutDensity")?.value || theme.layoutDensity
      }
    }) || current;

    const result = window.ConfigLoader?.apply?.(next) || { success: false, error: "ConfigLoader unavailable" };
    state.statusMessage = result.success ? "Theme saved successfully." : `Theme save failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  function resetThemeEditor() {
    if (!requireAdminMutation("theme reset")) return;
    const current = window.ConfigLoader?.get?.() || {};
    const next = window.ConfigLoader?.mergeConfig?.(current, {
      themeSettings: {
        primaryColor: "#3b82f6",
        accentColor: "#16a34a",
        backgroundMode: "soft",
        logoText: "WebbyOS",
        navStyle: "pills",
        layoutDensity: "comfortable"
      }
    }) || current;

    const result = window.ConfigLoader?.apply?.(next) || { success: false, error: "ConfigLoader unavailable" };
    state.statusMessage = result.success ? "Theme reset to defaults." : `Theme reset failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  function fieldValue(id) {
    return document.getElementById(id)?.value || "";
  }

  function fieldChecked(id) {
    return document.getElementById(id)?.checked === true;
  }

  async function saveNavigationItem(route) {
    try {
      await window.NavigationBuilderSystem?.saveItem?.({
        route,
        label: fieldValue(`navLabel_${route}`),
        order: Number(fieldValue(`navOrder_${route}`)),
        visibility: fieldValue(`navVisibility_${route}`),
        capability: fieldValue(`navCapability_${route}`),
        nav: fieldChecked(`navShown_${route}`),
        enabled: fieldChecked(`navEnabled_${route}`)
      });
      state.statusMessage = "Navigation item saved.";
      window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
    } catch (err) {
      state.statusMessage = `Navigation save failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function toggleBuilderNav(route, visible) {
    try {
      const item = (window.NavigationBuilderSystem?.getItems?.() || []).find((entry) => entry.route === route) || { route };
      await window.NavigationBuilderSystem?.saveItem?.({ ...item, nav: visible === true });
      state.statusMessage = visible ? "Navigation item shown." : "Navigation item hidden.";
      window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
    } catch (err) {
      state.statusMessage = `Navigation visibility failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function toggleBuilderRoute(route, enabled) {
    try {
      const item = (window.NavigationBuilderSystem?.getItems?.() || []).find((entry) => entry.route === route) || { route };
      await window.NavigationBuilderSystem?.saveItem?.({ ...item, enabled: enabled === true });
      state.statusMessage = enabled ? "Route enabled." : "Route disabled.";
      window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
    } catch (err) {
      state.statusMessage = `Route visibility failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function saveHomepageHero() {
    try {
      await window.HomepageBuilderSystem?.saveHero?.({
        kicker: fieldValue("homeHeroKicker"),
        title: fieldValue("homeHeroTitle"),
        body: fieldValue("homeHeroBody")
      });
      state.statusMessage = "Homepage hero saved.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Homepage hero save failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function saveHomepageSection(id) {
    try {
      await window.HomepageBuilderSystem?.saveSection?.({
        id,
        title: fieldValue(`homeSectionTitle_${id}`),
        order: Number(fieldValue(`homeSectionOrder_${id}`)),
        type: fieldValue(`homeSectionType_${id}`),
        widgetId: fieldValue(`homeSectionWidget_${id}`),
        enabled: fieldChecked(`homeSectionEnabled_${id}`)
      });
      state.statusMessage = "Homepage section saved.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Homepage section save failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function addHomepageSection() {
    try {
      const config = window.HomepageBuilderSystem?.getConfig?.() || { sections: [] };
      const type = fieldValue("homeNewSectionType") || "widget";
      const id = `${type}-${Date.now()}`;
      await window.HomepageBuilderSystem?.saveSection?.({
        id,
        type,
        title: fieldValue("homeNewSectionTitle") || "New Section",
        widgetId: fieldValue("homeNewSectionWidget"),
        enabled: true,
        order: (config.sections || []).length + 1
      });
      state.statusMessage = "Homepage section added.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Homepage section add failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function removeHomepageSection(id) {
    if (!window.confirm("Remove this homepage section?")) {
      return;
    }

    try {
      await window.HomepageBuilderSystem?.removeSection?.(id);
      state.statusMessage = "Homepage section removed.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Homepage section remove failed: ${err.message || err}`;
    }
    renderPanel();
  }

  function readWidgetFields(id) {
    return {
      id,
      title: fieldValue(`widgetTitle_${id}`),
      type: fieldValue(`widgetType_${id}`),
      limit: Number(fieldValue(`widgetLimit_${id}`)),
      content: fieldValue(`widgetContent_${id}`),
      enabled: fieldChecked(`widgetEnabled_${id}`)
    };
  }

  async function saveWidgetFromPanel(id) {
    try {
      await window.WidgetCoreSystem?.saveWidget?.(readWidgetFields(id));
      state.statusMessage = "Widget saved.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Widget save failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function addWidgetFromPanel() {
    try {
      await window.WidgetCoreSystem?.saveWidget?.({
        id: `widget-${Date.now()}`,
        title: fieldValue("widgetNewTitle") || "New Widget",
        type: fieldValue("widgetNewType"),
        limit: Number(fieldValue("widgetNewLimit")),
        content: fieldValue("widgetNewContent"),
        enabled: true
      });
      state.statusMessage = "Widget added.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Widget add failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function removeWidgetFromPanel(id) {
    if (!window.confirm("Remove this widget?")) {
      return;
    }

    try {
      await window.WidgetCoreSystem?.removeWidget?.(id);
      state.statusMessage = "Widget removed.";
      await window.HomeModuleUI?.refresh?.();
    } catch (err) {
      state.statusMessage = `Widget remove failed: ${err.message || err}`;
    }
    renderPanel();
  }

  async function loadTemplateSource(templateId, targetId) {
    const template = getEditableTemplate(templateId);
    const target = document.getElementById(targetId);
    if (!template || !target) return;

    try {
      const response = await fetch(template.path);
      if (!response.ok) throw new Error(`Source load failed: ${response.status}`);
      target.value = await response.text();
    } catch (err) {
      target.value = `Unable to load ${template.path}: ${err.message || err}`;
    }
  }

  function switchEditableTemplate(templateId) {
    state.activeTemplate = getEditableTemplate(templateId).id;
    if (state.visible) renderPanel();
  }

  function copyTemplateSource() {
    const source = document.getElementById("adminTemplateSource")?.value || "";
    const override = document.getElementById("adminTemplateOverride");
    if (override) override.value = source;
  }

  function getTemplateOverrides() {
    return { ...(window.ConfigLoader.get()?.settings?.templateOverrides || {}) };
  }

  function applySettingsUpdate(settingsPatch) {
    const current = window.ConfigLoader.get() || {};
    const next = window.ConfigLoader.mergeConfig?.(current, {
      settings: {
        ...(current.settings || {}),
        ...settingsPatch
      }
    }) || current;
    return window.ConfigLoader.apply(next);
  }

  function saveTemplateOverride(templateId) {
    const template = getEditableTemplate(templateId);
    const value = document.getElementById("adminTemplateOverride")?.value || "";
    if (template.requiredToken && !value.includes(template.requiredToken)) {
      state.statusMessage = `Template save failed: ${template.requiredToken} is required.`;
      renderPanel();
      return;
    }

    if (template.type === "css") {
      saveCustomCss(value);
      return;
    }

    const overrides = getTemplateOverrides();
    if (value.trim()) {
      overrides[template.id] = value;
    } else {
      delete overrides[template.id];
    }

    const result = applySettingsUpdate({ templateOverrides: overrides });
    state.statusMessage = result.success ? "Template override saved." : `Template save failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  function resetTemplateOverride(templateId) {
    const template = getEditableTemplate(templateId);
    if (template.type === "css") {
      resetCustomCss();
      return;
    }

    const overrides = getTemplateOverrides();
    delete overrides[template.id];
    const result = applySettingsUpdate({ templateOverrides: overrides });
    state.statusMessage = result.success ? "Template override removed." : `Template reset failed: ${result.error}`;
    renderPanel();
    window.Runtime?.navigate?.(window.Runtime.getState?.().route || "home", { updateHash: false });
  }

  function saveCustomCss(value = null) {
    const current = window.ConfigLoader.get() || {};
    const theme = current.themeSettings || {};
    const next = window.ConfigLoader.mergeConfig?.(current, {
      themeSettings: {
        ...theme,
        customCss: value ?? (document.getElementById("adminThemeCustomCss")?.value || "")
      }
    }) || current;
    const result = window.ConfigLoader.apply(next);
    state.statusMessage = result.success ? "CSS override saved." : `CSS save failed: ${result.error}`;
    renderPanel();
  }

  function resetCustomCss() {
    saveCustomCss("");
  }

  function hidePanel() {
    if (panel) panel.style.display = "none";
    state.visible = false;
  }

  function refresh() {
    if (state.visible) renderPanel();
  }

  function openRuntimeInspector() {
    try {
      const root = getOverlayRoot();
      let overlay = document.getElementById('runtimeInspectorOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'runtimeInspectorOverlay';
        overlay.className = 'inspector-overlay';
        root.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div class="inspector-modal">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div class="inspector-title">Runtime Inspector</div>
            <div><button onclick="document.getElementById('runtimeInspectorOverlay').remove()" class="admin-button-secondary">Close</button></div>
          </div>
          ${window.RuntimeInspector?.renderCard ? window.RuntimeInspector.renderCard() : '<div class="inspector-empty">RuntimeInspector unavailable</div>'}
        </div>
      `;
    } catch (err) {
      state.statusMessage = `Inspector open failed: ${err.message || err}`;
      renderPanel();
    }
  }

  return {
    init,
    logout,
    requireAuth,
    switchTab,
    switchCategory,
    switchSub,
    toggleModuleEnabled,
    togglePluginEnabled,
    toggleRouteEnabled,
    applyConfigEditor,
    resetConfigEditor,
    saveSiteSettings,
    saveFeatureToggles,
    saveReplacementVariable,
    removeReplacementVariable,
    applyThemeEditor,
    resetThemeEditor,
    saveNavigationItem,
    toggleBuilderNav,
    toggleBuilderRoute,
    saveHomepageHero,
    saveHomepageSection,
    addHomepageSection,
    removeHomepageSection,
    saveWidgetFromPanel,
    addWidgetFromPanel,
    removeWidgetFromPanel,
    switchEditableTemplate,
    copyTemplateSource,
    saveTemplateOverride,
    resetTemplateOverride,
    saveCustomCss,
    resetCustomCss,
    loadMediaPanel,
    deleteMediaItem,
    loadCmsPanel,
    saveCategoryFromPanel,
    saveTagFromPanel,
    refresh,
    updateButtonState,
    openPanel,
    hidePanel
    ,
    openRuntimeInspector
  };

})();

window.AdminSystemCore = AdminSystemCore;
