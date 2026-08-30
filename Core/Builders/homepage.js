const HomepageBuilderSystem = (() => {
  const STORE = "settings";
  const RECORD_ID = "builder-homepage";
  const SECTION_TYPES = ["hero", "moduleLinks", "blogPreview", "forumPreview", "calendarPreview", "activityFeed", "featuredContent", "widget"];

  const defaults = {
    hero: {
      kicker: "WebbyOS CMS",
      title: "Build a modular website from one stable WebbyOS workspace.",
      body: "This frontend gateway is ready for blogs, forums, calendars, accounts, community tools, and future installable modules."
    },
    sections: [
      { id: "hero", type: "hero", title: "Hero", enabled: true, order: 0 },
      { id: "module-links", type: "moduleLinks", title: "Explore", enabled: true, order: 1 },
      { id: "blog-preview", type: "blogPreview", title: "Latest Blog Posts", enabled: true, order: 2 },
      { id: "forum-preview", type: "forumPreview", title: "Latest Forum Threads", enabled: true, order: 3 },
      { id: "calendar-preview", type: "calendarPreview", title: "Upcoming Events", enabled: true, order: 4 },
      { id: "featured-content", type: "featuredContent", title: "Featured & Trending", enabled: true, order: 5 },
      { id: "activity-feed", type: "activityFeed", title: "Recent Activity", enabled: true, order: 6 }
    ]
  };

  let config = clone(defaults);
  let ready = false;

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function canAdmin() {
    return window.UserCoreSystem?.can?.("platform.admin.access") === true;
  }

  function normalizeSection(section = {}, index = 0) {
    const type = SECTION_TYPES.includes(section.type) ? section.type : "widget";
    return {
      id: typeof section.id === "string" && section.id.trim() ? section.id.trim() : `${type}-${index}`,
      type,
      title: typeof section.title === "string" && section.title.trim() ? section.title.trim() : type,
      enabled: section.enabled !== false,
      order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
      widgetId: typeof section.widgetId === "string" ? section.widgetId.trim() : ""
    };
  }

  function normalize(value = {}) {
    const hero = value.hero && typeof value.hero === "object" ? value.hero : {};
    const sections = Array.isArray(value.sections) && value.sections.length ? value.sections : defaults.sections;
    return {
      hero: {
        kicker: typeof hero.kicker === "string" ? hero.kicker : defaults.hero.kicker,
        title: typeof hero.title === "string" ? hero.title : defaults.hero.title,
        body: typeof hero.body === "string" ? hero.body : defaults.hero.body
      },
      sections: sections.map(normalizeSection).sort((a, b) => a.order - b.order)
    };
  }

  async function load() {
    if (!window.DataCoreSystem?.get) return getConfig();
    try {
      const record = await window.DataCoreSystem.get(STORE, RECORD_ID);
      config = normalize(record?.homepage || defaults);
    } catch (error) {
      Diagnostics?.warn?.("[HomepageBuilderSystem] failed to load homepage builder config", error);
      config = clone(defaults);
    }
    return getConfig();
  }

  async function save(nextConfig) {
    if (!canAdmin()) throw new Error("Admin access is required to manage the homepage.");
    if (!window.DataCoreSystem?.put) throw new Error("DataCoreSystem is unavailable for homepage builder.");
    config = normalize(nextConfig);
    await window.DataCoreSystem.put(STORE, {
      id: RECORD_ID,
      homepage: config
    });
    window.Runtime?.updateRuntimeState?.({ homepageBuilderReady: true });
    return getConfig();
  }

  async function saveHero(hero) {
    return save({ ...config, hero: { ...(config.hero || {}), ...(hero || {}) } });
  }

  async function saveSection(payload) {
    const section = normalizeSection(payload, config.sections.length);
    const sections = [...config.sections];
    const index = sections.findIndex((item) => item.id === section.id);
    if (index >= 0) {
      sections[index] = section;
    } else {
      sections.push(section);
    }
    return save({ ...config, sections });
  }

  async function removeSection(id) {
    return save({ ...config, sections: config.sections.filter((item) => item.id !== id) });
  }

  function getConfig() {
    return clone(config);
  }

  function getSections() {
    return getConfig().sections;
  }

  async function init() {
    await load();
    ready = true;
    window.Runtime?.updateRuntimeState?.({ homepageBuilderReady: true });
  }

  return {
    init,
    load,
    save,
    saveHero,
    saveSection,
    removeSection,
    getConfig,
    getSections,
    getSectionTypes: () => [...SECTION_TYPES],
    getDefaults: () => clone(defaults),
    isReady: () => ready
  };
})();

window.HomepageBuilderSystem = HomepageBuilderSystem;
