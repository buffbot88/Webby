// UserCoreSystem is a local development identity layer.
// Production authentication must be implemented through a secure backend/API.
const UserCoreSystem = (() => {

  const DEFAULT_USERS = [
    {
      username: "admin",
      password: "admin123",
      displayName: "Platform Admin",
      bio: "Administrative authority for local development.",
      role: "admin"
    },
    {
      username: "mod",
      password: "mod123",
      displayName: "Community Moderator",
      bio: "Moderator authority for forum workflows.",
      role: "moderator"
    },
    {
      username: "user",
      password: "user123",
      displayName: "Regular User",
      bio: "Standard user account for testing public workflows.",
      role: "user"
    }
  ];

  let users = [];
  let currentUser = null;
  let statusMessage = null;
  const SESSION_ID = "current";

  function clone(value) {
    if (value === null || typeof value !== "object") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function normalizeUsername(username) {
    return typeof username === "string" ? username.trim().toLowerCase() : "";
  }

  function normalizeRole(role) {
    const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
    return ["user", "moderator", "admin"].includes(normalized) ? normalized : "user";
  }

  function normalizeUser(user) {
    return {
      id: normalizeUsername(user.id || user.username),
      username: normalizeUsername(user.username),
      password: typeof user.password === "string" ? user.password : "",
      displayName: typeof user.displayName === "string" && user.displayName.trim()
        ? user.displayName.trim()
        : normalizeUsername(user.username) || "New User",
      bio: typeof user.bio === "string" ? user.bio.trim() : "",
      avatar: typeof user.avatar === "string" ? user.avatar : "",
      joinedAt: typeof user.joinedAt === "string" ? user.joinedAt : new Date().toISOString(),
      role: normalizeRole(user.role),
      capabilities: Array.isArray(user.capabilities)
        ? user.capabilities.filter((item) => typeof item === "string" && item.trim())
        : []
    };
  }

  function toPublicUser(user) {
    if (!user) return null;
    return clone({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      joinedAt: user.joinedAt,
      role: user.role,
      capabilities: user === currentUser ? getCapabilities() : Array.from(new Set([
        ...getRoleCapabilities(user.role),
        ...(user.capabilities || [])
      ]))
    });
  }

  function getRoleCapabilities(role) {
    if (role === "guest") {
      return [
        "site.view",
        "account.login",
        "account.signup"
      ];
    }

    if (role === "user") {
      return [
        "site.view",
        "account.profile",
        "forum.thread.create",
        "forum.post.create",
        "forum.post.editOwn",
        "blog.post.create",
        "calendar.event.create",
        "messaging.send",
        "messaging.read",
        "media.upload",
        "media.deleteOwn",
        "media.attach",
        "cms.search"
      ];
    }

    if (role === "moderator") {
      return [
        "site.view",
        "account.profile",
        "forum.thread.create",
        "forum.post.create",
        "forum.post.editOwn",
        "forum.thread.edit",
        "forum.thread.close",
        "forum.thread.pin",
        "forum.thread.unpin",
        "forum.thread.moveTrash",
        "forum.post.edit",
        "forum.post.moveTrash",
        "blog.post.edit",
        "blog.post.publish",
        "blog.post.moveTrash",
        "blog.post.feature",
        "calendar.event.edit",
        "calendar.event.publish",
        "calendar.event.cancel",
        "calendar.event.moveTrash",
        "calendar.event.feature",
        "messaging.send",
        "messaging.read",
        "moderation.report.review",
        "moderation.user.warn",
        "moderation.user.suspend",
        "media.upload",
        "media.deleteOwn",
        "media.deleteAny",
        "media.attach",
        "media.manage",
        "cms.search",
        "cms.taxonomy.manage",
        "cms.revision.view",
        "cms.schedule.publish"
      ];
    }

    if (role === "admin") {
      return ["*"];
    }

    return [
      "site.view",
      "account.profile",
      "forum.thread.create",
      "forum.post.create",
      "forum.post.editOwn"
    ];
  }

  async function loadUsers() {
    if (!window.DataCoreSystem?.list) {
      Diagnostics?.warn?.("[UserCoreSystem] DataCoreSystem is unavailable.");
      users = [];
      return;
    }

    try {
      const stored = await window.DataCoreSystem.list("users");
      users = Array.isArray(stored) ? stored.map(normalizeUser) : [];
    } catch (err) {
      Diagnostics?.warn?.("[UserCoreSystem] failed to load users", err);
      users = [];
    }
  }

  async function saveUsers() {
    if (!window.DataCoreSystem?.clear || !window.DataCoreSystem?.put) {
      Diagnostics?.warn?.("[UserCoreSystem] DataCoreSystem is unavailable for saving users.");
      return;
    }

    try {
      await window.DataCoreSystem.clear("users");
      for (const user of users) {
        await window.DataCoreSystem.put("users", user);
      }
    } catch (err) {
      Diagnostics?.warn?.("[UserCoreSystem] failed to save users", err);
    }
  }

  async function restoreSession() {
    if (!window.DataCoreSystem?.get) return;

    try {
      const session = await window.DataCoreSystem.get("sessions", SESSION_ID);
      const user = session?.userId ? findUser(session.userId) : null;
      currentUser = user || null;

      if (session && !user && window.DataCoreSystem?.remove) {
        await window.DataCoreSystem.remove("sessions", SESSION_ID);
      }
    } catch (err) {
      Diagnostics?.warn?.("[UserCoreSystem] failed to restore session", err);
      currentUser = null;
    }
  }

  async function saveSession() {
    if (!currentUser || !window.DataCoreSystem?.put) return;

    try {
      await window.DataCoreSystem.put("sessions", {
        id: SESSION_ID,
        userId: currentUser.id,
        username: currentUser.username,
        active: true,
        lastSeenAt: new Date().toISOString()
      });
    } catch (err) {
      Diagnostics?.warn?.("[UserCoreSystem] failed to save session", err);
    }
  }

  async function clearSession() {
    if (!window.DataCoreSystem?.remove) return;

    try {
      await window.DataCoreSystem.remove("sessions", SESSION_ID);
    } catch (err) {
      if (!String(err?.message || err).includes("Record not found")) {
        Diagnostics?.warn?.("[UserCoreSystem] failed to clear session", err);
      }
    }
  }

  function findUser(identifier) {
    const normalized = normalizeUsername(identifier);
    return users.find((entry) => entry.id === normalized || entry.username === normalized) || null;
  }

  function setStatusMessage(message) {
    statusMessage = typeof message === "string" ? message : null;
  }

  async function seedDefaultUsers() {
    if (users.length > 0) return;

    users = DEFAULT_USERS.map((entry) => normalizeUser({
      ...entry,
      id: normalizeUsername(entry.username),
      joinedAt: new Date().toISOString()
    }));

    await saveUsers();
  }

  function getCurrentUser() {
    return toPublicUser(currentUser);
  }

  function isAuthenticated() {
    return !!currentUser;
  }

  function hasRole(role) {
    return typeof role === "string" && currentUser?.role === role;
  }

  function getCapabilities() {
    if (!currentUser) {
      return getRoleCapabilities("guest");
    }
    if (currentUser.role === "admin") {
      return ["*"];
    }
    return Array.from(new Set([
      ...getRoleCapabilities(currentUser.role),
      ...(currentUser.capabilities || [])
    ]));
  }

  function can(capability) {
    if (currentUser?.role === "admin") {
      return true;
    }
    if (typeof capability !== "string" || !capability.trim()) {
      return false;
    }
    return getCapabilities().includes(capability);
  }

  function routeHasAllowedRole(route) {
    if (!Array.isArray(route?.roles) || route.roles.length === 0) {
      return true;
    }

    return !!currentUser && route.roles.includes(currentUser.role);
  }

  function routeHasRequiredCapabilities(route) {
    if (!Array.isArray(route?.capabilities) || route.capabilities.length === 0) {
      return true;
    }

    return route.capabilities.every((capability) => can(capability));
  }

  function isRouteAccessible(route) {
    if (!route || typeof route !== "object") {
      return false;
    }

    if (currentUser?.role === "admin") {
      return true;
    }

    if (route.auth === true && !isAuthenticated()) {
      return false;
    }

    return routeHasAllowedRole(route) && routeHasRequiredCapabilities(route);
  }

  function getRouteDeniedReason(route) {
    if (!route || typeof route !== "object") {
      return "Route is unavailable.";
    }

    if (route.auth === true && !isAuthenticated()) {
      return "Authentication required.";
    }

    if (!routeHasAllowedRole(route)) {
      return "Required role is missing.";
    }

    if (!routeHasRequiredCapabilities(route)) {
      return "Required capability is missing.";
    }

    return "";
  }

  async function authenticate(username, password) {
    await loadUsers();
    const user = findUser(username);
    if (!user || user.password !== password) {
      setStatusMessage("Invalid username or password.");
      return false;
    }
    currentUser = user;
    await saveSession();
    setStatusMessage("Signed in successfully.");
    updateRuntimeState();
    Lifecycle.emit("user:login", { user: getCurrentUser() });
    return true;
  }

  async function signup({ username, password, displayName, bio }) {
    await loadUsers();
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !password || password.length < 3) {
      setStatusMessage("Username and password are required. Password must be at least 3 characters.");
      return false;
    }

    if (findUser(normalizedUsername)) {
      setStatusMessage("That username is already in use.");
      return false;
    }

    const newUser = normalizeUser({
      id: normalizedUsername,
      username: normalizedUsername,
      password,
      displayName,
      bio,
      role: "user",
      joinedAt: new Date().toISOString(),
      capabilities: []
    });

    users.push(newUser);
    await saveUsers();
    currentUser = newUser;
    await saveSession();
    setStatusMessage("Registration complete. You are now signed in.");
    updateRuntimeState();
    Lifecycle.emit("user:register", { user: getCurrentUser() });
    return true;
  }

  async function logout() {
    if (!currentUser) return false;
    const previousUser = currentUser;
    currentUser = null;
    await clearSession();
    setStatusMessage("Logged out successfully.");
    updateRuntimeState();
    Lifecycle.emit("user:logout", { user: toPublicUser(previousUser) });
    return true;
  }

  async function updateProfile(patch) {
    if (!currentUser) {
      setStatusMessage("No authenticated user.");
      return false;
    }

    const updated = normalizeUser({
      ...currentUser,
      displayName: typeof patch.displayName === "string" ? patch.displayName.trim() : currentUser.displayName,
      bio: typeof patch.bio === "string" ? patch.bio.trim() : currentUser.bio,
      avatar: typeof patch.avatar === "string" ? patch.avatar : currentUser.avatar
    });

    users = users.map((entry) =>
      entry.id === currentUser.id ? updated : entry
    );

    currentUser = updated;
    await saveUsers();
    setStatusMessage("Profile updated successfully.");
    updateRuntimeState();
    Lifecycle.emit("user:profile:update", { user: getCurrentUser() });
    return true;
  }

  function getProfile(userId) {
    if (!userId) {
      return getCurrentUser();
    }
    return toPublicUser(findUser(userId));
  }

  function listUsers() {
    if (!can("platform.admin.access")) {
      setStatusMessage("Admin access required to list users.");
      return [];
    }
    return users.map((user) => clone({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      joinedAt: user.joinedAt,
      role: user.role,
      capabilities: getRoleCapabilities(user.role)
    }));
  }

  function getSessionState() {
    return {
      currentUser: getCurrentUser(),
      currentRole: currentUser?.role || "guest",
      userCapabilities: getCapabilities(),
      isAuthenticated: isAuthenticated()
    };
  }

  function updateRuntimeState() {
    if (window.Runtime?.updateRuntimeState) {
      window.Runtime.updateRuntimeState(getSessionState());
    }
  }

  async function init() {
    await loadUsers();
    await seedDefaultUsers();
    await restoreSession();
    updateRuntimeState();
  }

  function getStatusMessage() {
    return statusMessage || "";
  }

  const UserCoreSystemUI = {
    async loginUser(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      const username = document.getElementById("accountLoginUsername")?.value;
      const password = document.getElementById("accountLoginPassword")?.value;
      await authenticate(username, password);
      window.Runtime?.navigate("account", { updateHash: false });
      return false;
    },
    async registerUser(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      const username = document.getElementById("accountRegisterUsername")?.value;
      const password = document.getElementById("accountRegisterPassword")?.value;
      const displayName = document.getElementById("accountRegisterName")?.value;
      const bio = document.getElementById("accountRegisterBio")?.value;
      await signup({ username, password, displayName, bio });
      window.Runtime?.navigate("account", { updateHash: false });
      return false;
    },
    async logoutUser() {
      await logout();
      window.Runtime?.navigate("account", { updateHash: false });
    },
    async updateProfileUser(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      const displayName = document.getElementById("accountProfileName")?.value;
      const bio = document.getElementById("accountProfileBio")?.value;
      const success = await updateProfile({ displayName, bio });
      if (success) {
        window.Runtime?.navigate("account", { updateHash: false });
      }
      return false;
    },
    getStatusMessage
  };

  return {
    init,
    signup,
    login: authenticate,
    logout,
    getCurrentUser,
    isAuthenticated,
    hasRole,
    can,
    updateProfile,
    getProfile,
    listUsers,
    getRoleCapabilities,
    getSessionState,
    isRouteAccessible,
    getRouteDeniedReason,
    getStatusMessage,
    UserCoreSystemUI
  };

})();

window.UserCoreSystem = UserCoreSystem;
window.UserCoreSystemUI = UserCoreSystem.UserCoreSystemUI;
