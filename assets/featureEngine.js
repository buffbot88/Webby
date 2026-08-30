const FeatureEngine = (() => {

  const registry = new Map();

  function register(id, fn) {
    registry.set(id, fn);
  }

  function resolve(list = [], ctx = {}) {
    return (list || [])
      .map(id => registry.get(id))
      .filter(Boolean)
      .map(fn => {
        try {
          return fn(ctx);
        } catch (err) {
          Diagnostics.error("[FeatureEngine] feature render failed", err);
          return "";
        }
      })
      .join("");
  }

  return {
    register,
    resolve
  };

})();

window.FeatureEngine = FeatureEngine;