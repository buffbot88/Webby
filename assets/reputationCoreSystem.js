const ReputationCoreSystem = (() => {
  const REPUTATION_STORE = "reputation";
  const BADGE_STORE = "userBadges";

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function normalizeUserId(userId) {
    return String(userId || "").trim();
  }

  function normalizeReputation(record) {
    const userId = normalizeUserId(record.userId || record.id);
    const score = Number.isFinite(Number(record.score)) ? Number(record.score) : 0;
    return {
      id: userId,
      userId,
      score,
      stats: record.stats && typeof record.stats === "object" ? { ...record.stats } : {},
      createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  function normalizeBadge(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      userId: normalizeUserId(record.userId),
      badge: typeof record.badge === "string" ? record.badge : "",
      label: typeof record.label === "string" ? record.label : "",
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function getReputation(userId) {
    const id = normalizeUserId(userId);
    if (!id) return normalizeReputation({ userId: "" });
    const existing = await window.DataCoreSystem.get(REPUTATION_STORE, id);
    return normalizeReputation(existing || { id, userId: id, score: 0, stats: {} });
  }

  function trustLevel(score) {
    if (score >= 100) return "leader";
    if (score >= 50) return "trusted";
    if (score >= 15) return "active";
    return "new";
  }

  async function awardReputation(userId, points, reason = "", statKey = "") {
    const id = normalizeUserId(userId);
    if (!id || !Number.isFinite(Number(points))) return null;
    const current = await getReputation(id);
    const stats = { ...(current.stats || {}) };
    if (statKey) stats[statKey] = Number(stats[statKey] || 0) + 1;
    const next = normalizeReputation({
      ...current,
      score: current.score + Number(points),
      stats,
      metadata: {
        ...(current.metadata || {}),
        lastReason: reason
      }
    });
    const saved = await window.DataCoreSystem.put(REPUTATION_STORE, next);
    await ensureMilestoneBadges(saved.userId, saved.score);
    return saved;
  }

  async function removeReputation(userId, points, reason = "") {
    return awardReputation(userId, -Math.abs(Number(points) || 0), reason);
  }

  async function ensureMilestoneBadges(userId, score) {
    if (score >= 15) await awardBadge(userId, "active-member", "Active Member");
    if (score >= 50) await awardBadge(userId, "trusted-voice", "Trusted Voice");
    if (score >= 100) await awardBadge(userId, "community-leader", "Community Leader");
  }

  async function awardBadge(userId, badge, label = badge) {
    const id = normalizeUserId(userId);
    if (!id || !badge) return null;
    const badges = await listBadges(id);
    if (badges.some((item) => item.badge === badge)) return badges.find((item) => item.badge === badge);
    return window.DataCoreSystem.put(BADGE_STORE, normalizeBadge({ userId: id, badge, label }));
  }

  async function listBadges(userId) {
    const id = normalizeUserId(userId);
    const records = await window.DataCoreSystem.list(BADGE_STORE);
    return (Array.isArray(records) ? records.map(normalizeBadge) : []).filter((item) => item.userId === id);
  }

  async function getContributionStats(userId) {
    const reputation = await getReputation(userId);
    return reputation.stats || {};
  }

  async function recordThreadCreated(userId) {
    return awardReputation(userId, 5, "Forum thread created", "threadsCreated");
  }

  async function recordHelpfulReceived(userId) {
    return awardReputation(userId, 3, "Helpful reaction received", "helpfulReactions");
  }

  async function recordBlogPostPublished(userId) {
    return awardReputation(userId, 10, "Blog post published", "blogPostsPublished");
  }

  async function recordModerationAction(userId) {
    return awardReputation(userId, 1, "Moderation action", "moderationActions");
  }

  async function renderUserReputation(userId) {
    const reputation = await getReputation(userId);
    return `<span class="reputation-badge">${escape(reputation.score)} rep</span> <span class="trust-level">${escape(trustLevel(reputation.score))}</span>`;
  }

  function renderReputationSummary(reputation, badges = []) {
    const score = Number(reputation?.score || 0);
    return `
      <div class="reputation-summary">
        <span class="reputation-badge">${escape(score)} reputation</span>
        <span class="trust-level">${escape(trustLevel(score))}</span>
        <div class="capability-grid">
          ${badges.length ? badges.map((badge) => `<span class="capability-chip">${escape(badge.label || badge.badge)}</span>`).join("") : `<span class="capability-chip">No badges yet</span>`}
        </div>
      </div>
    `;
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ reputationReady: true });
    }
  }

  return {
    init,
    getReputation,
    awardReputation,
    removeReputation,
    trustLevel,
    awardBadge,
    listBadges,
    getContributionStats,
    recordThreadCreated,
    recordHelpfulReceived,
    recordBlogPostPublished,
    recordModerationAction,
    renderUserReputation,
    renderReputationSummary
  };
})();

window.ReputationCoreSystem = ReputationCoreSystem;
