(function(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    const Karto = root.Karto || (root.Karto = {});
    Object.assign(Karto, api);
  }
})(typeof window !== "undefined" ? window : globalThis, function() {
  function isEditableTarget(target) {
    if (!target || typeof target !== "object") {
      return false;
    }

    const tagName = String(target.tagName || "").toUpperCase();
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }

    if (target.isContentEditable) {
      return true;
    }

    if (typeof target.closest === "function") {
      return !!target.closest("[contenteditable='true'], [contenteditable='']");
    }

    return false;
  }

  function shouldHandleGlobalEscape(event) {
    return !!event &&
      event.key === "Escape" &&
      !event.defaultPrevented &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !isEditableTarget(event.target);
  }

  return {
    isEditableTarget,
    shouldHandleGlobalEscape
  };
});
