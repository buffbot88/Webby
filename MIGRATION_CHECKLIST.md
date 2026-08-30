# WebbyOS v0.50 Migration Checklist

This checklist was prepared during v0.49 and completed during v0.50. It now remains as the historical validation and rollback reference for the Core migration.

## Preflight

- [x] Confirm v0.49 is marked COMPLETE.
- [x] Confirm `/Core` does not already exist from an unreviewed migration.
- [x] Confirm public site serves 200.
- [x] Confirm Home, Blog, Forums, Calendar, and Account load.
- [x] Confirm Admin CP opens.
- [x] Confirm RuntimeInspector opens.
- [x] Confirm Admin Extensions and package diagnostics render.
- [x] Confirm DataCore reads packages, settings, users, and content.
- [x] Confirm a temporary DataCore write/update/get/remove round-trip works.
- [x] Confirm encrypted stores remain readable.
- [x] Confirm browser console has no errors before migration.
- [x] Confirm no browser storage APIs were introduced.
- [x] Confirm no external product references are present.
- [x] Confirm the persistence bridge is only used through `DataCoreSystem`.

## Compatibility Requirements

- [x] Preserve `window.Runtime`.
- [x] Preserve `window.AdminSystemCore`.
- [x] Preserve `window.ContentCoreSystem`.
- [x] Preserve `window.UserCoreSystem`.
- [x] Preserve `window.DataCoreSystem`.
- [x] Preserve `window.PackageCoreSystem`.
- [x] Preserve `blogPost`.
- [x] Preserve `forumThread`.
- [x] Preserve `forumPost`.
- [x] Preserve `calendarEvent`.
- [x] Preserve current route IDs.
- [x] Preserve public module default views.
- [x] Preserve Admin CP category and sublink keys.
- [x] Preserve package manifest compatibility.
- [x] Preserve encrypted store formats.

## Per-Subsystem Migration Steps

Use these steps for each subsystem in the planned order.

- [x] Create the new target folder and files.
- [x] Copy or extract behavior without changing public method signatures.
- [x] Add or keep a legacy shim at the old script path.
- [x] Assign the same legacy global.
- [x] Keep the old script order behavior equivalent.
- [x] Run syntax checks.
- [x] Load public site.
- [x] Open Admin CP if the subsystem is admin/runtime/data/package related.
- [x] Check browser console.
- [x] Run the targeted validation list for that subsystem.
- [x] Record the rollback point before moving to the next subsystem.

## Planned Migration Order

- [x] Diagnostics
- [x] DataCore
- [x] PackageCore
- [x] Runtime
- [x] UserCore
- [x] ContentCore
- [x] Builder systems
- [x] RuntimeInspector
- [x] AdminSystemCore
- [x] Home module
- [x] Blog module
- [x] Forums module
- [x] Calendar module
- [x] Account module

## Migration Notes

### Diagnostics

- [x] Created `Core/Diagnostics/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/diagnostics.js` as a compatibility shim for legacy consumers.
- [x] Verified the shim creates the Diagnostics API when loaded alone.
- [x] Verified the shim preserves an existing `window.Diagnostics` when Core loads first.
- [x] Verified public routes, Admin CP, RuntimeInspector, and browser console after migration.

### DataCore

- [x] Created `Core/DataCore/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/dataCoreSystem.js` as a compatibility shim for legacy consumers.
- [x] Verified the shim creates the DataCore API when loaded alone.
- [x] Verified the shim preserves an existing `window.DataCoreSystem` when Core loads first.
- [x] Verified packages, settings, users, and module data reads through the PHP bridge.
- [x] Verified a temporary write/update/get/remove round-trip through the PHP bridge.
- [x] Verified public routes, Admin CP, and browser console after migration.

### PackageCore

- [x] Created `Core/Packages/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/packageCoreSystem.js` as a compatibility shim for legacy consumers.
- [x] Verified the shim creates the PackageCore API when loaded alone.
- [x] Verified the shim preserves an existing `window.PackageCoreSystem` when Core loads first.
- [x] Verified public routes after migration.
- [x] Verified Admin Extensions package inventory.
- [x] Verified Package Diagnostics.
- [x] Verified browser console after migration.

### Runtime

- [x] Created `Core/Runtime/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/runtime.js` as a compatibility shim for legacy consumers.
- [x] Verified the shim creates the Runtime API when loaded alone.
- [x] Verified the shim preserves an existing `window.Runtime` when Core loads first.
- [x] Verified public navigation and public module subviews.
- [x] Verified DataCore reads after migration.
- [x] Verified Admin CP and RuntimeInspector.
- [x] Verified fresh browser console after migration.

### UserCore

- [x] Created `Core/Users/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/userCoreSystem.js` as a compatibility shim for legacy consumers.
- [x] Verified the shim creates the UserCore API when loaded alone.
- [x] Verified the shim preserves an existing `window.UserCoreSystem` when Core loads first.
- [x] Verified account/profile rendering and admin session visibility.
- [x] Verified Admin CP opens.
- [x] Verified user store reads.
- [x] Verified browser console after migration.

### ContentCore

- [x] Created `Core/Content/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/contentCoreSystem.js` as a compatibility shim for legacy consumers.
- [x] Verified the shim creates the ContentCore API when loaded alone.
- [x] Verified the shim preserves an existing `window.ContentCoreSystem` when Core loads first.
- [x] Verified public content-backed routes.
- [x] Verified temporary `blogPost` write/update/get/remove behavior.
- [x] Verified Admin Content rendering.
- [x] Verified browser console after migration.

### Builder Systems

- [x] Created `Core/Builders/widgets.js`.
- [x] Created `Core/Builders/navigation.js`.
- [x] Created `Core/Builders/homepage.js`.
- [x] Updated the primary script paths in `index.html`.
- [x] Kept the legacy builder asset paths as compatibility shims.
- [x] Verified public home portal and navigation rendering.
- [x] Verified Admin Homepage Builder.
- [x] Verified Admin Widget Library.
- [x] Verified Admin Navigation Builder.
- [x] Verified browser console after migration.

### RuntimeInspector

- [x] Created `Core/Diagnostics/inspector.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/RuntimeInspector.js` as a compatibility shim.
- [x] Verified RuntimeInspector opens from Admin System.

### AdminSystemCore

- [x] Created `Core/AdminCore/index.js`.
- [x] Updated the primary script path in `index.html`.
- [x] Kept `assets/adminSystemCore.js` as a compatibility shim.
- [x] Verified Admin CP category rendering.
- [x] Verified RuntimeInspector and Package Diagnostics from Admin CP.

### Public Modules

- [x] Created `Core/Modules/Home/index.js`.
- [x] Created `Core/Modules/Blog/index.js`.
- [x] Created `Core/Modules/Forums/index.js`.
- [x] Created `Core/Modules/Calendar/index.js`.
- [x] Created `Core/Modules/Account/index.js`.
- [x] Updated public module script paths in `index.html`.
- [x] Kept legacy `modules/pages/*.js` files available for compatibility.
- [x] Verified public routes and public subviews.

## Public Module Validation

- [x] Home portal sections and quick links render.
- [x] Blog Articles subview works.
- [x] Blog Write subview works.
- [x] Forums Threads subview works.
- [x] Forums Start Thread subview works.
- [x] Forum thread detail works.
- [x] Forum moderation-aware controls render only when allowed.
- [x] Calendar Month subview works.
- [x] Calendar Agenda subview works.
- [x] Calendar Create subview works.
- [x] Account Profile subview works.
- [x] Account Activity subview works.
- [x] Account Inbox subview works.
- [x] Account Standing subview works.
- [x] Route return lands on sensible defaults.
- [x] Back navigation does not leave stale selected subviews.

## Admin Validation

- [x] Overview renders.
- [x] Site renders.
- [x] Community renders.
- [x] Content renders.
- [x] Users & Roles renders.
- [x] Permissions renders.
- [x] Appearance renders.
- [x] Builders renders.
- [x] Extensions renders.
- [x] Maintenance renders.
- [x] System renders.
- [x] Representative sublinks render without duplicates.
- [x] RuntimeInspector opens.
- [x] Package diagnostics render.
- [x] No inline handler errors appear in the console.

## Data And Package Validation

- [x] DataCore reads packages.
- [x] DataCore reads settings.
- [x] DataCore reads users.
- [x] DataCore reads content.
- [x] Temporary write/update/get/remove round-trip passes.
- [x] Encrypted store files remain readable.
- [x] PackageCore boots.
- [x] Built-in packages register.
- [x] Package lifecycle metadata is present.
- [x] Admin Extensions shows package records.
- [x] Package diagnostics report expected health.

## Regression Checks

- [x] No slow boot is visible.
- [x] No duplicate renders are visible.
- [x] No runaway event listeners are visible.
- [x] No diagnostics spam appears.
- [x] Public mobile navigation remains usable.
- [x] Cards and metadata do not overflow on narrow screens.
- [x] Calendar month grid remains stable.
- [x] Forum thread cards and detail views remain stable.
- [x] Blog article grid/list remains stable.
- [x] Account profile and inbox views remain stable.

## Rollback Reference

- Restore the previous `index.html` script path for the failed subsystem.
- Restore the legacy subsystem file if it was edited.
- Leave encrypted stores untouched.
- Leave record types unchanged.
- Re-run public route smoke.
- Re-open Admin CP.
- Re-check DataCore if the failed subsystem touched persistence.
- Re-check browser console.
- Document the failed migration step before retrying.

## v0.50 Completion Gate

- [x] All migrated subsystems pass targeted validation.
- [x] All required globals are preserved.
- [x] All required record types are preserved.
- [x] Public site serves 200.
- [x] Browser console has no errors.
- [x] Admin CP and RuntimeInspector work.
- [x] DataCore and PackageCore validations pass.
- [x] No external product references are present.
- [x] No browser storage APIs were introduced.
- [x] Persistence bridge access remains isolated through `DataCoreSystem`.
