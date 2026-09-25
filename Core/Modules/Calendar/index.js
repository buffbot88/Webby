(() => {
  const state = {
    events: [],
    filters: {
      query: "",
      category: "All"
    },
    view: "calendar",
    monthOffset: 0,
    loaded: false,
    loading: false,
    message: "",
    messageTone: "info"
  };

  function escape(value) {
    return Diagnostics.escapeText(value == null ? "" : String(value));
  }

  function jsArg(value) {
    return escape(JSON.stringify(String(value == null ? "" : value)));
  }

  function can(capability) {
    return !!window.UserCoreSystem?.can?.(capability);
  }

  function setMessage(message, tone = "info") {
    state.message = message || "";
    state.messageTone = tone;
  }

  function renderStatusMessage() {
    if (!state.message) return "";
    return `<div class="calendar-alert" data-tone="${escape(state.messageTone)}">${escape(state.message)}</div>`;
  }

  function formatDate(value) {
    if (!value) return "Date pending";
    const date = new Date(`${value}T00:00:00`);
    return isNaN(date.getTime()) ? "Date pending" : date.toLocaleDateString();
  }

  function formatTime(value, allDay) {
    if (allDay) return "All day";
    if (!value) return "Time pending";
    const date = new Date(`2000-01-01T${value}`);
    return isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function getAuthorName(authorId) {
    if (!authorId) return "Unknown author";
    const profile = window.UserCoreSystem?.getProfile?.(authorId);
    return profile?.displayName || profile?.username || authorId;
  }

  function normalizeEvent(event) {
    const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
    return {
      ...event,
      status: ["draft", "published", "cancelled", "trash"].includes(event.status) ? event.status : "draft",
      metadata: {
        ...metadata,
        eventDate: typeof metadata.eventDate === "string" ? metadata.eventDate : "",
        eventTime: typeof metadata.eventTime === "string" ? metadata.eventTime : "",
        location: typeof metadata.location === "string" ? metadata.location : "",
        category: typeof metadata.category === "string" ? metadata.category : "General",
        featured: metadata.featured === true,
        allDay: metadata.allDay === true,
        imageUrl: typeof metadata.imageUrl === "string" ? metadata.imageUrl : "",
        imageMediaId: typeof metadata.imageMediaId === "string" ? metadata.imageMediaId : ""
      }
    };
  }

  function isUpcoming(event) {
    if (!event.metadata?.eventDate) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(`${event.metadata.eventDate}T00:00:00`);
    return isNaN(eventDate.getTime()) || eventDate >= today;
  }

  function visibleEvents() {
    const canManage = can("calendar.event.edit") || can("calendar.event.publish") || can("calendar.event.cancel") || can("calendar.event.moveTrash") || can("calendar.event.feature");
    const query = state.filters.query.trim().toLowerCase();
    return state.events
      .filter((event) => event.status !== "trash")
      .filter((event) => canManage || event.status === "published")
      .filter((event) => canManage || isUpcoming(event))
      .filter((event) => state.filters.category === "All" || event.metadata?.category === state.filters.category)
      .filter((event) => !query || [event.title, event.body, event.metadata?.category, event.metadata?.location].join(" ").toLowerCase().includes(query))
      .sort((a, b) => {
        const featuredDelta = Number(b.metadata?.featured === true) - Number(a.metadata?.featured === true);
        if (featuredDelta !== 0) return featuredDelta;
        const aDate = new Date(`${a.metadata?.eventDate || "9999-12-31"}T${a.metadata?.eventTime || "00:00"}`).getTime();
        const bDate = new Date(`${b.metadata?.eventDate || "9999-12-31"}T${b.metadata?.eventTime || "00:00"}`).getTime();
        return aDate - bDate;
      });
  }

  function renderBadges(event) {
    const badges = [];
    if (event.status === "draft") badges.push(`<span class="calendar-badge calendar-badge-draft">Draft</span>`);
    if (event.status === "published") badges.push(`<span class="calendar-badge calendar-badge-published">Published</span>`);
    if (event.status === "cancelled") badges.push(`<span class="calendar-badge calendar-badge-cancelled">Cancelled</span>`);
    if (event.metadata?.featured) badges.push(`<span class="calendar-badge calendar-badge-featured">Featured</span>`);
    if (event.metadata?.category) badges.push(`<span class="calendar-badge">${escape(event.metadata.category)}</span>`);
    return badges.join("");
  }

  function renderActionBar(event) {
    const actions = [];
    const nextStatus = event.status === "published" ? "draft" : "published";
    const nextCancelled = event.status === "cancelled" ? "published" : "cancelled";

    if (can("calendar.event.edit")) {
      actions.push(`<button type="button" onclick="window.CalendarModuleUI.editEvent(${jsArg(event.id)})">Edit</button>`);
      actions.push(`<button type="button" onclick="window.CalendarModuleUI.uploadEventImage(${jsArg(event.id)})">Image</button>`);
    }
    if (can("calendar.event.publish") && event.status !== "cancelled") {
      actions.push(`<button type="button" onclick="window.CalendarModuleUI.toggleEventStatus(${jsArg(event.id)}, ${jsArg(nextStatus)})">${event.status === "published" ? "Unpublish" : "Publish"}</button>`);
    }
    if (can("calendar.event.cancel")) {
      actions.push(`<button type="button" onclick="window.CalendarModuleUI.toggleEventStatus(${jsArg(event.id)}, ${jsArg(nextCancelled)})">${event.status === "cancelled" ? "Restore" : "Cancel"}</button>`);
    }
    if (can("calendar.event.feature")) {
      actions.push(`<button type="button" onclick="window.CalendarModuleUI.toggleFeatured(${jsArg(event.id)}, ${event.metadata?.featured ? "false" : "true"})">${event.metadata?.featured ? "Unfeature" : "Feature"}</button>`);
    }
    if (can("calendar.event.moveTrash")) {
      actions.push(`<button type="button" onclick="window.CalendarModuleUI.moveEventTrash(${jsArg(event.id)})">Move to Trash</button>`);
    }

    return actions.length ? `<div class="calendar-action-bar">${actions.join("")}</div>` : "";
  }

  function renderSocialBar(event) {
    if (event.status !== "published") return "";
    const reactions = window.ReactionCoreSystem?.renderReactionBar
      ? window.ReactionCoreSystem.renderReactionBar("calendarEvent", event.id)
      : "";
    const bookmark = window.BookmarkCoreSystem?.renderBookmarkButton
      ? window.BookmarkCoreSystem.renderBookmarkButton("calendarEvent", event.id, event.title || "Calendar event", "#calendar")
      : "";
    return reactions || bookmark ? `<div class="calendar-action-bar">${reactions}${bookmark}</div>` : "";
  }

  function renderEvent(event) {
    return `
      <article class="calendar-event-card event-calendar-card glass">
        ${event.metadata?.imageUrl ? `<img class="cover-image" src="${escape(event.metadata.imageUrl)}" alt="${escape(event.title || "Event image")}" loading="lazy" />` : ""}
        <header>
          <div class="calendar-event-topline">
            <div>
              <h2>${escape(event.title || "Untitled event")}</h2>
              <div class="calendar-event-meta">
                <span>${escape(formatDate(event.metadata?.eventDate))}</span>
                <span>${escape(formatTime(event.metadata?.eventTime, event.metadata?.allDay))}</span>
                <span>${escape(getAuthorName(event.authorId))}</span>
                ${event.metadata?.location ? `<span>${escape(event.metadata.location)}</span>` : ""}
              </div>
            </div>
            <div class="calendar-badge-row">${renderBadges(event)}</div>
          </div>
        </header>
        <div class="calendar-body">${escape(event.body || "No description.")}</div>
        <div class="calendar-event-ledger">
          <span>${escape(event.metadata?.category || "General")}</span>
          <span>${event.metadata?.featured ? "Featured" : "Standard"}</span>
          <span>${event.metadata?.allDay ? "All day" : "Timed event"}</span>
        </div>
        ${renderSocialBar(event)}
        ${renderActionBar(event)}
      </article>
    `;
  }

  function renderEventList() {
    if (state.loading && !state.loaded) {
      return `<div class="calendar-empty">Loading events...</div>`;
    }

    const events = visibleEvents();
    if (!events.length) {
      return `
        <div class="calendar-empty module-empty-state glass-subtle">
          <strong>No upcoming events.</strong>
          <p>Published events will appear here as they are scheduled.</p>
        </div>
      `;
    }

    return `<div class="calendar-event-list">${events.map(renderEvent).join("")}</div>`;
  }

  function monthLabel(date) {
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function renderMonthView() {
    const events = visibleEvents();
    const base = new Date();
    base.setMonth(base.getMonth() + state.monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstDay.getDay();
    const cells = [];

    for (let index = 0; index < leadingBlanks; index += 1) {
      cells.push(`<div class="calendar-month-cell calendar-month-empty" aria-hidden="true"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const isoDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayEvents = events.filter((event) => event.metadata?.eventDate === isoDay);
      cells.push(`
        <div class="calendar-month-cell">
          <div class="calendar-month-day">${escape(String(day))}</div>
          ${dayEvents.slice(0, 3).map((event) => `
            <button type="button" class="calendar-month-event" onclick="window.CalendarModuleUI.setView('agenda')">
              ${escape(event.title || "Untitled event")}
            </button>
          `).join("")}
          ${dayEvents.length > 3 ? `<div class="calendar-month-more">${escape(String(dayEvents.length - 3))} more</div>` : ""}
        </div>
      `);
    }

    return `
      <section class="calendar-month-panel glass">
        <header class="panel-header">
          <div>
            <h2>${escape(monthLabel(base))}</h2>
            <p class="muted">Published and manageable events grouped by date.</p>
          </div>
          <div class="calendar-month-actions">
            <button type="button" class="button-secondary" onclick="window.CalendarModuleUI.shiftMonth(-1)">Previous</button>
            <button type="button" class="button-secondary" onclick="window.CalendarModuleUI.shiftMonth(0)">Today</button>
            <button type="button" class="button-secondary" onclick="window.CalendarModuleUI.shiftMonth(1)">Next</button>
          </div>
        </header>
        <div class="calendar-month-weekdays">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${escape(day)}</span>`).join("")}
        </div>
        <div class="calendar-month-grid">${cells.join("")}</div>
      </section>
    `;
  }

  function setView(view) {
    if (!["calendar", "agenda", "create"].includes(view)) return;
    state.view = view;
    updateCalendarPage();
  }

  function shiftMonth(delta) {
    if (delta === 0) {
      state.monthOffset = 0;
    } else {
      state.monthOffset += Number(delta) || 0;
    }
    state.view = "calendar";
    updateCalendarPage();
  }

  function renderViewNav() {
    const items = [
      ["calendar", "Month"],
      ["agenda", "Agenda"],
      ["create", "Create"]
    ];

    return `
      <nav class="module-subnav" aria-label="Calendar views">
        ${items.map(([view, label]) => `
          <button type="button" class="${state.view === view ? "active" : ""}" onclick="window.CalendarModuleUI.setView('${escape(view)}')">
            ${escape(label)}
          </button>
        `).join("")}
      </nav>
    `;
  }

  function renderActiveView() {
    if (state.view === "create") {
      return `<div id="calendarEditorContainer">${renderEditor()}</div>`;
    }

    if (state.view === "agenda") {
      return `
        <div id="calendarEventContainer">
          ${renderFilters()}
          ${renderAgendaView()}
        </div>
      `;
    }

    return `
      <div id="calendarEventContainer">
        ${renderFilters()}
        ${renderMonthView()}
      </div>
    `;
  }

  function renderAgendaView() {
    if (state.loading && !state.loaded) {
      return `<div class="calendar-empty">Loading events...</div>`;
    }

    const events = visibleEvents();
    if (!events.length) {
      return `
        <div class="calendar-empty module-empty-state glass-subtle">
          <strong>No upcoming events.</strong>
          <p>Published events will appear here as a chronological agenda.</p>
        </div>
      `;
    }

    const groups = events.reduce((acc, event) => {
      const key = event.metadata?.eventDate || "Date pending";
      acc[key] = acc[key] || [];
      acc[key].push(event);
      return acc;
    }, {});

    return `
      <div class="calendar-agenda-list">
        ${Object.entries(groups).map(([date, items]) => `
          <section class="calendar-agenda-day">
            <div class="calendar-agenda-date">
              <strong>${escape(formatDate(date === "Date pending" ? "" : date))}</strong>
              <span>${escape(String(items.length))} event${items.length === 1 ? "" : "s"}</span>
            </div>
            <div class="calendar-event-list">${items.map(renderEvent).join("")}</div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function renderFilters() {
    const categories = Array.from(new Set(state.events.map((event) => event.metadata?.category || "General"))).sort();
    return `
      <div class="search-tools">
        <input id="calendarSearchQuery" type="search" placeholder="Search events" value="${escape(state.filters.query)}" oninput="window.CalendarModuleUI.updateFilters()" />
        <select id="calendarCategoryFilter" onchange="window.CalendarModuleUI.updateFilters()">
          <option value="All">All categories</option>
          ${categories.map((category) => `<option value="${escape(category)}" ${state.filters.category === category ? "selected" : ""}>${escape(category)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function renderEditor() {
    if (!can("calendar.event.create")) {
      return `<div class="calendar-empty">Sign in with event permissions to create calendar events.</div>`;
    }

    return `
      <article class="calendar-editor glass">
        <h2>Create Event</h2>
        <form id="calendarEventForm" onsubmit="window.CalendarModuleUI.createEvent(event)">
          <div class="form-row">
            <label for="calendarEventTitle">Title</label>
            <input id="calendarEventTitle" type="text" placeholder="Event title" required />
          </div>
          <div class="form-row">
            <label for="calendarEventDate">Date</label>
            <input id="calendarEventDate" type="date" required />
          </div>
          <div class="form-row">
            <label for="calendarEventTime">Time</label>
            <input id="calendarEventTime" type="time" />
          </div>
          <div class="form-row">
            <label for="calendarEventLocation">Location</label>
            <input id="calendarEventLocation" type="text" placeholder="Venue or online" />
          </div>
          <div class="form-row">
            <label for="calendarEventCategory">Category</label>
            <input id="calendarEventCategory" type="text" placeholder="General" />
          </div>
          <div class="form-row">
            <label for="calendarEventBody">Description</label>
            <textarea id="calendarEventBody" rows="5" placeholder="Event description"></textarea>
          </div>
          <div class="form-row media-upload">
            <label for="calendarEventImage">Event image</label>
            <input id="calendarEventImage" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </div>
          <div class="form-row">
            <label for="calendarEventStatus">Status</label>
            <select id="calendarEventStatus">
              <option value="draft">Draft</option>
              ${can("calendar.event.publish") ? `<option value="published">Published</option>` : ""}
            </select>
          </div>
          <label class="form-row">
            <span>All day</span>
            <input id="calendarEventAllDay" type="checkbox" />
          </label>
          <button class="primary" type="submit">Save Event</button>
        </form>
      </article>
    `;
  }

  async function refreshEvents() {
    const contentSystem = window.ContentCoreSystem;
    const userSystem = window.UserCoreSystem;

    if (!contentSystem || !userSystem) {
      state.loaded = true;
      state.loading = false;
      setMessage("Calendar system is unavailable.", "error");
      updateCalendarPage();
      return;
    }

    state.loading = true;

    try {
      const events = await contentSystem.listContent("calendarEvent", {});
      state.events = Array.isArray(events) ? events.map(normalizeEvent) : [];
      state.loaded = true;
      state.loading = false;
    } catch (error) {
      state.loaded = true;
      state.loading = false;
      setMessage("Unable to load calendar events.", "error");
    }

    updateCalendarPage();
  }

  function updateCalendarPage() {
    const navContainer = document.getElementById("calendarViewNav");
    if (navContainer) navContainer.innerHTML = renderViewNav();

    const contentContainer = document.getElementById("calendarContentContainer");
    if (contentContainer) contentContainer.innerHTML = renderActiveView();

    const statusEl = document.getElementById("calendarStatusMessage");
    if (statusEl) statusEl.innerHTML = renderStatusMessage();

    window.ReactionCoreSystem?.hydrateReactionBars?.();
    window.BookmarkCoreSystem?.hydrateBookmarkButtons?.();
  }

  async function reloadWithMessage(message, tone = "info") {
    setMessage(message, tone);
    await refreshEvents();
    setMessage(message, tone);
    updateCalendarPage();

    if (window.HomeModuleUI?.refresh) {
      window.HomeModuleUI.refresh();
    }
  }

  function findEvent(id) {
    return state.events.find((event) => String(event.id) === String(id)) || null;
  }

  window.CalendarModuleUI = {
    refresh: refreshEvents,
    setView,
    shiftMonth,

    async createEvent(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();

      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      if (!contentSystem || !userSystem?.can("calendar.event.create")) {
        setMessage("You do not have permission to create calendar events.", "error");
        updateCalendarPage();
        return false;
      }

      const title = document.getElementById("calendarEventTitle")?.value?.trim() || "";
      const body = document.getElementById("calendarEventBody")?.value?.trim() || "";
      const eventDate = document.getElementById("calendarEventDate")?.value || "";
      const eventTime = document.getElementById("calendarEventTime")?.value || "";
      const location = document.getElementById("calendarEventLocation")?.value?.trim() || "";
      const category = document.getElementById("calendarEventCategory")?.value?.trim() || "General";
      const allDay = document.getElementById("calendarEventAllDay")?.checked === true;
      const requestedStatus = document.getElementById("calendarEventStatus")?.value || "draft";
      const status = requestedStatus === "published" && can("calendar.event.publish") ? "published" : "draft";

      if (!title || !eventDate) {
        setMessage("Event title and date are required.", "error");
        updateCalendarPage();
        return false;
      }

      const currentUser = userSystem.getCurrentUser?.();

      try {
        let saved = await contentSystem.createContent("calendarEvent", {
          title,
          body,
          status,
          authorId: currentUser?.id || currentUser?.username || "",
          metadata: {
            eventDate,
            eventTime,
            location,
            category,
            featured: false,
            allDay
          }
        });
        const imageInput = document.getElementById("calendarEventImage");
        if (imageInput?.files?.[0] && window.MediaCoreSystem?.uploadFromInput) {
          const media = await window.MediaCoreSystem.uploadFromInput(imageInput, {
            targetType: "calendarEvent",
            targetId: saved.id,
            metadata: { purpose: "event-image" }
          });
          saved = await contentSystem.updateContent("calendarEvent", saved.id, {
            metadata: {
              ...(saved.metadata || {}),
              imageMediaId: media.id,
              imageUrl: media.url
            }
          });
        }
        if (status === "published") {
          window.ActivityFeedCoreSystem?.recordCalendarEventPublished?.(saved).catch((error) => {
            Diagnostics?.warn?.("[CalendarModule] failed to record event activity", error);
          });
        }
        window.CategoryCoreSystem?.ensureCategory?.(category, "calendarEvent").catch(() => null);
        document.getElementById("calendarEventForm")?.reset();
        state.view = "calendar";
        await reloadWithMessage(status === "published" ? "Event published." : "Event draft saved.");
      } catch (error) {
        setMessage("Unable to save the calendar event.", "error");
        updateCalendarPage();
      }

      return false;
    },

    async editEvent(id) {
      const contentSystem = window.ContentCoreSystem;
      const item = findEvent(id);

      if (!contentSystem || !can("calendar.event.edit")) {
        setMessage("You do not have permission to edit this event.", "error");
        updateCalendarPage();
        return;
      }

      if (!item || item.status === "trash") {
        setMessage("Calendar event not found.", "error");
        updateCalendarPage();
        return;
      }

      const title = window.prompt("Update event title:", item.title) ?? item.title;
      const body = window.prompt("Update event description:", item.body || "") ?? (item.body || "");
      const eventDate = window.prompt("Update event date (YYYY-MM-DD):", item.metadata?.eventDate || "") ?? (item.metadata?.eventDate || "");
      const eventTime = window.prompt("Update event time (HH:MM):", item.metadata?.eventTime || "") ?? (item.metadata?.eventTime || "");
      const location = window.prompt("Update location:", item.metadata?.location || "") ?? (item.metadata?.location || "");
      const category = window.prompt("Update category:", item.metadata?.category || "General") ?? (item.metadata?.category || "General");

      if (!String(title).trim() || !String(eventDate).trim()) {
        setMessage("Event title and date are required.", "error");
        updateCalendarPage();
        return;
      }

      try {
        await contentSystem.updateContent("calendarEvent", id, {
          title: String(title).trim(),
          body: String(body).trim(),
          metadata: {
            ...(item.metadata || {}),
            eventDate: String(eventDate).trim(),
            eventTime: String(eventTime).trim(),
            location: String(location).trim(),
            category: String(category).trim() || "General"
          }
        });
        await reloadWithMessage("Event updated.");
      } catch (error) {
        setMessage("Unable to update event.", "error");
        updateCalendarPage();
      }
    },

    async toggleEventStatus(id, status) {
      const contentSystem = window.ContentCoreSystem;
      const item = findEvent(id);

      if (!contentSystem) {
        setMessage("Calendar system is unavailable.", "error");
        updateCalendarPage();
        return;
      }

      if (status === "cancelled" && !can("calendar.event.cancel")) {
        setMessage("You do not have permission to cancel events.", "error");
        updateCalendarPage();
        return;
      }

      if (["draft", "published"].includes(status) && !can("calendar.event.publish")) {
        setMessage("You do not have permission to publish events.", "error");
        updateCalendarPage();
        return;
      }

      if (!item || item.status === "trash" || !["draft", "published", "cancelled"].includes(status)) {
        setMessage("Calendar event not found or status is invalid.", "error");
        updateCalendarPage();
        return;
      }

      try {
        const saved = await contentSystem.updateContent("calendarEvent", id, { status });
        if (status === "published" && item.status !== "published") {
          window.ActivityFeedCoreSystem?.recordCalendarEventPublished?.(saved).catch((error) => {
            Diagnostics?.warn?.("[CalendarModule] failed to record event activity", error);
          });
        }
        const label = status === "cancelled" ? "cancelled" : status === "published" ? "published" : "unpublished";
        await reloadWithMessage(`Event ${label}.`);
      } catch (error) {
        setMessage("Unable to update event status.", "error");
        updateCalendarPage();
      }
    },

    async toggleFeatured(id, featured) {
      const contentSystem = window.ContentCoreSystem;
      const item = findEvent(id);

      if (!contentSystem || !can("calendar.event.feature")) {
        setMessage("You do not have permission to feature events.", "error");
        updateCalendarPage();
        return;
      }

      if (!item || item.status === "trash") {
        setMessage("Calendar event not found.", "error");
        updateCalendarPage();
        return;
      }

      try {
        await contentSystem.updateContent("calendarEvent", id, {
          metadata: {
            ...(item.metadata || {}),
            featured: featured === true
          }
        });
        await reloadWithMessage(featured ? "Event featured." : "Event unfeatured.");
      } catch (error) {
        setMessage("Unable to update featured state.", "error");
        updateCalendarPage();
      }
    },

    async moveEventTrash(id) {
      const contentSystem = window.ContentCoreSystem;

      if (!contentSystem || !can("calendar.event.moveTrash")) {
        setMessage("You do not have permission to move events to trash.", "error");
        updateCalendarPage();
        return;
      }

      if (!findEvent(id)) {
        setMessage("Calendar event not found.", "error");
        updateCalendarPage();
        return;
      }

      if (!window.confirm("Move this calendar event to trash?")) {
        return;
      }

      try {
        await contentSystem.updateContent("calendarEvent", id, { status: "trash" });
        await reloadWithMessage("Event moved to trash.");
      } catch (error) {
        setMessage("Unable to move event to trash.", "error");
        updateCalendarPage();
      }
    },

    async uploadEventImage(id) {
      const contentSystem = window.ContentCoreSystem;
      const item = findEvent(id);
      if (!contentSystem || !item || !can("calendar.event.edit")) {
        setMessage("You do not have permission to update this event image.", "error");
        updateCalendarPage();
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.onchange = async () => {
        try {
          const media = await window.MediaCoreSystem.uploadFromInput(input, {
            targetType: "calendarEvent",
            targetId: id,
            metadata: { purpose: "event-image" }
          });
          await contentSystem.updateContent("calendarEvent", id, {
            metadata: {
              ...(item.metadata || {}),
              imageMediaId: media.id,
              imageUrl: media.url
            }
          });
          await reloadWithMessage("Event image updated.");
        } catch (error) {
          setMessage(error?.message || "Unable to upload event image.", "error");
          updateCalendarPage();
        }
      };
      input.click();
    },

    updateFilters() {
      state.filters.query = document.getElementById("calendarSearchQuery")?.value || "";
      state.filters.category = document.getElementById("calendarCategoryFilter")?.value || "All";
      updateCalendarPage();
    }
  };

  ModuleSDK.registerPage("calendar", {
    title: "Calendar",
    render: () => {
      const userSystem = window.UserCoreSystem;
      const contentSystem = window.ContentCoreSystem;
      state.view = "calendar";

      if (!contentSystem || !userSystem) {
        return `
          <section class="page-shell calendar-shell">
            <header class="page-header calendar-header"><div><span class="section-eyebrow">EVENTS</span><h1 class="page-title">Calendar</h1><p class="page-subtitle">Gatherings, dates, and community moments.</p></div></header>
            <div class="calendar-alert" data-tone="error">Calendar system is unavailable.</div>
          </section>
        `;
      }

      if (!state.loaded && !state.loading) {
        refreshEvents().catch(() => {
          state.loaded = true;
          state.loading = false;
          setMessage("Unable to load calendar content.", "error");
          updateCalendarPage();
        });
      }

      return `
        <section class="page-shell calendar-shell">
          <header class="page-header calendar-header">
            <div>
              <span class="section-eyebrow">EVENTS</span>
              <h1 class="page-title">Calendar</h1>
              <p class="page-subtitle">A real event calendar for published dates, featured events, locations, images, and community planning.</p>
            </div>
            <button class="button-secondary" type="button" onclick="window.CalendarModuleUI.refresh()">Refresh</button>
          </header>

          <div id="calendarStatusMessage">${renderStatusMessage()}</div>
          <div id="calendarViewNav">${renderViewNav()}</div>
          <div id="calendarContentContainer">${renderActiveView()}</div>
        </section>
      `;
    }
  });
})();
