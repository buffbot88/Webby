const NavigationBuilderSystem = (() => {
  const STORE = "settings";
  const RECORD_ID = "builder-navigation";
  const VISIBILITY = ["public", "authenticated", "admin", "capability"];

  let items = [];
  let ready = false;

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function canAdmin() {
    return window.UserCoreSystem?.can?.("platform.admin.access") === true;
  }

  function normalizeItem(record = {}, fallback = {}) {
    const route = typeof record.route === "string" && record.route.trim() ? record.route.trim() : fallback.route || fallback.id || "";
    const visibility = VISIBILITY.includes(record.visibility) ? record.visibility : "public";
    return {
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : route,
      route,
      label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : fallback.label || fallback.title || route,
      nav: typeof record.nav === "boolean" ? record.nav : fallback.nav !== false,
      enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled !== false,
      order: Number.isFinite(Number(record.order)) ? Number(record.order) : 0,
      visibility,
      capability: typeof record.capability === "string" ? record.capability.trim() : "",
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
    };
  }

  function registryItems() {
    return Object.values(window.RegistryEngine?.getAll?.() || {})
      .filter((route) => route?.type === "page")
      .map((route, index) => normalizeItem({
        id: route.id,
        route: route.id,
        label: route.label || route.title || route.id,
        nav: route.nav !== false,
        enabled: route.enabled !== false,
        order: index,
        visibility: route.auth ? "authenticated" : "public",
        capability: Array.isArray(route.capabilities) ? route.capabilities[0] || "" : ""
      }, route));
  }

  function mergeWithRegistry(savedItems = items) {
    const savedByRoute = new Map(savedItems.map((item) => [item.route, item]));
    return registryItems().map((routeItem, index) => normalizeItem({
      ...routeItem,
      ...(savedByRoute.get(routeItem.route) || {}),
      order: savedByRoute.has(routeItem.route) ? savedByRoute.get(routeItem.route).order : index
    }, routeItem));
  }

  async function load() {
    if (!window.DataCoreSystem?.get) {
      items = mergeWithRegistry([]);
      return getItems();
    }
    try {
      const record = await window.DataCoreSystem.get(STORE, RECORD_ID);
      const saved = Array.isArray(record?.items) ? record.items.map((item) => normalizeItem(item)) : [];
      items = mergeWithRegistry(saved);
      applyRouteState();
    } catch (error) {
      Diagnostics?.warn?.("[NavigationBuilderSystem] failed to load navigation", error);
      items = mergeWithRegistry([]);
    }
    return getItems();
  }

  function applyRouteState() {
    items.forEach((item) => {
      window.RegistryEngine?.updateRoute?.(item.route, {
        label: item.label,
        nav: item.nav,
        enabled: item.enabled
      });
    });
  }

  async function persist() {
    if (!canAdmin()) throw new Error("Admin access is required to manage navigation.");
    if (!window.DataCoreSystem?.put) throw new Error("DataCoreSystem is unavailable for navigation.");
    await window.DataCoreSystem.put(STORE, {
      id: RECORD_ID,
      items: items.map(normalizeItem)
    });
    applyRouteState();
    window.Runtime?.updateRuntimeState?.({ navigationBuilderReady: true, navigationItems: getItems() });
  }

  async function saveItem(payload) {
    if (!canAdmin()) throw new Error("Admin access is required to manage navigation.");
    const next = normalizeItem({
      ...payload,
      updatedAt: new Date().toISOString()
    });
    const index = items.findIndex((item) => item.route === next.route);
    if (index >= 0) {
      items[index] = { ...items[index], ...next };
    } else {
      items.push(next);
    }
    await persist();
    return next;
  }

  async function setRouteVisible(route, nav) {
    const item = items.find((entry) => entry.route === route) || normalizeItem({ route });
    return saveItem({ ...item, nav: nav === true });
  }

  function isVisible(item) {
    if (!item || item.nav === false || item.enabled === false) return false;
    if (item.visibility === "authenticated") return window.UserCoreSystem?.isAuthenticated?.() === true;
    if (item.visibility === "admin") return canAdmin();
    if (item.visibility === "capability") return !!item.capability && window.UserCoreSystem?.can?.(item.capability) === true;
    return true;
  }

  function getItems() {
    return items.map((item) => ({ ...item })).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }

  function getPublicItems() {
    return getItems().filter(isVisible);
  }

  function renderPublicNav() {
    return getPublicItems()
      .map((item) => `
        <button onclick="Runtime.navigate('${escape(item.route)}')">
          ${escape(item.label)}
        </button>
      `)
      .join("");
  }

  async function init() {
    await load();
    ready = true;
    window.Runtime?.updateRuntimeState?.({ navigationBuilderReady: true, navigationItems: getItems() });
  }

  return {
    init,
    load,
    getItems,
    getPublicItems,
    saveItem,
    setRouteVisible,
    renderPublicNav,
    getVisibilityOptions: () => [...VISIBILITY],
    isReady: () => ready
  };
})();

window.NavigationBuilderSystem = NavigationBuilderSystem;
