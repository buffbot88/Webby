const AccountModuleUI = (() => {
  let activeView = "profile";

  function setAlert(id, message, tone = "error") {
    const alert = document.getElementById(id);
    if (!alert) return;
    alert.textContent = message || "";
    alert.dataset.tone = tone;
    alert.hidden = !message;
  }

  function value(id) {
    return document.getElementById(id)?.value || "";
  }

  async function login(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    setAlert("accountLoginAlert", "");

    const ok = await window.UserCoreSystem?.login?.(
      value("accountLoginUsername"),
      value("accountLoginPassword")
    );

    if (!ok) {
      setAlert("accountLoginAlert", window.UserCoreSystem?.getStatusMessage?.() || "Sign-in failed.");
      return false;
    }

    window.Runtime?.navigate("account", { updateHash: false });
    return false;
  }

  async function signup(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    setAlert("accountSignupAlert", "");

    const password = value("accountSignupPassword");
    const confirmation = value("accountSignupPasswordConfirm");

    if (password !== confirmation) {
      setAlert("accountSignupAlert", "Passwords do not match.");
      return false;
    }

    const ok = await window.UserCoreSystem?.signup?.({
      username: value("accountSignupUsername"),
      password,
      displayName: value("accountSignupDisplayName"),
      bio: value("accountSignupBio")
    });

    if (!ok) {
      setAlert("accountSignupAlert", window.UserCoreSystem?.getStatusMessage?.() || "Account creation failed.");
      return false;
    }

    window.Runtime?.navigate("account", { updateHash: false });
    return false;
  }

  async function updateProfile(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    setAlert("accountProfileAlert", "");

    const ok = await window.UserCoreSystem?.updateProfile?.({
      displayName: value("accountProfileDisplayName"),
      bio: value("accountProfileBio")
    });

    if (!ok) {
      setAlert("accountProfileAlert", window.UserCoreSystem?.getStatusMessage?.() || "Profile update failed.");
      return false;
    }

    window.Runtime?.navigate("account", { updateHash: false });
    return false;
  }

  async function uploadAvatar() {
    const input = document.getElementById("accountAvatarUpload");
    try {
      const media = await window.MediaCoreSystem?.uploadFromInput?.(input, {
        targetType: "userProfile",
        targetId: window.UserCoreSystem?.getCurrentUser?.()?.id || "",
        metadata: { purpose: "avatar" }
      });
      if (!media) return;
      await window.UserCoreSystem?.updateProfile?.({ avatar: media.url });
      window.Runtime?.navigate("account", { updateHash: false });
    } catch (error) {
      setAlert("accountProfileAlert", error?.message || "Avatar upload failed.");
    }
  }

  async function logout() {
    await window.UserCoreSystem?.logout?.();
    window.Runtime?.navigate("account", { updateHash: false });
  }

  async function refreshSocial() {
    const bookmarkContainer = document.getElementById("accountBookmarkList");
    const notificationContainer = document.getElementById("accountNotificationList");
    const unreadCounter = document.getElementById("accountUnreadCount");

    if (bookmarkContainer && window.BookmarkCoreSystem?.listCurrentUserBookmarks) {
      const bookmarks = await window.BookmarkCoreSystem.listCurrentUserBookmarks();
      bookmarkContainer.innerHTML = window.BookmarkCoreSystem.renderBookmarkList(bookmarks);
    }

    if (notificationContainer && window.NotificationCoreSystem?.listNotifications) {
      const notifications = await window.NotificationCoreSystem.listNotifications();
      notificationContainer.innerHTML = `<div class="notification-list">${window.NotificationCoreSystem.renderNotificationList(notifications)}</div>`;
    }

    if (unreadCounter && window.NotificationCoreSystem?.countUnread) {
      const count = await window.NotificationCoreSystem.countUnread();
      unreadCounter.textContent = String(count);
    }

    await refreshGovernance();
  }

  async function refreshGovernance() {
    const inboxContainer = document.getElementById("accountInboxList");
    const messageContainer = document.getElementById("accountMessageThread");
    const messageUnreadCounter = document.getElementById("accountMessageUnreadCount");
    const reputationContainer = document.getElementById("accountReputationSummary");
    const warningContainer = document.getElementById("accountWarningList");
    const suspensionContainer = document.getElementById("accountSuspensionList");
    const user = window.UserCoreSystem?.getCurrentUser?.();
    const userId = user?.id || user?.username || "";

    if (inboxContainer && window.MessagingCoreSystem?.listInboxConversations) {
      try {
        const conversations = await window.MessagingCoreSystem.listInboxConversations();
        inboxContainer.innerHTML = window.MessagingCoreSystem.renderInbox(conversations);
      } catch {
        inboxContainer.innerHTML = `<div class="conversation-list"><div class="activity-item">Inbox is unavailable.</div></div>`;
      }
    }

    if (messageContainer && !messageContainer.dataset.loaded) {
      messageContainer.innerHTML = `<div class="message-thread"><div class="activity-item">Open a conversation to read messages.</div></div>`;
    }

    if (messageUnreadCounter && window.MessagingCoreSystem?.countUnreadMessages) {
      try {
        messageUnreadCounter.textContent = String(await window.MessagingCoreSystem.countUnreadMessages());
      } catch {
        messageUnreadCounter.textContent = "0";
      }
    }

    if (reputationContainer && window.ReputationCoreSystem?.getReputation) {
      const reputation = await window.ReputationCoreSystem.getReputation(userId);
      const badges = await window.ReputationCoreSystem.listBadges(userId);
      reputationContainer.innerHTML = window.ReputationCoreSystem.renderReputationSummary(reputation, badges);
    }

    if (warningContainer && window.ModerationCoreSystem?.listWarnings) {
      const warnings = await window.ModerationCoreSystem.listWarnings(userId);
      warningContainer.innerHTML = window.ModerationCoreSystem.renderWarnings(warnings);
    }

    if (suspensionContainer && window.ModerationCoreSystem?.listSuspensions) {
      const suspensions = await window.ModerationCoreSystem.listSuspensions(userId);
      suspensionContainer.innerHTML = window.ModerationCoreSystem.renderSuspensions(suspensions);
    }
  }

  async function markNotificationRead(id) {
    await window.NotificationCoreSystem?.markRead?.(id);
    await refreshSocial();
  }

  async function markAllNotificationsRead() {
    await window.NotificationCoreSystem?.markAllRead?.();
    await refreshSocial();
  }

  async function deleteNotification(id) {
    await window.NotificationCoreSystem?.deleteNotification?.(id);
    await refreshSocial();
  }

  async function startConversation() {
    const participantId = window.prompt("Send message to username:");
    if (!String(participantId || "").trim()) return;
    const body = window.prompt("Message:");
    if (!String(body || "").trim()) return;
    try {
      const conversation = await window.MessagingCoreSystem?.createConversation?.([participantId.trim()]);
      await window.MessagingCoreSystem?.sendMessage?.(conversation.id, body);
      await refreshSocial();
      await openConversation(conversation.id);
    } catch (error) {
      window.alert(error?.message || "Unable to send message.");
    }
  }

  async function openConversation(conversationId) {
    const container = document.getElementById("accountMessageThread");
    const input = document.getElementById("accountReplyConversationId");
    if (!container || !window.MessagingCoreSystem?.listConversationMessages) return;
    await window.MessagingCoreSystem.markMessagesRead(conversationId);
    const messages = await window.MessagingCoreSystem.listConversationMessages(conversationId);
    container.dataset.loaded = "true";
    container.innerHTML = window.MessagingCoreSystem.renderMessageThread(messages);
    if (input) input.value = conversationId;
    await refreshGovernance();
  }

  async function sendConversationReply(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const conversationId = value("accountReplyConversationId");
    const body = value("accountReplyBody");
    if (!conversationId || !String(body || "").trim()) return false;
    try {
      await window.MessagingCoreSystem?.sendMessage?.(conversationId, body);
      const bodyField = document.getElementById("accountReplyBody");
      if (bodyField) bodyField.value = "";
      await openConversation(conversationId);
    } catch (error) {
      window.alert(error?.message || "Unable to send reply.");
    }
    return false;
  }

  function setView(view) {
    if (!["profile", "activity", "inbox", "standing"].includes(view)) return;
    activeView = view;
    if (typeof AccountModuleUI.refreshCurrentView === "function") {
      AccountModuleUI.refreshCurrentView();
    } else {
      window.Runtime?.navigate("account", { updateHash: false });
    }
  }

  function getView() {
    return activeView;
  }

  function setDefaultView() {
    activeView = "profile";
  }

  return {
    login,
    signup,
    updateProfile,
    uploadAvatar,
    logout,
    refreshSocial,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    refreshGovernance,
    startConversation,
    openConversation,
    sendConversationReply,
    setView,
    getView,
    setDefaultView
  };
})();

window.AccountModuleUI = AccountModuleUI;

ModuleSDK.registerPage("account", {

  title: "Account",

  render: () => {
    AccountModuleUI.setDefaultView?.();
    const userSystem = window.UserCoreSystem;
    const currentUser = userSystem?.getCurrentUser?.();
    const authenticated = userSystem?.isAuthenticated?.() ?? false;
    const statusMessage = userSystem?.getStatusMessage?.() || "";
    const capabilities = userSystem?.getCapabilities?.() || [];
    const canProfile = userSystem?.can?.("account.profile") ?? false;

    function escape(value) {
      return Diagnostics.escapeText(value == null ? "" : String(value));
    }

    function renderStatus() {
      if (!statusMessage) return "";
      return `<div class="account-alert" data-tone="info">${escape(statusMessage)}</div>`;
    }

    function renderRoleBadge(role) {
      const safeRole = ["guest", "user", "moderator", "admin"].includes(role) ? role : "user";
      return `<span class="role-badge role-${escape(safeRole)}">${escape(safeRole)}</span>`;
    }

    function renderCapabilities(items) {
      const safeItems = items && items.length ? items : ["site.view"];
      return `
        <div class="capability-grid">
          ${safeItems.map((capability) => `<span class="capability-chip">${escape(capability)}</span>`).join("")}
        </div>
      `;
    }

    function queueSocialRefresh() {
      window.setTimeout(() => window.AccountModuleUI?.refreshSocial?.(), 0);
    }

    function renderAccountNav() {
      const activeView = window.AccountModuleUI?.getView?.() || "profile";
      const items = [
        ["profile", "Profile"],
        ["activity", "Activity"],
        ["inbox", "Inbox"],
        ["standing", "Standing"]
      ];

      return `
        <nav class="module-subnav" aria-label="Account views">
          ${items.map(([view, label]) => `
            <button type="button" class="${activeView === view ? "active" : ""}" onclick="window.AccountModuleUI.setView('${escape(view)}')">
              ${escape(label)}
            </button>
          `).join("")}
        </nav>
      `;
    }

    function renderAccountOverview() {
      return `
        <section class="account-overview-grid" aria-label="Account summary">
          <div class="account-overview-card">
            <span>Profile</span>
            <strong>${escape(displayName)}</strong>
            <small>@${escape(username)}</small>
          </div>
          <div class="account-overview-card">
            <span>Role</span>
            <strong>${escape(role)}</strong>
            <small>${adminReady ? "Admin controls available" : "Standard workspace access"}</small>
          </div>
          <div class="account-overview-card">
            <span>Notifications</span>
            <strong id="accountUnreadCount">0</strong>
            <small>Unread public activity</small>
          </div>
          <div class="account-overview-card">
            <span>Messages</span>
            <strong id="accountMessageUnreadCount">0</strong>
            <small>Unread inbox items</small>
          </div>
        </section>
      `;
    }

    if (!userSystem) {
      return `
        <section class="page-shell account-shell">
          <h1>Account</h1>
          <div class="account-alert">Identity system is not available.</div>
        </section>
      `;
    }

    if (!authenticated) {
      return `
        <section class="page-shell account-shell">
          <div class="page-header account-heading">
            <div>
              <h1 class="page-title">Account</h1>
              <p class="page-subtitle">Sign in or create a community profile with identity, messages, bookmarks, reputation, and standing.</p>
            </div>
            ${renderRoleBadge("guest")}
          </div>

          ${renderStatus()}

          <div class="auth-grid">
            <article class="auth-card">
              <h2>Sign In</h2>
              <p class="muted">Use an existing account to restore your profile and permissions.</p>
              <div id="accountLoginAlert" class="account-alert" hidden></div>
              <form onsubmit="window.AccountModuleUI.login(event)">
                <div class="form-row">
                  <label for="accountLoginUsername">Username</label>
                  <input id="accountLoginUsername" type="text" autocomplete="username" required />
                </div>
                <div class="form-row">
                  <label for="accountLoginPassword">Password</label>
                  <input id="accountLoginPassword" type="password" autocomplete="current-password" required />
                </div>
                <button class="button-primary" type="submit">Sign In</button>
              </form>
            </article>

            <article class="auth-card">
              <h2>Create Account</h2>
              <p class="muted">Public signup always creates the normal user role.</p>
              <div id="accountSignupAlert" class="account-alert" hidden></div>
              <form onsubmit="window.AccountModuleUI.signup(event)">
                <div class="form-row">
                  <label for="accountSignupUsername">Username</label>
                  <input id="accountSignupUsername" type="text" autocomplete="username" required />
                </div>
                <div class="form-row">
                  <label for="accountSignupPassword">Password</label>
                  <input id="accountSignupPassword" type="password" autocomplete="new-password" required />
                </div>
                <div class="form-row">
                  <label for="accountSignupPasswordConfirm">Confirm password</label>
                  <input id="accountSignupPasswordConfirm" type="password" autocomplete="new-password" required />
                </div>
                <div class="form-row">
                  <label for="accountSignupDisplayName">Display name</label>
                  <input id="accountSignupDisplayName" type="text" autocomplete="name" />
                </div>
                <div class="form-row">
                  <label for="accountSignupBio">Bio</label>
                  <textarea id="accountSignupBio" rows="4"></textarea>
                </div>
                <button class="button-primary" type="submit">Create Account</button>
              </form>
            </article>
          </div>
        </section>
      `;
    }

    const displayName = currentUser?.displayName || currentUser?.username || "Account";
    const username = currentUser?.username || "unknown";
    const joinedAt = currentUser?.joinedAt ? new Date(currentUser.joinedAt).toLocaleDateString() : "Unknown";
    const initial = (displayName || username || "?").slice(0, 1).toUpperCase();
    const role = currentUser?.role || "guest";
    const adminReady = userSystem?.can?.("platform.admin.access") === true;
    const accountView = window.AccountModuleUI?.getView?.() || "profile";
    queueSocialRefresh();

    function renderProfileView() {
      return `
        <div class="profile-card">
          <div class="profile-card-main">
            ${currentUser?.avatar
              ? `<img class="profile-avatar avatar-image" src="${escape(currentUser.avatar)}" alt="${escape(displayName)}" />`
              : `<div class="profile-avatar" aria-hidden="true">${escape(initial)}</div>`}
            <div>
              <div class="profile-name">${escape(displayName)}</div>
              <div class="profile-meta">@${escape(username)}</div>
              <div class="profile-meta">Joined ${escape(joinedAt)}</div>
            </div>
          </div>
          <div class="profile-card-side">
            ${renderRoleBadge(role)}
          </div>
          <div class="profile-bio">${escape(currentUser?.bio || "No bio yet.")}</div>
        </div>

        <div class="account-panels">
          <article class="auth-card">
            <h2>Edit Profile</h2>
            <div id="accountProfileAlert" class="account-alert" hidden></div>
            ${canProfile ? `
              <form onsubmit="window.AccountModuleUI.updateProfile(event)">
                <div class="form-row">
                  <label for="accountProfileDisplayName">Display name</label>
                  <input id="accountProfileDisplayName" type="text" value="${escape(currentUser?.displayName || "")}" />
                </div>
                <div class="form-row">
                  <label for="accountProfileBio">Bio</label>
                  <textarea id="accountProfileBio" rows="5">${escape(currentUser?.bio || "")}</textarea>
                </div>
                <div class="form-row media-upload">
                  <label for="accountAvatarUpload">Avatar image</label>
                  <input id="accountAvatarUpload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
                  <button class="button-secondary" type="button" onclick="window.AccountModuleUI.uploadAvatar()">Upload Avatar</button>
                </div>
                <button class="button-primary" type="submit">Save Profile</button>
              </form>
            ` : `<p class="muted">Profile editing is not available for this account.</p>`}
          </article>

          <article class="auth-card">
            <h2>Account Status</h2>
            <dl class="account-status-list">
              <div>
                <dt>Session</dt>
                <dd>Authenticated</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>${renderRoleBadge(role)}</dd>
              </div>
              <div>
                <dt>Admin controls</dt>
                <dd>${adminReady ? "Available" : "Hidden"}</dd>
              </div>
            </dl>
          </article>
        </div>

        <article class="auth-card">
          <h2>Capabilities</h2>
          ${renderCapabilities(capabilities)}
        </article>
      `;
    }

    function renderActivityView() {
      return `
        <div class="account-panels">
          <article class="auth-card">
            <h2>Notifications <span class="social-count">Activity</span></h2>
            <button class="button-secondary" type="button" onclick="window.AccountModuleUI.markAllNotificationsRead()">Mark All Read</button>
            <div id="accountNotificationList" class="notification-list">
              <div class="notification-item">Loading notifications...</div>
            </div>
          </article>

          <article class="auth-card">
            <h2>My Bookmarks</h2>
            <div id="accountBookmarkList" class="activity-feed">
              <div class="activity-item">Loading bookmarks...</div>
            </div>
          </article>
        </div>
      `;
    }

    function renderInboxView() {
      return `
        <article class="auth-card inbox-shell">
          <h2>Inbox <span class="social-count">Messages</span></h2>
          <button class="button-secondary" type="button" onclick="window.AccountModuleUI.startConversation()">New Message</button>
          <div id="accountInboxList" class="conversation-list">
            <div class="activity-item">Loading inbox...</div>
          </div>
          <div id="accountMessageThread" class="message-thread">
            <div class="activity-item">Open a conversation to read messages.</div>
          </div>
          <form onsubmit="window.AccountModuleUI.sendConversationReply(event)">
            <input id="accountReplyConversationId" type="hidden" />
            <div class="form-row">
              <label for="accountReplyBody">Reply</label>
              <textarea id="accountReplyBody" rows="3"></textarea>
            </div>
            <button class="button-primary" type="submit">Send Reply</button>
          </form>
        </article>
      `;
    }

    function renderStandingView() {
      return `
        <div class="account-panels">
          <article class="auth-card">
            <h2>Reputation</h2>
            <div id="accountReputationSummary">
              <div class="activity-item">Loading reputation...</div>
            </div>
          </article>

          <article class="auth-card">
            <h2>Account Standing</h2>
            <div id="accountSuspensionList"></div>
            <div id="accountWarningList">
              <div class="activity-item">Loading warnings...</div>
            </div>
          </article>
        </div>
      `;
    }

    function renderAccountView() {
      const currentView = window.AccountModuleUI?.getView?.() || accountView;
      if (currentView === "activity") return renderActivityView();
      if (currentView === "inbox") return renderInboxView();
      if (currentView === "standing") return renderStandingView();
      return renderProfileView();
    }

    window.AccountModuleUI.refreshCurrentView = () => {
      const nav = document.getElementById("accountViewNav");
      const content = document.getElementById("accountActiveView");
      if (nav) nav.innerHTML = renderAccountNav();
      if (content) content.innerHTML = renderAccountView();
      queueSocialRefresh();
    };

    return `
      <section class="page-shell account-shell">
        <div class="page-header account-heading">
          <div>
            <h1 class="page-title">Account</h1>
            <p class="page-subtitle">A social profile hub for identity, permissions, notifications, bookmarks, inbox, reputation, and moderation standing.</p>
          </div>
          <button class="button-secondary" type="button" onclick="window.AccountModuleUI.logout()">Logout</button>
        </div>

        ${renderStatus()}
        ${renderAccountOverview()}
        <div id="accountViewNav">${renderAccountNav()}</div>
        <div id="accountActiveView">${renderAccountView()}</div>
      </section>
    `;
  }

});
