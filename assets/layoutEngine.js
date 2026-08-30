const LayoutEngine = (() => {

  const loading = new Set();

  async function load(name = "default") {
    const layoutName = typeof name === "string" && name.trim()
      ? name.trim()
      : "default";

    if (loading.has(layoutName)) {
      Diagnostics?.warn?.("[LayoutEngine] recursive layout load blocked", { layoutName });
      return fallbackLayout();
    }

    loading.add(layoutName);

    try {
      const override = ConfigLoader?.get?.()?.settings?.templateOverrides?.[`layouts/${layoutName}.html`];
      if (typeof override === "string" && override.trim()) {
        return ensureMainSlot(override, layoutName);
      }

      const res = await fetch(`./layouts/${layoutName}.html`);

      if (!res.ok) {
        Diagnostics?.warn?.("[LayoutEngine] layout missing, using fallback", { layoutName });
        return fallbackLayout();
      }

      const html = await res.text();

      Lifecycle?.emit?.("layout:mount", {
        layout: layoutName
      });

      return ensureMainSlot(html, layoutName);

    } catch (err) {
      Diagnostics?.error?.("[LayoutEngine] layout load failed", {
        layoutName,
        error: err?.message || String(err)
      });

      return fallbackLayout();

    } finally {
      loading.delete(layoutName);
    }
  }

  function ensureMainSlot(html, layoutName) {
    if (String(html || "").includes("{{slot:main}}")) {
      return html;
    }

    Diagnostics?.warn?.("[LayoutEngine] layout missing main slot", { layoutName });
    return `${html}<main id="layout-slot">{{slot:main}}</main>`;
  }

  function fallbackLayout() {
    return `
      <div class="layout layout-default">
        <header class="system-header">
          <div class="system-brand">{{slot:brand}}</div>
          <nav class="system-actions">{{slot:nav}}</nav>
        </header>

        <main id="layout-slot">
          {{slot:main}}
        </main>
      </div>
    `;
  }

  function inject(layout, content) {
    return String(layout || fallbackLayout())
      .replace("{{slot:main}}", content || "")
      .replace("{{slot:brand}}", renderBrand())
      .replace("{{slot:nav}}", Runtime?.renderPublicNav?.() || "");
  }

  function renderBrand() {
    const config = ConfigLoader?.get?.() || {};
    const theme = config.themeSettings || {};
    const logoText = theme.logoText || config.siteName || "WebbyOS";
    const tagline = config.tagline || "";

    return `
      <div class="system-brand-main">${Diagnostics.escapeText(logoText)}</div>
      ${tagline ? `<div class="system-brand-tagline">${Diagnostics.escapeText(tagline)}</div>` : ""}
    `;
  }

  return {
    load,
    inject
  };

})();

window.LayoutEngine = LayoutEngine;
