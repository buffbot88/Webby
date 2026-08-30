const ConfigLoader = (() => {

  let config = null;
  const CONFIG_RECORD_ID = "platform-config";
  const defaults = {
    siteName: "WebbyOS",
    tagline: "Modular publishing for community sites.",
    theme: "light-blue",
    features: {},
    admin: { enabled: false },
    settings: {},
    themeSettings: {
      primaryColor: "#3b82f6",
      accentColor: "#16a34a",
      backgroundMode: "soft",
      logoText: "WebbyOS",
      navStyle: "pills",
      layoutDensity: "comfortable"
    }
  };

  function normalizeHexColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
  }

  function normalizeChoice(value, choices, fallback) {
    return choices.includes(value) ? value : fallback;
  }

  function normalizeThemeSettings(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
      primaryColor: normalizeHexColor(source.primaryColor, defaults.themeSettings.primaryColor),
      accentColor: normalizeHexColor(source.accentColor, defaults.themeSettings.accentColor),
      backgroundMode: normalizeChoice(source.backgroundMode, ["soft", "plain", "contrast"], defaults.themeSettings.backgroundMode),
      logoText: typeof source.logoText === "string" ? source.logoText.trim() || defaults.themeSettings.logoText : defaults.themeSettings.logoText,
      navStyle: normalizeChoice(source.navStyle, ["pills", "underline", "compact"], defaults.themeSettings.navStyle),
      layoutDensity: normalizeChoice(source.layoutDensity, ["comfortable", "compact", "spacious"], defaults.themeSettings.layoutDensity),
      customCss: typeof source.customCss === "string" ? source.customCss : ""
    };
  }

  function normalize(value) {
    if (!value || typeof value !== "object") return { ...defaults };
    return {
      siteName: typeof value.siteName === "string" ? value.siteName : defaults.siteName,
      tagline: typeof value.tagline === "string" ? value.tagline : defaults.tagline,
      theme: typeof value.theme === "string" ? value.theme : defaults.theme,
      features: typeof value.features === "object" && value.features !== null ? value.features : { ...defaults.features },
      admin: typeof value.admin === "object" && value.admin !== null ? {
        enabled: typeof value.admin.enabled === "boolean" ? value.admin.enabled : defaults.admin.enabled
      } : { ...defaults.admin },
      settings: typeof value.settings === "object" && value.settings !== null ? value.settings : { ...defaults.settings },
      themeSettings: normalizeThemeSettings(value.themeSettings || value.settings?.theme)
    };
  }

  function validate(value) {
    return (
      value &&
      typeof value.siteName === "string" &&
      typeof value.tagline === "string" &&
      typeof value.theme === "string" &&
      typeof value.features === "object" &&
      value.features !== null &&
      typeof value.admin === "object" &&
      value.admin !== null &&
      typeof value.admin.enabled === "boolean" &&
      typeof value.settings === "object" &&
      value.settings !== null &&
      typeof value.themeSettings === "object" &&
      value.themeSettings !== null
    );
  }

  function mergeConfig(base, override) {
    if (!override || typeof override !== "object") return base;
    return normalize({
      ...base,
      ...override,
      features: {
        ...base.features,
        ...(typeof override.features === "object" && override.features !== null ? override.features : {})
      },
      admin: {
        ...base.admin,
        ...(typeof override.admin === "object" && override.admin !== null ? override.admin : {})
      },
      settings: {
        ...base.settings,
        ...(typeof override.settings === "object" && override.settings !== null ? override.settings : {})
      },
      themeSettings: {
        ...base.themeSettings,
        ...(typeof override.themeSettings === "object" && override.themeSettings !== null ? override.themeSettings : {})
      }
    });
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex, defaults.themeSettings.primaryColor).slice(1);
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function applyThemeToDocument(value = config) {
    if (!document?.documentElement) return;
    const normalized = normalize(value || defaults);
    const theme = normalized.themeSettings;
    const primary = hexToRgb(theme.primaryColor);
    const accent = hexToRgb(theme.accentColor);
    const root = document.documentElement;

    root.style.setProperty("--primary", theme.primaryColor);
    root.style.setProperty("--primary-soft", `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.12)`);
    root.style.setProperty("--accent", theme.accentColor);
    root.style.setProperty("--accent-soft", `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.14)`);
    root.dataset.backgroundMode = theme.backgroundMode;
    root.dataset.navStyle = theme.navStyle;
    root.dataset.layoutDensity = theme.layoutDensity;

    let style = document.getElementById("webbyCustomThemeCss");
    if (!style && theme.customCss) {
      style = document.createElement("style");
      style.id = "webbyCustomThemeCss";
      document.head.appendChild(style);
    }
    if (style) {
      style.textContent = theme.customCss || "";
      if (!theme.customCss) style.remove();
    }
  }

  function updateRuntimeConfig(normalized) {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ config: normalized, featureFlags: normalized.features });
    }
    applyThemeToDocument(normalized);
  }

  async function load() {
    try {
      const res = await fetch("./config.json");
      if (!res.ok) throw new Error(`[ConfigLoader] fetch failed: ${res.status}`);
      const data = await res.json();
      config = normalize(data);
      if (!validate(config)) {
        Diagnostics.warn("[ConfigLoader] invalid config shape, using defaults", data);
        config = { ...defaults };
      }
    } catch (err) {
      Diagnostics.error("[ConfigLoader] load failed", err);
      config = { ...defaults };
    }

    applyThemeToDocument(config);

    return config;
  }

  async function loadStoredOverride() {
    if (!window.DataCoreSystem?.get) return config;

    try {
      const record = await window.DataCoreSystem.get("settings", CONFIG_RECORD_ID);
      const override = record?.config;
      if (!override) return config;

      const merged = mergeConfig(config || defaults, override);
      if (!validate(merged)) {
        Diagnostics.warn("[ConfigLoader] stored config override invalid, ignoring", record);
        return config;
      }

      config = merged;
      updateRuntimeConfig(config);
      return config;
    } catch (err) {
      Diagnostics.warn("[ConfigLoader] failed to load stored config override", err);
      return config;
    }
  }

  function apply(value) {
    if (!validate(value)) {
      return { success: false, error: "Invalid configuration payload" };
    }
    const normalized = normalize(value);
    config = normalized;

    if (window.DataCoreSystem?.put) {
      window.DataCoreSystem.put("settings", {
        id: CONFIG_RECORD_ID,
        config: normalized
      }).catch((err) => Diagnostics.warn("[ConfigLoader] failed to persist config override", err));
    } else {
      Diagnostics.warn("[ConfigLoader] DataCoreSystem unavailable; config override is in-memory only.");
    }

    Diagnostics.info("[ConfigLoader] configuration applied via admin editor", normalized);
    updateRuntimeConfig(normalized);
    return { success: true };
  }

  function reset() {
    config = normalize(defaults);
    if (window.DataCoreSystem?.remove) {
      window.DataCoreSystem.remove("settings", CONFIG_RECORD_ID)
        .catch((err) => Diagnostics.warn("[ConfigLoader] failed to remove stored config override", err));
    }
    Diagnostics.info("[ConfigLoader] configuration reset to defaults");
    updateRuntimeConfig(config);
    return config;
  }

  function get() {
    return config;
  }

  function getFeature(key) {
    return config?.features?.[key];
  }

  function getSetting(key) {
    return config?.settings?.[key];
  }

  return {
    load,
    get,
    getFeature,
    getSetting,
    apply,
    reset,
    loadStoredOverride,
    applyThemeToDocument,
    mergeConfig,
    validate
  };

})();

window.ConfigLoader = ConfigLoader;
