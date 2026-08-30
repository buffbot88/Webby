const RuntimeInspector = (() => {
  const uiState = {
    filterType: "all"
  };

  function renderSection(title, content) {
    return `
      <div class="inspector-section">
        <div class="inspector-section-title">${Diagnostics.escapeText(title)}</div>
        <div>${content}</div>
      </div>
    `;
  }

  function renderList(items, emptyLabel = "None") {
    if (!items || !items.length) return `<div class="inspector-empty">${Diagnostics.escapeText(emptyLabel)}</div>`;
    return `<div class="inspector-log-list">${items.map((item) => `<div class="inspector-log-item">${Diagnostics.escapeText(item)}</div>`).join("")}</div>`;
  }

  function renderRouteTable(routes) {
    if (!routes || !Object.keys(routes).length) {
      return `<div class="inspector-empty">No route registry available</div>`;
    }

    const rows = Object.entries(routes).map(([name, route]) => {
      const status = route.enabled === false ? "disabled" : "active";
      return `
        <tr>
          <td>${Diagnostics.escapeText(name)}</td>
          <td>${Diagnostics.escapeText(route.layout)}</td>
          <td>${Diagnostics.escapeText(String(route.auth))}</td>
          <td><span class="${status === "active" ? "admin-badge admin-badge-success" : "admin-badge"}">${Diagnostics.escapeText(status)}</span></td>
        </tr>
      `;
    }).join("");

    return `
      <div style="overflow:auto;">
        <table class="table-clean">
          <thead>
            <tr>
              <th>Route</th>
              <th>Layout</th>
              <th>Auth</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderLogToolbar() {
    const types = ["all", "info", "warn", "error"];
    return `
      <div class="admin-actions" style="margin-bottom:10px;">
        ${types.map((type) => `<button class="admin-tab ${uiState.filterType === type ? "active" : ""}" onclick="window.RuntimeInspector.toggleFilter('${type}')">${Diagnostics.escapeText(type)}</button>`).join("")}
      </div>
    `;
  }

  function filterLogs(items) {
    if (uiState.filterType === "all") return items;
    return items.filter((item) => item.type === uiState.filterType);
  }

  function getSharedState() {
    return Runtime?.getSharedState?.() || {};
  }

  function renderCard() {
    const shared = getSharedState();
    const logEntries = filterLogs(
      (Diagnostics.getErrors().concat(Diagnostics.getWarnings(), Diagnostics.getLogs()) || [])
        .map((entry) => ({ ...entry, type: entry.type || "info" }))
        .sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")))
    );

    const registry = shared.registry || {};
    const safeMode = shared.safeMode || {};
    const moduleHealth = shared.moduleHealth || [];
    const pluginHealth = shared.pluginHealth || [];
    const installedPackages = shared.installedPackages || [];
    const registryInspection = RegistryEngine.inspect?.() || {};
    const recovery = Runtime?.getState?.()?.recovery || {};

    const diagnosticsSummary = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <span class="admin-badge admin-badge-warning">Warnings: ${shared.diagnostics?.warnings ?? 0}</span>
        <span class="admin-badge admin-badge-danger">Errors: ${shared.diagnostics?.errors ?? 0}</span>
        <span class="admin-badge">Plugins: ${shared.loadedPlugins?.length ?? 0}</span>
        <span class="admin-badge">Modules: ${shared.loadedModules?.length ?? 0}</span>
        <span class="admin-badge">Packages: ${installedPackages.length}</span>
      </div>
    `;

    return `
      <div class="inspector-card">
        <div class="inspector-header">
          <div>
            <div class="inspector-title">WebbyOS Inspector</div>
            <div class="admin-muted">Runtime state, diagnostics, registry, module, and plugin health.</div>
          </div>
          ${diagnosticsSummary}
        </div>
        ${renderSection("Boot status", `<div>${Diagnostics.escapeText(shared.booted ? "complete" : "pending")}</div>`)}
        ${renderSection("Active route", `<div>${Diagnostics.escapeText(shared.activeRoute || "None")}</div>`)}
        ${renderSection("Current layout", `<div>${Diagnostics.escapeText(shared.currentLayout || "None")}</div>`)}
        ${renderSection("Runtime events", `${renderLogToolbar()}${renderList(logEntries.map((entry) => `${entry.timestamp} - ${String(entry.type).toUpperCase()}: ${entry.message}`), "No events")}`)}
        ${renderSection("Registered routes", renderRouteTable(registry))}
        ${renderSection("Loaded plugins", renderList(shared.loadedPlugins))}
        ${renderSection("Loaded modules", renderList(shared.loadedModules))}
        ${renderSection("Loaded features", renderList(shared.loadedFeatures))}
        ${renderSection("Route health", `<div>Total: ${Object.keys(registry).length}<br>Active: ${Object.values(registry).filter((route) => route.enabled !== false).length}<br>Disabled: ${Object.values(registry).filter((route) => route.enabled === false).length}<br>Invalid: ${Object.values(registry).filter((route) => !route || route.type !== "page").length}</div>`)}
        ${renderSection("Module health", `<div>Quarantined modules: ${moduleHealth.filter((entry) => entry.quarantined).length}<br>${Diagnostics.escapeText((moduleHealth.filter((entry) => entry.quarantined).map((entry) => entry.moduleId) || []).join(", ") || "None")}</div>`)}
        ${renderSection("Plugin health", `<div>Quarantined plugins: ${pluginHealth.filter((entry) => entry.quarantined).length}<br>${Diagnostics.escapeText((pluginHealth.filter((entry) => entry.quarantined).map((entry) => entry.pluginId) || []).join(", ") || "None")}</div>`)}
        ${renderSection("Package health", `<div>Ready: ${shared.packagesReady ? "yes" : "no"}<br>Warnings: ${(shared.packageWarnings || []).length}<br>Errors: ${(shared.packageErrors || []).length}<br>Routes: ${(shared.packageRoutes || []).length}<br>Capabilities: ${(shared.packageCapabilities || []).length}</div>`)}
        ${renderSection("Crash counters", `<div>Runtime crash count: ${recovery.crashCount || 0}</div>`)}
        ${renderSection("Safe mode flags", `<div>${Object.entries(safeMode).map(([key, value]) => `${Diagnostics.escapeText(key)}: ${Diagnostics.escapeText(String(value))}`).join("<br>") || "None"}</div>`)}
        ${renderSection("Registry diagnostics", `
          <div style="font-size:12px;margin-bottom:6px;">Duplicate routes</div>
          ${renderList(registryInspection.duplicateRoutes || [])}
          <div style="font-size:12px;margin:8px 0 6px 0;">Invalid contracts</div>
          ${renderList(registryInspection.invalidContracts || [])}
          <div style="font-size:12px;margin:8px 0 6px 0;">Disabled routes</div>
          ${renderList(registryInspection.disabledRoutes || [])}
          <div style="font-size:12px;margin:8px 0 6px 0;">Missing layouts</div>
          ${renderList(registryInspection.missingLayouts || [])}
          <div style="font-size:12px;margin:8px 0 6px 0;">Missing modules</div>
          ${renderList(registryInspection.missingModules || [])}
        `)}
      </div>
    `;
  }

  function toggleFilter(filterType) {
    uiState.filterType = filterType;
    window.AdminSystemCore?.refresh?.();
  }

  function refresh() {
    window.AdminSystemCore?.refresh?.();
  }

  function init() {
    refresh();
  }

  return {
    init,
    renderCard,
    toggleFilter,
    refresh
  };
})();

window.RuntimeInspector = RuntimeInspector;
