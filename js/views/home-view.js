(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createHomeView(ctx) {
    const grid = document.getElementById("deckGrid");
    const rotationStates = new Map();
    const reducedMotionQuery = typeof root.matchMedia === "function"
      ? root.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    let isActive = false;

    function prefersReducedMotion() {
      return !!reducedMotionQuery?.matches;
    }

    function randomIndex(length) {
      return length > 0 ? Math.floor(root.Math.random() * length) : 0;
    }

    function shuffle(values) {
      const copy = values.slice();

      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(root.Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
      }

      return copy;
    }

    function getDeckImages(deck) {
      const seen = new Set();

      return deck.cards
        .map((card) => String(card.image || "").trim())
        .filter((imageUrl) => {
          if (!imageUrl || seen.has(imageUrl)) {
            return false;
          }

          seen.add(imageUrl);
          return true;
        });
    }

    function buildRotationQueue(images, currentIndex) {
      return shuffle(images.map((_, index) => index).filter((index) => index !== currentIndex));
    }

    function stopRotation(state) {
      if (!state) return;

      if (state.timeoutId !== null) {
        root.clearTimeout(state.timeoutId);
        state.timeoutId = null;
      }

      if (state.transitionId !== null) {
        root.clearTimeout(state.transitionId);
        state.transitionId = null;
      }

      const activeImage = state.imageNodes.find((node) => node.classList.contains("is-active")) || state.activeImage;
      state.activeImage = activeImage;
      state.inactiveImage = state.imageNodes.find((node) => node !== activeImage) || state.inactiveImage;

      state.imageNodes.forEach((imageNode) => {
        if (imageNode === state.activeImage) {
          imageNode.classList.add("is-active");
          return;
        }

        imageNode.classList.remove("is-active");
        imageNode.removeAttribute("src");
      });
    }

    function clearRotationStates() {
      rotationStates.forEach(stopRotation);
      rotationStates.clear();
    }

    function scheduleRotation(state) {
      if (!isActive || prefersReducedMotion() || state.images.length < 2) {
        return;
      }

      state.timeoutId = root.setTimeout(() => {
        state.timeoutId = null;
        rotateToNextImage(state);
      }, 4500 + Math.floor(root.Math.random() * 2501));
    }

    function rotateToNextImage(state) {
      if (!isActive || prefersReducedMotion() || state.images.length < 2) {
        return;
      }

      if (!state.queue.length) {
        state.queue = buildRotationQueue(state.images, state.currentIndex);
      }

      const nextIndex = state.queue.shift();
      if (nextIndex === undefined || nextIndex === state.currentIndex) {
        scheduleRotation(state);
        return;
      }

      const outgoing = state.activeImage;
      const incoming = state.inactiveImage;

      incoming.classList.remove("is-active");
      incoming.src = state.images[nextIndex];
      incoming.alt = state.alt;

      root.requestAnimationFrame(() => {
        incoming.classList.add("is-active");
        outgoing.classList.remove("is-active");
      });

      state.transitionId = root.setTimeout(() => {
        state.transitionId = null;

        const previous = state.activeImage;
        state.activeImage = incoming;
        state.inactiveImage = previous;
        state.currentIndex = nextIndex;

        state.inactiveImage.classList.remove("is-active");
        state.inactiveImage.removeAttribute("src");

        scheduleRotation(state);
      }, 760);
    }

    function activate() {
      isActive = true;
      rotationStates.forEach((state) => {
        stopRotation(state);
        scheduleRotation(state);
      });
    }

    function deactivate() {
      isActive = false;
      rotationStates.forEach(stopRotation);
    }

    function createDeckMediaStage(deck, images) {
      const stage = createElement("div", {
        className: `deck-media-stage${images.length ? "" : " is-empty"}`,
        attrs: { "aria-hidden": "true" }
      });

      if (!images.length) {
        return stage;
      }

      const startIndex = randomIndex(images.length);
      const activeImage = createElement("img", {
        className: "deck-media-image is-active",
        attrs: {
          src: images[startIndex],
          alt: deck.name,
          loading: "lazy",
          decoding: "async"
        }
      });

      stage.appendChild(activeImage);

      if (images.length === 1 || prefersReducedMotion()) {
        return stage;
      }

      const inactiveImage = createElement("img", {
        className: "deck-media-image",
        attrs: {
          alt: deck.name,
          loading: "lazy",
          decoding: "async"
        }
      });

      stage.appendChild(inactiveImage);

      rotationStates.set(deck.id, {
        alt: deck.name,
        images,
        currentIndex: startIndex,
        queue: buildRotationQueue(images, startIndex),
        activeImage,
        inactiveImage,
        imageNodes: [activeImage, inactiveImage],
        timeoutId: null,
        transitionId: null
      });

      return stage;
    }

    function createDeckTile(deck) {
      const images = getDeckImages(deck);
      const tile = createElement("div", {
        className: `deck-tile${images.length ? "" : " deck-tile-no-image"}`,
        dataset: { deckId: deck.id }
      });

      tile.appendChild(createDeckMediaStage(deck, images));

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

    function applyGridPreference() {
      grid.dataset.columns = ctx.state.homeGridColumns || "auto";
    }

    function render() {
      clearRotationStates();
      clearElement(grid);
      applyGridPreference();

      ctx.state.decks.forEach((deck) => {
        grid.appendChild(createDeckTile(deck));
      });

      grid.appendChild(createCreateDeckTile());

      if (isActive) {
        activate();
      }
    }

    function handleReducedMotionChange() {
      render();
    }

    if (reducedMotionQuery) {
      if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
      } else if (typeof reducedMotionQuery.addListener === "function") {
        reducedMotionQuery.addListener(handleReducedMotionChange);
      }
    }

    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const deckId = button.dataset.deckId;

      switch (button.dataset.action) {
        case "study":
          ctx.startStudy(deckId);
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
          ctx.deckEditorView.openCreateDraft("homeScreen");
          break;
      }
    });

    return {
      activate,
      applyGridPreference,
      deactivate,
      render
    };
  }

  Karto.createHomeView = createHomeView;
})(window);
