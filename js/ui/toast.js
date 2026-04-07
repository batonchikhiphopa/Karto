(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createToastManager(container) {
    function showToast(options) {
      const tone = options.tone || "info";
      const duration = options.duration ?? 4200;

      const toast = createElement("div", {
        className: "toast",
        attrs: {
          role: tone === "error" ? "alert" : "status",
          "data-tone": tone
        }
      });

      const message = createElement("div", {
        className: "toast-message",
        text: options.message
      });

      const closeButton = createElement("button", {
        className: "toast-close",
        text: t("common.close"),
        attrs: {
          type: "button"
        }
      });

      function dismiss() {
        if (toast.isConnected) {
          toast.remove();
        }
      }

      closeButton.addEventListener("click", dismiss);
      toast.appendChild(message);

      if (options.actionLabel && typeof options.onAction === "function") {
        const actionButton = createElement("button", {
          className: "toast-action",
          text: options.actionLabel,
          attrs: {
            type: "button"
          }
        });

        actionButton.addEventListener("click", () => {
          options.onAction();
          dismiss();
        });

        toast.appendChild(actionButton);
      }

      toast.appendChild(closeButton);
      container.prepend(toast);

      if (duration > 0) {
        root.setTimeout(dismiss, duration);
      }

      return {
        dismiss
      };
    }

    return {
      showToast,
      success(message, extra = {}) {
        return showToast({ ...extra, tone: "success", message });
      },
      error(message, extra = {}) {
        return showToast({ ...extra, tone: "error", message });
      },
      info(message, extra = {}) {
        return showToast({ ...extra, tone: "info", message });
      }
    };
  }

  Karto.createToastManager = createToastManager;
})(window);
