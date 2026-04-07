(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createSettingsView(ctx) {
    const languageSelect = document.getElementById("languageSelect");
    const themeSelect = document.getElementById("themeSelect");
    const sessionHistoryList = document.getElementById("sessionHistoryList");

    function render() {
      languageSelect.value = getCurrentLanguage();
      themeSelect.value = ctx.state.themePreference;
      clearElement(sessionHistoryList);

      if (ctx.state.studySessions.length === 0) {
        sessionHistoryList.appendChild(ctx.createEmptyMessage(t("settings.emptySessions")));
        return;
      }

      const formatter = new Intl.DateTimeFormat(getCurrentLanguage(), {
        dateStyle: "medium",
        timeStyle: "short"
      });

      ctx.state.studySessions.forEach((session) => {
        const percent = typeof session.percentCorrect === "number" ? session.percentCorrect : 0;
        const finishedAt = session.finishedAt ? formatter.format(new Date(session.finishedAt)) : "";

        sessionHistoryList.appendChild(createElement("div", {
          className: "session-history-item",
          children: [
            createElement("div", {
              className: "session-history-title",
              text: `${session.deckName || "Deck"} • ${finishedAt}`
            }),
            createElement("div", {
              className: "session-history-meta",
              text: `${t("study.sessionEntry", {
                reviewed: session.reviewed || 0,
                percent
              })} • ${t(
                session.mode === "new" ? "study.modeNew" :
                session.mode === "review" ? "study.modeReview" :
                "study.modeAll"
              )}`
            })
          ]
        }));
      });
    }

    languageSelect.addEventListener("change", () => {
      setLanguage(languageSelect.value);
    });

    themeSelect.addEventListener("change", () => {
      ctx.store.setThemePreference(themeSelect.value);
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      const snapshot = ctx.store.createSnapshot();
      ctx.store.clearAllData({ includeLanguage: true });
      setLanguage(resolveInitialLanguage(), { persist: true, refresh: false });
      ctx.refreshAll();

      ctx.toast.info(t("alerts.confirmReset"), {
        actionLabel: t("common.undo"),
        duration: 6000,
        onAction: () => {
          ctx.restoreSnapshot(snapshot);
        }
      });
    });

    return {
      render
    };
  }

  Karto.createSettingsView = createSettingsView;
})(window);
