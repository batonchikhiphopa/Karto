(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createSidebar(options) {
    const mount = options.mount;
    const overlay = options.overlay;
    const toggleButton = options.toggleButton;
    const template = document.getElementById("sidebarTemplate");

    mount.appendChild(template.content.cloneNode(true));

    const sidebarElement = mount.querySelector("#appSidebar");
    const closeButton = mount.querySelector("#sidebarCloseBtn");
    const quitButton = mount.querySelector("#sidebarQuitBtn");

    if (quitButton) {
      quitButton.hidden = !options.showQuitAction;
    }

    function setOpen(isOpen) {
      document.body.classList.toggle("sidebar-open", !!isOpen);
      overlay.hidden = !isOpen;
    }

    function close() {
      setOpen(false);
    }

    function setActive(targetScreenId) {
      mount.querySelectorAll("[data-nav]").forEach((button) => {
        button.classList.toggle("active", !!targetScreenId && button.dataset.nav === targetScreenId);
      });
    }

    toggleButton.addEventListener("click", () => setOpen(true));
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", close);

    sidebarElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-nav]");
      const actionButton = event.target.closest("[data-sidebar-action]");

      if (button) {
        close();
        options.onNavigate(button.dataset.nav);
        return;
      }

      if (actionButton?.dataset.sidebarAction === "quit") {
        close();
        options.onQuit?.();
      }
    });

    root.addEventListener("resize", () => {
      if (root.innerWidth > 980) {
        close();
      }
    });

    return {
      close,
      setActive,
      setOpen,
      element: sidebarElement
    };
  }

  Karto.createSidebar = createSidebar;
})(window);
