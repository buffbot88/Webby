const ModuleLoader = (() => {

  const moduleHealth = {};
  const quarantineDuration = 30000;

  function now() {
    return Date.now();
  }

  function ensureHealth(id) {
    if (!moduleHealth[id]) {
      moduleHealth[id] = {
        id,
        initialized: false,
        loaded: false,
        failures: 0,
        quarantined: false,
        quarantineUntil: null,
        adminDisabled: false,
        lastError: null
      };
    }

    return moduleHealth[id];
  }

  function isQuarantined(id) {
    const health = ensureHealth(id);

    if (!health.quarantined) return false;

    if (health.quarantineUntil && now() > health.quarantineUntil) {
      health.quarantined = false;
      health.quarantineUntil = null;
      return false;
    }

    return true;
  }

  function quarantine(id, error) {
    const health = ensureHealth(id);

    health.failures += 1;
    health.lastError = error?.message || String(error);
    health.quarantined = true;
    health.quarantineUntil = now() + quarantineDuration;

    Diagnostics?.warn?.("[ModuleLoader] module quarantined", {
      id,
      failures: health.failures,
      error: health.lastError
    });
  }

  function getHealth() {
    return JSON.parse(JSON.stringify(moduleHealth));
  }

  function setModuleEnabled(id, enabled) {
    const health = ensureHealth(id);

    health.adminDisabled = !enabled;

    Runtime?.updateRuntimeState?.({
      moduleHealth: getHealth()
    });
  }

  function isModuleEnabled(id) {
    return !ensureHealth(id).adminDisabled;
  }

  function normalizeOutput(output) {
    if (output === null || output === undefined) return "";
    return String(output);
  }

  function load(route, ctx = {}) {
    const id = route?.id;

    if (!id) {
      return `
        <div class="module-error">
          Invalid module route.
        </div>
      `;
    }

    const health = ensureHealth(id);

    if (!isModuleEnabled(id)) {
      return `
        <div class="module-disabled">
          Module disabled: ${id}
        </div>
      `;
    }

    if (isQuarantined(id)) {
      return `
        <div class="module-quarantined">
          Module temporarily quarantined: ${id}
        </div>
      `;
    }

    try {
      const mod = window.ModuleRegistry?.[id];

      if (!mod || typeof mod.render !== "function") {
        throw new Error(`Missing module render(): ${id}`);
      }

      if (!health.initialized && typeof mod.init === "function") {
        mod.init(ctx);
        health.initialized = true;
      }

      const loadedFeatureIds = Array.isArray(route.features)
        ? [...new Set(route.features)]
        : [];

      const features = FeatureEngine?.resolve?.(loadedFeatureIds, ctx) || "";

      const body = normalizeOutput(mod.render(ctx));

      health.loaded = true;
      health.lastError = null;

      Runtime?.updateRuntimeState?.({
        moduleHealth: getHealth(),
        loadedModules: [id],
        loadedFeatures: loadedFeatureIds
      });

      Lifecycle?.emit?.("module:load", {
        id,
        route
      });

      return `
        <div class="module" data-module-id="${id}">
          <div class="features">${features}</div>
          <div class="content">${body}</div>
        </div>
      `;

    } catch (error) {
      quarantine(id, error);

      Runtime?.updateRuntimeState?.({
        moduleHealth: getHealth()
      });

      Diagnostics?.error?.("[ModuleLoader] render failed", {
        id,
        error: error?.message || String(error)
      });

      return `
        <div class="module-error">
          <h3>Module Error</h3>
          <p>${id} failed to render.</p>
        </div>
      `;
    }
  }

  return {
    load,
    getHealth,
    setModuleEnabled,
    isModuleEnabled
  };

})();

window.ModuleLoader = ModuleLoader;