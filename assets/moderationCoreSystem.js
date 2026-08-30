const ModerationCoreSystem = (() => {
  const REPORT_STORE = "reports";
  const LOG_STORE = "moderationLogs";
  const WARNING_STORE = "userWarnings";
  const SUSPENSION_STORE = "userSuspensions";
  const REPORT_TYPES = new Set(["forumThread", "forumPost", "blogPost", "calendarEvent", "userProfile"]);
  const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

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
      throw new Error("You do not have permission for this moderation action.");
    }
  }

  function requireModerationAccess() {
    if (!can("moderation.report.review") && !can("moderation.user.warn") && !can("moderation.user.suspend")) {
      throw new Error("You do not have permission for this moderation action.");
    }
  }

  function normalizeReport(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      reporterId: typeof record.reporterId === "string" ? record.reporterId : "",
      targetType: typeof record.targetType === "string" ? record.targetType : "",
      targetId: String(record.targetId || ""),
      reason: typeof record.reason === "string" ? record.reason : "",
      status: STATUSES.has(record.status) ? record.status : "open",
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  function normalizeLog(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      moderatorId: typeof record.moderatorId === "string" ? record.moderatorId : "",
      action: typeof record.action === "string" ? record.action : "moderation.action",
      targetType: typeof record.targetType === "string" ? record.targetType : "",
      targetId: String(record.targetId || ""),
      reason: typeof record.reason === "string" ? record.reason : "",
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function createReport({ targetType, targetId, reason, metadata = {} }) {
    if (!currentUserId()) throw new Error("Sign in to report content.");
    if (!REPORT_TYPES.has(targetType)) throw new Error("Unsupported report type.");
    if (!targetId || !String(reason || "").trim()) throw new Error("Report target and reason are required.");

    return window.DataCoreSystem.put(REPORT_STORE, normalizeReport({
      reporterId: currentUserId(),
      targetType,
      targetId,
      reason: String(reason).trim(),
      status: "open",
      metadata
    }));
  }

  async function listReports(criteria = {}) {
    requireCapability("moderation.report.review");
    const reports = await window.DataCoreSystem.list(REPORT_STORE);
    let items = Array.isArray(reports) ? reports.map(normalizeReport) : [];
    if (criteria.status) items = items.filter((report) => report.status === criteria.status);
    if (criteria.targetType) items = items.filter((report) => report.targetType === criteria.targetType);
    return items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async function createModerationLog({ action, targetType, targetId, reason, metadata = {} }) {
    requireModerationAccess();
    const log = await window.DataCoreSystem.put(LOG_STORE, normalizeLog({
      moderatorId: currentUserId(),
      action,
      targetType,
      targetId,
      reason,
      metadata
    }));
    window.ReputationCoreSystem?.recordModerationAction?.(currentUserId(), action).catch((error) => {
      Diagnostics?.warn?.("[ModerationCoreSystem] failed to record moderation reputation", error);
    });
    return log;
  }

  async function updateReportStatus(reportId, status, note = "") {
    requireCapability("moderation.report.review");
    if (!STATUSES.has(status)) throw new Error("Invalid report status.");
    const report = (await listReports()).find((item) => String(item.id) === String(reportId));
    if (!report) throw new Error("Report not found.");
    const notes = Array.isArray(report.metadata?.notes) ? report.metadata.notes : [];
    const updated = await window.DataCoreSystem.update(REPORT_STORE, report.id, {
      status,
      metadata: {
        ...(report.metadata || {}),
        notes: note ? [...notes, { moderatorId: currentUserId(), note, createdAt: new Date().toISOString() }] : notes
      }
    });
    await createModerationLog({
      action: `report.${status}`,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: note || `Report marked ${status}.`,
      metadata: { reportId: report.id }
    });
    return updated;
  }

  async function addModerationNote(reportId, note) {
    return updateReportStatus(reportId, "reviewing", note);
  }

  async function warnUser(userId, reason, metadata = {}) {
    requireCapability("moderation.user.warn");
    const warning = await window.DataCoreSystem.put(WARNING_STORE, {
      userId: String(userId || ""),
      moderatorId: currentUserId(),
      reason: String(reason || ""),
      active: true,
      metadata
    });
    await createModerationLog({ action: "user.warn", targetType: "userProfile", targetId: userId, reason, metadata: { warningId: warning.id } });
    return warning;
  }

  async function suspendUser(userId, reason, expiresAt = "", metadata = {}) {
    requireCapability("moderation.user.suspend");
    const suspension = await window.DataCoreSystem.put(SUSPENSION_STORE, {
      userId: String(userId || ""),
      moderatorId: currentUserId(),
      reason: String(reason || ""),
      active: true,
      expiresAt: typeof expiresAt === "string" ? expiresAt : "",
      metadata
    });
    await createModerationLog({ action: "user.suspend", targetType: "userProfile", targetId: userId, reason, metadata: { suspensionId: suspension.id } });
    return suspension;
  }

  async function listWarnings(userId = currentUserId()) {
    const records = await window.DataCoreSystem.list(WARNING_STORE);
    return (Array.isArray(records) ? records : []).filter((item) => item.userId === userId);
  }

  async function listSuspensions(userId = currentUserId()) {
    const records = await window.DataCoreSystem.list(SUSPENSION_STORE);
    return (Array.isArray(records) ? records : []).filter((item) => item.userId === userId && item.active !== false);
  }

  async function listModerationLogs() {
    requireCapability("moderation.report.review");
    const logs = await window.DataCoreSystem.list(LOG_STORE);
    return (Array.isArray(logs) ? logs.map(normalizeLog) : [])
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  function renderReportButton(targetType, targetId) {
    if (!currentUserId()) return "";
    return `<button type="button" onclick="window.ForumModuleUI?.reportTarget?.('${escape(targetType)}', '${escape(targetId)}')">Report</button>`;
  }

  function renderReports(reports) {
    if (!Array.isArray(reports) || !reports.length) {
      return `<div class="moderation-panel"><div class="moderation-report">No reports awaiting review.</div></div>`;
    }
    return `
      <div class="moderation-panel">
        ${reports.map((report) => `
          <article class="moderation-report">
            <div>
              <strong>${escape(report.targetType)} ${escape(report.targetId)}</strong>
              <p>${escape(report.reason)}</p>
              <span class="moderation-badge">${escape(report.status)}</span>
            </div>
            <div class="notification-actions">
              <button type="button" onclick="window.ForumModuleUI?.updateReportStatus?.('${escape(report.id)}', 'reviewing')">Review</button>
              <button type="button" onclick="window.ForumModuleUI?.updateReportStatus?.('${escape(report.id)}', 'resolved')">Resolve</button>
              <button type="button" onclick="window.ForumModuleUI?.updateReportStatus?.('${escape(report.id)}', 'dismissed')">Dismiss</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderWarnings(items) {
    if (!Array.isArray(items) || !items.length) return `<div class="activity-item">No warnings.</div>`;
    return items.map((warning) => `<div class="user-warning">${escape(warning.reason || "Warning")}</div>`).join("");
  }

  function renderSuspensions(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return items.map((item) => `<div class="suspension-alert">${escape(item.reason || "Account suspended")}</div>`).join("");
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ moderationReady: true });
    }
  }

  return {
    init,
    createReport,
    listReports,
    updateReportStatus,
    addModerationNote,
    createModerationLog,
    warnUser,
    suspendUser,
    listWarnings,
    listSuspensions,
    listModerationLogs,
    renderReportButton,
    renderReports,
    renderWarnings,
    renderSuspensions
  };
})();

window.ModerationCoreSystem = ModerationCoreSystem;
