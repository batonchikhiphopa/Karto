(function(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  const Karto = root.Karto || (root.Karto = {});
  Object.assign(Karto, api);
})(typeof window !== "undefined" ? window : globalThis, function() {
  function getPrimaryNavScreen(screenId) {
    if (screenId === "homeScreen") return "homeScreen";
    if (screenId === "settingsScreen") return "settingsScreen";
    if (screenId === "studyScreen") return null;
    return "libraryScreen";
  }

  function createRouter(options = {}) {
    const screenIds = options.screenIds || [];
    let currentScreenId = options.initialScreenId || screenIds[0] || "homeScreen";

    function goTo(screenId, navTargetOverride = undefined) {
      currentScreenId = screenId;

      screenIds.forEach((id) => {
        const screen = document.getElementById(id);
        if (!screen) return;

        const isActive = id === screenId;
        screen.classList.toggle("is-active", isActive);
        screen.setAttribute("aria-hidden", isActive ? "false" : "true");
      });

      document.body.classList.toggle("study-open", screenId === "studyScreen");

      if (typeof options.onChange === "function") {
        options.onChange(screenId);
      }

      if (typeof options.onNavChange === "function") {
        options.onNavChange(
          navTargetOverride === undefined ? getPrimaryNavScreen(screenId) : navTargetOverride
        );
      }
    }

    function isVisible(screenId) {
      return currentScreenId === screenId;
    }

    function getCurrentScreenId() {
      return currentScreenId;
    }

    return {
      goTo,
      isVisible,
      getCurrentScreenId
    };
  }

  return {
    createRouter,
    getPrimaryNavScreen
  };
});
