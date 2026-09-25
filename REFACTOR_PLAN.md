# WebbyOS v0.49 Refactor Preparation Plan

Status: COMPLETE

This document records the v0.49 preparation work for the v0.50 structure migration. During v0.49 it was intentionally audit and design only: no files were moved, no modules were split, and no compatibility contracts were changed.

## Guardrails

- Do not create `/Core` during v0.49.
- Do not move files during v0.49.
- Do not split public modules during v0.49.
- Do not refactor `PlatformCore` or change the runtime directory structure during v0.49.
- Do not change record types.
- Preserve `window.Runtime`, `window.AdminSystemCore`, `window.ContentCoreSystem`, `window.UserCoreSystem`, `window.DataCoreSystem`, and `window.PackageCoreSystem`.
- Preserve `blogPost`, `forumThread`, `forumPost`, and `calendarEvent`.
- Keep the PHP persistence bridge reachable only through `DataCoreSystem`.
- Do not introduce browser storage APIs or external product references.

## v0.49 Baseline Load Order

During v0.49, `index.html` loaded platform scripts in this order:

1. `assets/diagnostics.js`
2. `assets/lifecycle.js`
3. `assets/registryEngine.js`
4. `assets/configLoader.js`
5. `assets/featureEngine.js`
6. `assets/pluginEngine.js`
7. `assets/layoutEngine.js`
8. `assets/moduleLoader.js`
9. `assets/dataCoreSystem.js`
10. `assets/packageCoreSystem.js`
11. `assets/userCoreSystem.js`
12. `assets/contentCoreSystem.js`
13. Community support systems: notification, reaction, bookmark, activity, messaging, moderation, reputation, media, category, tag, revision, search, and widgets
14. Builder systems: navigation and homepage
15. `assets/adminSystemCore.js`
16. `assets/RuntimeInspector.js`
17. `assets/runtime.js`
18. `assets/moduleSdk.js`
19. Public modules: Home, Blog, Forums, Calendar, Account

This order matters because most systems publish globals and later scripts read those globals directly.

## Post-v0.50 Core Load Order

After v0.50, `index.html` loads the migrated Core implementations for the systems that moved:

1. `Core/Diagnostics/index.js`
2. `Core/DataCore/index.js`
3. `Core/Packages/index.js`
4. `Core/Users/index.js`
5. `Core/Content/index.js`
6. `Core/Builders/widgets.js`
7. `Core/Builders/navigation.js`
8. `Core/Builders/homepage.js`
9. `Core/AdminCore/index.js`
10. `Core/Diagnostics/inspector.js`
11. `Core/Runtime/index.js`
12. `Core/Modules/Home/index.js`
13. `Core/Modules/Blog/index.js`
14. `Core/Modules/Forums/index.js`
15. `Core/Modules/Calendar/index.js`
16. `Core/Modules/Account/index.js`

All migrated systems now load from `Core/`. The temporary compatibility shims under `assets/` and `modules/pages/` were retired in v0.50.11, so each `Core/` file is the single source for its global. `assets/` retains only live runtime support systems (builders, engines, layout, module SDK).

## Dependency Map

### Runtime

Current file: `Core/Runtime/index.js`

Primary dependencies:
- `Diagnostics` for safe logging, escaping, error reporting, and operation retention.
- `Lifecycle`, `RegistryEngine`, `ConfigLoader`, `PluginEngine`, `LayoutEngine`, and `ModuleLoader` during boot.
- `DataCoreSystem`, `PackageCoreSystem`, `UserCoreSystem`, `ContentCoreSystem`, and support systems for shared runtime state.
- `AdminSystemCore` and `RuntimeInspector` for admin entry points and diagnostics views.
- Public modules through registry/module loader route resolution.

Coupling notes:
- Runtime owns boot, navigation, shared state updates, route recovery, and public/admin entry points in one file.
- It assumes all core globals are available before boot completes.
- Public modules call `Runtime.navigate`, `Runtime.refreshHome`, and `Runtime.updateRuntimeState` style APIs.

### AdminSystemCore

Current file: `Core/AdminCore/index.js`

Primary dependencies:
- `Runtime` shared state and navigation hooks.
- `DataCoreSystem` for settings, content, users, packages, and builder data.
- `PackageCoreSystem` for extension/package inventory and diagnostics.
- `RegistryEngine`, `ConfigLoader`, builder systems, media/category/tag systems, and `RuntimeInspector`.
- `UserCoreSystem` for role and capability checks.
- `Diagnostics` for escaping, logging, and health visibility.

Coupling notes:
- Admin navigation, state, permissions, renderers, forms, inline actions, and diagnostics live in one oversized file.
- Many admin actions use global inline handlers, so any migration must preserve the `window.AdminSystemCore` action surface until handlers are replaced or shimmed.
- Admin renderers duplicate card, badge, empty state, escape, and JS argument helpers used elsewhere.

### DataCoreSystem

Current file: `Core/DataCore/index.js`

Primary dependencies:
- `Diagnostics` for operation visibility and error capture.
- PHP persistence bridge for read/write/list/remove operations.
- `Runtime.updateRuntimeState` for recent operation health.

Coupling notes:
- This is the only system that should know the persistence bridge path.
- Other systems should continue to consume DataCore through global methods only.
- v0.50 must preserve encrypted store compatibility and method signatures before changing file paths.

### PackageCoreSystem

Current file: `Core/Packages/index.js`

Primary dependencies:
- `DataCoreSystem` for package persistence.
- `Diagnostics` for package health reporting.
- `Runtime.updateRuntimeState` for lifecycle status.
- Built-in package manifest paths and registry integration.

Coupling notes:
- Package diagnostics and Admin Extensions depend on PackageCore shape.
- Built-in package registration should be migrated before any optional package loading changes.
- Package records must remain compatible with existing encrypted stores.

### Public Modules

Current files: `Core/Modules/Home/index.js`, `Blog/index.js`, `Forums/index.js`, `Calendar/index.js`, `Account/index.js` (the former `modules/pages/*.js` paths were retired in v0.50.11).

Shared dependencies:
- `ModuleSDK` for registration.
- `Runtime` for route, refresh, shared state, and navigation behavior.
- `Diagnostics` for escaping.
- `ContentCoreSystem` for content records.
- `UserCoreSystem` for current user and capability checks.
- Optional support systems for reactions, bookmarks, activity, moderation, reputation, media, categories, tags, notifications, and messaging.

Module-specific notes:
- Home aggregates content, activity, widgets, search, navigation, and quick links.
- Blog owns editorial listings, article detail/write flows, category/tag metadata, cover image handling, and article actions.
- Forums owns thread lists, thread detail, replies, moderation affordances, badges, and reply/activity metadata.
- Calendar owns month, agenda, create, event detail, and event metadata views.
- Account owns profile, activity, inbox, standing, bookmarks, notifications, and reputation summaries.

### Builder Systems

Current files: `Core/Builders/navigation.js`, `Core/Builders/homepage.js`, `Core/Builders/widgets.js`

Primary dependencies:
- `DataCoreSystem` for configuration persistence.
- `Runtime.updateRuntimeState` for builder/system health.
- `UserCoreSystem.can` for write permissions.
- `ContentCoreSystem`, `ActivityFeedCoreSystem`, and `SearchCoreSystem` for widget data.
- `RegistryEngine` and Runtime navigation state for route-aware previews.

Coupling notes:
- Builder systems bridge public UX and Admin CP.
- Their persisted schemas should be frozen before v0.50 file moves.
- Admin builder screens assume current global names and method signatures.

### Diagnostics And Runtime Inspector

Current files: `Core/Diagnostics/index.js`, `Core/Diagnostics/inspector.js`

Primary dependencies:
- `Diagnostics` must load first.
- `RuntimeInspector` depends on `Runtime`, `RegistryEngine`, `AdminSystemCore`, package diagnostics, and shared runtime state.

Coupling notes:
- Diagnostics is a dependency of nearly every file.
- RuntimeInspector should migrate late enough that Runtime and Admin compatibility shims are already proven.

## Global Usage And Coupling

Global reads/writes are the main compatibility contract. v0.50 must keep the existing global API stable while internals move.

Required preserved globals:
- `window.Runtime`
- `window.AdminSystemCore`
- `window.ContentCoreSystem`
- `window.UserCoreSystem`
- `window.DataCoreSystem`
- `window.PackageCoreSystem`

Other actively used globals include diagnostics, registry, config, plugin, layout, module loading, support community systems, builder systems, and public page modules. These can be migrated later, but their old names should remain valid during v0.50.

## File Size And Complexity Audit

Current high-risk files by size:

- `Core/AdminCore/index.js`: admin navigation, state, renderers, actions, diagnostics, inline handlers, permissions, package/admin tools, and builders share one file.
- `assets/theme.css`: public, admin, module, card, badge, responsive, and utility styles share one stylesheet.
- `Core/Modules/Forums/index.js`: state, rendering, actions, thread detail, moderation, replies, and helper logic are combined.
- `Core/Modules/Calendar/index.js`: month, agenda, create, event rendering, and date helpers are combined.
- `Core/Runtime/index.js`: boot, navigation, state, recovery, rendering, and admin integration are combined.
- `Core/Modules/Blog/index.js`: editorial listing, article detail, write flow, media handling, and metadata helpers are combined.
- `Core/Packages/index.js`: manifest loading, package registry, diagnostics, and persistence are combined.
- `Core/Modules/Account/index.js`: profile, activity, inbox, standing, and account actions are combined.

Repeated logic candidates:
- `escape(value)` wrappers around `Diagnostics.escapeText`.
- `jsArg(value)` for safe inline handler arguments.
- `can(capability)` permission helpers.
- `formatDate`, `formatTime`, and event/article/thread metadata formatters.
- View/subview state setters and `renderActiveView` flows.
- Status message and empty state renderers.
- Card, badge, CTA, section header, and subnav markup patterns.
- Media/avatar/cover placeholder handling.

## Planned `/Core` Structure

This is the target design for v0.50 execution, not a v0.49 change.

```text
Core/
  Runtime/
    index.js
    boot.js
    navigation.js
    routes.js
    sharedState.js
    recovery.js
  AdminCore/
    index.js
    state.js
    navigation.js
    render.js
    actions.js
    diagnostics.js
  DataCore/
    index.js
    bridge.js
    health.js
    validation.js
  Packages/
    index.js
    registry.js
    manifests.js
    diagnostics.js
  Users/
    index.js
    permissions.js
    session.js
  Content/
    index.js
    records.js
    metadata.js
  Builders/
    navigation.js
    homepage.js
    widgets.js
  Diagnostics/
    index.js
    inspector.js
```

## Compatibility Shim Strategy

Each moved system should keep a temporary legacy file at the original path or an equivalent script bridge until the migration is validated.

Shim requirements:
- Assign the same `window.*` object as the legacy file.
- Preserve method names, argument shapes, return shapes, and async behavior.
- Preserve inline handler compatibility until admin and public renderers are converted.
- Preserve registry route IDs and public module names.
- Preserve record type strings exactly.
- Keep `index.html` script order equivalent unless a subsystem-specific validation proves a safe adjustment.

## Executed v0.50 Migration Order

1. Create `/Core` folders and add shims without changing behavior (the shims were later retired in v0.50.11).
2. Migrate Diagnostics first because every other system depends on it.
3. Migrate DataCore with a bridge shim and verify encrypted store read/write (shim retired in v0.50.11).
4. Migrate PackageCore and verify built-in packages plus Admin Extensions.
5. Migrate Runtime internals behind `window.Runtime`.
6. Migrate UserCore and ContentCore while preserving record/capability behavior.
7. Migrate builder systems after Runtime, DataCore, and ContentCore are stable.
8. Migrate RuntimeInspector after Runtime/Admin diagnostics are stable.
9. Migrate AdminSystemCore to `Core/AdminCore/index.js` after all admin categories pass.
10. Migrate public modules last, one module at a time.

## v0.50 Execution Result

Completed: May 21, 2026

Result: PASS. v0.50 executed the compatibility-first Core migration without record type changes, database migrations, or public API breaks.

Completed moves:
- Diagnostics moved to `Core/Diagnostics/index.js`.
- DataCore moved to `Core/DataCore/index.js`.
- PackageCore moved to `Core/Packages/index.js`.
- Runtime moved to `Core/Runtime/index.js`.
- UserCore moved to `Core/Users/index.js`.
- ContentCore moved to `Core/Content/index.js`.
- Builder systems moved to `Core/Builders/`.
- RuntimeInspector moved to `Core/Diagnostics/inspector.js`.
- AdminSystemCore moved to `Core/AdminCore/index.js`.
- Home, Blog, Forums, Calendar, and Account moved to `Core/Modules/`.

Legacy compatibility files remain at their previous paths. Deeper file splitting into `boot.js`, `state.js`, `render.js`, `actions.js`, and similar module files was deferred so v0.50 could preserve behavior while changing primary load paths.

## Public Module Split Plan

Future target pattern for each module:

- `state.js`: module-local active view, selected item IDs, form message state, normalized cached records, and default view selection.
- `render.js`: page shell, headers, subnav, cards, empty states, details, lists, grids, and mobile-safe layouts.
- `actions.js`: create/update/delete/reply/moderate/bookmark/react/navigation handlers and form submit behavior.
- `index.js`: module registration, dependency binding, public API exposure, and compatibility surface.

Module-specific split notes:
- Home: portal aggregation state, widget renderers, quick links, activity/content/event adapters.
- Blog: article listing/detail/write state, editorial renderers, metadata helpers, publish actions.
- Forums: thread list/detail state, reply actions, moderation actions, badge/reply/activity renderers.
- Calendar: month/agenda/create state, event date utilities, event CRUD actions.
- Account: profile/activity/inbox/standing state, notification/message adapters, account renderers.

Shared utility candidates after splits:
- HTML escaping and safe inline argument helpers.
- Date/time metadata formatting.
- Capability checks.
- Empty state, badge, section title, subnav, CTA button, card, and media placeholder renderers.
- Route/subview defaulting helpers.

## Rollback Safety Strategy

- Migrate one subsystem at a time.
- Keep the old path working until its replacement passes validation.
- Avoid database migrations in v0.50.
- Avoid record type changes in v0.50.
- Keep a script-path rollback available for each migrated subsystem.
- Validate public, admin, package, and persistence behavior after each subsystem.
- If a subsystem fails validation, restore the previous script path and legacy implementation before continuing.

## v0.49 Completion Criteria

v0.49 is complete when:

- Dependency mapping is documented.
- Oversized files and duplicated logic are documented.
- Future `/Core` structure is planned.
- Public module split strategy is planned.
- Compatibility and rollback plans are documented.
- Validation confirms the current app still loads and no architecture change occurred.
- v0.50 has a safe, incremental execution plan.

## v0.49 Validation Audit

Completed: May 21, 2026

Audit result: PASS. v0.49 is closed as an audit and preparation stage only. No `/Core` directory was created, no files were moved, no public modules were split, and no compatibility contract was intentionally changed.

Validation evidence:
- JavaScript parse audit passed for 37 source files.
- Public site served 200 through the bundled PHP server.
- Home, Blog, Forums, Calendar, and Account loaded successfully.
- Public subviews passed for Blog Articles/Write, Forums Threads/Start Thread, Calendar Month/Agenda/Create, and Account Profile/Activity/Inbox/Standing.
- Admin CP opened in an admin session.
- Admin categories rendered for Overview, Site, Community, Content, Users & Roles, Permissions, Appearance, Builders, Extensions, Maintenance, and System.
- Representative Admin content rendered for Site Navigation, Community Forums, Content Blog/Calendar/Categories, Builders Homepage/Widgets, Extensions Packages, and System Runtime/Registry/Diagnostics.
- Site and Appearance default category views cover the General and Theme landing content in the current Admin CP.
- RuntimeInspector opened from Admin System.
- Package diagnostics rendered from Admin Extensions.
- DataCore read packages, settings, users, and module data through the PHP persistence bridge.
- DataCore temporary write/update/get/remove round-trip passed.
- Browser console audit completed without warnings or errors.
- Static scans found no direct `api/data.php` usage outside `DataCoreSystem`.
- Static scans found no runtime browser storage APIs, `eval`, `new Function`, or dynamic remote imports in source.
- Static source scan found no external product references.
