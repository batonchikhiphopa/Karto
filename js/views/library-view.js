(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createLibraryView(ctx) {
    const list = document.getElementById("libraryDeckList");
    const mergeList = document.getElementById("mergeCheckboxList");
    const mergeNameInput = document.getElementById("mergeNewNameInput");
    let editingDeckNameId = null;

    function persistDeckRename(deck, nextName, options = {}) {
      const trimmedName = nextName.trim();
      if (!trimmedName) {
        if (options.force) {
          ctx.toast.error(t("alerts.enterName"));
        }
        return false;
      }

      if (deck.name === trimmedName) {
        return true;
      }

      deck.name = trimmedName;
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.toast.success(t("alerts.deckNameSaved"));
      return true;
    }

    function beginRename(deckId) {
      editingDeckNameId = deckId;
      render();
    }

    function cancelRename() {
      if (editingDeckNameId === null) return;
      editingDeckNameId = null;
      render();
    }

    function commitRename(deckId, value, options = {}) {
      const deck = ctx.getDeckById(deckId);
      if (!deck) {
        editingDeckNameId = null;
        render();
        return;
      }

      if (!value.trim()) {
        if (options.force) {
          ctx.toast.error(t("alerts.enterName"));
          return;
        }

        editingDeckNameId = null;
        render();
        return;
      }

      const didPersist = persistDeckRename(deck, value, options);
      if (!didPersist) {
        return;
      }

      editingDeckNameId = null;
      render();
    }

    function createDeckNameControl(deck) {
      if (editingDeckNameId === deck.id) {
        return createElement("input", {
          className: "form-input lib-deck-row-name-input",
          value: deck.name,
          attrs: {
            type: "text",
            "data-rename-input": deck.id,
            "aria-label": t("actions.renameDeck")
          },
          listeners: {
            click(event) {
              event.stopPropagation();
            },
            keydown(event) {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename(deck.id, event.currentTarget.value, { force: true });
              }

              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            },
            blur(event) {
              commitRename(deck.id, event.currentTarget.value);
            }
          }
        });
      }

      return createElement("button", {
        className: "lib-deck-row-name-btn",
        text: deck.name,
        attrs: {
          type: "button",
          "data-action": "rename",
          "data-deck-id": deck.id,
          "aria-label": t("actions.renameDeck"),
          title: t("actions.renameDeck")
        }
      });
    }

    function createLibraryRow(deck) {
      return createElement("div", {
        className: "lib-deck-row",
        dataset: { deckId: deck.id },
        children: [
          createDeckNameControl(deck),
          createElement("div", {
            className: "lib-deck-row-count",
            text: ctx.cardCount(deck.cards.length)
          }),
          createElement("div", {
            className: "lib-deck-row-actions",
            children: [
              createElement("button", {
                className: "icon-btn icon-btn-accent",
                children: [createElement("span", { text: "+", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "create-card",
                  "data-deck-id": deck.id,
                  "aria-label": t("actions.createCard"),
                  title: t("actions.createCard")
                }
              }),
              createElement("button", {
                className: "icon-btn",
                children: [createElement("span", { text: "✎", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "edit",
                  "data-deck-id": deck.id,
                  "aria-label": t("actions.edit"),
                  title: t("actions.edit")
                }
              }),
              createElement("button", {
                className: "icon-btn",
                children: [createIcon("mergeDeck")],
                attrs: {
                  type: "button",
                  "data-action": "merge",
                  "data-deck-id": deck.id,
                  "aria-label": t("actions.mergeDeck"),
                  title: t("actions.mergeDeck")
                }
              }),
              createElement("button", {
                className: "icon-btn",
                children: [createIcon("share")],
                attrs: {
                  type: "button",
                  "data-action": "share",
                  "data-deck-id": deck.id,
                  "aria-label": t("actions.share"),
                  title: t("actions.share")
                }
              }),
              createElement("button", {
                className: "icon-btn icon-btn-danger",
                children: [createElement("span", { text: "✕", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "delete",
                  "data-deck-id": deck.id,
                  "aria-label": t("actions.delete"),
                  title: t("actions.delete")
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

      if (editingDeckNameId !== null) {
        root.requestAnimationFrame(() => {
          const input = list.querySelector(`[data-rename-input="${editingDeckNameId}"]`);
          if (!input) return;
          input.focus();
          input.select();
        });
      }
    }

    function openCreateDeck(returnScreen) {
      ctx.deckEditorView.openCreateDraft(returnScreen || "homeScreen");
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

    function openMerge(selectedDeckIds = []) {
      if (ctx.state.decks.length < 2) {
        ctx.toast.error(t("alerts.needTwoDecks"));
        return;
      }

      renderMergeOptions(selectedDeckIds);
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

      if (button.dataset.action === "rename") {
        beginRename(deckId);
      }

      if (button.dataset.action === "create-card") {
        ctx.cardFormView.open(deckId, null, "libraryScreen");
      }

      if (button.dataset.action === "edit") {
        ctx.deckEditorView.open(deckId);
      }

      if (button.dataset.action === "merge") {
        openMerge([deckId]);
      }

      if (button.dataset.action === "share") {
        ctx.shareDeck(ctx.getDeckById(deckId));
      }

      if (button.dataset.action === "delete") {
        ctx.deleteDeckWithUndo(deckId);
      }
    });

    document.getElementById("libraryImportBtn").addEventListener("click", () => {
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

    document.getElementById("closeMergeBtn").addEventListener("click", () => {
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
