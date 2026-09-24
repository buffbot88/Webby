# WebbyOS

WebbyOS is a modular self-hosted community ecosystem platform built with vanilla JavaScript and lightweight PHP persistence services.

The platform is designed around extensible runtime systems, encrypted local persistence, modular public experiences, package-driven extensibility, and a professional Admin Control Panel without relying on heavy frameworks.

WebbyOS focuses on:
- modular architecture
- extensibility
- self-hosting
- lightweight deployment
- builder-driven customization
- community systems
- package-based growth
- long-term maintainability

---

# Development Status

WebbyOS is currently in active alpha development.

Current roadmap stage:
- v0.46 - COMPLETE
- v0.47 - COMPLETE
- v0.48 - COMPLETE
- v0.49 - COMPLETE
- v0.50 - COMPLETE
- v0.60 - PLANNED
- v0.70 - PLANNED
- v0.80 - PLANNED
- v0.90 - PLANNED
- v0.95 - PLANNED
- v1.0 - PLANNED

Roadmap execution source of truth:
- `TODO.md`

Current development focus:
- v0.60 productization and first-install experience
- Starter/demo content and empty-state polish
- Post-refactor module and package UX cleanup
- Compatibility shim retention policy

WebbyOS is not yet considered production-ready or commercially released.

---

# Platform Overview

WebbyOS is built around modular runtime systems that separate responsibilities into composable platform layers.

## Core Platform Systems

### Runtime
Handles:
- application boot
- navigation
- shared runtime state
- module lifecycle
- system initialization

### Registry System
Handles:
- routes
- page definitions
- module registration
- runtime lookups

### DataCoreSystem
Handles:
- encrypted persistence
- local data storage
- data read/write operations
- PHP bridge communication
- persistence validation

### UserCoreSystem
Handles:
- authentication
- capability-based permissions
- role handling
- sessions
- profile access
- moderation permissions

### ContentCoreSystem
Handles:
- content registration
- content validation
- metadata
- categories/tags integration
- revision support

### PackageCoreSystem
Handles:
- package manifests
- package validation
- package diagnostics
- package registration
- package health checks

### AdminSystemCore
Handles:
- Admin Control Panel
- system management
- module management
- package visibility
- runtime inspection
- moderation tooling
- builder management

### Builder Systems
Includes:
- NavigationBuilderSystem
- HomepageBuilderSystem
- WidgetCoreSystem

These systems provide configurable frontend experiences without requiring framework-level customization.

### Diagnostics + RuntimeInspector
Handles:
- diagnostics reporting
- runtime health
- registry visibility
- package diagnostics
- debugging visibility

---

# Public Platform Systems

WebbyOS currently includes:

- Home Portal
- Forums
- Blog
- Calendar
- Account/Profile system
- Notifications
- Messaging
- Reputation/activity systems
- Media upload support
- Moderation systems
- Categories/tags/revisions/search foundations

These systems completed the v0.47 public UX productization phase and passed the v0.48 stability validation phase.

---

# Repository Structure

```text
.
|-- index.html
|-- server.js
|-- package.json
|-- registry.json
|-- config.json
|-- TODO.md
|-- Core/
|   |-- Runtime/index.js
|   |-- Diagnostics/index.js
|   |-- Diagnostics/inspector.js
|   |-- DataCore/index.js
|   |-- Packages/index.js
|   |-- Users/index.js
|   |-- Content/index.js
|   |-- AdminCore/index.js
|   |-- Builders/
|   |   |-- navigation.js
|   |   |-- homepage.js
|   |   `-- widgets.js
|   `-- Modules/
|       |-- Home/index.js
|       |-- Blog/index.js
|       |-- Forums/index.js
|       |-- Calendar/index.js
|       `-- Account/index.js
|-- assets/
|   |-- theme.css
|   `-- legacy compatibility shims for migrated Core systems
|-- modules/pages/
|   `-- legacy compatibility paths for public modules
|-- api/
|   |-- data.php
|   `-- upload.php
|-- database/
|   `-- *.enc
|-- uploads/
`-- layouts/
```

`index.html` now loads the migrated `Core/` implementations first. Legacy files under `assets/` and `modules/pages/` are retained for compatibility while the shim policy remains active.

---

# Features

## Platform Features

- Modular runtime architecture
- Package extensibility
- Encrypted local persistence
- Builder systems
- Capability-based permissions
- Modular page routing
- Runtime diagnostics
- Media upload handling
- Lightweight deployment
- Vanilla JavaScript architecture
- No framework lock-in

## Community Features

- Forums
- Blog publishing
- Calendar/events
- Profiles/accounts
- Messaging foundations
- Notifications/activity
- Moderation systems
- Categories/tags/revisions
- Widgetized homepage systems

## Administrative Features

- Professional Admin Control Panel
- Runtime diagnostics
- Registry visibility
- Package diagnostics
- Navigation management
- Homepage management
- Widget management
- Permissions/capabilities
- Module visibility controls

---

# Getting Started

## Local Development

### Node runtime (default)

`server.js` serves the static site and provides drop-in replacements for the
`api/data.php` and `api/upload.php` endpoints, so WebbyOS runs on Node-only
hosts that have no PHP interpreter:

```bash
bun install        # no dependencies today; keeps the lockfile/install step healthy
bun run dev        # or: node server.js
```

Then open:

```text
http://127.0.0.1:8080/
```

The listener honours `PORT` and `HOST` (defaults `8080` and `0.0.0.0`), which is
what managed preview environments inject.

### PHP hosting

The original PHP persistence bridge is retained for classic hosting:

```bash
php -S 127.0.0.1:8080
```

Or use:
- USBWebserver
- Apache
- Nginx + PHP
- other lightweight PHP hosting

`index.html` is unchanged between the two runtimes: `DataCoreSystem` still calls
`./api/data.php` and `MediaCoreSystem` still calls `./api/upload.php`.

---

# Runtime Compatibility Layer

`server.js` keeps the frontend contract and the on-disk storage format intact:

- Serves `index.html`, `assets/`, `Core/`, `modules/`, `layouts/`, and `uploads/`.
- Blocks web access to `database/`, `node_modules/`, `.git/`, `.env*`, and any
  path containing a dotfile segment, or ending in `.enc`, `.bak`, or `.php`.
- Implements the full `DataCoreSystem` action set: `list`, `get`, `put`, `update`,
  `remove`, `clear`, and `export`, with identical request/response shapes.
- Implements the `MediaCoreSystem` upload endpoint (5 MB limit, structural image
  validation equivalent to PHP's `getimagesize()` gate, `action=upload|delete`;
  deletes require the active session to be an admin/moderator or the uploader
  of the media record that owns the file).
- Reads both `aes-256-gcm` and legacy `aes-256-cbc` store envelopes, and writes
  `aes-256-gcm` using atomic replace, matching what current PHP builds produce.

Configuration:

The server is configured through `server.config.json` in the project root (no
`.env` file required). Recognized keys - all optional, empty means default:

```json
{
  "port": 8080,
  "host": "0.0.0.0",
  "storageSecret": "",
  "dataDir": "",
  "uploadsDir": "",
  "nodeEnv": ""
}
```

- `storageSecret` sets the storage secret explicitly. When empty, the server
  generates and persists a random secret to `database/.storage-secret`
  (git-ignored); stores committed to the repository were encrypted with the
  historical public default and are therefore intentionally unreadable to any
  deployment using a rotated or generated secret - the app re-seeds itself in
  that case. In production (`nodeEnv: "production"`) the server refuses to
  boot without an explicit secret.
- `dataDir` and `uploadsDir` relocate the encrypted stores and upload directory
  when data must live outside the app root.
- `port` / `host` control the listen address (defaults `8080` / `0.0.0.0`).

For convenience on hosted platforms that inject environment variables, each
key can also be set via `WEBBYOS_STORAGE_SECRET`, `WEBBYOS_DATA_DIR`,
`WEBBYOS_UPLOADS_DIR`, `PORT`, `HOST`, and `NODE_ENV`; an env var overrides
the same key in `server.config.json` when both are present.
- Upload request bodies are capped at `MAX_UPLOAD_BYTES + 64 KB` of multipart
  overhead: an oversized declared `Content-Length` gets a clean `413` and an
  undeclared oversized stream is cut off mid-flight, so `formData()` parsing
  can never buffer unbounded input.
- Package reconciliation and search-index rebuilds are no-ops on disk when
  nothing changed, so repeated app boots no longer rewrite
  `database/packages.enc` or `database/searchIndex.enc`.

Scripts (`package.json`):

- `npm run dev` / `npm start` - run the server (listens on `server.config.json`
  `port`/`host`, or injected `PORT`/`HOST` when present).
- `npm run check` - syntax-check `server.js`.
- `npm test` - the node:test suite in `test/` (no dependencies).

> The `database/` folder remains a development placeholder. Set a real
> `WEBBYOS_STORAGE_SECRET` before any production deployment, and change the
> seeded account passwords (admin/admin123, mod/mod123, user/user123) right
> after first boot. Passwords are stored as PBKDF2-SHA256 hashes (210k
> iterations, per-user salt); legacy plaintext records are upgraded
> automatically on the next successful login.

---

# Persistence + Data Storage

WebbyOS stores platform data through `DataCoreSystem`.

Features:
- encrypted persistence stores
- PHP persistence bridge
- validated storage access
- package-safe persistence rules

Encrypted records are stored under:

```text
/database/
```

Current persistence types include:
- users
- settings
- content
- packages
- media metadata
- community records

---

# Package System

WebbyOS includes a package foundation system.

Current package capabilities:
- manifest validation
- package registration
- package diagnostics
- package health visibility
- built-in package support
- runtime package visibility

The package ecosystem is currently local-first and does not yet include a remote marketplace.

---

# Platform Philosophy

WebbyOS is designed around:

- modular systems
- self-hosted ownership
- lightweight architecture
- long-term maintainability
- extensibility without framework lock-in
- package-driven growth
- professional administrative tooling

The platform is designed to remain:
- framework-light
- extensible
- portable
- customizable
- deployment-friendly

---

# Security Foundations

Current security foundations include:
- encrypted persistence stores
- capability-based permissions
- upload restrictions
- package validation
- validated persistence access
- role/capability separation
- Admin CP access guards

WebbyOS is still in alpha and security hardening phases continue during later roadmap stages.

---

# Current Roadmap Direction

## v0.47
Public Module UX Foundations

Status: COMPLETE

Focus:
- CMS-style homepage
- structured forums
- editorial blog UX
- improved calendar experience
- improved profile/account systems
- internal module navigation/subviews

## v0.48
Stability + Runtime Hardening

Status: COMPLETE

## v0.49
Structure + Refactor Preparation Era

Status: COMPLETE

Focus:
- dependency mapping
- file size and complexity audit
- future `/Core` structure design
- public module split planning
- compatibility and rollback strategy
- validation audit closure

## v0.50
Prepared Migration Execution + Product Cohesion

Status: COMPLETE

Progress:
- Diagnostics has been migrated to `Core/Diagnostics/index.js`.
- `assets/diagnostics.js` remains as a compatibility shim.
- DataCore has been migrated to `Core/DataCore/index.js`.
- `assets/dataCoreSystem.js` remains as a compatibility shim.
- PackageCore has been migrated to `Core/Packages/index.js`.
- `assets/packageCoreSystem.js` remains as a compatibility shim.
- Runtime has been migrated to `Core/Runtime/index.js`.
- `assets/runtime.js` remains as a compatibility shim.
- UserCore has been migrated to `Core/Users/index.js`.
- `assets/userCoreSystem.js` remains as a compatibility shim.
- ContentCore has been migrated to `Core/Content/index.js`.
- `assets/contentCoreSystem.js` remains as a compatibility shim.
- Builder systems have been migrated to `Core/Builders/`.
- Legacy builder asset files remain as compatibility shims.
- RuntimeInspector has been migrated to `Core/Diagnostics/inspector.js`.
- AdminSystemCore has been migrated to `Core/AdminCore/index.js`.
- Public modules have been migrated to `Core/Modules/`.
- v0.50 final validation passed.

## v0.60
Productization + First Install Experience

Status: PLANNED

Focus:
- first-run setup and onboarding polish
- starter/demo content
- empty-state refinement
- module and package UX cleanup after the v0.50 migration

## v0.70
Installer + Deployment Era

Status: PLANNED

Focus:
- installer and deployment workflow
- environment checks
- upgrade and recovery paths
- hosting-oriented documentation

## v0.80
Documentation + Ecosystem Era

Status: PLANNED

Focus:
- user and administrator documentation
- developer and package author guidance
- ecosystem conventions
- marketplace-readiness planning

## v0.90
Security + Commercial Hardening

Status: PLANNED

Focus:
- security hardening
- permission and upload review
- production readiness checks
- release quality gates

## v0.95
Release Candidate Era

Status: PLANNED

Focus:
- release candidate validation
- final compatibility review
- installer and documentation freeze
- launch-blocker cleanup

## v1.0
Commercial Launch

Status: PLANNED

Focus:
- stable self-hosted release
- polished installer and onboarding
- complete admin/user documentation
- launch-ready package and deployment story

---

# License

MIT
