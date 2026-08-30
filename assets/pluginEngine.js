const PluginEngine = (() => {

  const plugins = new Map();
  const MAX_PLUGIN_FAILURES = 3;

  function getPluginRecord(id) {
    if (!plugins.has(id)) return null;
    const entry = plugins.get(id);
    if (!entry.health) {
      entry.health = {
        failureCount: 0,
        quarantined: false,
        disabledAt: null,
        disabled: false,
        lastError: null,
        status: "registered"
      };
    }
    return entry;
  }

  function register(id, plugin) {
    if (!id || typeof plugin !== "object") {
      Diagnostics.warn("[PluginEngine] invalid plugin registration", { id, plugin });
      return;
    }

    plugins.set(id, {
      instance: plugin,
      health: {
        failureCount: 0,
        quarantined: false,
        disabledAt: null,
        disabled: false,
        lastError: null,
        status: "registered"
      }
    });

    try {
      plugin?.init?.();
      const record = getPluginRecord(id);
      if (record) record.health.status = "initialized";
    } catch (err) {
      const record = getPluginRecord(id);
      if (record) {
        record.health.failureCount += 1;
        record.health.lastError = err;
        record.health.status = "init_failed";
      }
      Diagnostics.error("[PluginEngine] plugin init failed", { id, error: err });
    }
  }

  function mountAll(ctx = {}) {
    for (const [id, entry] of plugins.entries()) {
      if (entry.health.quarantined) {
        Diagnostics.warn("[PluginEngine] plugin mount skipped because quarantined", { id });
        Lifecycle.emit("plugin:mount", { pluginId: id, status: "quarantined" });
        continue;
      }

      if (entry.health.disabled) {
        Diagnostics.warn("[PluginEngine] plugin mount skipped because disabled", { id });
        Lifecycle.emit("plugin:mount", { pluginId: id, status: "disabled" });
        continue;
      }

      if (window.Runtime?.safeMode?.pluginDisableMode) {
        Diagnostics.warn("[PluginEngine] plugin mount skipped due to safe mode", { id });
        Lifecycle.emit("plugin:mount", { pluginId: id, status: "skipped" });
        continue;
      }

      try {
        entry.instance?.mount?.(ctx);
        entry.health.status = "mounted";
        Lifecycle.emit("plugin:mount", { pluginId: id, status: "mounted" });
      } catch (err) {
        entry.health.failureCount += 1;
        entry.health.lastError = err;
        entry.health.status = "mount_failed";
        Diagnostics.error("[PluginEngine] plugin mount failed", { id, error: err });
        Lifecycle.emit("plugin:mount", { pluginId: id, status: "failed", error: err });
        if (entry.health.failureCount >= MAX_PLUGIN_FAILURES) {
          entry.health.quarantined = true;
          entry.health.disabledAt = Date.now();
          Diagnostics.warn("[PluginEngine] plugin quarantined after repeated failures", { id, failureCount: entry.health.failureCount });
          Lifecycle.emit("plugin:mount", { pluginId: id, status: "quarantined" });
        }
      }
    }
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ pluginHealth: getHealth() });
    }
  }

  function trigger(event, data) {
    for (const [id, entry] of plugins.entries()) {
      if (entry.health.quarantined || entry.health.disabled) continue;
      try {
        entry.instance?.onEvent?.(event, data);
      } catch (err) {
        Diagnostics.error("[PluginEngine] plugin event failed", { id, event, error: err });
      }
    }
  }

  function setPluginEnabled(id, enabled) {
    const entry = getPluginRecord(id);
    if (!entry || typeof enabled !== "boolean") return false;
    entry.health.disabled = enabled === false ? true : false;
    entry.health.status = entry.health.disabled ? "admin_disabled" : "registered";
    if (entry.health.disabled) {
      entry.health.disabledAt = Date.now();
    }
    Diagnostics.info("[PluginEngine] plugin admin disabled state updated", { id, disabled: entry.health.disabled });
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ pluginHealth: getHealth() });
    }
    return true;
  }

  function getHealth() {
    return Array.from(plugins.entries()).map(([id, entry]) => ({
      pluginId: id,
      ...entry.health
    }));
  }

  return {
    register,
    mountAll,
    trigger,
    getHealth,
    setPluginEnabled
  };

})();

window.PluginEngine = PluginEngine;