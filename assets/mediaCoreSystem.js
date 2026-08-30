const MediaCoreSystem = (() => {
  const STORE = "mediaLibrary";
  const UPLOAD_ENDPOINT = "./api/upload.php";
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE = 5 * 1024 * 1024;

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function currentUserId() {
    const user = window.UserCoreSystem?.getCurrentUser?.();
    return user?.id || user?.username || "";
  }

  function can(capability) {
    return window.UserCoreSystem?.can?.(capability) === true;
  }

  function requireCapability(capability) {
    if (!can(capability)) {
      throw new Error("You do not have permission for this media action.");
    }
  }

  function normalizeMedia(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      filename: typeof record.filename === "string" ? record.filename : "",
      originalName: typeof record.originalName === "string" ? record.originalName : "",
      mimeType: typeof record.mimeType === "string" ? record.mimeType : "",
      size: Number.isFinite(Number(record.size)) ? Number(record.size) : 0,
      url: typeof record.url === "string" ? record.url : "",
      uploaderId: typeof record.uploaderId === "string" ? record.uploaderId : "",
      targetType: typeof record.targetType === "string" ? record.targetType : "",
      targetId: String(record.targetId || ""),
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  function validateMediaMetadata(file) {
    if (!file) throw new Error("Media file is required.");
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Unsupported media type.");
    if (Number(file.size || 0) > MAX_SIZE) throw new Error("Media file is too large.");
    return true;
  }

  async function uploadMedia(file, options = {}) {
    requireCapability("media.upload");
    validateMediaMetadata(file);

    const form = new FormData();
    form.append("action", "upload");
    form.append("media", file);

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: form
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || "Upload failed.");
    }

    const media = normalizeMedia({
      ...data.media,
      uploaderId: currentUserId(),
      targetType: options.targetType || "",
      targetId: options.targetId || "",
      metadata: options.metadata || {}
    });
    return window.DataCoreSystem.put(STORE, media);
  }

  async function listMedia(criteria = {}) {
    const records = await window.DataCoreSystem.list(STORE);
    let media = Array.isArray(records) ? records.map(normalizeMedia) : [];
    if (criteria.targetType) media = media.filter((item) => item.targetType === criteria.targetType);
    if (criteria.targetId) media = media.filter((item) => String(item.targetId) === String(criteria.targetId));
    if (criteria.uploaderId) media = media.filter((item) => item.uploaderId === criteria.uploaderId);
    return media.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async function getMediaItem(id) {
    if (!id) return null;
    const media = await window.DataCoreSystem.get(STORE, id);
    return media ? normalizeMedia(media) : null;
  }

  function canDelete(item) {
    return can("media.manage") || can("media.deleteAny") || (can("media.deleteOwn") && item.uploaderId === currentUserId());
  }

  async function deleteMedia(id) {
    const item = await getMediaItem(id);
    if (!item) return false;
    if (!canDelete(item)) throw new Error("You do not have permission to delete this media item.");

    const form = new FormData();
    form.append("action", "delete");
    form.append("filename", item.filename);
    await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form }).catch(() => null);
    return window.DataCoreSystem.remove(STORE, item.id);
  }

  async function attachMedia(mediaId, targetType, targetId, metadata = {}) {
    requireCapability("media.attach");
    const item = await getMediaItem(mediaId);
    if (!item) throw new Error("Media item not found.");
    return window.DataCoreSystem.update(STORE, item.id, {
      targetType: String(targetType || ""),
      targetId: String(targetId || ""),
      metadata: {
        ...(item.metadata || {}),
        ...metadata
      }
    });
  }

  async function detachMedia(mediaId) {
    requireCapability("media.attach");
    const item = await getMediaItem(mediaId);
    if (!item) return null;
    return window.DataCoreSystem.update(STORE, item.id, {
      targetType: "",
      targetId: ""
    });
  }

  async function uploadFromInput(input, options = {}) {
    const file = input?.files?.[0];
    if (!file) return null;
    return uploadMedia(file, options);
  }

  function renderImage(mediaOrUrl, className = "media-thumb", alt = "") {
    const url = typeof mediaOrUrl === "string" ? mediaOrUrl : mediaOrUrl?.url;
    if (!url) return "";
    return `<img class="${escape(className)}" src="${escape(url)}" alt="${escape(alt)}" loading="lazy" />`;
  }

  function renderAttachmentList(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return `
      <div class="attachment-list">
        ${items.map((item) => renderImage(item.url || item, "attachment-image", item.originalName || "Attachment")).join("")}
      </div>
    `;
  }

  function renderMediaGrid(items, options = {}) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="media-empty">No media uploaded yet.</div>`;
    }
    const allowDelete = options.allowDelete === true;
    return `
      <div class="media-grid">
        ${items.map((item) => `
          <article class="media-card">
            ${renderImage(item, "media-thumb", item.originalName)}
            <strong>${escape(item.originalName || item.filename)}</strong>
            <span>${escape(formatSize(item.size))}</span>
            <span>${escape(item.uploaderId || "unknown")}</span>
            ${allowDelete ? `<button type="button" onclick="window.AdminSystemCore?.deleteMediaItem?.('${escape(item.id)}')">Delete</button>` : ""}
          </article>
        `).join("")}
      </div>
    `;
  }

  function formatSize(size) {
    const value = Number(size || 0);
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (value >= 1024) return `${Math.round(value / 1024)} KB`;
    return `${value} B`;
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ mediaReady: true, mediaTypes: [...ALLOWED_TYPES] });
    }
  }

  return {
    init,
    uploadMedia,
    listMedia,
    getMediaItem,
    deleteMedia,
    attachMedia,
    detachMedia,
    validateMediaMetadata,
    uploadFromInput,
    renderImage,
    renderAttachmentList,
    renderMediaGrid,
    getAllowedTypes: () => [...ALLOWED_TYPES],
    getMaxSize: () => MAX_SIZE
  };
})();

window.MediaCoreSystem = MediaCoreSystem;
