(async function(root) {
  root.__kartoStartup = {
    ready: false,
    error: ""
  };

  const STARTUP_MEDIA_PREWARM_TIMEOUT_MS = 1200;
  const store = root.Karto.createAppState();
  const { state } = store;
  const bootScreen = document.getElementById("bootScreen");

  function wait(ms) {
    return new Promise((resolve) => {
      root.setTimeout(resolve, ms);
    });
  }

  function normalizeImageSource(value) {
    return root.Karto.normalizeImageSource?.(value) || (typeof value === "string" ? value.trim() : "");
  }

  function getStartupMediaUrl(card) {
    return [
      normalizeImageSource(card?.imageThumb),
      normalizeImageSource(card?.imageStudy),
      normalizeImageSource(root.Karto.deriveTileImageUrl?.(card?.image)),
      normalizeImageSource(card?.image)
    ].find(Boolean) || "";
  }

  function getStartupMediaUrls(decks) {
    const seen = new Set();
    return (Array.isArray(decks) ? decks : [])
      .flatMap((deck) => (Array.isArray(deck?.cards) ? deck.cards : []))
      .map(getStartupMediaUrl)
      .filter((imageUrl) => {
        if (!imageUrl || seen.has(imageUrl)) {
          return false;
        }

        seen.add(imageUrl);
        return true;
      });
  }

  async function prewarmStartupMedia(decks) {
    const loadImage = root.Karto.loadImage;
    const delayMs = Number(root.kartoDesktop?.startupPrewarmDelayMs) || 0;
    const imageUrls = getStartupMediaUrls(decks);
    const tasks = [];

    if (typeof loadImage === "function") {
      imageUrls.forEach((imageUrl) => {
        tasks.push(loadImage(imageUrl));
      });
    }

    if (delayMs > 0) {
      tasks.push(wait(delayMs));
    }

    if (!tasks.length) {
      return;
    }

    await Promise.race([
      Promise.allSettled(tasks),
      wait(STARTUP_MEDIA_PREWARM_TIMEOUT_MS)
    ]);
  }

  await store.loadFullData();
  setLanguage(state.languagePreference, {
    persist: false,
    refresh: false,
    storage: null
  });

  const toast = root.Karto.createToastManager(document.getElementById("toastRegion"));
  const api = root.Karto.createApiClient();
  const desktopApi = root.kartoDesktop && root.kartoDesktop.isDesktop ? root.kartoDesktop : null;

  function navTargetForScreen(screenId) {
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

      if (ctx?.settingsView && screenId !== "settingsScreen") {
        ctx.settingsView.discardDraft();
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

    await store.ensureDeckHydrated?.(deck.id, { includeMedia: true });
    store.saveDecksNow?.();
    const exportDeck = state.decks.find((item) => item.id === deck.id) || deck;
    const payload = createExportPayload([exportDeck]);
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

  function getDeckCardCount(deck) {
    return typeof root.getDeckCardCount === "function"
      ? root.getDeckCardCount(deck)
      : Array.isArray(deck?.cards)
        ? deck.cards.length
        : 0;
  }

  function createEmptyMessage(text) {
    return createElement("div", {
      className: "lib-empty",
      text
    });
  }

  function createCardThumbnail(card) {
    const imageSource = card.imageThumb || card.imageStudy || card.image || "";
    if (imageSource) {
      return createElement("img", {
        className: "card-row-thumb",
        attrs: {
          src: imageSource,
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
    getDeckCardCount,
    getDeckById,
    importJson,
    isValidImageValue,
    navTargetForScreen,
    restoreSnapshot,
    router,
    shareDeck,
    slugify,
    state,
    desktopApi,
    store,
    toast
  };

  sidebar = root.Karto.createSidebar({
    mount: document.getElementById("sidebarMount"),
    overlay: document.getElementById("sidebarOverlay"),
    toggleButton: document.getElementById("sidebarToggleBtn"),
    showQuitAction: !!desktopApi,
    onNavigate(target) {
      if (target === "homeScreen") {
        ctx.homeView.render();
      }

      if (target === "libraryScreen") {
        ctx.libraryView.render();
      }

      if (target === "settingsScreen") {
        ctx.settingsView.open();
      }

      router.goTo(target, target);
    },
    async onQuit() {
      if (!desktopApi) {
        return;
      }

      try {
        await desktopApi.quit();
      } catch (error) {
        console.error("[karto] Failed to quit application:", error);
        toast.error(t("alerts.quitUnavailable"));
      }
    }
  });

  ctx.homeView = root.Karto.createHomeView(ctx);
  ctx.libraryView = root.Karto.createLibraryView(ctx);
  ctx.deckEditorView = root.Karto.createDeckEditorView(ctx);
  ctx.cardFormView = root.Karto.createCardFormView(ctx);
  ctx.studyView = root.Karto.createStudyView(ctx);
  ctx.settingsView = root.Karto.createSettingsView(ctx);

  ctx.startStudy = (deckId) => {
    ctx.studyView.start(deckId);
  };

  root.document.addEventListener("keydown", (event) => {
    if (!root.Karto.shouldHandleGlobalEscape(event)) {
      return;
    }

    if (router.isVisible("homeScreen")) {
      return;
    }

    event.preventDefault();
    ctx.homeView.render();
    router.goTo("homeScreen", "homeScreen");
  });

  function refreshAll() {
    ctx.homeView.render();
    ctx.libraryView.render();
    ctx.settingsView.render();
    ctx.cardFormView.render();

    if (state.editingDeckId !== null || router.isVisible("editDeckScreen")) {
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

  ctx.refreshAll = refreshAll;
  root.refreshLocalizedUI = refreshAll;

  if (desktopApi?.isE2E) {
    root.__kartoE2E = {
      clearAllData() {
        store.clearAllData({ includeLanguage: false });
        refreshAll();
        router.goTo("homeScreen", "homeScreen");
      },
      async exportLibraryPayload() {
        await store.ensureAllDecksHydrated?.({ includeMedia: true });
        store.saveDecksNow?.();
        return createExportPayload(state.decks);
      },
      async importLibraryPayload(payload) {
        await store.ensureAllDecksHydrated?.({ includeMedia: true });
        const result = prepareLibraryImport(payload, state.decks);
        if (!result.isValid) {
          throw new Error("Invalid library import payload.");
        }

        state.decks = state.decks.concat(result.decks);
        store.saveDecksNow();
        refreshAll();
        return {
          addedCount: result.decks.length,
          skippedCount: result.skippedCount
        };
      },
      snapshot() {
        return store.createSnapshot();
      }
    };
  }

  refreshAll();
  router.goTo("homeScreen", "homeScreen");
  await prewarmStartupMedia(state.decks);
  if (bootScreen) {
    bootScreen.hidden = true;
  }
  document.body.classList.add("app-loaded");
  root.__kartoStartup.ready = true;
  root.__kartoStartup.error = "";
})(window).catch((error) => {
  console.error("[karto] Failed to start renderer:", error);
  window.__kartoStartup = {
    ready: false,
    error: error?.stack || error?.message || String(error)
  };
  const bootScreen = document.getElementById("bootScreen");
  if (bootScreen) {
    bootScreen.hidden = false;
    bootScreen.textContent = "Karto could not finish loading.";
  }
});
