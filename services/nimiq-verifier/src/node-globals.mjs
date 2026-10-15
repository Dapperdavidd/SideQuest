if (typeof globalThis.addEventListener !== "function") {
  const lifecycleEvents = new EventTarget();
  globalThis.addEventListener = lifecycleEvents.addEventListener.bind(lifecycleEvents);
  globalThis.removeEventListener = lifecycleEvents.removeEventListener.bind(lifecycleEvents);
  globalThis.dispatchEvent = lifecycleEvents.dispatchEvent.bind(lifecycleEvents);
}
