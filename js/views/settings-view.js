(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createSettingsView(ctx) {
    const languageSelect = document.getElementById("languageSelect");
    const themeSelect = document.getElementById("themeSelect");
    const windowModeRow = document.getElementById("windowModeRow");
    const windowModeSelect = document.getElementById("windowModeSelect");
    const homeGridColumnsSelect = document.getElementById("homeGridColumnsSelect");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const sessionHistoryList = document.getElementById("sessionHistoryList");
    const desktopApi = ctx.desktopApi && ctx.desktopApi.isDesktop ? ctx.desktopApi : null;
    const draftState = {
      language: "en",
      theme: "system",
      windowMode: "fullscreen",
      homeGridColumns: "auto",
      isDirty: false,
      isInitialized: false,
      isSaving: false
    };
    let currentWindowMode = "fullscreen";
    let syncRequestId = 0;

    function normalizeWindowMode(value) {
      return value === "windowed" ? "windowed" : "fullscreen";
    }

    function getSavedSnapshot() {
      return {
        language: ctx.state.languagePreference,
        theme: ctx.state.themePreference,
        windowMode: currentWindowMode,
        homeGridColumns: ctx.state.homeGridColumns
      };
    }

    function updateSaveButton() {
      if (!saveSettingsBtn) {
        return;
      }

      saveSettingsBtn.disabled = draftState.isSaving || !draftState.isDirty;
    }

    function renderControls() {
      languageSelect.value = draftState.language;
      themeSelect.value = draftState.theme;
      homeGridColumnsSelect.value = draftState.homeGridColumns;

      if (desktopApi && windowModeRow && windowModeSelect) {
        windowModeRow.hidden = false;
        windowModeSelect.value = draftState.windowMode;
      } else if (windowModeRow) {
        windowModeRow.hidden = true;
      }

      updateSaveButton();
    }

    function syncDraftDirty() {
      const savedSnapshot = getSavedSnapshot();

      draftState.isDirty =
        draftState.language !== savedSnapshot.language ||
        draftState.theme !== savedSnapshot.theme ||
        draftState.homeGridColumns !== savedSnapshot.homeGridColumns ||
        (!!desktopApi && draftState.windowMode !== savedSnapshot.windowMode);

      updateSaveButton();
    }

    function initializeDraftFromSavedState() {
      const savedSnapshot = getSavedSnapshot();

      draftState.language = savedSnapshot.language;
      draftState.theme = savedSnapshot.theme;
      draftState.windowMode = savedSnapshot.windowMode;
      draftState.homeGridColumns = savedSnapshot.homeGridColumns;
      draftState.isDirty = false;
      draftState.isInitialized = true;
      draftState.isSaving = false;

      renderControls();
    }

    function ensureDraftInitialized() {
      if (!draftState.isInitialized) {
        initializeDraftFromSavedState();
      }
    }

    function discardDraft() {
      draftState.isDirty = false;
      draftState.isInitialized = false;
      draftState.isSaving = false;
      updateSaveButton();
    }

    function setCurrentWindowMode(value) {
      currentWindowMode = normalizeWindowMode(value);
    }

    async function syncDesktopPreferences() {
      if (!desktopApi || !windowModeRow) {
        return;
      }

      const requestId = ++syncRequestId;

      try {
        const preferences = await desktopApi.getWindowPreferences();
        if (requestId !== syncRequestId) {
          return;
        }

        setCurrentWindowMode(preferences?.windowMode);
        windowModeRow.hidden = false;

        if (!draftState.isInitialized || !draftState.isDirty) {
          ensureDraftInitialized();
          draftState.windowMode = currentWindowMode;
          draftState.isDirty = false;
          renderControls();
          return;
        }

        syncDraftDirty();
      } catch (error) {
        console.error("[karto] Failed to read desktop window preferences:", error);
        windowModeRow.hidden = true;
      }
    }

    function updateDraft(field, value) {
      ensureDraftInitialized();
      draftState[field] = value;
      syncDraftDirty();
    }

    async function saveChanges() {
      ensureDraftInitialized();

      if (draftState.isSaving || !draftState.isDirty) {
        return;
      }

      const nextSettings = {
        language: draftState.language,
        theme: draftState.theme,
        windowMode: draftState.windowMode,
        homeGridColumns: draftState.homeGridColumns
      };

      draftState.isSaving = true;
      updateSaveButton();

      try {
        if (desktopApi && nextSettings.windowMode !== currentWindowMode) {
          const preferences = await desktopApi.setWindowMode(nextSettings.windowMode);
          setCurrentWindowMode(preferences?.windowMode);
        }

        ctx.store.setThemePreference(nextSettings.theme);
        ctx.store.setHomeGridColumns(nextSettings.homeGridColumns);
        ctx.store.setLanguagePreference(nextSettings.language);
        setLanguage(nextSettings.language, {
          persist: false,
          refresh: false
        });

        discardDraft();
        ctx.refreshAll();
        ctx.toast.success(t("alerts.settingsSaved"));
      } catch (error) {
        console.error("[karto] Failed to save settings:", error);
        draftState.isSaving = false;
        syncDraftDirty();
        ctx.toast.error(t("alerts.settingsSaveFailed"));
      }
    }

    function renderSessionHistory() {
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

    function render() {
      ensureDraftInitialized();
      renderControls();
      renderSessionHistory();

      if (desktopApi && windowModeRow) {
        void syncDesktopPreferences();
      } else if (windowModeRow) {
        windowModeRow.hidden = true;
      }
    }

    function open() {
      discardDraft();
      render();
    }

    languageSelect.addEventListener("change", () => {
      updateDraft("language", languageSelect.value);
    });

    themeSelect.addEventListener("change", () => {
      updateDraft("theme", themeSelect.value);
    });

    homeGridColumnsSelect.addEventListener("change", () => {
      updateDraft("homeGridColumns", homeGridColumnsSelect.value);
    });

    if (windowModeSelect) {
      windowModeSelect.addEventListener("change", () => {
        updateDraft("windowMode", windowModeSelect.value);
      });
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", () => {
        void saveChanges();
      });
    }

    document.getElementById("resetBtn").addEventListener("click", () => {
      const snapshot = ctx.store.createSnapshot();
      ctx.store.clearAllData({ includeLanguage: true });
      setLanguage(ctx.state.languagePreference, {
        persist: false,
        refresh: false,
        storage: null
      });
      discardDraft();
      ctx.refreshAll();

      ctx.toast.info(t("alerts.confirmReset"), {
        actionLabel: t("common.undo"),
        duration: 6000,
        onAction: () => {
          discardDraft();
          ctx.restoreSnapshot(snapshot);
        }
      });
    });

    return {
      discardDraft,
      open,
      render
    };
  }

  Karto.createSettingsView = createSettingsView;
})(window);
