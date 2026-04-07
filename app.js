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

  function exportJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv(decks, filename) {
    const rows = [];

    decks.forEach((deck) => {
      deck.cards.forEach((card) => {
        rows.push([
          deck.name,
          card.frontText,
          card.backText,
          card.image || ""
        ]);
      });
    });

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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

  const ctx = {
    api,
    cardCount,
    createCardThumbnail,
    createEmptyMessage,
    deleteDeckWithUndo,
    exportCsv,
    exportJson,
    getDeckById,
    importJson,
    isValidImageValue,
    navTargetForScreen,
    restoreSnapshot,
    router,
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
