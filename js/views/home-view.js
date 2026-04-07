(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createHomeView(ctx) {
    const grid = document.getElementById("deckGrid");

    function createDeckTile(deck) {
      const previewCard = deck.cards.find((card) => card.image);
      const tile = createElement("div", {
        className: "deck-tile",
        dataset: { deckId: deck.id }
      });

      if (previewCard) {
        tile.appendChild(
          createElement("img", {
            attrs: {
              src: previewCard.image,
              alt: deck.name
            }
          })
        );
      }

      tile.appendChild(createElement("div", {
        className: "deck-overlay",
        attrs: { "aria-hidden": "true" }
      }));

      const surface = createElement("button", {
        className: "deck-tile-surface",
        attrs: {
          type: "button",
          "data-action": "study",
          "data-deck-id": deck.id,
          "aria-label": `${deck.name}`
        }
      });

      const footer = createElement("div", { className: "deck-tile-footer" });
      footer.append(
        createElement("div", { className: "deck-tile-name", text: deck.name }),
        createElement("div", {
          className: "deck-tile-count",
          text: ctx.cardCount(deck.cards.length)
        })
      );

      const actionBar = createElement("div", { className: "tile-action-bar" });
      const leftGroup = createElement("div", { className: "tile-action-group" });
      const rightGroup = createElement("div", { className: "tile-action-group" });

      leftGroup.appendChild(
        createElement("button", {
          className: "tile-action",
          children: [createElement("span", { text: "+", attrs: { "aria-hidden": "true" } })],
          attrs: {
            type: "button",
            "data-action": "add-card",
            "data-deck-id": deck.id,
            "aria-label": t("cardForm.addCard"),
            title: t("cardForm.addCard")
          }
        })
      );

      rightGroup.append(
        createElement("button", {
          className: "tile-action",
          children: [createElement("span", { text: "✎", attrs: { "aria-hidden": "true" } })],
          attrs: {
            type: "button",
            "data-action": "edit-deck",
            "data-deck-id": deck.id,
            "aria-label": t("actions.edit"),
            title: t("actions.edit")
          }
        }),
        createElement("button", {
          className: "tile-action",
          children: [createElement("span", { text: "✕", attrs: { "aria-hidden": "true" } })],
          attrs: {
            type: "button",
            "data-action": "delete-deck",
            "data-deck-id": deck.id,
            "aria-label": t("actions.delete"),
            title: t("actions.delete")
          }
        })
      );

      actionBar.append(leftGroup, rightGroup);
      tile.append(surface, footer, actionBar);
      return tile;
    }

    function createCreateDeckTile() {
      return createElement("button", {
        className: "create-tile",
        attrs: {
          type: "button",
          "data-action": "create-deck",
          "aria-label": t("home.createDeck")
        },
        children: [
          createElement("div", {
            className: "create-tile-inner",
            children: [
              createElement("div", {
                className: "create-plus",
                text: "+",
                attrs: { "aria-hidden": "true" }
              }),
              createElement("div", {
                className: "create-text",
                text: t("home.createDeck")
              })
            ]
          })
        ]
      });
    }

    function render() {
      clearElement(grid);

      ctx.state.decks.forEach((deck) => {
        grid.appendChild(createDeckTile(deck));
      });

      grid.appendChild(createCreateDeckTile());
    }

    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const deckId = button.dataset.deckId;

      switch (button.dataset.action) {
        case "study":
          ctx.startStudy(deckId, "all");
          break;
        case "edit-deck":
          ctx.deckEditorView.open(deckId);
          break;
        case "add-card":
          ctx.cardFormView.open(deckId, null, "homeScreen");
          break;
        case "delete-deck":
          ctx.deleteDeckWithUndo(deckId);
          break;
        case "create-deck":
          ctx.libraryView.openCreateDeck("homeScreen");
          break;
      }
    });

    return {
      render
    };
  }

  Karto.createHomeView = createHomeView;
})(window);
