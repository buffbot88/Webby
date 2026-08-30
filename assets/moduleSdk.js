const ModuleSDK = (() => {

  function createPageModule(definition = {}) {
    return {
      id: definition.id || "unknown",
      title: definition.title || definition.id || "Untitled Module",

      init(ctx) {
        if (typeof definition.init === "function") {
          return definition.init(ctx);
        }
      },

      render(ctx) {
        if (typeof definition.render !== "function") {
          return `<div class="cms-card">Module has no render method.</div>`;
        }

        return String(definition.render(ctx) || "");
      },

      destroy(ctx) {
        if (typeof definition.destroy === "function") {
          return definition.destroy(ctx);
        }
      }
    };
  }

  function registerPage(id, moduleDefinition) {
    window.ModuleRegistry = window.ModuleRegistry || {};
    window.ModuleRegistry[id] = createPageModule({
      id,
      ...moduleDefinition
    });
  }

  return {
    createPageModule,
    registerPage
  };

})();

window.ModuleSDK = ModuleSDK;