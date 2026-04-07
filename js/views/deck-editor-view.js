(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createDeckEditorView(ctx) {
    const nameInput = document.getElementById("editDeckNameInput");
    const cardList = document.getElementById("editDeckCardList");
    const searchInput = document.getElementById("editDeckSearchInput");
    const bulkSummary = document.getElementById("bulkSummary");
    const bulkMoveDeckSelect = document.getElementById("bulkMoveDeckSelect");

    function getDeck() {
      return ctx.getDeckById(ctx.state.editingDeckId);
    }

    function getFilteredCards(deck) {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) return deck.cards;

      return deck.cards.filter((card) => {
        return (
          card.frontText.toLowerCase().includes(query) ||
          card.backText.toLowerCase().includes(query)
        );
      });
    }

    function populateMoveDeckSelect() {
      clearElement(bulkMoveDeckSelect);

      bulkMoveDeckSelect.appendChild(
        createElement("option", {
          value: "",
          text: t("bulk.moveToDeckPlaceholder")
        })
      );

      ctx.state.decks
        .filter((deck) => deck.id !== ctx.state.editingDeckId)
        .forEach((deck) => {
          bulkMoveDeckSelect.appendChild(
            createElement("option", {
              value: deck.id,
              text: deck.name
            })
          );
        });
    }

    function renderBulkSummary(deck) {
      const selectedCount = ctx.state.selectedCardIds.length;
      bulkSummary.textContent = selectedCount
        ? t("bulk.selectedSummary", { count: selectedCount })
        : t("bulk.noneSelected");

      bulkMoveDeckSelect.disabled = selectedCount === 0 || bulkMoveDeckSelect.options.length <= 1;
      document.getElementById("bulkMoveBtn").disabled = bulkMoveDeckSelect.disabled;
      document.getElementById("bulkDeleteBtn").disabled = selectedCount === 0;
      document.getElementById("selectAllCardsBtn").disabled = !deck || deck.cards.length === 0;
    }

    function createCardRow(card) {
      const isSelected = ctx.state.selectedCardIds.includes(card.id);

      return createElement("div", {
        className: "card-row",
        dataset: { cardId: card.id },
        attrs: {
          draggable: "true"
        },
        children: [
          createElement("label", {
            className: "card-row-select",
            children: [
              createElement("input", {
                className: "card-row-checkbox",
                attrs: {
                  type: "checkbox",
                  "data-action": "toggle-select",
                  "data-card-id": card.id,
                  "aria-label": card.frontText
                },
                properties: {
                  checked: isSelected
                }
              })
            ]
          }),
          ctx.createCardThumbnail(card),
          createElement("div", {
            className: "card-row-texts",
            children: [
              createElement("div", {
                className: "card-row-front",
                text: card.frontText
              }),
              createElement("div", {
                className: "card-row-back",
                text: card.backText
              })
            ]
          }),
          createElement("div", {
            className: "card-row-actions",
            children: [
              createElement("button", {
                className: "icon-btn drag-handle",
                children: [createElement("span", { text: "⠿", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "drag",
                  "data-card-id": card.id,
                  "aria-label": "Drag to reorder"
                }
              }),
              createElement("button", {
                className: "icon-btn",
                children: [createElement("span", { text: "✎", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "edit-card",
                  "data-card-id": card.id,
                  "aria-label": t("actions.edit"),
                  title: t("actions.edit")
                }
              }),
              createElement("button", {
                className: "icon-btn",
                children: [createElement("span", { text: "✕", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "delete-card",
                  "data-card-id": card.id,
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
      const deck = getDeck();
      if (!deck) return;

      nameInput.value = deck.name;
      clearElement(cardList);
      populateMoveDeckSelect();
      renderBulkSummary(deck);

      const filteredCards = getFilteredCards(deck);

      if (deck.cards.length === 0) {
        cardList.appendChild(ctx.createEmptyMessage(t("editDeck.empty")));
        return;
      }

      if (filteredCards.length === 0) {
        cardList.appendChild(ctx.createEmptyMessage(t("alerts.nothingFound")));
        return;
      }

      filteredCards.forEach((card) => {
        cardList.appendChild(createCardRow(card));
      });
    }

    function open(deckId) {
      const deck = ctx.getDeckById(deckId);
      if (!deck) return;

      ctx.state.editingDeckId = deckId;
      ctx.state.selectedCardIds = [];
      searchInput.value = "";
      render();
      ctx.router.goTo("editDeckScreen", "libraryScreen");
    }

    function toggleSelection(cardId) {
      if (ctx.state.selectedCardIds.includes(cardId)) {
        ctx.state.selectedCardIds = ctx.state.selectedCardIds.filter((id) => id !== cardId);
      } else {
        ctx.state.selectedCardIds = ctx.state.selectedCardIds.concat(cardId);
      }

      render();
    }

    function renameDeck() {
      const deck = getDeck();
      if (!deck) return;

      const name = nameInput.value.trim();
      if (!name) {
        ctx.toast.error(t("alerts.enterName"));
        return;
      }

      deck.name = name;
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      render();
      ctx.toast.success(t("alerts.deckNameSaved"));
    }

    function deleteSelectedCards() {
      if (ctx.state.selectedCardIds.length === 0) return;

      const deck = getDeck();
      const selectedIds = new Set(ctx.state.selectedCardIds);
      const removedCount = deck.cards.filter((card) => selectedIds.has(card.id)).length;

      const snapshot = ctx.store.createSnapshot();
      deck.cards = deck.cards.filter((card) => !selectedIds.has(card.id));
      ctx.state.selectedCardIds = [];
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      render();

      ctx.toast.info(t("alerts.cardsDeleted", { count: removedCount }), {
        actionLabel: t("common.undo"),
        duration: 6000,
        onAction: () => {
          ctx.restoreSnapshot(snapshot);
        }
      });
    }

    function moveSelectedCards() {
      const deck = getDeck();
      const targetDeck = ctx.getDeckById(bulkMoveDeckSelect.value);

      if (!deck || !targetDeck || ctx.state.selectedCardIds.length === 0) {
        return;
      }

      const selectedCards = deck.cards.filter((card) => ctx.state.selectedCardIds.includes(card.id));
      const result = prepareDeckImport(selectedCards, targetDeck);
      const acceptedFingerprints = new Set(result.cards.map(cardFingerprint));

      targetDeck.cards.push(...result.cards);
      deck.cards = deck.cards.filter((card) => {
        if (!ctx.state.selectedCardIds.includes(card.id)) {
          return true;
        }

        return !acceptedFingerprints.has(cardFingerprint(card));
      });

      ctx.state.selectedCardIds = [];
      bulkMoveDeckSelect.value = "";
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      render();

      ctx.toast.success(t("alerts.cardsMoved", {
        added: result.cards.length,
        skipped: result.skippedCount
      }));
    }

    function copyFromOtherDeck(cardId) {
      const targetDeck = ctx.getDeckById(ctx.state.addOtherTargetDeckId);
      const sourceDeck = ctx.getDeckById(document.getElementById("sourceOtherDeckSelect").value);
      const card = sourceDeck?.cards.find((item) => item.id === cardId);

      if (!targetDeck || !card) return;

      const clonedCard = cloneCard(card, { freshId: true });
      targetDeck.cards.push(clonedCard);
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      if (ctx.state.editingDeckId === targetDeck.id) {
        render();
      }
      ctx.toast.success(t("alerts.cardAdded", { frontText: card.frontText }));
    }

    function openAddFromOther(targetDeckId) {
      ctx.state.addOtherTargetDeckId = targetDeckId;

      const select = document.getElementById("sourceOtherDeckSelect");
      clearElement(select);

      ctx.state.decks
        .filter((deck) => deck.id !== targetDeckId)
        .forEach((deck) => {
          select.appendChild(createElement("option", {
            value: deck.id,
            text: deck.name
          }));
        });

      if (select.options.length === 0) {
        ctx.toast.error(t("alerts.noOtherDecks"));
        return;
      }

      renderSourceCardList();
      ctx.router.goTo("addFromOtherScreen", "libraryScreen");
    }

    function renderSourceCardList() {
      const select = document.getElementById("sourceOtherDeckSelect");
      const sourceDeck = ctx.getDeckById(select.value);
      const sourceList = document.getElementById("sourceCardList");

      clearElement(sourceList);

      if (!sourceDeck || sourceDeck.cards.length === 0) {
        sourceList.appendChild(ctx.createEmptyMessage(t("addFromOther.empty")));
        return;
      }

      sourceDeck.cards.forEach((card) => {
        sourceList.appendChild(createElement("div", {
          className: "card-row",
          dataset: { cardId: card.id },
          children: [
            createElement("div"),
            ctx.createCardThumbnail(card),
            createElement("div", {
              className: "card-row-texts",
              children: [
                createElement("div", { className: "card-row-front", text: card.frontText }),
                createElement("div", { className: "card-row-back", text: card.backText })
              ]
            }),
            createElement("div", {
              className: "card-row-actions",
              children: [
                createElement("button", {
                  className: "lib-btn lib-btn-green",
                  text: t("addFromOther.addCard"),
                  attrs: {
                    type: "button",
                    "data-action": "copy-card",
                    "data-card-id": card.id
                  }
                })
              ]
            })
          ]
        }));
      });
    }

    cardList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const cardId = button.dataset.cardId;
      const deck = getDeck();
      if (!deck) return;

      if (button.dataset.action === "toggle-select") {
        toggleSelection(cardId);
      }

      if (button.dataset.action === "edit-card") {
        ctx.cardFormView.open(deck.id, cardId, "editDeckScreen");
      }

      if (button.dataset.action === "delete-card") {
        const snapshot = ctx.store.createSnapshot();
        deck.cards = deck.cards.filter((card) => card.id !== cardId);
        ctx.state.selectedCardIds = ctx.state.selectedCardIds.filter((id) => id !== cardId);
        ctx.store.saveDecksSoon();
        ctx.homeView.render();
        ctx.libraryView.render();
        render();

        ctx.toast.info(t("alerts.cardDeleted"), {
          actionLabel: t("common.undo"),
          duration: 6000,
          onAction: () => {
            ctx.restoreSnapshot(snapshot);
          }
        });
      }
    });

    cardList.addEventListener("dragstart", (event) => {
      const row = event.target.closest(".card-row[draggable='true']");
      if (!row) return;

      ctx.state.dragCardId = row.dataset.cardId;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.cardId);
    });

    cardList.addEventListener("dragend", (event) => {
      const row = event.target.closest(".card-row");
      if (row) {
        row.classList.remove("dragging");
      }

      ctx.state.dragCardId = null;
      cardList.querySelectorAll(".card-row").forEach((item) => item.classList.remove("drag-over"));
    });

    cardList.addEventListener("dragover", (event) => {
      const row = event.target.closest(".card-row[draggable='true']");
      if (!row || !ctx.state.dragCardId || row.dataset.cardId === ctx.state.dragCardId) return;

      event.preventDefault();
      cardList.querySelectorAll(".card-row").forEach((item) => item.classList.remove("drag-over"));
      row.classList.add("drag-over");
    });

    cardList.addEventListener("drop", (event) => {
      const row = event.target.closest(".card-row[draggable='true']");
      const deck = getDeck();
      if (!row || !deck || !ctx.state.dragCardId || row.dataset.cardId === ctx.state.dragCardId) return;

      event.preventDefault();

      const fromIndex = deck.cards.findIndex((card) => card.id === ctx.state.dragCardId);
      const toIndex = deck.cards.findIndex((card) => card.id === row.dataset.cardId);
      if (fromIndex === -1 || toIndex === -1) return;

      const [movedCard] = deck.cards.splice(fromIndex, 1);
      deck.cards.splice(toIndex, 0, movedCard);
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      render();
    });

    document.getElementById("renameDeckBtn").addEventListener("click", renameDeck);
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        renameDeck();
      }
    });

    document.getElementById("backFromEditDeckBtn").addEventListener("click", () => {
      ctx.libraryView.render();
      ctx.router.goTo("libraryScreen", "libraryScreen");
    });
    document.getElementById("editDeckCreateCardBtn").addEventListener("click", () => {
      ctx.cardFormView.open(ctx.state.editingDeckId, null, "editDeckScreen");
    });
    document.getElementById("editDeckAddFromOtherBtn").addEventListener("click", () => {
      openAddFromOther(ctx.state.editingDeckId);
    });
    document.getElementById("editDeckExportBtn").addEventListener("click", () => {
      const deck = getDeck();
      if (!deck) return;
      ctx.exportJson(createExportPayload([deck]), buildDeckExportFilename(deck.name));
    });
    document.getElementById("editDeckExportCsvBtn").addEventListener("click", () => {
      const deck = getDeck();
      if (!deck) return;
      ctx.exportCsv([deck], `karto-${ctx.slugify(deck.name)}.csv`);
    });
    document.getElementById("editDeckImportBtn").addEventListener("click", () => {
      const deck = getDeck();
      if (!deck) return;

      ctx.importJson((rawPayload) => {
        const result = prepareDeckImport(rawPayload, deck);
        if (!result.isValid) {
          ctx.toast.error(t("alerts.invalidFormat"));
          return;
        }

        deck.cards = deck.cards.concat(result.cards);
        ctx.store.saveDecksSoon();
        ctx.homeView.render();
        ctx.libraryView.render();
        render();

        ctx.toast.success(t("alerts.deckImportSummary", {
          added: result.cards.length,
          skipped: result.skippedCount
        }));
      });
    });
    searchInput.addEventListener("input", () => {
      render();
    });
    document.getElementById("selectAllCardsBtn").addEventListener("click", () => {
      const deck = getDeck();
      if (!deck) return;
      ctx.state.selectedCardIds = getFilteredCards(deck).map((card) => card.id);
      render();
    });
    document.getElementById("bulkDeleteBtn").addEventListener("click", deleteSelectedCards);
    document.getElementById("bulkMoveBtn").addEventListener("click", moveSelectedCards);
    document.getElementById("startDeckStudyBtn").addEventListener("click", () => {
      ctx.startStudy(ctx.state.editingDeckId, document.getElementById("studyModeSelect").value);
    });

    document.getElementById("sourceOtherDeckSelect").addEventListener("change", renderSourceCardList);
    document.getElementById("sourceCardList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action='copy-card']");
      if (!button) return;
      copyFromOtherDeck(button.dataset.cardId);
    });
    document.getElementById("backFromAddOtherBtn").addEventListener("click", () => {
      render();
      ctx.router.goTo("editDeckScreen", "libraryScreen");
    });

    return {
      open,
      render,
      renderSourceCardList,
      openAddFromOther
    };
  }

  Karto.createDeckEditorView = createDeckEditorView;
})(window);
