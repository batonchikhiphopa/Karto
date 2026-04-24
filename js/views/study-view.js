(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createStudyView(ctx) {
    const wrap = document.getElementById("studyWrap");
    const cardElement = document.getElementById("studyCard");
    const exitStudyButton = document.getElementById("exitStudyBtn");
    const imageMetaCache = new Map();
    const STUDY_PRELOAD_WINDOW = 5;
    const EXIT_STUDY_SAFE_ZONE_PADDING = 112.5;
    const STUDY_EDGE_THRESHOLD = 0.2;
    const STUDY_EDGE_DELTA_EPSILON = 0.001;
    const STUDY_EDGE_KEYS = ["left", "right", "bottom", "top"];
    const STUDY_EDGE_CONFIG = {
      left: {
        glowVar: "--left-glow",
        labelId: "wrongLabel",
        action: () => answer("wrong")
      },
      right: {
        glowVar: "--right-glow",
        labelId: "correctLabel",
        action: () => answer("correct")
      },
      bottom: {
        glowVar: "--bottom-glow",
        labelId: "unsureLabel",
        action: () => answer("unsure")
      },
      top: {
        glowVar: "--top-glow",
        labelId: "backLabel",
        action: goBack
      }
    };
    let resizeFrameId = null;
    let activeStudyEdge = null;
    let lastPointerScores = null;
    let prepareToken = 0;

    function hasPendingAnswer() {
      return !!ctx.state.study.pendingAnswer;
    }

    function markCurrentBackShown() {
      const card = getCurrentStudyCard(ctx.state.study);
      ctx.state.study.backShownCardId = card?.id || null;
    }

    function hasCurrentBackBeenShown() {
      const card = getCurrentStudyCard(ctx.state.study);
      return !!card && ctx.state.study.backShownCardId === card.id;
    }

    function clearCurrentBackShown() {
      ctx.state.study.backShownCardId = null;
    }

    function resetAnswerSideIndex() {
      ctx.state.study.answerSideIndex = 0;
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
      activeStudyEdge = null;
      lastPointerScores = null;
      resetLabels();
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getPointerEdgeScores(event) {
      const width = root.innerWidth;
      const height = root.innerHeight;
      const edge = 200;

      return {
        left: 1 - clamp(event.clientX / edge, 0, 1),
        right: 1 - clamp((width - event.clientX) / edge, 0, 1),
        bottom: 1 - clamp((height - event.clientY) / edge, 0, 1),
        top: 1 - clamp(event.clientY / edge, 0, 1)
      };
    }

    function isPointerInExitStudySafeZone(event) {
      if (!exitStudyButton) {
        return false;
      }

      const rect = exitStudyButton.getBoundingClientRect();
      const safeLeft = Math.max(0, rect.left - EXIT_STUDY_SAFE_ZONE_PADDING);
      const safeRight = Math.min(root.innerWidth, rect.right + EXIT_STUDY_SAFE_ZONE_PADDING);
      const safeTop = Math.max(0, rect.top - EXIT_STUDY_SAFE_ZONE_PADDING);
      const safeBottom = Math.min(root.innerHeight, rect.bottom + EXIT_STUDY_SAFE_ZONE_PADDING);

      return (
        event.clientX >= safeLeft &&
        event.clientX <= safeRight &&
        event.clientY >= safeTop &&
        event.clientY <= safeBottom
      );
    }

    function resolveActiveStudyEdge(scores) {
      const candidates = STUDY_EDGE_KEYS.filter((edge) => scores[edge] > STUDY_EDGE_THRESHOLD);

      if (candidates.length === 0) {
        return null;
      }

      if (candidates.length === 1) {
        return candidates[0];
      }

      const previousScores = lastPointerScores || {};
      let growthEdge = null;
      let bestGrowth = STUDY_EDGE_DELTA_EPSILON;

      candidates.forEach((edge) => {
        const growth = scores[edge] - (previousScores[edge] || 0);
        if (growth > bestGrowth) {
          bestGrowth = growth;
          growthEdge = edge;
        }
      });

      if (growthEdge) {
        return growthEdge;
      }

      if (activeStudyEdge && candidates.includes(activeStudyEdge)) {
        return activeStudyEdge;
      }

      return candidates.reduce((bestEdge, edge) => {
        return scores[edge] > scores[bestEdge] ? edge : bestEdge;
      }, candidates[0]);
    }

    function setActiveStudyEdge(edge, scores = {}) {
      activeStudyEdge = edge;

      STUDY_EDGE_KEYS.forEach((key) => {
        const isActive = key === edge;
        const score = isActive ? scores[key] || 0 : 0;
        const config = STUDY_EDGE_CONFIG[key];
        const label = document.getElementById(config.labelId);

        wrap.style.setProperty(config.glowVar, score.toFixed(3));
        if (label) {
          label.classList.toggle("visible", isActive && score > STUDY_EDGE_THRESHOLD);
        }
      });
    }

    function performStudyEdgeAction(edge) {
      STUDY_EDGE_CONFIG[edge]?.action();
    }

    function resolveClickStudyEdge(defaultEdge, event) {
      if (event.detail <= 0) {
        return defaultEdge;
      }

      const scores = getPointerEdgeScores(event);
      const candidates = STUDY_EDGE_KEYS.filter((edge) => scores[edge] > STUDY_EDGE_THRESHOLD);
      if (candidates.includes(defaultEdge)) {
        return defaultEdge;
      }

      return candidates.reduce((bestEdge, edge) => {
        return scores[edge] > scores[bestEdge] ? edge : bestEdge;
      }, candidates[0] || defaultEdge);
    }

    function handleStudyEdgeClick(defaultEdge, event) {
      if (event.detail > 0 && isPointerInExitStudySafeZone(event)) {
        resetGlow();
        return;
      }

      const edge = resolveClickStudyEdge(defaultEdge, event);
      performStudyEdgeAction(edge);
    }

    function getAnswerTexts(card) {
      if (!card) {
        return [];
      }

      return [card.backText]
        .concat((Array.isArray(card.extraSides) ? card.extraSides : []).map((side) => side?.text))
        .map((text) => String(text || "").trim())
        .filter(Boolean);
    }

    function getCurrentAnswerSideIndex(card = getCurrentStudyCard(ctx.state.study)) {
      if (!ctx.state.study.flipped) {
        return 0;
      }

      const sideCount = Math.max(1, getAnswerTexts(card).length);
      const index = Number.isFinite(Number(ctx.state.study.answerSideIndex))
        ? Math.round(Number(ctx.state.study.answerSideIndex))
        : 0;
      const clampedIndex = clamp(index, 0, sideCount - 1);
      ctx.state.study.answerSideIndex = clampedIndex;
      return clampedIndex;
    }

    function getCurrentSide() {
      if (!ctx.state.study.flipped) {
        return "front";
      }

      return getCurrentAnswerSideIndex() > 0 ? "extra" : "back";
    }

    function getCurrentText(card) {
      if (!ctx.state.study.flipped) {
        return card.frontText;
      }

      return getAnswerTexts(card)[getCurrentAnswerSideIndex(card)] || card.backText;
    }

    function splitStudyParagraphs(text) {
      return String(text || "")
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);
    }

    function createStudyTextNode(text, options = {}) {
      const {
        isFlipped = false,
        hasMedia = false
      } = options;

      const className = `${isFlipped ? "study-back-text" : "study-front-text"}${hasMedia ? " has-media" : ""}`;

      if (!isFlipped) {
        return createElement("div", {
          className,
          text
        });
      }

      const paragraphs = splitStudyParagraphs(text);

      if (paragraphs.length <= 1) {
        return createElement("div", {
          className,
          text
        });
      }

      return createElement("div", {
        className,
        children: paragraphs.map((paragraph) =>
          createElement("p", {
            className: "study-paragraph",
            text: paragraph
          })
        )
      });
    }

    function normalizeStudyImageUrl(value) {
      return Karto.normalizeImageSource?.(value) || "";
    }

    function getStudyImageSources(card) {
      if (!card?.hasImage && !card?.image && !card?.imageStudy && !card?.imageThumb) {
        return [];
      }

      return [
        normalizeStudyImageUrl(card.imageThumb),
        normalizeStudyImageUrl(card.imageStudy),
        normalizeStudyImageUrl(Karto.deriveStudyImageUrl?.(card.image)),
        normalizeStudyImageUrl(card.image)
      ].filter((url, index, urls) => url && urls.indexOf(url) === index);
    }

    function getStudyImageSource(card) {
      return getStudyImageSources(card)[0] || "";
    }

    function getCurrentImage(card, currentSide) {
      const imageUrl = getStudyImageSource(card);
      if (!imageUrl) {
        return null;
      }

      return (card.imageSide || "back") === currentSide ? imageUrl : null;
    }

    function isLongStudyText(text) {
      const normalizedText = String(text || "").trim();
      const lineBreaks = (normalizedText.match(/\n/g) || []).length;
      return normalizedText.length > 120 || lineBreaks >= 2;
    }

    function getImageOrientation(meta) {
      if (!meta || meta.status !== "loaded" || typeof meta.aspectRatio !== "number") {
        return null;
      }

      if (meta.aspectRatio < 0.95) {
        return "vertical";
      }

      if (meta.aspectRatio > 1.05) {
        return "horizontal";
      }

      return null;
    }

    function renderIfCurrentImage(url) {
      const currentCard = getCurrentStudyCard(ctx.state.study);
      if (!currentCard || getCurrentImage(currentCard, getCurrentSide()) !== url || !ctx.router.isVisible("studyScreen")) {
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

    function mergeStudyCardMedia(cards) {
      const cardsById = new Map((Array.isArray(cards) ? cards : []).map((card) => [card.id, card]));
      if (cardsById.size === 0) {
        return;
      }

      ["allCards", "queue"].forEach((key) => {
        ctx.state.study[key] = (ctx.state.study[key] || []).map((card) => {
          const mediaCard = cardsById.get(card.id);
          return mediaCard
            ? {
              ...card,
              image: mediaCard.image,
              imageThumb: mediaCard.imageThumb || card.imageThumb || "",
              imageStudy: mediaCard.imageStudy || card.imageStudy || "",
              imageSide: mediaCard.imageSide,
              hasImage: mediaCard.hasImage,
              mediaLoaded: true
            }
            : card;
        });
      });
    }

    function getUpcomingStudyCards(limit = STUDY_PRELOAD_WINDOW) {
      const queue = Array.isArray(ctx.state.study.queue) ? ctx.state.study.queue : [];
      if (!queue.length) {
        return [];
      }

      return queue.slice(ctx.state.study.currentIndex, ctx.state.study.currentIndex + limit);
    }

    function needsStudyMedia(card) {
      return !!card?.hasImage && card.mediaLoaded === false && !getStudyImageSource(card);
    }

    async function loadStudyMedia(cards) {
      const cardIds = (Array.isArray(cards) ? cards : [])
        .filter(needsStudyMedia)
        .map((card) => card.id);

      if (!cardIds.length) {
        return;
      }

      mergeStudyCardMedia(await ctx.store.loadCardMedia?.(cardIds));
    }

    function warmUpcomingCards() {
      const upcomingCards = getUpcomingStudyCards(STUDY_PRELOAD_WINDOW);
      void (async () => {
        await loadStudyMedia(upcomingCards);
        upcomingCards
          .map(getStudyImageSource)
          .filter(Boolean)
          .forEach((url) => {
            ensureImageMeta(url);
          });
      })();
    }

    function resolveMediaLayout(currentSide, text, imageUrl) {
      if (!imageUrl) {
        return "text-only";
      }

      const meta = ensureImageMeta(imageUrl);
      const orientation = getImageOrientation(meta);
      if (orientation === "vertical") {
        return "side";
      }

      if (orientation === "horizontal") {
        return "top";
      }

      if (currentSide === "front") {
        return "top";
      }

      if (root.innerWidth < 960) {
        return "top";
      }

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

      const text = getCurrentText(card);
      const answerTexts = getAnswerTexts(card);
      const answerSideIndex = getCurrentAnswerSideIndex(card);
      const imageUrl = getCurrentImage(card, currentSide);
      const imageMeta = imageUrl ? ensureImageMeta(imageUrl) : null;
      const visibleImageUrl = imageMeta?.status === "error" ? null : imageUrl;
      const layout = resolveMediaLayout(currentSide, text, visibleImageUrl);

      clearElement(cardElement);
      cardElement.classList.toggle("is-flipped", ctx.state.study.flipped);
      cardElement.classList.toggle("has-media", !!visibleImageUrl);
      cardElement.classList.toggle("is-layout-top", layout === "top");
      cardElement.classList.toggle("is-layout-side", layout === "side");

      const content = createElement("div", {
        className:
          layout === "side" ? "study-card-content is-side" :
          layout === "top" ? "study-card-content is-top" :
          "study-card-content is-text-only"
      });

      if (visibleImageUrl) {
        content.appendChild(createElement("div", {
          className: "study-card-media",
          children: [
            createElement("img", {
              className: "study-card-img",
              attrs: {
                src: visibleImageUrl,
                alt: card.frontText || text || "Study image",
                decoding: "async"
              }
            })
          ]
        }));
      }

      const copyChildren = [];
      if (ctx.state.study.flipped && answerTexts.length > 1) {
        copyChildren.push(createElement("div", {
          className: "study-answer-progress",
          text: `${answerSideIndex + 1} / ${answerTexts.length}`
        }));
      }

      const textElement = createStudyTextNode(text, {
        isFlipped: ctx.state.study.flipped,
        hasMedia: !!visibleImageUrl
      });
      copyChildren.push(textElement);

      content.appendChild(createElement("div", {
        className: "study-card-copy",
        children: copyChildren
      }));

      cardElement.appendChild(content);

      resetLabels();
    }

    function showCurrentCardWhenReady() {
      const token = prepareToken + 1;
      prepareToken = token;

      render();
      resetGlow();

      void (async () => {
        await loadStudyMedia(getUpcomingStudyCards(STUDY_PRELOAD_WINDOW));
        if (prepareToken !== token || !ctx.router.isVisible("studyScreen")) {
          return;
        }

        const card = getCurrentStudyCard(ctx.state.study);
        if (card) {
          ensureImageMeta(getCurrentImage(card, getCurrentSide()));
        }

        render();
        warmUpcomingCards();
      })().catch((error) => {
        console.error("[karto] Failed to prepare study media:", error);

        if (prepareToken === token && ctx.router.isVisible("studyScreen")) {
          render();
        }
      });
    }

    async function start(deckId) {
      const shellDeck = ctx.getDeckById(deckId);
      const preferredCardIds = (Array.isArray(shellDeck?.cards) ? shellDeck.cards : [])
        .map((card) => (typeof card?.id === "string" ? card.id : ""))
        .filter(Boolean);

      await ctx.store.ensureDeckHydrated?.(deckId);
      const deck = ctx.getDeckById(deckId);
      if (!deck || ctx.getDeckCardCount(deck) === 0 || deck.cards.length === 0) {
        ctx.toast.error(t("alerts.emptyDeckStudy"));
        return;
      }

      ctx.state.studyMode = "all";
      ctx.state.study = createStudyState({ cards: deck.cards }, Math.random, {
        completedRounds: ctx.store.getCompletedRoundsForDeck(deckId),
        preferredCardIds
      });
      resetAnswerSideIndex();
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

      ctx.router.goTo("studyScreen", null);
      await showCurrentCardWhenReady();
    }

    function getProgressSnapshot(cardId) {
      return typeof ctx.store.getStudyProgressEntry === "function"
        ? ctx.store.getStudyProgressEntry(cardId)
        : null;
    }

    function restoreProgressSnapshot(cardId, entry) {
      if (typeof ctx.store.restoreStudyProgressEntry === "function") {
        ctx.store.restoreStudyProgressEntry(cardId, entry);
      }
    }

    function recordAnswer(cardId, result) {
      ctx.state.study.session.reviewed += 1;
      ctx.state.study.session[result] += 1;
      ctx.store.recordStudyAnswer(cardId, result);
    }

    function undoSessionAnswer(result) {
      if (!ctx.state.study.session) {
        return;
      }

      ctx.state.study.session.reviewed = Math.max(0, ctx.state.study.session.reviewed - 1);
      if (["wrong", "unsure", "correct"].includes(result)) {
        ctx.state.study.session[result] = Math.max(0, ctx.state.study.session[result] - 1);
      }
    }

    function finalizeAnswer(result) {
      const card = getCurrentStudyCard(ctx.state.study);
      if (!card) return;

      const previousProgressEntry = getProgressSnapshot(card.id);
      recordAnswer(card.id, result);
      advanceStudy(ctx.state.study, result, Math.random, { previousProgressEntry });
      clearCurrentBackShown();
      resetAnswerSideIndex();
      ctx.state.study.flipped = false;
      void showCurrentCardWhenReady();
    }

    function finalizePendingAnswer() {
      const card = getCurrentStudyCard(ctx.state.study);
      if (!card) {
        return false;
      }

      const previousProgressEntry = getProgressSnapshot(card.id);
      const committedAnswer = commitPendingStudyAnswer(ctx.state.study, Math.random, { previousProgressEntry });
      if (!committedAnswer) {
        return false;
      }

      recordAnswer(card.id, committedAnswer.result);
      clearCurrentBackShown();
      resetAnswerSideIndex();
      ctx.state.study.flipped = false;
      void showCurrentCardWhenReady();
      return true;
    }

    function advanceAnswerSide() {
      const card = getCurrentStudyCard(ctx.state.study);
      if (!card || !ctx.state.study.flipped) {
        return false;
      }

      const answerTexts = getAnswerTexts(card);
      const currentIndex = getCurrentAnswerSideIndex(card);
      if (currentIndex >= answerTexts.length - 1) {
        return false;
      }

      ctx.state.study.answerSideIndex = currentIndex + 1;
      render();
      resetGlow();
      return true;
    }

    function answer(result) {
      if (!getCurrentStudyCard(ctx.state.study)) {
        return;
      }

      if (ctx.state.study.flipped) {
        if (hasPendingAnswer()) {
          if (ctx.state.study.pendingAnswer.result !== result) {
            finalizeAnswer(result);
            return;
          }

          if (advanceAnswerSide()) {
            return;
          }

          finalizePendingAnswer();
          return;
        }

        finalizeAnswer(result);
        return;
      }

      if (result === "correct") {
        finalizeAnswer(result);
        return;
      }

      if (hasCurrentBackBeenShown()) {
        finalizeAnswer(result);
        return;
      }

      if (hasPendingAnswer()) {
        if (advanceAnswerSide()) {
          return;
        }

        finalizePendingAnswer();
        return;
      }

      if (queuePendingStudyAnswer(ctx.state.study, result)) {
        resetAnswerSideIndex();
        markCurrentBackShown();
        render();
        resetGlow();
      }
    }

    function handleCardAction() {
      if (!ctx.state.study.queue.length) return;

      if (ctx.state.study.flipped) {
        if (advanceAnswerSide()) {
          return;
        }

        if (hasPendingAnswer()) {
          finalizePendingAnswer();
          return;
        }

        ctx.state.study.flipped = false;
        resetAnswerSideIndex();
        void showCurrentCardWhenReady();
        return;
      }

      ctx.state.study.flipped = true;
      resetAnswerSideIndex();
      markCurrentBackShown();
      void showCurrentCardWhenReady();
    }

    function goBack() {
      const undoneAnswer = undoStudyAnswer(ctx.state.study);
      if (undoneAnswer) {
        restoreProgressSnapshot(undoneAnswer.cardId, undoneAnswer.previousProgressEntry);
        undoSessionAnswer(undoneAnswer.result);
        clearCurrentBackShown();
        resetAnswerSideIndex();
        void showCurrentCardWhenReady();
        return;
      }

      resetGlow();
    }

    function exitStudy() {
      prepareToken += 1;
      finishSession();
      ctx.settingsView.render();
      ctx.router.goTo("homeScreen", "homeScreen");
      resetGlow();
    }

    cardElement.addEventListener("click", handleCardAction);

    document.getElementById("wrongZone").addEventListener("click", (event) => {
      handleStudyEdgeClick("left", event);
    });
    document.getElementById("correctZone").addEventListener("click", (event) => {
      handleStudyEdgeClick("right", event);
    });
    document.getElementById("unsureZone").addEventListener("click", (event) => {
      handleStudyEdgeClick("bottom", event);
    });
    document.getElementById("backZone").addEventListener("click", (event) => {
      handleStudyEdgeClick("top", event);
    });
    exitStudyButton?.addEventListener("click", exitStudy);

    root.addEventListener("mousemove", (event) => {
      if (!ctx.router.isVisible("studyScreen")) return;

      if (isPointerInExitStudySafeZone(event)) {
        resetGlow();
        return;
      }

      const scores = getPointerEdgeScores(event);
      const edge = resolveActiveStudyEdge(scores);
      setActiveStudyEdge(edge, scores);
      lastPointerScores = scores;
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
