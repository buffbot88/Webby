const MessagingCoreSystem = (() => {
  const CONVERSATION_STORE = "conversations";
  const MESSAGE_STORE = "messages";

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function currentUser() {
    return window.UserCoreSystem?.getCurrentUser?.() || null;
  }

  function currentUserId() {
    const user = currentUser();
    return user?.id || user?.username || "";
  }

  function can(capability) {
    return window.UserCoreSystem?.can?.(capability) === true;
  }

  function requireCapability(capability) {
    if (!can(capability)) {
      throw new Error("You do not have permission for this messaging action.");
    }
  }

  function normalizeIdList(items) {
    return Array.from(new Set((Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)));
  }

  function normalizeConversation(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      participantIds: normalizeIdList(record.participantIds),
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  function normalizeMessage(record) {
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    return {
      id: typeof record.id === "string" && record.id ? record.id : undefined,
      conversationId: String(record.conversationId || ""),
      senderId: String(record.senderId || ""),
      body: typeof record.body === "string" ? record.body : "",
      readBy: normalizeIdList(record.readBy),
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      metadata: record.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {}
    };
  }

  async function listConversationsRaw() {
    const records = await window.DataCoreSystem.list(CONVERSATION_STORE);
    return Array.isArray(records) ? records.map(normalizeConversation) : [];
  }

  async function listMessagesRaw() {
    const records = await window.DataCoreSystem.list(MESSAGE_STORE);
    return Array.isArray(records) ? records.map(normalizeMessage) : [];
  }

  function canAccessConversation(conversation, userId = currentUserId()) {
    return !!userId && conversation.participantIds.includes(userId) && conversation.metadata?.deletedBy?.[userId] !== true;
  }

  async function createConversation(participantIds, metadata = {}) {
    requireCapability("messaging.send");
    const userId = currentUserId();
    const participants = normalizeIdList([userId, ...normalizeIdList(participantIds)]);
    if (participants.length < 2) {
      throw new Error("A conversation needs at least two participants.");
    }

    const existing = (await listConversationsRaw()).find((conversation) => {
      const left = [...conversation.participantIds].sort().join("|");
      const right = [...participants].sort().join("|");
      return left === right && !conversation.metadata?.deletedBy?.[userId];
    });
    if (existing) return existing;

    return window.DataCoreSystem.put(CONVERSATION_STORE, normalizeConversation({
      participantIds: participants,
      metadata: {
        ...metadata,
        deletedBy: {}
      }
    }));
  }

  async function sendMessage(conversationId, body, metadata = {}) {
    requireCapability("messaging.send");
    const userId = currentUserId();
    const text = String(body || "").trim();
    if (!text) throw new Error("Message body is required.");

    const conversation = (await listConversationsRaw()).find((item) => String(item.id) === String(conversationId));
    if (!conversation || !canAccessConversation(conversation, userId)) {
      throw new Error("Conversation is unavailable.");
    }

    const saved = await window.DataCoreSystem.put(MESSAGE_STORE, normalizeMessage({
      conversationId: conversation.id,
      senderId: userId,
      body: text,
      readBy: [userId],
      metadata
    }));

    await window.DataCoreSystem.update(CONVERSATION_STORE, conversation.id, {
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(conversation.metadata || {}),
        lastMessageAt: saved.createdAt,
        deletedBy: {}
      }
    });

    await notifyParticipants(conversation, saved);
    return saved;
  }

  async function notifyParticipants(conversation, message) {
    const sender = currentUser();
    const senderName = sender?.displayName || sender?.username || "Someone";
    const targets = conversation.participantIds.filter((id) => id !== message.senderId);
    await Promise.all(targets.map((userId) =>
      window.NotificationCoreSystem?.createNotification?.({
        userId,
        type: "message.new",
        title: "New message",
        message: `${senderName} sent you a message.`,
        link: "#account",
        read: false,
        metadata: { conversationId: conversation.id, messageId: message.id }
      }).catch((error) => Diagnostics?.warn?.("[MessagingCoreSystem] failed to notify message recipient", error))
    ));
  }

  async function listInboxConversations() {
    requireCapability("messaging.read");
    const userId = currentUserId();
    const messages = await listMessagesRaw();
    const conversations = (await listConversationsRaw())
      .filter((conversation) => canAccessConversation(conversation, userId))
      .map((conversation) => {
        const related = messages.filter((message) => message.conversationId === conversation.id);
        const lastMessage = related.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] || null;
        const unreadCount = related.filter((message) => message.senderId !== userId && !message.readBy.includes(userId)).length;
        return { ...conversation, lastMessage, unreadCount };
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    return conversations;
  }

  async function listConversationMessages(conversationId) {
    requireCapability("messaging.read");
    const conversation = (await listConversationsRaw()).find((item) => String(item.id) === String(conversationId));
    if (!conversation || !canAccessConversation(conversation)) return [];
    return (await listMessagesRaw())
      .filter((message) => String(message.conversationId) === String(conversation.id))
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }

  async function markMessagesRead(conversationId) {
    requireCapability("messaging.read");
    const userId = currentUserId();
    const messages = await listConversationMessages(conversationId);
    const updated = [];
    for (const message of messages.filter((item) => item.senderId !== userId && !item.readBy.includes(userId))) {
      updated.push(await window.DataCoreSystem.update(MESSAGE_STORE, message.id, {
        readBy: [...message.readBy, userId]
      }));
    }
    return updated;
  }

  async function countUnreadMessages() {
    requireCapability("messaging.read");
    const conversations = await listInboxConversations();
    return conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  }

  async function softDeleteConversation(conversationId) {
    requireCapability("messaging.read");
    const userId = currentUserId();
    const conversation = (await listConversationsRaw()).find((item) => String(item.id) === String(conversationId));
    if (!conversation || !conversation.participantIds.includes(userId)) return false;
    await window.DataCoreSystem.update(CONVERSATION_STORE, conversation.id, {
      metadata: {
        ...(conversation.metadata || {}),
        deletedBy: {
          ...(conversation.metadata?.deletedBy || {}),
          [userId]: true
        }
      }
    });
    return true;
  }

  function participantLabel(conversation) {
    const userId = currentUserId();
    return conversation.participantIds
      .filter((id) => id !== userId)
      .map((id) => {
        const profile = window.UserCoreSystem?.getProfile?.(id);
        return profile?.displayName || profile?.username || id;
      })
      .join(", ") || "Conversation";
  }

  function renderInbox(conversations) {
    if (!Array.isArray(conversations) || !conversations.length) {
      return `<div class="conversation-list"><div class="activity-item">No conversations yet.</div></div>`;
    }
    return `
      <div class="conversation-list">
        ${conversations.map((conversation) => `
          <article class="activity-item">
            <div>
              <strong>${escape(participantLabel(conversation))}</strong>
              <p>${escape(conversation.lastMessage?.body || "No messages yet.")}</p>
              <span class="social-count">${escape(conversation.unreadCount || 0)}</span>
            </div>
            <button type="button" onclick="window.AccountModuleUI?.openConversation?.('${escape(conversation.id)}')">Open</button>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderMessageThread(messages) {
    const userId = currentUserId();
    if (!Array.isArray(messages) || !messages.length) {
      return `<div class="message-thread"><div class="activity-item">No messages in this conversation.</div></div>`;
    }
    return `
      <div class="message-thread">
        ${messages.map((message) => `
          <div class="message-bubble ${message.senderId === userId ? "message-own" : ""}">
            <div>${escape(message.body)}</div>
            <small>${escape(message.senderId)}</small>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function init() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState({ messagingReady: true });
    }
  }

  return {
    init,
    createConversation,
    sendMessage,
    listInboxConversations,
    listConversationMessages,
    markMessagesRead,
    countUnreadMessages,
    softDeleteConversation,
    renderInbox,
    renderMessageThread
  };
})();

window.MessagingCoreSystem = MessagingCoreSystem;
