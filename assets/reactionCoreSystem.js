const ReactionCoreSystem = (() => {
  const STORE = "reactions";
  const TARGET_TYPES = new Set(["blogPost", "forumThread", "forumPost", "calendarEvent"]);
  const REACTION_TYPES = ["like", "love", "helpful", "laugh"];
  const LABELS = {
    like: "Like",
    love: "Love",
    helpful: "Helpful",
    laugh: "Laugh"
  };

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function currentUserId() {
    const user = window.UserCoreSystem?.getCurrentUser?.();
    return user?.id || user?.username || "";
  }

  function isAuthenticated() {
    return window.UserCoreSystem?.isAuthenticated?.() === true;
  }

  function validateTarget(targetType, targetId) {
    if (!TARGET_TYPES.has(targetType)) throw new Error("Unsupported reaction target.");
    if (targetId == null || String(targetId).trim() === "") throw new Error("Reaction target id is required.");
  }

  function validateReactionType(reactionType) {
    if (!REACTION_TYPES.includes(reactionType)) throw new Error("Unsupported reaction type.");
  }

  function normalizeReaction(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      userId: typeof record.userId === "string" ? record.userId : "",
      targetType: typeof record.targetType === "string" ? record.targetType : "",
      targetId: String(record.targetId || ""),
      reactionType: typeof record.reactionType === "string" ? record.reactionType : "like",
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt
    };
  }

  async function listAll() {
    if (!window.DataCoreSystem?.list) return [];
    const records = await window.DataCoreSystem.list(STORE);
    return Array.isArray(records) ? records.map(normalizeReaction) : [];
  }

  async function listReactionsForTarget(targetType, targetId) {
    validateTarget(targetType, targetId);
    const records = await listAll();
    return records.filter((item) => item.targetType === targetType && String(item.targetId) === String(targetId));
  }

  async function findOwnReaction(targetType, targetId, reactionType) {
    const userId = currentUserId();
    if (!userId) return null;
    const records = await listReactionsForTarget(targetType, targetId);
    return records.find((item) => item.userId === userId && item.reactionType === reactionType) || null;
  }

  async function addReaction(targetType, targetId, reactionType) {
    validateTarget(targetType, targetId);
    validateReactionType(reactionType);
    if (!isAuthenticated()) throw new Error("Authentication is required to react.");

    const existing = await findOwnReaction(targetType, targetId, reactionType);
    if (existing) return existing;

    const record = normalizeReaction({
      userId: currentUserId(),
      targetType,
      targetId,
      reactionType
    });
    const saved = await window.DataCoreSystem.put(STORE, record);
    window.ActivityFeedCoreSystem?.recordReactionAdded?.(saved).catch((error) => {
      Diagnostics?.warn?.("[ReactionCoreSystem] failed to record reaction activity", error);
    });
    if (reactionType === "helpful") {
      recordHelpfulReputation(targetType, targetId, currentUserId()).catch((error) => {
        Diagnostics?.warn?.("[ReactionCoreSystem] failed to record helpful reputation", error);
      });
    }
    return saved;
  }

  async function recordHelpfulReputation(targetType, targetId, reactorId) {
    if (!window.ContentCoreSystem?.getContent || !window.ReputationCoreSystem?.recordHelpfulReceived) return;
    const content = await window.ContentCoreSystem.getContent(targetType, targetId);
    const authorId = content?.authorId || "";
    if (authorId && authorId !== reactorId) {
      await window.ReputationCoreSystem.recordHelpfulReceived(authorId);
    }
  }

  async function removeReaction(targetType, targetId, reactionType) {
    validateTarget(targetType, targetId);
    validateReactionType(reactionType);
    if (!isAuthenticated()) throw new Error("Authentication is required to remove reactions.");

    const existing = await findOwnReaction(targetType, targetId, reactionType);
    if (!existing) return false;
    return window.DataCoreSystem.remove(STORE, existing.id);
  }

  async function toggleReaction(targetType, targetId, reactionType) {
    const existing = await findOwnReaction(targetType, targetId, reactionType);
    if (existing) {
      await removeReaction(targetType, targetId, reactionType);
      return { active: false };
    }
    const reaction = await addReaction(targetType, targetId, reactionType);
    return { active: true, reaction };
  }

  async function countReactionsByType(targetType, targetId) {
    const records = await listReactionsForTarget(targetType, targetId);
    return REACTION_TYPES.reduce((counts, type) => {
      counts[type] = records.filter((item) => item.reactionType === type).length;
      return counts;
    }, {});
  }

  async function hasCurrentUserReacted(targetType, targetId, reactionType) {
    if (reactionType) return !!(await findOwnReaction(targetType, targetId, reactionType));
    const userId = currentUserId();
    if (!userId) return false;
    const records = await listReactionsForTarget(targetType, targetId);
    return records.some((item) => item.userId === userId);
  }

  function barId(targetType, targetId) {
    return `reaction-${targetType}-${String(targetId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function renderReactionBar(targetType, targetId) {
    validateTarget(targetType, targetId);
    const disabled = isAuthenticated() ? "" : "disabled";
    return `
      <div id="${escape(barId(targetType, targetId))}" class="reaction-bar" data-target-type="${escape(targetType)}" data-target-id="${escape(targetId)}">
        ${REACTION_TYPES.map((type) => `
          <button class="reaction-button" type="button" data-reaction-type="${escape(type)}" ${disabled} onclick="window.ReactionCoreSystem.toggleReactionFromUI('${escape(targetType)}', '${escape(targetId)}', '${escape(type)}')">
            ${escape(LABELS[type])} <span class="social-count" data-social-count="${escape(type)}">0</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  async function hydrateReactionBar(element) {
    if (!element) return;
    const targetType = element.dataset.targetType;
    const targetId = element.dataset.targetId;
    const [counts, records] = await Promise.all([
      countReactionsByType(targetType, targetId),
      listReactionsForTarget(targetType, targetId)
    ]);
    const userId = currentUserId();

    element.querySelectorAll("[data-social-count]").forEach((countEl) => {
      const type = countEl.dataset.socialCount;
      countEl.textContent = String(counts[type] || 0);
    });
    element.querySelectorAll(".reaction-button").forEach((button) => {
      const type = button.dataset.reactionType;
      const active = !!userId && records.some((item) => item.userId === userId && item.reactionType === type);
      button.classList.toggle("active", active);
      button.disabled = !isAuthenticated();
      button.title = isAuthenticated() ? `${LABELS[type]} this` : "Sign in to react";
    });
  }

  async function hydrateReactionBars(root = document) {
    const bars = Array.from(root.querySelectorAll(".reaction-bar[data-target-type][data-target-id]"));
    await Promise.all(bars.map((bar) => hydrateReactionBar(bar).catch((error) => {
      Diagnostics?.warn?.("[ReactionCoreSystem] failed to hydrate reaction bar", error);
    })));
  }

  async function toggleReactionFromUI(targetType, targetId, reactionType) {
    try {
      await toggleReaction(targetType, targetId, reactionType);
      await hydrateReactionBars();
      window.HomeModuleUI?.refresh?.();
    } catch (error) {
      window.alert(error?.message || "Unable to update reaction.");
    }
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ reactionReady: true });
    }
  }

  return {
    init,
    addReaction,
    removeReaction,
    toggleReaction,
    listReactionsForTarget,
    countReactionsByType,
    hasCurrentUserReacted,
    renderReactionBar,
    hydrateReactionBars,
    toggleReactionFromUI,
    getReactionTypes: () => [...REACTION_TYPES],
    getTargetTypes: () => Array.from(TARGET_TYPES)
  };
})();

window.ReactionCoreSystem = ReactionCoreSystem;
