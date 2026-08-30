const Lifecycle = (() => {
  const listeners = new Map();

  function emit(event, data) {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString()
    };

    const handlers = listeners.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        Diagnostics?.error?.("[Lifecycle] handler failed", { event, error: err });
      }
    }
  }

  function on(event, handler) {
    if (typeof handler !== "function") return;
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event).push(handler);
  }

  return {
    emit,
    on
  };
})();

window.Lifecycle = Lifecycle;
