const RevisionCoreSystem = (() => {
  const STORE = "contentRevisions";

  function currentUserId() {
    const user = window.UserCoreSystem?.getCurrentUser?.();
    return user?.id || user?.username || "";
  }

  function normalize(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      contentType: typeof record.contentType === "string" ? record.contentType : "",
      contentId: String(record.contentId || ""),
      editorId: typeof record.editorId === "string" ? record.editorId : "",
      title: typeof record.title === "string" ? record.title : "",
      snapshot: record.snapshot && typeof record.snapshot === "object" ? JSON.parse(JSON.stringify(record.snapshot)) : {},
      changeSummary: typeof record.changeSummary === "string" ? record.changeSummary : "",
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function createRevision(contentType, contentId, snapshot, changeSummary = "Content updated") {
    if (!window.DataCoreSystem?.put || !snapshot) return null;
    return window.DataCoreSystem.put(STORE, normalize({
      contentType,
      contentId,
      editorId: currentUserId(),
      title: snapshot.title || "",
      snapshot,
      changeSummary
    }));
  }

  async function listRevisions(contentType, contentId) {
    const records = await window.DataCoreSystem.list(STORE);
    return (Array.isArray(records) ? records.map(normalize) : [])
      .filter((item) => item.contentType === contentType && String(item.contentId) === String(contentId))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ revisionReady: true });
    }
  }

  return {
    init,
    createRevision,
    listRevisions
  };
})();

window.RevisionCoreSystem = RevisionCoreSystem;
