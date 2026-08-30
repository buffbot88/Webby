const PackageCoreSystem = (() => {
  const STORE = "packages";
  const CURRENT_WEBBY_VERSION = "0.48.0";
  const PACKAGE_TYPES = ["module", "plugin", "theme", "widget", "system"];
  const SEMVER_REGEX = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
  const SAFE_SCRIPT_PATH = /^\.\/(assets|modules)\//;
  const SAFE_STYLE_PATH = /^\.\/assets\//;

  const BUILT_IN_MANIFESTS = [
    {
      id: "home",
      name: "Home Module",
      version: "0.1.0",
      type: "module",
      description: "Built-in homepage module.",
      author: "WebbyOS",
      routes: ["home"],
      stores: ["settings", "moduleData"],
      capabilities: ["module.home"],
      widgets: ["homepage"],
      themes: [],
      scripts: ["./modules/pages/home.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "account",
      name: "Account Module",
      version: "0.1.0",
      type: "module",
      description: "Built-in account and profile pages.",
      author: "WebbyOS",
      routes: ["account"],
      stores: ["users", "profiles", "sessions"],
      capabilities: ["module.account"],
      widgets: [],
      themes: [],
      scripts: ["./modules/pages/account.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "blog",
      name: "Blog Module",
      version: "0.1.0",
      type: "module",
      description: "Built-in blog content module.",
      author: "WebbyOS",
      routes: ["blog"],
      stores: ["blogPosts", "contentCategories", "contentTags"],
      capabilities: ["module.blog"],
      widgets: [],
      themes: [],
      scripts: ["./modules/pages/blog.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "forums",
      name: "Forums Module",
      version: "0.1.0",
      type: "module",
      description: "Built-in forums module.",
      author: "WebbyOS",
      routes: ["forums"],
      stores: ["forumThreads", "forumPosts"],
      capabilities: ["module.forums"],
      widgets: [],
      themes: [],
      scripts: ["./modules/pages/forums.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "calendar",
      name: "Calendar Module",
      version: "0.1.0",
      type: "module",
      description: "Built-in calendar module.",
      author: "WebbyOS",
      routes: ["calendar"],
      stores: ["calendarEvents"],
      capabilities: ["module.calendar"],
      widgets: [],
      themes: [],
      scripts: ["./modules/pages/calendar.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "navigation-builder",
      name: "Navigation Builder",
      version: "0.1.0",
      type: "plugin",
      description: "Package metadata for the navigation builder.",
      author: "WebbyOS",
      routes: [],
      stores: ["settings"],
      capabilities: ["builder.navigation"],
      widgets: [],
      themes: [],
      scripts: ["./assets/navigationBuilderSystem.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "homepage-builder",
      name: "Homepage Builder",
      version: "0.1.0",
      type: "plugin",
      description: "Package metadata for the homepage builder.",
      author: "WebbyOS",
      routes: [],
      stores: ["settings"],
      capabilities: ["builder.homepage"],
      widgets: [],
      themes: [],
      scripts: ["./assets/homepageBuilderSystem.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "widget-system",
      name: "Widget System",
      version: "0.1.0",
      type: "plugin",
      description: "Package metadata for the widget system.",
      author: "WebbyOS",
      routes: [],
      stores: ["settings"],
      capabilities: ["builder.widgets"],
      widgets: [],
      themes: [],
      scripts: ["./assets/widgetCoreSystem.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "media-system",
      name: "Media System",
      version: "0.1.0",
      type: "system",
      description: "Package metadata for the media and upload system.",
      author: "WebbyOS",
      routes: [],
      stores: ["mediaLibrary"],
      capabilities: ["system.media"],
      widgets: [],
      themes: [],
      scripts: ["./assets/mediaCoreSystem.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "activity-feed-system",
      name: "Activity Feed System",
      version: "0.1.0",
      type: "system",
      description: "Package metadata for public activity and social feed records.",
      author: "WebbyOS",
      routes: [],
      stores: ["activityFeed"],
      capabilities: ["system.activityFeed"],
      widgets: [],
      themes: [],
      scripts: ["./assets/activityFeedCoreSystem.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "messaging-system",
      name: "Messaging System",
      version: "0.1.0",
      type: "system",
      description: "Package metadata for conversations and private messages.",
      author: "WebbyOS",
      routes: [],
      stores: ["conversations", "messages", "notifications"],
      capabilities: ["system.messaging"],
      widgets: [],
      themes: [],
      scripts: ["./assets/messagingCoreSystem.js"],
      styles: [],
      requires: { webby: ">=0.45" }
    },
    {
      id: "webby-default-theme",
      name: "Webby Default Theme",
      version: "0.1.0",
      type: "theme",
      description: "Built-in admin and public theme stylesheet.",
      author: "WebbyOS",
      routes: [],
      stores: ["settings"],
      capabilities: ["theme.default"],
      widgets: [],
      themes: ["default"],
      scripts: [],
      styles: ["./assets/theme.css"],
      requires: { webby: ">=0.45" }
    }
  ];

  let ready = false;
  let installedPackages = [];
  let packageRegistries = {
    routes: [],
    stores: [],
    capabilities: [],
    widgets: [],
    themes: []
  };

  function logError(message, data) {
    Diagnostics?.error?.("[PackageCoreSystem] " + message, data || {});
  }

  function logWarn(message, data) {
    Diagnostics?.warn?.("[PackageCoreSystem] " + message, data || {});
  }

  function clone(value) {
    return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeManifest(manifest) {
    return {
      id: String(manifest.id || "").trim(),
      name: String(manifest.name || "").trim(),
      version: String(manifest.version || "").trim(),
      type: String(manifest.type || "").trim(),
      description: String(manifest.description || "").trim(),
      author: String(manifest.author || "").trim(),
      routes: Array.isArray(manifest.routes) ? manifest.routes.map(String).filter(Boolean) : [],
      stores: Array.isArray(manifest.stores) ? manifest.stores.map(String).filter(Boolean) : [],
      capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities.map(String).filter(Boolean) : [],
      widgets: Array.isArray(manifest.widgets) ? manifest.widgets.map(String).filter(Boolean) : [],
      themes: Array.isArray(manifest.themes) ? manifest.themes.map(String).filter(Boolean) : [],
      scripts: Array.isArray(manifest.scripts) ? manifest.scripts.map(String).filter(Boolean) : [],
      styles: Array.isArray(manifest.styles) ? manifest.styles.map(String).filter(Boolean) : [],
      requires: manifest.requires && typeof manifest.requires === "object" ? { ...manifest.requires } : {}
    };
  }

  function getAllowedStores() {
    if (window.DataCoreSystem?.getStores) {
      return window.DataCoreSystem.getStores();
    }
    return [
      "users",
      "profiles",
      "sessions",
      "forumThreads",
      "forumPosts",
      "blogPosts",
      "calendarEvents",
      "notifications",
      "reactions",
      "bookmarks",
      "activityFeed",
      "conversations",
      "messages",
      "reports",
      "moderationLogs",
      "userWarnings",
      "userSuspensions",
      "reputation",
      "userBadges",
      "mediaLibrary",
      "contentCategories",
      "contentRevisions",
      "contentTags",
      "searchIndex",
      "settings",
      "moduleData",
      "packages"
    ];
  }

  function isSafePath(path, pattern) {
    return typeof path === "string" && pattern.test(path) && !path.includes("..") && !path.includes("//");
  }

  function validateVersionFormat(version) {
    return SEMVER_REGEX.test(version);
  }

  function compareVersion(a, b) {
    const partsA = a.split(/[.+-]/)[0].split(".").map(Number);
    const partsB = b.split(/[.+-]/)[0].split(".").map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
      const na = partsA[i] || 0;
      const nb = partsB[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  function versionSatisfies(current, requirement) {
    if (typeof requirement !== "string") return false;
    if (requirement.startsWith(">=")) {
      return compareVersion(current, requirement.slice(2)) >= 0;
    }
    if (requirement.startsWith("<=")) {
      return compareVersion(current, requirement.slice(2)) <= 0;
    }
    if (requirement.startsWith(">")) {
      return compareVersion(current, requirement.slice(1)) > 0;
    }
    if (requirement.startsWith("<")) {
      return compareVersion(current, requirement.slice(1)) < 0;
    }
    return compareVersion(current, requirement) === 0;
  }

  function validateManifest(manifest) {
    const errors = [];
    const warnings = [];

    if (!manifest || typeof manifest !== "object") {
      errors.push("Manifest must be an object.");
      return { errors, warnings };
    }

    const normalized = normalizeManifest(manifest);

    if (!normalized.id) {
      errors.push("Package manifest is missing id.");
    } else if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(normalized.id)) {
      errors.push("Package id must be lowercase and use only letters, numbers, dots, underscores, or dashes.");
    }

    if (!normalized.name) {
      errors.push("Package manifest is missing name.");
    }

    if (!PACKAGE_TYPES.includes(normalized.type)) {
      errors.push(`Invalid package type: ${String(normalized.type)}. Supported types: ${PACKAGE_TYPES.join(", ")}.`);
    }

    if (!normalized.version) {
      errors.push("Package manifest is missing version.");
    } else if (!validateVersionFormat(normalized.version)) {
      errors.push("Package version must follow semantic versioning (x.y.z). Example: 0.1.0.");
    }

    const routeSet = new Set();
    for (const route of normalized.routes) {
      if (typeof route !== "string" || !route.trim()) {
        warnings.push("Package manifest contains an invalid route declaration.");
      } else if (routeSet.has(route)) {
        warnings.push(`Duplicate route declaration in package manifest: ${route}`);
      } else {
        routeSet.add(route);
      }
    }

    const capabilitySet = new Set();
    for (const capability of normalized.capabilities) {
      if (typeof capability !== "string" || !capability.trim()) {
        warnings.push("Package manifest contains an invalid capability declaration.");
      } else if (capabilitySet.has(capability)) {
        warnings.push(`Duplicate capability declaration in package manifest: ${capability}`);
      } else {
        capabilitySet.add(capability);
      }
    }

    const allowedStores = getAllowedStores();
    for (const store of normalized.stores) {
      if (!allowedStores.includes(store)) {
        warnings.push(`Unknown package store declaration: ${store}.`);
      }
    }

    for (const script of normalized.scripts) {
      if (!isSafePath(script, SAFE_SCRIPT_PATH)) {
        warnings.push(`Unsafe or invalid script path: ${script}. Must be local and start with ./assets/ or ./modules/.`);
      }
    }

    for (const style of normalized.styles) {
      if (!isSafePath(style, SAFE_STYLE_PATH)) {
        warnings.push(`Unsafe or invalid style path: ${style}. Must be local and start with ./assets/.`);
      }
    }

    if (normalized.requires && typeof normalized.requires.webby === "string") {
      if (!versionSatisfies(CURRENT_WEBBY_VERSION, normalized.requires.webby)) {
        warnings.push(`Package requires webby ${normalized.requires.webby} but current version is ${CURRENT_WEBBY_VERSION}.`);
      }
    }

    return { errors, warnings, normalized };
  }

  function validatePackageSet(manifests) {
    const warnings = [];
    const errors = [];
    const ids = new Set();
    const routeIds = new Set();
    const capabilityIds = new Set();

    for (const manifest of manifests) {
      const { errors: itemErrors, warnings: itemWarnings, normalized } = validateManifest(manifest);
      const id = normalized?.id || "unknown";
      if (itemErrors.length) {
        errors.push(...itemErrors.map((msg) => `${id}: ${msg}`));
      }
      warnings.push(...itemWarnings.map((msg) => `${id}: ${msg}`));

      if (!normalized) {
        continue;
      }

      if (normalized.id) {
        if (ids.has(normalized.id)) {
          errors.push(`Duplicate package id: ${normalized.id}`);
        }
        ids.add(normalized.id);
      }

      for (const route of normalized.routes) {
        if (routeIds.has(route)) {
          errors.push(`Duplicate route id across packages: ${route}`);
        }
        routeIds.add(route);
      }

      for (const capability of normalized.capabilities) {
        if (capabilityIds.has(capability)) {
          errors.push(`Duplicate capability id across packages: ${capability}`);
        }
        capabilityIds.add(capability);
      }
    }

    return { errors, warnings };
  }

  function createPackageRecord(manifest, options = {}) {
    const now = new Date().toISOString();
    const health = getManifestHealth(manifest);
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      enabled: options.enabled !== false,
      installedAt: options.installedAt || now,
      updatedAt: options.updatedAt || now,
      manifest: clone(manifest),
      health,
      warnings: health.warnings || [],
      errors: health.errors || []
    };
  }

  function getManifestHealth(manifest) {
    const result = validateManifest(manifest);
    const status = result.errors.length ? "invalid" : result.warnings.length ? "warning" : "healthy";
    return {
      status,
      errors: result.errors,
      warnings: result.warnings
    };
  }

  async function loadStoredPackages() {
    if (!window.DataCoreSystem?.list) return [];
    try {
      const records = await window.DataCoreSystem.list(STORE);
      if (!Array.isArray(records)) return [];
      return records;
    } catch (err) {
      logWarn("Unable to load package registry store.", { error: err?.message || String(err) });
      return [];
    }
  }

  async function saveStoredPackage(record) {
    if (!window.DataCoreSystem?.put) {
      throw new Error("DataCoreSystem is unavailable for package persistence.");
    }
    return window.DataCoreSystem.put(STORE, record);
  }

  async function updateStoredPackage(id, patch) {
    if (!window.DataCoreSystem?.update) {
      throw new Error("DataCoreSystem is unavailable for package persistence.");
    }
    return window.DataCoreSystem.update(STORE, id, patch);
  }

  async function reconcileBuiltInPackages(storedRecords) {
    const recordsById = (storedRecords || []).reduce((acc, record) => {
      if (record && record.id) acc[record.id] = record;
      return acc;
    }, {});

    const installed = [];
    const packageSetValidation = validatePackageSet(BUILT_IN_MANIFESTS);
    if (packageSetValidation.errors.length) {
      packageSetValidation.errors.forEach((message) => logError(message));
    }
    if (packageSetValidation.warnings.length) {
      packageSetValidation.warnings.forEach((message) => logWarn(message));
    }

    for (const manifest of BUILT_IN_MANIFESTS) {
      const normalized = normalizeManifest(manifest);
      const existing = recordsById[normalized.id];
      if (existing) {
        const health = getManifestHealth(normalized);
        const updatedRecord = {
          ...existing,
          name: normalized.name,
          version: normalized.version,
          type: normalized.type,
          manifest: clone(normalized),
          health,
          warnings: health.warnings,
          errors: health.errors,
          updatedAt: new Date().toISOString()
        };
        try {
          await updateStoredPackage(normalized.id, updatedRecord);
          installed.push(updatedRecord);
        } catch (err) {
          logWarn("Unable to update stored package record.", { id: normalized.id, error: err?.message || String(err) });
          installed.push(existing);
        }
      } else {
        const newRecord = createPackageRecord(normalized, { enabled: true });
        try {
          const saved = await saveStoredPackage(newRecord);
          installed.push(saved || newRecord);
        } catch (err) {
          logWarn("Unable to persist built-in package record.", { id: normalized.id, error: err?.message || String(err) });
          installed.push(newRecord);
        }
      }
    }

    for (const stored of (storedRecords || [])) {
      if (stored && stored.id && !installed.find((item) => item.id === stored.id)) {
        installed.push(stored);
      }
    }

    return installed;
  }

  function synthesizePackageSummary() {
    const packages = installedPackages || [];
    return {
      total: packages.length,
      healthy: packages.filter((item) => item.health?.status === "healthy").length,
      warning: packages.filter((item) => item.health?.status === "warning").length,
      invalid: packages.filter((item) => item.health?.status === "invalid").length,
      enabled: packages.filter((item) => item.enabled).length,
      disabled: packages.filter((item) => !item.enabled).length
    };
  }

  function getPackageWarnings() {
    return (installedPackages || []).flatMap((record) => record.health?.warnings || []);
  }

  function getPackageErrors() {
    return (installedPackages || []).flatMap((record) => record.health?.errors || []);
  }

  function buildPackageRegistries(records) {
    const enabledRecords = (records || []).filter((record) => record.enabled !== false && record.health?.status !== "invalid");
    const collect = (field) => Array.from(new Set(enabledRecords.flatMap((record) => record.manifest?.[field] || []))).sort();
    packageRegistries = {
      routes: collect("routes"),
      stores: collect("stores"),
      capabilities: collect("capabilities"),
      widgets: collect("widgets"),
      themes: collect("themes")
    };
    return clone(packageRegistries);
  }

  function renderPackageState() {
    return installedPackages.map((record) => {
      const summary = {
        id: record.id,
        name: record.name,
        version: record.version,
        type: record.type,
        enabled: record.enabled,
        status: record.health?.status || "unknown"
      };
      return summary;
    });
  }

  function getLifecycleReport() {
    const packages = installedPackages || [];
    const invalid = packages.filter((record) => record.health?.status === "invalid");
    const duplicateIds = packages
      .map((record) => record.id)
      .filter((id, index, ids) => id && ids.indexOf(id) !== index);
    const disabled = packages.filter((record) => record.enabled === false);

    return {
      ready,
      currentVersion: CURRENT_WEBBY_VERSION,
      summary: synthesizePackageSummary(),
      invalidPackageIds: invalid.map((record) => record.id),
      duplicateIds: Array.from(new Set(duplicateIds)),
      disabledPackageIds: disabled.map((record) => record.id),
      registries: clone(packageRegistries)
    };
  }

  function validateAgainstInstalled(manifest) {
    const errors = [];
    const warnings = [];
    const routeIds = new Set((installedPackages || []).flatMap((record) => record.manifest?.routes || []));
    const capabilityIds = new Set((installedPackages || []).flatMap((record) => record.manifest?.capabilities || []));

    if ((installedPackages || []).some((record) => record.id === manifest.id)) {
      errors.push(`Duplicate package id: ${manifest.id}`);
    }

    for (const route of manifest.routes || []) {
      if (routeIds.has(route)) errors.push(`Duplicate route id across packages: ${route}`);
    }

    for (const capability of manifest.capabilities || []) {
      if (capabilityIds.has(capability)) errors.push(`Duplicate capability id across packages: ${capability}`);
    }

    return { errors, warnings };
  }

  function readManifest(manifest) {
    const result = validateManifest(manifest);
    return {
      manifest: result.normalized ? clone(result.normalized) : null,
      errors: result.errors,
      warnings: result.warnings
    };
  }

  async function registerManifest(manifest, options = {}) {
    const result = validateManifest(manifest);
    if (result.errors.length) {
      result.errors.forEach((message) => logWarn("Rejected package manifest. " + message));
      return { success: false, errors: result.errors, warnings: result.warnings };
    }

    const duplicateValidation = validateAgainstInstalled(result.normalized);
    if (duplicateValidation.errors.length) {
      duplicateValidation.errors.forEach((message) => logWarn("Rejected package manifest. " + message));
      return {
        success: false,
        errors: duplicateValidation.errors,
        warnings: [...result.warnings, ...duplicateValidation.warnings]
      };
    }

    const record = createPackageRecord(result.normalized, { enabled: options.enabled !== false });
    const saved = await saveStoredPackage(record).catch((err) => {
      logWarn("Unable to persist local package manifest.", { id: result.normalized.id, error: err?.message || String(err) });
      return null;
    });
    const finalRecord = saved || record;
    installedPackages.push(finalRecord);
    buildPackageRegistries(installedPackages);
    updateRuntimeState();
    return { success: true, record: clone(finalRecord), warnings: result.warnings };
  }

  async function togglePackageEnabled(packageId) {
    const record = installedPackages.find((item) => item.id === packageId);
    if (!record) {
      throw new Error(`Package not found: ${packageId}`);
    }
    const nextEnabled = !record.enabled;
    const patch = {
      enabled: nextEnabled,
      updatedAt: new Date().toISOString()
    };
    const updated = await updateStoredPackage(packageId, patch).catch((err) => {
      logWarn("Unable to update package enabled state.", { id: packageId, error: err?.message || String(err) });
      return null;
    });
    if (updated) {
      record.enabled = nextEnabled;
      record.updatedAt = patch.updatedAt;
      buildPackageRegistries(installedPackages);
      updateRuntimeState();
    }
    return record;
  }

  function getPackageById(id) {
    return clone((installedPackages || []).find((item) => item.id === id) || null);
  }

  function getInstalledPackages() {
    return clone(installedPackages || []);
  }

  function getPackageStatus(id) {
    const record = installedPackages.find((item) => item.id === id);
    return record?.health?.status || "unknown";
  }

  function getInstalledPackageIds() {
    return (installedPackages || []).map((item) => item.id);
  }

  function updateRuntimeState() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({
        packagesReady: ready,
        installedPackages: getInstalledPackages().map((item) => ({
          id: item.id,
          name: item.name,
          version: item.version,
          type: item.type,
          enabled: item.enabled,
          status: item.health?.status || "unknown"
        })),
        packageWarnings: getPackageWarnings(),
        packageErrors: getPackageErrors(),
        packageCapabilities: clone(packageRegistries.capabilities || []),
        packageRoutes: clone(packageRegistries.routes || [])
      });
    }
  }

  async function init() {
    const storedRecords = await loadStoredPackages();
    installedPackages = await reconcileBuiltInPackages(storedRecords);
    buildPackageRegistries(installedPackages);
    ready = true;
    updateRuntimeState();
    Diagnostics?.info?.("[PackageCoreSystem] package registry ready", synthesizePackageSummary());
    return {
      packagesReady: ready,
      installedPackages: getInstalledPackages(),
      packageWarnings: getPackageWarnings()
    };
  }

  return {
    init,
    getInstalledPackages,
    getPackageById,
    getPackageWarnings,
    getWarnings: getPackageWarnings,
    getPackageErrors,
    getErrors: getPackageErrors,
    getPackageHealth: () => clone(installedPackages.map((item) => item.health || {})),
    getPackageStatus,
    getPackageRoutes: () => clone(packageRegistries.routes || []),
    getRoutes: () => clone(packageRegistries.routes || []),
    getPackageStores: () => clone(packageRegistries.stores || []),
    getStores: () => clone(packageRegistries.stores || []),
    getPackageCapabilities: () => clone(packageRegistries.capabilities || []),
    getCapabilities: () => clone(packageRegistries.capabilities || []),
    getPackageWidgets: () => clone(packageRegistries.widgets || []),
    getWidgets: () => clone(packageRegistries.widgets || []),
    getPackageThemes: () => clone(packageRegistries.themes || []),
    getThemes: () => clone(packageRegistries.themes || []),
    readManifest,
    registerManifest,
    validateManifest,
    validatePackageSet,
    togglePackageEnabled,
    isReady: () => ready,
    getPackageSummary: synthesizePackageSummary,
    getLifecycleReport
  };
})();

window.PackageCoreSystem = PackageCoreSystem;
