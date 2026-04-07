(function(root) {
  const store = root.Karto.createAppState();
  const { state } = store;

  store.load();
  setLanguage(resolveInitialLanguage(), { persist: true, refresh: false });

  const toast = root.Karto.createToastManager(document.getElementById("toastRegion"));
  const api = root.Karto.createApiClient();

  function navTargetForScreen(screenId) {
    if (screenId === "createDeckScreen") {
      return root.Karto.getPrimaryNavScreen(state.createDeckReturn);
    }

    if (screenId === "createCardScreen") {
      return root.Karto.getPrimaryNavScreen(state.cardForm.returnScreen);
    }

    return root.Karto.getPrimaryNavScreen(screenId);
  }

  let ctx;
  let sidebar;
  const router = root.Karto.createRouter({
    screenIds: [
      "homeScreen",
      "libraryScreen",
      "editDeckScreen",
      "settingsScreen",
      "createCardScreen",
      "createDeckScreen",
      "mergeDecksScreen",
      "addFromOtherScreen",
      "studyScreen"
    ],
    initialScreenId: state.currentScreenId,
    onChange(screenId) {
      state.currentScreenId = screenId;
      api.abortAll();
      applyTranslations(document.getElementById(screenId) || document);

      if (ctx?.homeView) {
        if (screenId === "homeScreen") {
          ctx.homeView.activate();
        } else {
          ctx.homeView.deactivate();
        }
      }
    },
    onNavChange(navTarget) {
      if (sidebar) {
        sidebar.setActive(navTarget);
      }
    }
  });

  function cardCount(count) {
    const formatted = new Intl.NumberFormat(getCurrentLanguage()).format(count);
    return `${formatted} ${translatePlural("counts.cards", count)}`;
  }

  function slugify(value) {
    return String(value || "deck")
      .trim()
      .toLowerCase()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "deck";
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();

    try {
      return document.execCommand("copy");
    } finally {
      helper.remove();
    }
  }

  async function shareDeck(deck) {
    if (!deck) return false;

    const payload = createExportPayload([deck]);
    const json = JSON.stringify(payload, null, 2);
    const filename = buildDeckExportFilename(deck.name);
    const file = typeof File === "function"
      ? new File([json], filename, { type: "application/json" })
      : null;

    try {
      if (navigator.share && file) {
        const shareData = {
          title: deck.name,
          files: [file]
        };

        const canShareFiles = typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share(shareData);
          toast.success(t("alerts.deckShared"));
          return true;
        }
      }

      if (await copyText(json)) {
        toast.success(t("alerts.deckJsonCopied"));
        return true;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }

      try {
        if (await copyText(json)) {
          toast.success(t("alerts.deckJsonCopied"));
          return true;
        }
      } catch {
        // Fall through to localized error toast below.
      }
    }

    toast.error(t("alerts.shareUnavailable"));
    return false;
  }

  function importJson(callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.addEventListener("load", (event) => {
        try {
          callback(JSON.parse(event.target.result));
        } catch {
          toast.error(t("alerts.invalidJson"));
        }
      });
      reader.readAsText(file);
    });

    input.click();
  }

  function isValidImageValue(value) {
    if (!value) return true;
    if (value.startsWith("data:image/")) return true;

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function getDeckById(deckId) {
    return state.decks.find((deck) => deck.id === deckId) || null;
  }

  function createEmptyMessage(text) {
    return createElement("div", {
      className: "lib-empty",
      text
    });
  }

  function createCardThumbnail(card) {
    if (card.image) {
      return createElement("img", {
        className: "card-row-thumb",
        attrs: {
          src: card.image,
          alt: card.frontText || ""
        }
      });
    }

    return createElement("div", {
      className: "card-row-thumb-placeholder",
      text: "?"
    });
  }

  function clearDeckReferences(deckId) {
    if (state.editingDeckId === deckId) {
      state.editingDeckId = null;
    }

    if (state.addOtherTargetDeckId === deckId) {
      state.addOtherTargetDeckId = null;
    }

    if (state.cardForm.editDeckId === deckId) {
      state.cardForm.editDeckId = null;
      state.cardForm.editCardId = null;
    }

    state.selectedCardIds = [];
  }

  function restoreSnapshot(snapshot) {
    store.restoreSnapshot(snapshot);
    refreshAll();
  }

  function deleteDeckWithUndo(deckId) {
    const deck = getDeckById(deckId);
    if (!deck) return;

    const snapshot = store.createSnapshot();
    state.decks = state.decks.filter((item) => item.id !== deckId);
    clearDeckReferences(deckId);
    store.saveDecksSoon();

    if (!getDeckById(state.editingDeckId) && state.currentScreenId === "editDeckScreen") {
      router.goTo("libraryScreen", "libraryScreen");
    }

    refreshAll();

    toast.info(t("alerts.deckDeleted", { name: deck.name }), {
      actionLabel: t("common.undo"),
      duration: 6000,
      onAction: () => {
        restoreSnapshot(snapshot);
      }
    });
  }

  ctx = {
    api,
    cardCount,
    createCardThumbnail,
    createEmptyMessage,
    deleteDeckWithUndo,
    getDeckById,
    importJson,
    isValidImageValue,
    navTargetForScreen,
    restoreSnapshot,
    router,
    shareDeck,
    slugify,
    state,
    store,
    toast
  };

  sidebar = root.Karto.createSidebar({
    mount: document.getElementById("sidebarMount"),
    overlay: document.getElementById("sidebarOverlay"),
    toggleButton: document.getElementById("sidebarToggleBtn"),
    onNavigate(target) {
      if (target === "homeScreen") {
        ctx.homeView.render();
      }

      if (target === "libraryScreen") {
        ctx.libraryView.render();
      }

      if (target === "settingsScreen") {
        ctx.settingsView.render();
      }

      router.goTo(target, target);
    }
  });

  ctx.homeView = root.Karto.createHomeView(ctx);
  ctx.libraryView = root.Karto.createLibraryView(ctx);
  ctx.deckEditorView = root.Karto.createDeckEditorView(ctx);
  ctx.cardFormView = root.Karto.createCardFormView(ctx);
  ctx.studyView = root.Karto.createStudyView(ctx);
  ctx.settingsView = root.Karto.createSettingsView(ctx);

  ctx.startStudy = (deckId, mode) => {
    ctx.studyView.start(deckId, mode);
  };

  function refreshAll() {
    ctx.homeView.render();
    ctx.libraryView.render();
    ctx.settingsView.render();
    ctx.cardFormView.render();

    if (state.editingDeckId !== null) {
      ctx.deckEditorView.render();
    }

    if (state.addOtherTargetDeckId !== null && router.isVisible("addFromOtherScreen")) {
      ctx.deckEditorView.renderSourceCardList();
    }

    if (router.isVisible("studyScreen")) {
      ctx.studyView.render();
    }

    applyTranslations(document);
    sidebar.setActive(navTargetForScreen(state.currentScreenId));
  }

  root.refreshLocalizedUI = refreshAll;

  refreshAll();
  router.goTo("homeScreen", "homeScreen");
})(window);
