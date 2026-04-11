(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createDeckEditorView(ctx) {
    const titleElement = document.getElementById("editDeckTitle");
    const cardList = document.getElementById("editDeckCardList");
    const createCardBtn = document.getElementById("editDeckCreateCardBtn");
    const addFromOtherBtn = document.getElementById("editDeckAddFromOtherBtn");
    const startStudyBtn = document.getElementById("startDeckStudyBtn");

    let isCreatingDeckDraft = false;
    let isRenamingDeck = false;
    let ignoreNextDeckNameBlur = false;
    let draftReturnScreen = "homeScreen";

    function getDeck() {
      return ctx.getDeckById(ctx.state.editingDeckId);
    }

    function getRenderableDeck() {
      if (isCreatingDeckDraft) {
        return {
          id: "",
          name: "",
          cards: []
        };
      }

      return getDeck();
    }

    function getAvailableTargetDecks() {
      return ctx.state.decks.filter((deck) => deck.id !== ctx.state.editingDeckId);
    }

    function isCurrentDeckCardId(cardId) {
      const deck = getDeck();
      return !!deck?.cards.some((card) => card.id === cardId);
    }

    function getActionCardIds(clickedCardId) {
      const deck = getDeck();
      if (!deck) return [];

      const deckIds = new Set(deck.cards.map((card) => card.id));
      const selectedIds = ctx.state.selectedCardIds.filter((cardId) => deckIds.has(cardId));
      if (selectedIds.length > 0) {
        return selectedIds;
      }

      return deckIds.has(clickedCardId) ? [clickedCardId] : [];
    }

    function closeInlineMoveMenu() {
      ctx.state.openMoveCardId = null;
      ctx.state.pendingMoveDeckId = "";
    }

    function closeEditor() {
      if (isCreatingDeckDraft) {
        isCreatingDeckDraft = false;
        isRenamingDeck = false;
        ignoreNextDeckNameBlur = false;
        ctx.state.editingDeckId = null;
        ctx.router.goTo(draftReturnScreen, ctx.navTargetForScreen(draftReturnScreen));
        return;
      }

      ctx.libraryView.render();
      ctx.router.goTo("libraryScreen", "libraryScreen");
    }

    function commitDeckName(value, options = {}) {
      const name = value.trim();

      if (!name) {
        if (options.force) {
          ctx.toast.error(t("alerts.enterName"));
        }
        return false;
      }

      if (isCreatingDeckDraft) {
        const deck = createDeck(name);
        ctx.state.decks.push(deck);
        ctx.state.editingDeckId = deck.id;
        isCreatingDeckDraft = false;
        isRenamingDeck = false;
        ctx.store.saveDecksSoon();
        ctx.homeView.render();
        ctx.libraryView.render();
        render();
        ctx.toast.success(t("alerts.deckCreated"));
        return true;
      }

      const deck = getDeck();
      if (!deck) return false;

      if (deck.name === name) {
        isRenamingDeck = false;
        render();
        return true;
      }

      deck.name = name;
      isRenamingDeck = false;
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      render();
      ctx.toast.success(t("alerts.deckNameSaved"));
      return true;
    }

    function cancelDeckRename() {
      if (isCreatingDeckDraft) {
        closeEditor();
        return;
      }

      isRenamingDeck = false;
      render();
    }

    function createDeckNameControl(deck) {
      const shouldShowInput = isCreatingDeckDraft || isRenamingDeck;

      if (shouldShowInput) {
        return createElement("input", {
          className: "form-input editdeck-title-input",
          value: deck.name,
          attrs: {
            type: "text",
            "data-deck-name-input": "true",
            "aria-label": t("actions.renameDeck"),
            placeholder: t("editDeck.namePlaceholder")
          },
          listeners: {
            keydown(event) {
              if (event.key === "Enter") {
                event.preventDefault();
                ignoreNextDeckNameBlur = true;
                commitDeckName(event.currentTarget.value, { force: true });
              }

              if (event.key === "Escape") {
                event.preventDefault();
                ignoreNextDeckNameBlur = true;
                cancelDeckRename();
              }
            },
            blur(event) {
              if (ignoreNextDeckNameBlur) {
                ignoreNextDeckNameBlur = false;
                return;
              }

              if (isCreatingDeckDraft && !event.currentTarget.value.trim()) {
                return;
              }

              commitDeckName(event.currentTarget.value);
            }
          }
        });
      }

      return createElement("button", {
        className: "editdeck-title-btn",
        text: deck.name,
        attrs: {
          type: "button",
          "aria-label": t("actions.renameDeck"),
          title: t("actions.renameDeck")
        },
        listeners: {
          click() {
            isRenamingDeck = true;
            render();
          }
        }
      });
    }

    function renderDeckTitle(deck) {
      clearElement(titleElement);
      titleElement.appendChild(createDeckNameControl(deck));

      if (isCreatingDeckDraft || isRenamingDeck) {
        root.requestAnimationFrame(() => {
          const input = titleElement.querySelector("[data-deck-name-input='true']");
          if (!input) return;
          input.focus();
          input.select();
        });
      }
    }

    function syncToolbarState() {
      const isDraft = isCreatingDeckDraft;
      [createCardBtn, addFromOtherBtn, startStudyBtn].forEach((button) => {
        button.disabled = isDraft;
      });
    }

    function openInlineMoveMenu(cardId) {
      const targetDecks = getAvailableTargetDecks();
      if (targetDecks.length === 0) {
        ctx.toast.error(t("alerts.noOtherDecks"));
        return;
      }

      ctx.state.openMoveCardId = cardId;
      ctx.state.pendingMoveDeckId = targetDecks[0].id;
      render();
    }

    function updateInlineMoveTarget(deckId) {
      ctx.state.pendingMoveDeckId = deckId;
    }

    function createInlineMoveMenu(cardId) {
      return createElement("div", {
        className: "card-row-inline-move",
        children: [
          createElement("select", {
            className: "form-input card-row-move-select",
            attrs: {
              "data-action": "select-move-deck",
              "data-card-id": cardId,
              "aria-label": t("editDeck.moveToDeckLabel")
            },
            children: getAvailableTargetDecks().map((deck) => createElement("option", {
              value: deck.id,
              text: deck.name,
              properties: {
                selected: deck.id === ctx.state.pendingMoveDeckId
              }
            }))
          }),
          createElement("button", {
            className: "lib-btn",
            text: t("editDeck.moveConfirm"),
            attrs: {
              type: "button",
              "data-action": "confirm-move-card",
              "data-card-id": cardId
            },
            properties: {
              disabled: !ctx.state.pendingMoveDeckId
            }
          }),
          createElement("button", {
            className: "lib-btn",
            text: t("editDeck.moveCancel"),
            attrs: {
              type: "button",
              "data-action": "cancel-move-card",
              "data-card-id": cardId
            }
          })
        ]
      });
    }

    function createCardRow(card) {
      const isSelected = ctx.state.selectedCardIds.includes(card.id);
      const isMoveMenuOpen = ctx.state.openMoveCardId === card.id;
      const canMoveToOtherDeck = getAvailableTargetDecks().length > 0;

      return createElement("div", {
        className: `card-row${isSelected ? " is-selected" : ""}`,
        dataset: { cardId: card.id },
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
                className: "icon-btn icon-btn-accent",
                children: [createElement("span", { text: "✎", attrs: { "aria-hidden": "true" } })],
                attrs: {
                  type: "button",
                  "data-action": "edit-card",
                  "data-card-id": card.id,
                  "aria-label": t("actions.editCard"),
                  title: t("actions.editCard")
                }
              }),
              createElement("button", {
                className: "icon-btn",
                children: [createIcon("moveCard")],
                attrs: {
                  type: "button",
                  "data-action": "open-move-card",
                  "data-card-id": card.id,
                  "aria-label": t("actions.moveCard"),
                  title: t("actions.moveCard")
                },
                properties: {
                  disabled: !canMoveToOtherDeck
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
          }),
          isMoveMenuOpen ? createInlineMoveMenu(card.id) : null
        ]
      });
    }

    function moveCards(cardIds, targetDeckId) {
      const deck = getDeck();
      const targetDeck = ctx.getDeckById(targetDeckId);
      if (!deck || !targetDeck) {
        return null;
      }

      const deckIds = new Set(deck.cards.map((card) => card.id));
      const actionCardIds = cardIds.filter((cardId) => deckIds.has(cardId));
      if (actionCardIds.length === 0) {
        return null;
      }

      const result = moveCardsBetweenDecks(deck, targetDeck, actionCardIds);
      if (!result.isValid) {
        return null;
      }

      const actionIdSet = new Set(actionCardIds);
      ctx.state.selectedCardIds = ctx.state.selectedCardIds.filter((cardId) => {
        return !actionIdSet.has(cardId);
      });

      if (result.movedCardIds.length > 0) {
        ctx.store.saveDecksSoon();
        ctx.homeView.render();
        ctx.libraryView.render();
      }

      return {
        ...result,
        targetDeck,
        actionCount: actionCardIds.length
      };
    }

    function moveCardsFromRow(cardId) {
      const result = moveCards(getActionCardIds(cardId), ctx.state.pendingMoveDeckId);
      closeInlineMoveMenu();
      render();

      if (!result) {
        return;
      }

      if (result.actionCount === 1 && result.cards.length > 0) {
        ctx.toast.success(t("alerts.cardMoved", { deckName: result.targetDeck.name }));
        return;
      }

      if (result.actionCount === 1 && result.skippedCount > 0) {
        ctx.toast.info(t("alerts.cardMoveSkipped", { deckName: result.targetDeck.name }));
        return;
      }

      const toastMethod = result.cards.length > 0 ? "success" : "info";
      ctx.toast[toastMethod](t("alerts.cardsMoved", {
        added: result.cards.length,
        skipped: result.skippedCount
      }));
    }

    function deleteCardsFromRow(cardId) {
      const deck = getDeck();
      const actionCardIds = getActionCardIds(cardId);
      if (!deck || actionCardIds.length === 0) return;

      const actionIdSet = new Set(actionCardIds);
      const removedCount = deck.cards.filter((card) => actionIdSet.has(card.id)).length;
      if (removedCount === 0) return;

      const snapshot = ctx.store.createSnapshot();
      deck.cards = deck.cards.filter((card) => !actionIdSet.has(card.id));
      ctx.state.selectedCardIds = ctx.state.selectedCardIds.filter((id) => !actionIdSet.has(id));
      closeInlineMoveMenu();
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      render();

      ctx.toast.info(
        removedCount === 1
          ? t("alerts.cardDeleted")
          : t("alerts.cardsDeleted", { count: removedCount }),
        {
          actionLabel: t("common.undo"),
          duration: 6000,
          onAction: () => {
            ctx.restoreSnapshot(snapshot);
          }
        }
      );
    }

    function syncInlineMoveState(deck) {
      if (!deck) {
        closeInlineMoveMenu();
        return;
      }

      if (ctx.state.openMoveCardId && !deck.cards.some((card) => card.id === ctx.state.openMoveCardId)) {
        closeInlineMoveMenu();
        return;
      }

      if (
        ctx.state.openMoveCardId &&
        ctx.state.pendingMoveDeckId &&
        !getAvailableTargetDecks().some((targetDeck) => targetDeck.id === ctx.state.pendingMoveDeckId)
      ) {
        ctx.state.pendingMoveDeckId = "";
      }
    }

    function render() {
      const deck = getRenderableDeck();
      if (!deck) return;

      syncToolbarState();
      renderDeckTitle(deck);
      clearElement(cardList);

      if (isCreatingDeckDraft) {
        cardList.appendChild(ctx.createEmptyMessage(t("editDeck.draftHint")));
        return;
      }

      syncInlineMoveState(deck);

      if (deck.cards.length === 0) {
        cardList.appendChild(ctx.createEmptyMessage(t("editDeck.empty")));
        return;
      }

      deck.cards.forEach((card) => {
        cardList.appendChild(createCardRow(card));
      });
    }

    function open(deckId) {
      const deck = ctx.getDeckById(deckId);
      if (!deck) return;

      isCreatingDeckDraft = false;
      isRenamingDeck = false;
      ignoreNextDeckNameBlur = false;
      ctx.state.editingDeckId = deckId;
      ctx.state.selectedCardIds = [];
      closeInlineMoveMenu();
      render();
      ctx.router.goTo("editDeckScreen", "libraryScreen");
    }

    function openCreateDraft(returnScreen = "homeScreen") {
      isCreatingDeckDraft = true;
      isRenamingDeck = true;
      ignoreNextDeckNameBlur = false;
      draftReturnScreen = returnScreen;
      ctx.state.editingDeckId = null;
      ctx.state.selectedCardIds = [];
      closeInlineMoveMenu();
      render();
      ctx.router.goTo("editDeckScreen", ctx.navTargetForScreen(returnScreen));
    }

    function toggleSelection(cardId) {
      if (!isCurrentDeckCardId(cardId)) return;

      if (ctx.state.selectedCardIds.includes(cardId)) {
        ctx.state.selectedCardIds = ctx.state.selectedCardIds.filter((id) => id !== cardId);
      } else {
        ctx.state.selectedCardIds = ctx.state.selectedCardIds.concat(cardId);
      }

      render();
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

      if (button.dataset.action === "open-move-card") {
        if (ctx.state.openMoveCardId === cardId) {
          closeInlineMoveMenu();
          render();
        } else {
          openInlineMoveMenu(cardId);
        }
      }

      if (button.dataset.action === "confirm-move-card") {
        moveCardsFromRow(cardId);
      }

      if (button.dataset.action === "cancel-move-card") {
        closeInlineMoveMenu();
        render();
      }

      if (button.dataset.action === "edit-card") {
        ctx.cardFormView.open(deck.id, cardId, "editDeckScreen");
      }

      if (button.dataset.action === "delete-card") {
        deleteCardsFromRow(cardId);
      }
    });

    cardList.addEventListener("change", (event) => {
      const select = event.target.closest("[data-action='select-move-deck']");
      if (!select) return;

      updateInlineMoveTarget(select.value);
    });

    document.getElementById("closeEditDeckBtn").addEventListener("click", closeEditor);
    createCardBtn.addEventListener("click", () => {
      ctx.cardFormView.open(ctx.state.editingDeckId, null, "editDeckScreen");
    });
    addFromOtherBtn.addEventListener("click", () => {
      openAddFromOther(ctx.state.editingDeckId);
    });
    startStudyBtn.addEventListener("click", () => {
      ctx.startStudy(ctx.state.editingDeckId);
    });

    document.getElementById("sourceOtherDeckSelect").addEventListener("change", renderSourceCardList);
    document.getElementById("sourceCardList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action='copy-card']");
      if (!button) return;
      copyFromOtherDeck(button.dataset.cardId);
    });
    document.getElementById("closeAddOtherBtn").addEventListener("click", () => {
      render();
      ctx.router.goTo("editDeckScreen", "libraryScreen");
    });

    return {
      open,
      openCreateDraft,
      render,
      renderSourceCardList,
      openAddFromOther
    };
  }

  Karto.createDeckEditorView = createDeckEditorView;
})(window);
