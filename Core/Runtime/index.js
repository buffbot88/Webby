const Runtime = (() => {

  const state = {
    route: null,
    recovery: {
      bootFallbackRoute: null,
      routeFailures: {},
      crashCount: 0,
      routeHistory: [],
      recoveryMode: false,
      diagnosticsOnly: false,
      pluginDisabled: false,
      moduleDisabled: false,
      layoutFallbackUsed: false
    }
  };

  const safeMode = {
    safeBoot: false,
    pluginDisableMode: false,
    diagnosticsOnlyBoot: false,
    moduleDisableMode: false,
    fallbackLayoutBootMode: false
  };

  const sharedState = {
    activeRoute: null,
    currentLayout: null,
    loadedModules: [],
    loadedPlugins: [],
    loadedFeatures: [],
    featureFlags: {},
    config: {},
    safeMode: { ...safeMode },
    diagnostics: { logs: 0, warnings: 0, errors: 0 },
    registry: {},
    moduleHealth: [],
    pluginHealth: [],
    packagesReady: false,
    installedPackages: [],
    packageWarnings: [],
    packageErrors: [],
    packageCapabilities: [],
    packageRoutes: [],
    dataHealth: null,
    booted: false
  };

  let booted = false;
  let hashListenerAttached = false;
  let navigationSequence = 0;

  const MAX_ROUTE_FAILURES = 3;
  const MAX_ROUTE_HISTORY = 10;
  const ROUTE_LOOP_WINDOW_MS = 30000;
  const MAX_RUNTIME_CRASHES = 5;

  const el = (id) => document.getElementById(id);

  function getHashRoute() {
    return window.location.hash?.replace(/^#/, "") || "home";
  }

  function cloneValue(item) {
    if (item === null || typeof item !== "object") return item;

    try {
      return JSON.parse(JSON.stringify(item));
    } catch {
      return item;
    }
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  function getFallbackRouteName() {
    return Object.keys(RegistryEngine.getAll() || {})
      .find(name => RegistryEngine.resolveRoute(name)) || null;
  }

  function pruneRouteHistory() {
    const threshold = Date.now() - ROUTE_LOOP_WINDOW_MS;

    state.recovery.routeHistory =
      state.recovery.routeHistory.filter(entry => entry.timestamp >= threshold);
  }

  function detectRouteLoop(name) {
    pruneRouteHistory();

    const recent = state.recovery.routeHistory.filter(entry => entry.route === name && entry.success === false);

    if (recent.length >= MAX_ROUTE_FAILURES) {
      state.recovery.diagnosticsOnly = true;
      safeMode.diagnosticsOnlyBoot = true;

      Diagnostics.warn("[Runtime] detected repeated route attempts, enabling diagnostics-only mode", {
        route: name,
        attempts: recent.length
      });

      return true;
    }

    return false;
  }

  function trackRouteAttempt(name, success = true) {
    state.recovery.routeHistory.push({
      route: name,
      timestamp: Date.now(),
      success
    });

    if (state.recovery.routeHistory.length > MAX_ROUTE_HISTORY) {
      state.recovery.routeHistory.shift();
    }

    pruneRouteHistory();

    if (!success) {
      state.recovery.routeFailures[name] =
        (state.recovery.routeFailures[name] || 0) + 1;

      if (state.recovery.routeFailures[name] >= MAX_ROUTE_FAILURES) {
        state.recovery.recoveryMode = true;

        Diagnostics.warn("[Runtime] route entering recovery after repeated failures", {
          route: name,
          count: state.recovery.routeFailures[name]
        });
      }
    }
  }

  function recordRuntimeCrash(err) {
    state.recovery.crashCount += 1;

    if (state.recovery.crashCount >= MAX_RUNTIME_CRASHES) {
      state.recovery.diagnosticsOnly = true;
      safeMode.diagnosticsOnlyBoot = true;

      Diagnostics.warn("[Runtime] entering diagnostics-only mode after repeated crashes", {
        count: state.recovery.crashCount,
        error: err?.message || String(err)
      });
    }
  }

  function buildSharedState(update = {}) {

    const config = update.config ?? ConfigLoader.get() ?? {};
    const registry = update.registry ?? RegistryEngine.getAll() ?? {};

    const rawModuleHealth = update.moduleHealth ?? ModuleLoader.getHealth();
    const rawPluginHealth = update.pluginHealth ?? PluginEngine.getHealth();

    const moduleHealth = toArray(rawModuleHealth);
    const pluginHealth = toArray(rawPluginHealth);

    const featureFlags = update.featureFlags ?? config.features ?? {};

    const loadedModules = Array.from(new Set(
      update.loadedModules ??
      moduleHealth
        .map(entry => entry.id || entry.moduleId)
        .filter(Boolean)
    ));

    const loadedPlugins = Array.from(new Set(
      update.loadedPlugins ??
      pluginHealth
        .map(entry => entry.pluginId || entry.id)
        .filter(Boolean)
    ));

    const loadedFeatures = Array.from(new Set(
      update.loadedFeatures ?? sharedState.loadedFeatures ?? []
    ));

    const currentUser = update.currentUser ?? sharedState.currentUser ?? null;
    const currentRole = update.currentRole ?? sharedState.currentRole ?? (currentUser?.role || "guest");
    const userCapabilities = Array.from(new Set(
      update.userCapabilities ?? sharedState.userCapabilities ?? []
    ));
    const isAuthenticated = update.isAuthenticated ?? sharedState.isAuthenticated ?? !!currentUser;
    const dataReady = update.dataReady ?? sharedState.dataReady ?? false;
    const dataMode = update.dataMode ?? sharedState.dataMode ?? null;
    const dataStores = Array.isArray(update.dataStores)
      ? update.dataStores
      : Array.isArray(sharedState.dataStores)
        ? sharedState.dataStores
        : [];
    const packagesReady = update.packagesReady ?? sharedState.packagesReady ?? false;
    const installedPackages = Array.isArray(update.installedPackages)
      ? update.installedPackages
      : Array.isArray(sharedState.installedPackages)
        ? sharedState.installedPackages
        : [];
    const packageWarnings = Array.isArray(update.packageWarnings)
      ? update.packageWarnings
      : Array.isArray(sharedState.packageWarnings)
        ? sharedState.packageWarnings
        : [];
    const packageErrors = Array.isArray(update.packageErrors)
      ? update.packageErrors
      : Array.isArray(sharedState.packageErrors)
        ? sharedState.packageErrors
        : [];
    const packageCapabilities = Array.isArray(update.packageCapabilities)
      ? update.packageCapabilities
      : Array.isArray(sharedState.packageCapabilities)
        ? sharedState.packageCapabilities
        : [];
    const packageRoutes = Array.isArray(update.packageRoutes)
      ? update.packageRoutes
      : Array.isArray(sharedState.packageRoutes)
        ? sharedState.packageRoutes
        : [];
    const dataHealth = update.dataHealth ?? sharedState.dataHealth ?? null;

    return {
      activeRoute: update.activeRoute ?? state.route ?? sharedState.activeRoute,
      currentLayout: update.currentLayout ?? sharedState.currentLayout,
      currentUser: cloneValue(currentUser),
      currentRole,
      userCapabilities,
      isAuthenticated,
      dataReady,
      dataMode,
      dataStores,
      dataHealth: cloneValue(dataHealth),
      packagesReady,
      installedPackages: cloneValue(installedPackages),
      packageWarnings: cloneValue(packageWarnings),
      packageErrors: cloneValue(packageErrors),
      packageCapabilities: cloneValue(packageCapabilities),
      packageRoutes: cloneValue(packageRoutes),
      loadedModules,
      loadedPlugins,
      loadedFeatures,
      featureFlags: cloneValue(featureFlags),
      config: cloneValue(config),
      safeMode: {
        ...safeMode,
        ...sharedState.safeMode,
        ...(update.safeMode || {})
      },
      diagnostics: {
        logs: Diagnostics.getLogs().length,
        warnings: Diagnostics.getWarnings().length,
        errors: Diagnostics.getErrors().length
      },
      registry: cloneValue(registry),
      moduleHealth: cloneValue(moduleHealth),
      pluginHealth: cloneValue(pluginHealth),
      booted
    };
  }

  function normalizeHealthRecords(records) {
    return toArray(records)
      .map(entry => ({
        id: entry.id || entry.moduleId || entry.pluginId || null,
        quarantined: !!entry.quarantined,
        disabled: !!entry.disabled || !!entry.adminDisabled,
        status: entry.status || null
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  function normalizeRegistry(routes) {
    return Object.entries(routes || {})
      .sort()
      .map(([key, route]) => ({
        key,
        enabled: route.enabled !== false,
        layout: route.layout || null,
        auth: route.auth === true,
        id: route.id || key
      }));
  }

  function detectStateDrift() {
    const actual = {
      config: ConfigLoader.get(),
      registry: RegistryEngine.getAll(),
      moduleHealth: ModuleLoader.getHealth(),
      pluginHealth: PluginEngine.getHealth(),
      safeMode: { ...safeMode },
      activeRoute: state.route,
      booted,
      currentUser: window.UserCoreSystem?.getCurrentUser?.() ?? null,
      currentRole: window.UserCoreSystem?.isAuthenticated?.() ? window.UserCoreSystem?.getCurrentUser?.()['role'] ?? null : null,
      userCapabilities: window.UserCoreSystem?.getCapabilities?.() ?? [],
      isAuthenticated: window.UserCoreSystem?.isAuthenticated?.() ?? false,
      diagnostics: {
        logs: Diagnostics.getLogs().length,
        warnings: Diagnostics.getWarnings().length,
        errors: Diagnostics.getErrors().length
      }
    };

    const drift = [];

    if (JSON.stringify(actual.config) !== JSON.stringify(sharedState.config)) {
      drift.push("config");
    }

    if (JSON.stringify(normalizeRegistry(actual.registry)) !== JSON.stringify(normalizeRegistry(sharedState.registry))) {
      drift.push("registry");
    }

    if (JSON.stringify(normalizeHealthRecords(actual.moduleHealth)) !== JSON.stringify(normalizeHealthRecords(sharedState.moduleHealth))) {
      drift.push("moduleHealth");
    }

    if (JSON.stringify(normalizeHealthRecords(actual.pluginHealth)) !== JSON.stringify(normalizeHealthRecords(sharedState.pluginHealth))) {
      drift.push("pluginHealth");
    }

    if (JSON.stringify(actual.safeMode) !== JSON.stringify(sharedState.safeMode)) {
      drift.push("safeMode");
    }

    if (JSON.stringify(actual.currentUser) !== JSON.stringify(sharedState.currentUser)) {
      drift.push("currentUser");
    }

    if (actual.currentRole !== sharedState.currentRole) {
      drift.push("currentRole");
    }

    if (JSON.stringify(actual.userCapabilities) !== JSON.stringify(sharedState.userCapabilities)) {
      drift.push("userCapabilities");
    }

    if (actual.isAuthenticated !== sharedState.isAuthenticated) {
      drift.push("isAuthenticated");
    }

    if (actual.activeRoute !== sharedState.activeRoute) {
      drift.push("activeRoute");
    }

    if (actual.booted !== sharedState.booted) {
      drift.push("booted");
    }

    if (actual.diagnostics.logs !== sharedState.diagnostics.logs) {
      drift.push("diagnostics.logs");
    }

    if (actual.diagnostics.warnings !== sharedState.diagnostics.warnings) {
      drift.push("diagnostics.warnings");
    }

    if (actual.diagnostics.errors !== sharedState.diagnostics.errors) {
      drift.push("diagnostics.errors");
    }

    if (drift.length) {
      Diagnostics.warn("[Runtime] shared state drift detected", { drift });
    }

    return drift;
  }

  function updateRuntimeState(update = {}) {
    const nextState = buildSharedState(update);

    Object.assign(sharedState, nextState);

    if (window.RuntimeInspector?.refresh) {
      window.RuntimeInspector.refresh();
    }

    if (window.AdminSystemCore?.refresh) {
      window.AdminSystemCore.refresh();
    }

    if (window.AdminSystemCore?.updateButtonState) {
      window.AdminSystemCore.updateButtonState();
    }

    return cloneValue(sharedState);
  }

  function validateSharedState() {
    const drift = detectStateDrift();

    if (drift.length) {
      updateRuntimeState();
    }

    return {
      drift,
      shared: cloneValue(sharedState)
    };
  }

  function auditNavigationIntegrity() {
    const registry = RegistryEngine.getAll() || {};
    const issues = [];
    const ids = new Map();

    Object.entries(registry).forEach(([name, route]) => {
      const id =
        typeof route?.id === "string" && route.id.trim()
          ? route.id
          : name;

      if (ids.has(id)) {
        issues.push(`duplicate route id ${id} between ${ids.get(id)} and ${name}`);
      } else {
        ids.set(id, name);
      }

      if (route?.type !== "page") {
        issues.push(`route ${name} has invalid type ${route?.type}`);
      }

      if (typeof route?.layout !== "string" || !route.layout.trim()) {
        issues.push(`route ${name} missing or invalid layout`);
      }

      if (!window.ModuleRegistry?.[id]) {
        issues.push(`route ${name} points to missing module ${id}`);
      }
    });

    const fallback = getFallbackRouteName();

    if (!fallback) {
      issues.push("no fallback route available");
    }

    const currentHash = getHashRoute();

    if (currentHash && !RegistryEngine.resolveRoute(currentHash)) {
      issues.push(`hash route ${currentHash} is not resolvable`);
    }

    if (issues.length) {
      Diagnostics.warn("[Runtime] navigation integrity issues detected", { issues });
    }

    return { issues, fallback };
  }

  function injectFailure(type) {
    switch (type) {

      case "missing-module":
        ModuleLoader.load({
          id: "__validation_missing_module__",
          layout: "default",
          features: []
        }, { state });
        break;

      case "invalid-route":
        navigate("__validation_invalid_route__", { updateHash: false });
        break;

      case "plugin-crash":
        PluginEngine.register("__validation_plugin_crash__", {
          init() {},
          mount() {
            throw new Error("Injected plugin crash");
          }
        });
        PluginEngine.mountAll({ state });
        break;

      case "malformed-config":
        ConfigLoader.apply?.({ bad: "payload" });
        break;

      default:
        Diagnostics.warn("[Runtime] unknown failure injection type", { type });
    }

    updateRuntimeState();
  }

  async function runRecoveryValidation() {
    await navigate("__validation_invalid_route__", { updateHash: false });
    await navigate("__validation_invalid_route__", { updateHash: false });
    await navigate("__validation_invalid_route__", { updateHash: false });

    return validateSharedState();
  }

  async function runStabilityCheck(iterations = 3) {
    const routeNames = Object.keys(RegistryEngine.getAll() || {});
    const pluginIds = PluginEngine.getHealth()
      .map(entry => entry.pluginId || entry.id)
      .filter(Boolean);

    const moduleIds = toArray(ModuleLoader.getHealth())
      .map(entry => entry.id || entry.moduleId)
      .filter(Boolean);

    const report = [];

    const togglePlugin = (id) => {
      const record = PluginEngine.getHealth()
        .find(entry => (entry.pluginId || entry.id) === id);

      if (!record) return false;

      return PluginEngine.setPluginEnabled(id, !record.disabled);
    };

    const toggleModule = (id) => {
      const record = toArray(ModuleLoader.getHealth())
        .find(entry => (entry.id || entry.moduleId) === id);

      if (!record) return false;

      return ModuleLoader.setModuleEnabled(id, !record.adminDisabled);
    };

    for (let idx = 0; idx < iterations; idx += 1) {
      const route = routeNames[idx % routeNames.length];

      if (route) {
        await navigate(route, { updateHash: false });
      }

      if (pluginIds.length) {
        const pluginId = pluginIds[idx % pluginIds.length];
        const before = PluginEngine.getHealth()
          .find(entry => (entry.pluginId || entry.id) === pluginId);

        const toggled = togglePlugin(pluginId);
        togglePlugin(pluginId);

        report.push({
          type: "plugin-toggle",
          pluginId,
          toggled,
          beforeState: before
        });
      }

      if (moduleIds.length) {
        const moduleId = moduleIds[idx % moduleIds.length];
        const before = toArray(ModuleLoader.getHealth())
          .find(entry => (entry.id || entry.moduleId) === moduleId);

        const toggled = toggleModule(moduleId);
        toggleModule(moduleId);

        report.push({
          type: "module-toggle",
          moduleId,
          toggled,
          beforeState: before
        });
      }

      const drift = validateSharedState().drift;

      report.push({
        iteration: idx + 1,
        drift
      });
    }

    if (report.some(item => item.drift && item.drift.length)) {
      Diagnostics.warn("[Runtime] stability check detected drift during repeated operations", {
        report
      });
    }

    return report;
  }

  async function runSystemValidationSuite(options = {}) {
    const initial = validateSharedState();
    const navigation = auditNavigationIntegrity();
    const failures = [];

    for (const type of [
      "missing-module",
      "invalid-route",
      "plugin-crash",
      "malformed-config"
    ]) {
      injectFailure(type);

      failures.push({
        type,
        drift: validateSharedState().drift
      });
    }

    const recovery = await runRecoveryValidation();
    const stability = await runStabilityCheck(options.iterations || 3);

    const summary = {
      mode: options.mode || "logic",
      initial,
      navigation,
      failures,
      recovery,
      stability
    };

    Diagnostics.info("[Runtime] system validation suite completed", summary);

    return summary;
  }

  async function init() {
    Lifecycle.emit("boot:start", { state: "starting" });

    try {
      await ConfigLoader.load();
      await RegistryEngine.load();

      if (!RegistryEngine.validate()) {
        throw new Error("No valid registry routes loaded");
      }

      state.recovery.bootFallbackRoute = getFallbackRouteName();

      if (!state.recovery.bootFallbackRoute) {
        Diagnostics.warn("[Runtime] no safe boot fallback route available");
      }

      PluginEngine.mountAll({ state });

      if (window.DataCoreSystem?.init) {
        await window.DataCoreSystem.init();
      }

      if (window.PackageCoreSystem?.init) {
        await window.PackageCoreSystem.init();
      }

      if (window.ConfigLoader?.loadStoredOverride) {
        await window.ConfigLoader.loadStoredOverride();
      }

      if (window.ContentCoreSystem?.init) {
        await window.ContentCoreSystem.init();
      }

      if (window.UserCoreSystem?.init) {
        await window.UserCoreSystem.init();
      }

      if (window.NotificationCoreSystem?.init) {
        await window.NotificationCoreSystem.init();
      }

      if (window.ReactionCoreSystem?.init) {
        await window.ReactionCoreSystem.init();
      }

      if (window.BookmarkCoreSystem?.init) {
        await window.BookmarkCoreSystem.init();
      }

      if (window.ActivityFeedCoreSystem?.init) {
        await window.ActivityFeedCoreSystem.init();
      }

      if (window.MessagingCoreSystem?.init) {
        await window.MessagingCoreSystem.init();
      }

      if (window.ModerationCoreSystem?.init) {
        await window.ModerationCoreSystem.init();
      }

      if (window.ReputationCoreSystem?.init) {
        await window.ReputationCoreSystem.init();
      }

      if (window.MediaCoreSystem?.init) {
        await window.MediaCoreSystem.init();
      }

      if (window.CategoryCoreSystem?.init) {
        await window.CategoryCoreSystem.init();
      }

      if (window.TagCoreSystem?.init) {
        await window.TagCoreSystem.init();
      }

      if (window.RevisionCoreSystem?.init) {
        await window.RevisionCoreSystem.init();
      }

      if (window.SearchCoreSystem?.init) {
        await window.SearchCoreSystem.init();
      }

      if (window.WidgetCoreSystem?.init) {
        await window.WidgetCoreSystem.init();
      }

      if (window.NavigationBuilderSystem?.init) {
        await window.NavigationBuilderSystem.init();
      }

      if (window.HomepageBuilderSystem?.init) {
        await window.HomepageBuilderSystem.init();
      }

      const sessionState = window.UserCoreSystem?.getSessionState?.() || {};

      updateRuntimeState({
        config: ConfigLoader.get(),
        registry: RegistryEngine.getAll(),
        safeMode: { ...safeMode },
        loadedFeatures: [],
        activeRoute: state.route,
        currentLayout: null,
        moduleHealth: ModuleLoader.getHealth(),
        pluginHealth: PluginEngine.getHealth(),
        ...sessionState
      });

      AdminSystemCore.init();

      booted = true;

      updateRuntimeState({ booted });

      const routeName = getHashRoute();

      await navigate(routeName, {
        updateHash: false,
        bootPhase: true
      });

      Lifecycle.emit("boot:complete", { state: "complete" });

      if (window.RuntimeInspector?.init) {
        window.RuntimeInspector.init();
      }

      if (!hashListenerAttached) {
        window.addEventListener("hashchange", () => {
          const nextRoute = getHashRoute();

          if (nextRoute !== state.route) {
            navigate(nextRoute, { updateHash: false });
          }
        });
        hashListenerAttached = true;
      }

    } catch (err) {
      recordRuntimeCrash(err);

      Diagnostics.error("[Runtime] initialization failed", err);

      Lifecycle.emit("runtime:error", {
        message: err.message || "Runtime initialization failed",
        error: err
      });

      Diagnostics.renderError("WebbyOS failed to initialize. Check console for details.");
    }
  }

  async function navigate(name, options = {}) {
    if (!booted) return;

    const { updateHash = true, bootPhase = false } = options;
    const navToken = ++navigationSequence;

    const targetName =
      typeof name === "string"
        ? name
        : state.recovery.bootFallbackRoute;

    if (!targetName) {
      Diagnostics.error("[Runtime] no target route provided to navigate");
      return;
    }

    if (detectRouteLoop(targetName)) {
      Diagnostics.warn("[Runtime] route loop detected, preserving current state", {
        route: targetName
      });
      return;
    }

    let route = RegistryEngine.resolveRoute(targetName);

    if (!route) {
      const fallback = state.recovery.bootFallbackRoute || getFallbackRouteName();

      if (!fallback) {
        Diagnostics.error("[Runtime] no valid route available", {
          route: targetName
        });
        trackRouteAttempt(targetName, false);
        Diagnostics.renderError("No valid route available.");
        return;
      }

      if (fallback === targetName) {
        Diagnostics.error("[Runtime] no route available after fallback", {
          route: targetName
        });
        trackRouteAttempt(targetName, false);
        Diagnostics.renderError("No valid route available.");
        return;
      }

      Diagnostics.warn("[Runtime] route not found, falling back", {
        route: targetName,
        fallback
      });

      trackRouteAttempt(targetName, false);

      route = RegistryEngine.resolveRoute(fallback);
    }

    if (!route) {
      Diagnostics.renderError("Unable to resolve a route for rendering.");
      return;
    }

    if (window.UserCoreSystem?.isRouteAccessible && !window.UserCoreSystem.isRouteAccessible(route)) {
      const reason = window.UserCoreSystem.getRouteDeniedReason?.(route) || "Access denied";

      Diagnostics.warn("[Runtime] route access denied", {
        route: route.id,
        reason
      });

      if (!window.UserCoreSystem.isAuthenticated?.()) {
        await navigate("account", { updateHash: true });
        return;
      }

      Diagnostics.renderError("Access denied. You do not have permission to view this page.");
      return;
    }

    try {
      const layout = await LayoutEngine.load(route.layout || "default");
      const moduleHTML = ModuleLoader.load(route, { state });
      const finalHTML = LayoutEngine.inject(layout, moduleHTML, { route: route.id });

      if (navToken !== navigationSequence) {
        Diagnostics.info("[Runtime] discarded stale navigation render", {
          route: targetName,
          activeToken: navigationSequence,
          staleToken: navToken
        });
        return;
      }

      const app = el("app");

      if (app) {
        app.innerHTML = finalHTML;
      }

      state.route = route.id;

      updateRuntimeState({
        activeRoute: route.id,
        currentLayout: route.layout,
        loadedFeatures: route.features || []
      });

      trackRouteAttempt(route.id, true);
      state.recovery.routeFailures[route.id] = 0;

      if (updateHash && route.id) {
        const targetHash = `#${route.id}`;

        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      }

      Lifecycle.emit("route:change", { route });
      PluginEngine.trigger("route", route);

    } catch (err) {
      state.recovery.routeFailures[targetName] =
        (state.recovery.routeFailures[targetName] || 0) + 1;
      trackRouteAttempt(targetName, false);

      recordRuntimeCrash(err);

      Diagnostics.error("[Runtime] navigation failed", {
        route: targetName,
        error: err
      });

      Lifecycle.emit("runtime:error", {
        message: err.message || "Navigation failed",
        error: err
      });

      if (!bootPhase && targetName !== state.recovery.bootFallbackRoute && state.recovery.bootFallbackRoute) {
        Diagnostics.warn("[Runtime] retrying with safe fallback route", {
          fallback: state.recovery.bootFallbackRoute
        });

        await navigate(state.recovery.bootFallbackRoute, {
          updateHash,
          bootPhase: true
        });

      } else {
        Diagnostics.renderError("Route rendering failed. Check diagnostics for details.");
      }
    }
  }

  function getState() {
    return {
      route: state.route,
      booted,
      safeMode: { ...safeMode },
      recovery: { ...state.recovery }
    };
  }

  function getSharedState() {
    return cloneValue(sharedState);
  }
  
  function renderPublicNav() {
    if (window.NavigationBuilderSystem?.renderPublicNav) {
      return window.NavigationBuilderSystem.renderPublicNav();
    }

    const registry = RegistryEngine.getAll() || {};

    return Object.values(registry)
      .filter(route =>
        route &&
        route.type === "page" &&
        route.enabled !== false &&
        route.auth !== true &&
        route.nav !== false
      )
      .map(route => {
        const id = route.id;
        const label = route.label || route.title || route.id;

        return `
          <button onclick="Runtime.navigate('${id}')">
            ${Diagnostics.escapeText(label)}
          </button>
        `;
      })
      .join("");
  }

  return {
    init,
    navigate,

    getState,
    getSharedState,
    updateRuntimeState,

    validateSharedState,
	renderPublicNav,
    injectFailure,
    auditNavigationIntegrity,
    runRecoveryValidation,
    runStabilityCheck,
    runSystemValidationSuite,

    safeMode
  };

})();

window.Runtime = Runtime;
