(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createStudyView(ctx) {
    const wrap = document.getElementById("studyWrap");
    const cardElement = document.getElementById("studyCard");
    const imageMetaCache = new Map();
    const WARM_AHEAD_COUNT = 5;
    let resizeFrameId = null;

    function hasPendingAnswer() {
      return !!ctx.state.study.pendingAnswer;
    }

    function resetLabels() {
      ["wrongLabel", "correctLabel", "unsureLabel", "backLabel"].forEach((id) => {
        const label = document.getElementById(id);
        if (label) {
          label.classList.remove("visible");
        }
      });
    }

    function resetGlow() {
      wrap.style.setProperty("--left-glow", "0");
      wrap.style.setProperty("--right-glow", "0");
      wrap.style.setProperty("--bottom-glow", "0");
      wrap.style.setProperty("--top-glow", "0");
      resetLabels();
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getCurrentSide() {
      return ctx.state.study.flipped ? "back" : "front";
    }

    function getCurrentText(card) {
      return ctx.state.study.flipped ? card.backText : card.frontText;
    }

    function getCurrentImage(card, currentSide) {
      if (!card?.image) {
        return null;
      }

      return (card.imageSide || "back") === currentSide ? card.image : null;
    }

    function isLongStudyText(text) {
      const normalizedText = String(text || "").trim();
      const lineBreaks = (normalizedText.match(/\n/g) || []).length;
      return normalizedText.length > 120 || lineBreaks >= 2;
    }

    function renderIfCurrentImage(url) {
      const currentCard = getCurrentStudyCard(ctx.state.study);
      if (!currentCard || currentCard.image !== url || !ctx.router.isVisible("studyScreen")) {
        return;
      }

      render();
    }

    function ensureImageMeta(url) {
      if (!url) return null;

      const cached = imageMetaCache.get(url);
      if (cached) {
        return cached;
      }

      let resolveEntryPromise = null;
      const entry = {
        status: "loading",
        aspectRatio: null,
        promise: new Promise((resolve) => {
          resolveEntryPromise = resolve;
        })
      };

      imageMetaCache.set(url, entry);

      const probe = new Image();
      probe.addEventListener("load", async () => {
        try {
          if (typeof probe.decode === "function") {
            await probe.decode();
          }
        } catch (e) {
          // игнорируем, decode может падать
        }

        entry.status = "loaded";
        entry.aspectRatio = probe.naturalWidth && probe.naturalHeight
          ? probe.naturalWidth / probe.naturalHeight
          : 1;

        resolveEntryPromise(entry);
        renderIfCurrentImage(url);
      }, { once: true });
      probe.addEventListener("error", () => {
        entry.status = "error";
        entry.aspectRatio = null;
        resolveEntryPromise(entry);
        renderIfCurrentImage(url);
      }, { once: true });
      probe.decoding = "async";
      probe.src = url;

      return entry;
    }

    function getWarmImageUrls(limitAhead = WARM_AHEAD_COUNT) {
      const queue = Array.isArray(ctx.state.study.queue) ? ctx.state.study.queue : [];
      if (queue.length === 0) {
        return [];
      }

      const urls = [];
      const seenUrls = new Set();
      const targetCount = limitAhead + 1;

      for (let offset = 0; offset < queue.length && urls.length < targetCount; offset += 1) {
        const index = (ctx.state.study.currentIndex + offset) % queue.length;
        const card = queue[index];
        const url = typeof card?.image === "string" ? card.image.trim() : "";
        if (!url || seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
        urls.push(url);
      }

      return urls;
    }

    function warmUpcomingImages() {
      getWarmImageUrls().forEach((url) => {
        ensureImageMeta(url);
      });
    }

    function isWaitingForCurrentImage() {
      const currentCard = getCurrentStudyCard(ctx.state.study);
      if (!currentCard) {
        return false;
      }

      const imageUrl = getCurrentImage(currentCard, getCurrentSide());
      if (!imageUrl) {
        return false;
      }

      const meta = ensureImageMeta(imageUrl);
      return meta?.status === "loading";
    }

    function resolveMediaLayout(currentSide, text, imageUrl) {
      if (!imageUrl) {
        return "text-only";
      }

      if (currentSide === "front") {
        ensureImageMeta(imageUrl);
        return "top";
      }

      if (root.innerWidth < 960) {
        ensureImageMeta(imageUrl);
        return "top";
      }

      const meta = ensureImageMeta(imageUrl);
      if (!meta || meta.status !== "loaded" || typeof meta.aspectRatio !== "number") {
        return "top";
      }

      if (meta.aspectRatio < 1.05) {
        return "top";
      }

      return isLongStudyText(text) ? "side" : "top";
    }

    function finishSession() {
      if (!ctx.state.study.session) {
        return;
      }

      ctx.store.recordStudySession({
        deckId: ctx.state.study.session.deckId,
        deckName: ctx.state.study.session.deckName,
        completedRounds: ctx.state.study.sessionCompletedRounds || 0,
        finishedAt: new Date().toISOString()
      });
    }

    function render() {
      const card = getCurrentStudyCard(ctx.state.study);
      const currentSide = getCurrentSide();

      cardElement.classList.remove("is-flipped", "has-media", "is-layout-top", "is-layout-side", "is-loading-media");
      cardElement.setAttribute("aria-busy", "false");

      if (!card) {
        clearElement(cardElement);
        cardElement.textContent = t("study.emptyQueue");
        return;
      }

      warmUpcomingImages();

      const text = getCurrentText(card);
      const imageUrl = getCurrentImage(card, currentSide);
      const imageMeta = imageUrl ? ensureImageMeta(imageUrl) : null;
      const isWaitingForImage = !!imageUrl && imageMeta?.status === "loading";
      const layout = resolveMediaLayout(currentSide, text, imageUrl);

      clearElement(cardElement);
      cardElement.classList.toggle("is-flipped", ctx.state.study.flipped);
      cardElement.classList.toggle("has-media", !!imageUrl);
      cardElement.classList.toggle("is-layout-top", layout === "top");
      cardElement.classList.toggle("is-layout-side", layout === "side");

      if (isWaitingForImage) {
        cardElement.classList.add("is-loading-media", "is-layout-top");
        cardElement.setAttribute("aria-busy", "true");
        cardElement.appendChild(createElement("div", {
          className: "study-card-loading",
          children: [
            createElement("div", {
              className: "study-card-loading-spinner",
              attrs: { "aria-hidden": "true" }
            }),
            createElement("div", {
              className: "study-card-loading-text",
              text: t("common.loading")
            })
          ]
        }));
        resetLabels();
        return;
      }

      const content = createElement("div", {
        className:
          layout === "side" ? "study-card-content is-side" :
          layout === "top" ? "study-card-content is-top" :
          "study-card-content is-text-only"
      });

      if (imageUrl) {
        content.appendChild(createElement("div", {
          className: "study-card-media",
          children: [
            createElement("img", {
              className: "study-card-img",
              attrs: {
                src: imageUrl,
                alt: card.frontText || text || "Study image",
                decoding: "async"
              }
            })
          ]
        }));
      }

      content.appendChild(createElement("div", {
        className: "study-card-copy",
        children: [
          createElement("div", {
            className: `${ctx.state.study.flipped ? "study-back-text" : "study-front-text"}${imageUrl ? " has-media" : ""}`,
            text
          })
        ]
      }));

      cardElement.appendChild(content);

      resetLabels();
    }

    function start(deckId) {
      const deck = ctx.getDeckById(deckId);
      if (!deck || deck.cards.length === 0) {
        ctx.toast.error(t("alerts.emptyDeckStudy"));
        return;
      }

      ctx.state.studyMode = "all";
      ctx.state.study = createStudyState({ cards: deck.cards }, Math.random, {
        completedRounds: ctx.store.getCompletedRoundsForDeck(deckId)
      });
      ctx.state.study.mode = "all";
      ctx.state.study.session = {
        deckId,
        deckName: deck.name,
        mode: "all",
        reviewed: 0,
        correct: 0,
        wrong: 0,
        unsure: 0
      };

      warmUpcomingImages();
      ctx.router.goTo("studyScreen", null);
      render();
      resetGlow();
      cardElement.focus();
    }

    function recordAnswer(cardId, result) {
      ctx.state.study.session.reviewed += 1;
      ctx.state.study.session[result] += 1;
      ctx.store.recordStudyAnswer(cardId, result);
    }

    function finalizeAnswer(result) {
      const card = getCurrentStudyCard(ctx.state.study);
      if (!card) return;

      recordAnswer(card.id, result);
      advanceStudy(ctx.state.study, result);
      if (isWaitingForCurrentImage()) {
        render();
        return;
      }
      render();
      resetGlow();
    }

    function finalizePendingAnswer() {
      const card = getCurrentStudyCard(ctx.state.study);
      const committedAnswer = commitPendingStudyAnswer(ctx.state.study);
      if (!card || !committedAnswer) {
        return false;
      }

      recordAnswer(card.id, committedAnswer.result);
      render();
      resetGlow();
      return true;
    }

    function answer(result) {
      if (!getCurrentStudyCard(ctx.state.study) || isWaitingForCurrentImage()) {
        return;
      }

      if (hasPendingAnswer()) {
        finalizeAnswer(result);
        return;
      }

      if (result === "correct" || ctx.state.study.flipped) {
        finalizeAnswer(result);
        return;
      }

      if (queuePendingStudyAnswer(ctx.state.study, result)) {
        render();
        resetGlow();
      }
    }

    function handleCardAction() {
      if (!ctx.state.study.queue.length || isWaitingForCurrentImage()) return;

      if (hasPendingAnswer()) {
        finalizePendingAnswer();
        return;
      }

      ctx.state.study.flipped = !ctx.state.study.flipped;
      render();
      resetGlow();
    }

    function goBack() {
      if (!ctx.state.study.queue.length || isWaitingForCurrentImage()) return;

      if (cancelPendingStudyAnswer(ctx.state.study)) {
        render();
        resetGlow();
        return;
      }

      if (ctx.state.study.flipped) {
        ctx.state.study.flipped = false;
        render();
        resetGlow();
        return;
      }

      resetGlow();
    }

    function exitStudy() {
      finishSession();
      ctx.settingsView.render();
      ctx.router.goTo("homeScreen", "homeScreen");
      resetGlow();
    }

    cardElement.addEventListener("click", handleCardAction);

    document.getElementById("wrongZone").addEventListener("click", () => {
      answer("wrong");
    });
    document.getElementById("correctZone").addEventListener("click", () => {
      answer("correct");
    });
    document.getElementById("unsureZone").addEventListener("click", () => {
      answer("unsure");
    });
    document.getElementById("backZone").addEventListener("click", goBack);
    document.getElementById("exitStudyBtn").addEventListener("click", exitStudy);

    root.addEventListener("mousemove", (event) => {
      if (!ctx.router.isVisible("studyScreen")) return;

      const width = root.innerWidth;
      const height = root.innerHeight;
      const edge = 200;

      const left = (1 - clamp(event.clientX / edge, 0, 1)) * 1;
      const right = (1 - clamp((width - event.clientX) / edge, 0, 1)) * 1;
      const bottom = (1 - clamp((height - event.clientY) / edge, 0, 1)) * 1;
      const top = (1 - clamp(event.clientY / edge, 0, 1)) * 1;

      wrap.style.setProperty("--left-glow", left.toFixed(3));
      wrap.style.setProperty("--right-glow", right.toFixed(3));
      wrap.style.setProperty("--bottom-glow", bottom.toFixed(3));
      wrap.style.setProperty("--top-glow", top.toFixed(3));

      document.getElementById("wrongLabel").classList.toggle("visible", left > 0.2);
      document.getElementById("correctLabel").classList.toggle("visible", right > 0.2);
      document.getElementById("unsureLabel").classList.toggle("visible", bottom > 0.2);
      document.getElementById("backLabel").classList.toggle("visible", top > 0.2);
    });

    root.addEventListener("resize", () => {
      if (!ctx.router.isVisible("studyScreen")) return;

      if (resizeFrameId !== null) {
        return;
      }

      resizeFrameId = root.requestAnimationFrame(() => {
        resizeFrameId = null;
        render();
      });
    });

    root.document.addEventListener("keydown", (event) => {
      if (!ctx.router.isVisible("studyScreen")) return;

      const tagName = event.target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          handleCardAction();
          break;
        case "ArrowLeft":
          event.preventDefault();
          answer("wrong");
          break;
        case "ArrowDown":
          event.preventDefault();
          answer("unsure");
          break;
        case "ArrowRight":
          event.preventDefault();
          answer("correct");
          break;
        case "ArrowUp":
          event.preventDefault();
          goBack();
          break;
        case "Escape":
          event.preventDefault();
          exitStudy();
          break;
      }
    });

    return {
      start,
      render,
      exitStudy
    };
  }

  Karto.createStudyView = createStudyView;
})(window);
