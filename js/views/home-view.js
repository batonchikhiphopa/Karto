(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createHomeView(ctx) {
    const grid = document.getElementById("deckGrid");
    const rotationStates = new Map();
    const tileRecords = new Map();
    const imagePreloadCache = new Map();
    const pendingThumbs = new Set();
    const reducedMotionQuery = typeof root.matchMedia === "function"
      ? root.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    let createTileNode = null;
    let isActive = false;
    let reducedMotionMode = prefersReducedMotion();

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

    function normalizeImageSource(value) {
      return Karto.normalizeImageSource?.(value) || (typeof value === "string" ? value.trim() : "");
    }

    function arraysEqual(left, right) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }

      return left.every((value, index) => value === right[index]);
    }

    function createDeckMediaSignature(deck) {
      const cardPart = (Array.isArray(deck?.cards) ? deck.cards : [])
        .map((card) => [
          typeof card?.id === "string" ? card.id : "",
          normalizeImageSource(card?.image),
          normalizeImageSource(card?.imageThumb),
          card?.imageSide === "front" ? "front" : "back"
        ].join("\u241f"))
        .join("\u241e");

      return `${typeof deck?.id === "string" ? deck.id : ""}\u241d${cardPart}`;
    }

    function queueDataImageThumbnail(card, imageUrl) {
      if (!card || !Karto.isDataImageUrl?.(imageUrl) || typeof Karto.createDataImageThumbnail !== "function") {
        return;
      }

      const key = `${card.id || ""}:${imageUrl.slice(0, 80)}`;
      if (pendingThumbs.has(key)) {
        return;
      }

      pendingThumbs.add(key);
      Karto.createDataImageThumbnail(imageUrl)
        .then((imageThumb) => {
          pendingThumbs.delete(key);
          if (!imageThumb || normalizeImageSource(card.image) !== imageUrl || normalizeImageSource(card.imageThumb)) {
            return;
          }

          card.imageThumb = imageThumb;
          ctx.store.saveDecksSoon();
          if (isActive) {
            render();
          }
        })
        .catch(() => {
          pendingThumbs.delete(key);
        });
    }

    function resolveCardTileImage(card) {
      const storedThumb = normalizeImageSource(card.imageThumb);
      if (storedThumb) {
        return { imageUrl: storedThumb, didUpdate: false };
      }

      const imageUrl = normalizeImageSource(card?.image);
      if (!imageUrl) {
        return { imageUrl: "", didUpdate: false };
      }

      const derivedThumb = Karto.deriveTileImageUrl?.(imageUrl) || "";
      if (derivedThumb) {
        card.imageThumb = derivedThumb;
        return { imageUrl: derivedThumb, didUpdate: true };
      }

      queueDataImageThumbnail(card, imageUrl);
      return { imageUrl, didUpdate: false };
    }

    function buildDeckMedia(deck) {
      const initialSignature = createDeckMediaSignature(deck);
      const cachedEntry = ctx.store.getHomeMediaCacheEntry?.(deck.id);
      if (cachedEntry?.signature === initialSignature) {
        return {
          signature: initialSignature,
          images: cachedEntry.images
        };
      }

      const seen = new Set();
      let didUpdateCards = false;
      const images = deck.cards
        .map((card) => {
          const result = resolveCardTileImage(card);
          didUpdateCards = didUpdateCards || result.didUpdate;
          return result.imageUrl;
        })
        .filter((imageUrl) => {
          if (!imageUrl || seen.has(imageUrl)) {
            return false;
          }

          seen.add(imageUrl);
          return true;
        });
      const signature = didUpdateCards ? createDeckMediaSignature(deck) : initialSignature;
      const nextEntry = {
        signature,
        images,
        updatedAt: new Date().toISOString()
      };
      const latestEntry = ctx.store.getHomeMediaCacheEntry?.(deck.id);

      if (!latestEntry || latestEntry.signature !== signature || !arraysEqual(latestEntry.images, images)) {
        ctx.store.setHomeMediaCacheEntry?.(deck.id, nextEntry);
      }

      if (didUpdateCards) {
        ctx.store.saveDecksSoon();
      }

      return {
        signature,
        images
      };
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
      state.rotationToken += 1;

      state.imageNodes.forEach((imageNode) => {
        if (imageNode === state.activeImage) {
          imageNode.classList.add("is-active");
          return;
        }

        imageNode.classList.remove("is-active");
      });
    }

    function stopDeckRotation(deckId) {
      const state = rotationStates.get(deckId);
      stopRotation(state);
      rotationStates.delete(deckId);
    }

    function resetRenderedTiles() {
      tileRecords.forEach((record, deckId) => {
        stopDeckRotation(deckId);
        record.tile.remove();
      });
      tileRecords.clear();
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

    function preloadTileImage(url) {
      const imageUrl = normalizeImageSource(url);
      if (!imageUrl) {
        return Promise.reject(new Error("Image source is empty."));
      }

      const cached = imagePreloadCache.get(imageUrl);
      if (cached?.status === "loaded") {
        return Promise.resolve(imageUrl);
      }

      if (cached?.status === "loading") {
        return cached.promise;
      }

      if (cached?.status === "error") {
        return Promise.reject(new Error("Image previously failed to preload."));
      }

      const promise = (typeof Karto.loadImage === "function"
        ? Karto.loadImage(imageUrl)
        : Promise.resolve()
      ).then(() => {
        imagePreloadCache.set(imageUrl, {
          status: "loaded",
          promise: Promise.resolve(imageUrl)
        });
        return imageUrl;
      }).catch((error) => {
        imagePreloadCache.set(imageUrl, {
          status: "error",
          promise: null
        });
        throw error;
      });

      imagePreloadCache.set(imageUrl, { status: "loading", promise });
      return promise;
    }

    function rotateToNextImage(state, attempts = 0) {
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

      const nextImageUrl = state.images[nextIndex];
      const rotationToken = state.rotationToken + 1;
      state.rotationToken = rotationToken;

      preloadTileImage(nextImageUrl)
        .then(() => {
          if (!isActive || state.rotationToken !== rotationToken) {
            return;
          }

          const outgoing = state.activeImage;
          const incoming = state.inactiveImage;

          incoming.classList.remove("is-active");
          if (incoming.getAttribute("src") !== nextImageUrl) {
            incoming.src = nextImageUrl;
          }
          incoming.alt = state.alt;

          root.requestAnimationFrame(() => {
            if (state.rotationToken !== rotationToken) {
              return;
            }

            incoming.classList.add("is-active");
            outgoing.classList.remove("is-active");
          });

          state.transitionId = root.setTimeout(() => {
            state.transitionId = null;
            if (state.rotationToken !== rotationToken) {
              return;
            }

            const previous = state.activeImage;
            state.activeImage = incoming;
            state.inactiveImage = previous;
            state.currentIndex = nextIndex;

            state.inactiveImage.classList.remove("is-active");

            scheduleRotation(state);
          }, 760);
        })
        .catch(() => {
          if (!isActive || state.rotationToken !== rotationToken) {
            return;
          }

          if (attempts < state.images.length - 1) {
            rotateToNextImage(state, attempts + 1);
            return;
          }

          scheduleRotation(state);
        });
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

    function createDeckMediaStage(deck, media) {
      const images = media.images;
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
          loading: "eager",
          fetchpriority: "high",
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
        rotationToken: 0,
        timeoutId: null,
        transitionId: null
      });

      return stage;
    }

    function updateDeckTileContent(tile, deck, media) {
      tile.classList.toggle("deck-tile-no-image", media.images.length === 0);
      tile.dataset.deckId = deck.id;

      tile.querySelectorAll("[data-deck-id]").forEach((node) => {
        node.dataset.deckId = deck.id;
      });

      const surface = tile.querySelector("[data-action='study']");
      if (surface) {
        surface.setAttribute("aria-label", deck.name);
      }

      const name = tile.querySelector(".deck-tile-name");
      if (name) {
        name.textContent = deck.name;
      }

      const count = tile.querySelector(".deck-tile-count");
      if (count) {
        count.textContent = ctx.cardCount(ctx.getDeckCardCount(deck));
      }

      const rotationState = rotationStates.get(deck.id);
      if (rotationState) {
        rotationState.alt = deck.name;
      }
    }

    function createDeckTile(deck, media) {
      const tile = createElement("div", {
        className: `deck-tile${media.images.length ? "" : " deck-tile-no-image"}`,
        dataset: { deckId: deck.id }
      });

      tile.appendChild(createDeckMediaStage(deck, media));

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
          text: ctx.cardCount(ctx.getDeckCardCount(deck))
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

    function renderDeckTile(deck, media) {
      const existingRecord = tileRecords.get(deck.id);
      if (existingRecord?.mediaSignature === media.signature) {
        updateDeckTileContent(existingRecord.tile, deck, media);
        grid.appendChild(existingRecord.tile);
        return;
      }

      stopDeckRotation(deck.id);

      const tile = createDeckTile(deck, media);
      const nextRecord = {
        tile,
        mediaSignature: media.signature
      };

      if (existingRecord?.tile.isConnected) {
        existingRecord.tile.replaceWith(tile);
      } else {
        grid.appendChild(tile);
      }

      tileRecords.set(deck.id, nextRecord);
    }

    function render() {
      applyGridPreference();

      if (prefersReducedMotion() !== reducedMotionMode) {
        reducedMotionMode = prefersReducedMotion();
        resetRenderedTiles();
      }

      const validDeckIds = new Set();

      ctx.state.decks.forEach((deck) => {
        validDeckIds.add(deck.id);
        renderDeckTile(deck, buildDeckMedia(deck));
      });

      tileRecords.forEach((record, deckId) => {
        if (validDeckIds.has(deckId)) {
          return;
        }

        stopDeckRotation(deckId);
        record.tile.remove();
        tileRecords.delete(deckId);
      });

      ctx.store.pruneHomeMediaCache?.(validDeckIds);

      if (!createTileNode) {
        createTileNode = createCreateDeckTile();
      }

      grid.appendChild(createTileNode);

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
