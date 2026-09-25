import React from "react";
import { createRoot } from "react-dom/client";

// Script load order mirrors the original index.html CORE ENGINE LAYER
// (order matters). Each file is a classic script that attaches to
// window.*, so they are injected sequentially and awaited one by one.
const RUNTIME_SCRIPTS = [
  "Core/Diagnostics/index.js",
  "assets/lifecycle.js",
  "assets/registryEngine.js",
  "assets/configLoader.js",
  "assets/featureEngine.js",
  "assets/pluginEngine.js",
  "assets/layoutEngine.js",
  "assets/moduleLoader.js",
  "Core/DataCore/index.js",
  "Core/Packages/index.js",
  "Core/Users/index.js",
  "Core/Content/index.js",
  "assets/notificationCoreSystem.js",
  "assets/reactionCoreSystem.js",
  "assets/bookmarkCoreSystem.js",
  "assets/activityFeedCoreSystem.js",
  "assets/messagingCoreSystem.js",
  "assets/moderationCoreSystem.js",
  "assets/reputationCoreSystem.js",
  "assets/mediaCoreSystem.js",
  "assets/categoryCoreSystem.js",
  "assets/tagCoreSystem.js",
  "assets/revisionCoreSystem.js",
  "assets/searchCoreSystem.js",
  "Core/Builders/widgets.js",
  "Core/Builders/navigation.js",
  "Core/Builders/homepage.js",
  "Core/AdminCore/index.js",
  "Core/Diagnostics/inspector.js",
  "Core/Runtime/index.js",
  "assets/moduleSdk.js",
  "Core/Modules/Home/index.js",
  "Core/Modules/Blog/index.js",
  "Core/Modules/Forums/index.js",
  "Core/Modules/Calendar/index.js",
  "Core/Modules/Account/index.js"
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-runtime-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.runtimeSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load runtime script: ${src}`));
    document.body.appendChild(script);
  });
}

function AppShell() {
  const [status, setStatus] = React.useState("Booting WebbyOS…");
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const src of RUNTIME_SCRIPTS) {
          if (cancelled) return;
          await loadScript(src);
        }
        if (cancelled) return;
        setStatus("Starting runtime…");
        await window.Runtime.init();
        if (!cancelled) setStatus("");
      } catch (err) {
        if (!cancelled) setError(String(err?.message || err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="boot-error" role="alert">
        WebbyOS failed to start: {error}
      </div>
    );
  }
  if (!status) return null;
  return <div className="boot-status">{status}</div>;
}

createRoot(document.getElementById("app")).render(<AppShell />);
