const Diagnostics = window.Diagnostics || (() => {
  const MAX_ENTRIES_PER_TYPE = 250;
  const logs = [];
  const warnings = [];
  const errors = [];

  function record(target, type, message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data: data ?? null
    };
    target.push(entry);
    if (target.length > MAX_ENTRIES_PER_TYPE) {
      target.splice(0, target.length - MAX_ENTRIES_PER_TYPE);
    }
    return entry;
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function info(message, data) {
    const entry = record(logs, "info", message, data);
    console.info("[Diagnostics]", message, data ?? "");
    return entry;
  }

  function warn(message, data) {
    const entry = record(warnings, "warn", message, data);
    console.warn("[Diagnostics]", message, data ?? "");
    return entry;
  }

  function error(message, data) {
    const entry = record(errors, "error", message, data);
    console.error("[Diagnostics]", message, data ?? "");
    Lifecycle?.emit?.("runtime:error", { message, data });
    return entry;
  }

  function renderError(message) {
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `
      <div class="platform-error" style="padding:24px; color:#b91c1c; background:#fee2e2; border:1px solid #fca5a5; border-radius:12px;">
        <strong>WebbyOS error:</strong>
        <div style="margin-top:8px;">${escapeText(message)}</div>
      </div>
    `;
  }

  function getLogs() {
    return logs.slice();
  }

  function getWarnings() {
    return warnings.slice();
  }

  function getErrors() {
    return errors.slice();
  }

  function getSummary() {
    return {
      logs: logs.length,
      warnings: warnings.length,
      errors: errors.length,
      retentionLimit: MAX_ENTRIES_PER_TYPE,
      latestWarning: warnings[warnings.length - 1] || null,
      latestError: errors[errors.length - 1] || null
    };
  }

  return {
    info,
    warn,
    error,
    renderError,
    escapeText,
    getLogs,
    getWarnings,
    getErrors,
    getSummary,
    logs,
    warnings,
    errors
  };
})();

window.Diagnostics = Diagnostics;
