(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createLibraryView(ctx) {
    const list = document.getElementById("libraryDeckList");
    const createDeckInput = document.getElementById("newDeckNameInput");
    const mergeList = document.getElementById("mergeCheckboxList");
    const mergeNameInput = document.getElementById("mergeNewNameInput");

    function createLibraryRow(deck) {
      return createElement("div", {
        className: "lib-deck-row",
        dataset: { deckId: deck.id },
        children: [
          createElement("div", { className: "lib-deck-row-name", text: deck.name }),
          createElement("div", {
            className: "lib-deck-row-count",
            text: ctx.cardCount(deck.cards.length)
          }),
          createElement("div", {
            className: "lib-deck-row-actions",
            children: [
              createElement("button", {
                className: "lib-btn",
                text: t("actions.edit"),
                attrs: {
                  type: "button",
                  "data-action": "edit",
                  "data-deck-id": deck.id
                }
              }),
              createElement("button", {
                className: "lib-btn lib-btn-danger",
                text: t("actions.delete"),
                attrs: {
                  type: "button",
                  "data-action": "delete",
                  "data-deck-id": deck.id
                }
              })
            ]
          })
        ]
      });
    }

    function render() {
      clearElement(list);

      if (ctx.state.decks.length === 0) {
        list.appendChild(ctx.createEmptyMessage(t("library.empty")));
        return;
      }

      ctx.state.decks.forEach((deck) => {
        list.appendChild(createLibraryRow(deck));
      });
    }

    function openCreateDeck(returnScreen) {
      ctx.state.createDeckReturn = returnScreen || "homeScreen";
      createDeckInput.value = "";
      ctx.router.goTo("createDeckScreen", ctx.navTargetForScreen(ctx.state.createDeckReturn));
      createDeckInput.focus();
    }

    function saveDeck() {
      const name = createDeckInput.value.trim();
      if (!name) {
        ctx.toast.error(t("alerts.enterDeckName"));
        return;
      }

      ctx.state.decks.push(createDeck(name));
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      render();
      ctx.toast.success(t("alerts.deckCreated"));
      ctx.router.goTo(ctx.state.createDeckReturn, ctx.navTargetForScreen(ctx.state.createDeckReturn));
    }

    function renderMergeOptions(selectedDeckIds = []) {
      clearElement(mergeList);

      ctx.state.decks.forEach((deck) => {
        const checkboxId = `merge_${deck.id}`;
        const row = createElement("label", {
          className: "merge-checkbox-row",
          attrs: { for: checkboxId },
          children: [
            createElement("input", {
              attrs: {
                id: checkboxId,
                type: "checkbox",
                value: deck.id
              },
              properties: {
                checked: selectedDeckIds.includes(deck.id)
              }
            }),
            createElement("span", {
              text: `${deck.name} (${ctx.cardCount(deck.cards.length)})`
            })
          ]
        });

        mergeList.appendChild(row);
      });
    }

    function openMerge() {
      if (ctx.state.decks.length < 2) {
        ctx.toast.error(t("alerts.needTwoDecks"));
        return;
      }

      renderMergeOptions();
      mergeNameInput.value = "";
      ctx.router.goTo("mergeDecksScreen", "libraryScreen");
    }

    function confirmMerge() {
      const selectedDeckIds = Array.from(
        mergeList.querySelectorAll("input:checked")
      ).map((checkbox) => checkbox.value);

      if (selectedDeckIds.length < 2) {
        ctx.toast.error(t("alerts.chooseTwoDecks"));
        return;
      }

      const name = mergeNameInput.value.trim();
      if (!name) {
        ctx.toast.error(t("alerts.enterName"));
        return;
      }

      const sourceDecks = selectedDeckIds
        .map((deckId) => ctx.getDeckById(deckId))
        .filter(Boolean);

      ctx.state.decks.push(mergeDecks(sourceDecks, name));
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      render();
      ctx.toast.success(t("alerts.deckMerged", { name }));
      ctx.router.goTo("libraryScreen", "libraryScreen");
    }

    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const deckId = button.dataset.deckId;

      if (button.dataset.action === "edit") {
        ctx.deckEditorView.open(deckId);
      }

      if (button.dataset.action === "delete") {
        ctx.deleteDeckWithUndo(deckId);
      }
    });

    document.getElementById("libCreateDeckBtn").addEventListener("click", () => openCreateDeck("libraryScreen"));
    document.getElementById("libCreateCardBtn").addEventListener("click", () => ctx.cardFormView.open(null, null, "libraryScreen"));
    document.getElementById("libMergeBtn").addEventListener("click", openMerge);
    document.getElementById("libExportBtn").addEventListener("click", () => {
      if (ctx.state.decks.length === 0) {
        ctx.toast.error(t("alerts.noDecksExport"));
        return;
      }

      ctx.exportJson(createExportPayload(ctx.state.decks), buildLibraryExportFilename());
    });
    document.getElementById("libCsvExportBtn").addEventListener("click", () => {
      if (ctx.state.decks.length === 0) {
        ctx.toast.error(t("alerts.noDecksExport"));
        return;
      }

      ctx.exportCsv(ctx.state.decks, "karto-decks.csv");
    });
    document.getElementById("libImportBtn").addEventListener("click", () => {
      ctx.importJson((rawPayload) => {
        const result = prepareLibraryImport(rawPayload, ctx.state.decks);
        if (!result.isValid) {
          ctx.toast.error(t("alerts.invalidFormat"));
          return;
        }

        ctx.state.decks = ctx.state.decks.concat(result.decks);
        ctx.store.saveDecksSoon();
        ctx.homeView.render();
        render();
        ctx.toast.success(t("alerts.libraryImportSummary", {
          added: result.decks.length,
          skipped: result.skippedCount
        }));
      });
    });

    document.getElementById("saveDeckBtn").addEventListener("click", saveDeck);
    document.getElementById("backFromCreateDeckBtn").addEventListener("click", () => {
      ctx.router.goTo(ctx.state.createDeckReturn, ctx.navTargetForScreen(ctx.state.createDeckReturn));
    });
    createDeckInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        saveDeck();
      }
    });

    document.getElementById("backFromMergeBtn").addEventListener("click", () => {
      ctx.router.goTo("libraryScreen", "libraryScreen");
    });
    document.getElementById("confirmMergeBtn").addEventListener("click", confirmMerge);
    mergeNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        confirmMerge();
      }
    });

    return {
      openCreateDeck,
      openMerge,
      render
    };
  }

  Karto.createLibraryView = createLibraryView;
})(window);
