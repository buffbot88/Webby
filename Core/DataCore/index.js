const DataCoreSystem = (() => {

  const ENDPOINT = "./api/data.php";
  const ALLOWED_STORES = [
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
    "contentTags",
    "contentRevisions",
    "searchIndex",
    "settings",
    "moduleData",
    "packages"
  ];
  const ALLOWED_ACTIONS = new Set(["list", "get", "put", "update", "remove", "clear", "export"]);

  let ready = false;
  let dataStores = [...ALLOWED_STORES];
  let runtimeUpdateScheduled = false;
  const operationStats = {
    total: 0,
    success: 0,
    failure: 0,
    byAction: {},
    byStore: {},
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null
  };

  function logError(message, data) {
    Diagnostics?.error?.("[DataCoreSystem] " + message, data || {});
  }

  function logWarn(message, data) {
    Diagnostics?.warn?.("[DataCoreSystem] " + message, data || {});
  }

  function validateStore(store) {
    if (typeof store !== "string" || !ALLOWED_STORES.includes(store)) {
      throw new Error(`Invalid or unsupported store: ${String(store)}`);
    }
    return store;
  }

  function validateAction(action) {
    if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
      throw new Error(`Invalid action: ${String(action)}`);
    }
    return action;
  }

  function updateRuntimeState() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({
        dataReady: ready,
        dataMode: "php-file-db",
        dataStores: [...dataStores],
        dataHealth: getHealth()
      });
    }
  }

  function scheduleRuntimeStateUpdate() {
    if (runtimeUpdateScheduled) return;
    runtimeUpdateScheduled = true;
    window.setTimeout(() => {
      runtimeUpdateScheduled = false;
      updateRuntimeState();
    }, 0);
  }

  function recordOperation(action, store, ok, error = null) {
    operationStats.total += 1;
    operationStats.byAction[action] = (operationStats.byAction[action] || 0) + 1;
    operationStats.byStore[store] = (operationStats.byStore[store] || 0) + 1;

    if (ok) {
      operationStats.success += 1;
      operationStats.lastSuccessAt = new Date().toISOString();
    } else {
      operationStats.failure += 1;
      operationStats.lastFailureAt = new Date().toISOString();
      operationStats.lastError = error ? String(error.message || error) : "Unknown data operation failure";
    }
  }

  async function request(action, payload = {}) {
    validateAction(action);
    if (!payload.store) {
      throw new Error("Store name is required.");
    }
    validateStore(payload.store);

    const body = {
      action,
      store: payload.store,
      id: payload.id,
      record: payload.record,
      patch: payload.patch
    };

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Data API request failed (${response.status})` + (text ? `: ${text}` : ""));
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      recordOperation(action, payload.store, true);
      scheduleRuntimeStateUpdate();
      return data;
    } catch (err) {
      recordOperation(action, payload.store, false, err);
      logError("API request failed", { action, store: payload.store, error: err?.message || String(err) });
      scheduleRuntimeStateUpdate();
      throw err;
    }
  }

  async function init() {
    ready = true;
    updateRuntimeState();
    return {
      dataReady: ready,
      dataMode: "php-file-db",
      dataStores: [...dataStores]
    };
  }

  async function list(store) {
    validateStore(store);
    const result = await request("list", { store });
    return Array.isArray(result.records) ? result.records : [];
  }

  async function get(store, id) {
    validateStore(store);
    if (typeof id !== "string" && typeof id !== "number") {
      throw new Error("Record id is required for get().");
    }
    const result = await request("get", { store, id });
    return result.record ?? null;
  }

  async function put(store, record) {
    validateStore(store);
    if (!record || typeof record !== "object") {
      throw new Error("Record object is required for put().");
    }
    const result = await request("put", { store, record });
    return result.record ?? null;
  }

  async function update(store, id, patch) {
    validateStore(store);
    if (typeof id !== "string" && typeof id !== "number") {
      throw new Error("Record id is required for update().");
    }
    if (!patch || typeof patch !== "object") {
      throw new Error("Patch object is required for update().");
    }
    const result = await request("update", { store, id, patch });
    return result.record ?? null;
  }

  async function remove(store, id) {
    validateStore(store);
    if (typeof id !== "string" && typeof id !== "number") {
      throw new Error("Record id is required for remove().");
    }
    const result = await request("remove", { store, id });
    return result.success === true;
  }

  async function clear(store) {
    validateStore(store);
    const result = await request("clear", { store });
    return result.success === true;
  }

  async function exportStore(store) {
    validateStore(store);
    const result = await request("export", { store });
    return result.store ?? { records: [] };
  }

  function getHealth() {
    return {
      ready,
      mode: "php-file-db",
      stores: [...dataStores],
      operations: {
        total: operationStats.total,
        success: operationStats.success,
        failure: operationStats.failure,
        byAction: { ...operationStats.byAction },
        byStore: { ...operationStats.byStore },
        lastSuccessAt: operationStats.lastSuccessAt,
        lastFailureAt: operationStats.lastFailureAt,
        lastError: operationStats.lastError
      }
    };
  }

  return {
    init,
    list,
    get,
    put,
    update,
    remove,
    clear,
    exportStore,
    getHealth,
    getStores: () => [...dataStores],
    isReady: () => ready,
    getMode: () => "php-file-db"
  };

})();

window.DataCoreSystem = DataCoreSystem;
