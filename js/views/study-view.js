(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createStudyView(ctx) {
    const wrap = document.getElementById("studyWrap");
    const cardElement = document.getElementById("studyCard");
    const imageMetaCache = new Map();
    let resizeFrameId = null;

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

      const entry = {
        status: "loading",
        aspectRatio: null
      };

      imageMetaCache.set(url, entry);

      const probe = new Image();
      probe.addEventListener("load", () => {
        entry.status = "loaded";
        entry.aspectRatio = probe.naturalWidth && probe.naturalHeight
          ? probe.naturalWidth / probe.naturalHeight
          : 1;
        renderIfCurrentImage(url);
      }, { once: true });
      probe.addEventListener("error", () => {
        entry.status = "error";
        entry.aspectRatio = null;
        renderIfCurrentImage(url);
      }, { once: true });
      probe.src = url;

      return entry;
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
      if (!ctx.state.study.session || ctx.state.study.session.reviewed === 0) {
        return;
      }

      ctx.store.recordStudySession({
        deckId: ctx.state.study.session.deckId,
        deckName: ctx.state.study.session.deckName,
        mode: ctx.state.study.session.mode,
        reviewed: ctx.state.study.session.reviewed,
        correct: ctx.state.study.session.correct,
        wrong: ctx.state.study.session.wrong,
        unsure: ctx.state.study.session.unsure,
        percentCorrect: ctx.state.study.session.reviewed
          ? Math.round((ctx.state.study.session.correct / ctx.state.study.session.reviewed) * 100)
          : 0,
        finishedAt: new Date().toISOString()
      });
    }

    function render() {
      const card = getCurrentStudyCard(ctx.state.study);
      const currentSide = getCurrentSide();

      cardElement.classList.remove("is-flipped", "has-media", "is-layout-top", "is-layout-side");

      if (!card) {
        clearElement(cardElement);
        cardElement.textContent = t("study.emptyQueue");
        return;
      }

      const text = getCurrentText(card);
      const imageUrl = getCurrentImage(card, currentSide);
      const layout = resolveMediaLayout(currentSide, text, imageUrl);

      clearElement(cardElement);
      cardElement.classList.toggle("is-flipped", ctx.state.study.flipped);
      cardElement.classList.toggle("has-media", !!imageUrl);
      cardElement.classList.toggle("is-layout-top", layout === "top");
      cardElement.classList.toggle("is-layout-side", layout === "side");

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

    function start(deckId, mode = "all") {
      const deck = ctx.getDeckById(deckId);
      if (!deck || deck.cards.length === 0) {
        ctx.toast.error(t("alerts.emptyDeckStudy"));
        return;
      }

      const cards = deck.cards.filter((card) => {
        const progress = ctx.state.studyProgress[card.id];

        if (mode === "new") {
          return !progress?.seenCount;
        }

        if (mode === "review") {
          return !!progress?.seenCount;
        }

        return true;
      });

      if (cards.length === 0) {
        ctx.toast.error(t("alerts.noCardsForMode"));
        return;
      }

      ctx.state.studyMode = mode;
      ctx.state.study = createStudyState({ cards });
      ctx.state.study.mode = mode;
      ctx.state.study.session = {
        deckId,
        deckName: deck.name,
        mode,
        reviewed: 0,
        correct: 0,
        wrong: 0,
        unsure: 0
      };

      render();
      resetGlow();
      ctx.router.goTo("studyScreen", null);
      cardElement.focus();
    }

    function answer(result, interval) {
      const card = getCurrentStudyCard(ctx.state.study);
      if (!card) return;

      ctx.state.study.session.reviewed += 1;
      ctx.state.study.session[result] += 1;
      ctx.store.recordStudyAnswer(card.id, result);
      advanceStudy(ctx.state.study, interval);
      render();
      resetGlow();
    }

    function toggleFlip() {
      if (!ctx.state.study.queue.length) return;

      ctx.state.study.flipped = !ctx.state.study.flipped;
      render();
      resetGlow();
    }

    function goBack() {
      if (!ctx.state.study.queue.length) return;

      if (ctx.state.study.flipped) {
        ctx.state.study.pendingInterval = null;
        ctx.state.study.flipped = false;
        render();
        resetGlow();
        return;
      }

      if (goToPreviousCard(ctx.state.study)) {
        render();
        resetGlow();
      }
    }

    function exitStudy() {
      finishSession();
      ctx.settingsView.render();
      ctx.router.goTo("homeScreen", "homeScreen");
      resetGlow();
    }

    cardElement.addEventListener("click", toggleFlip);

    document.getElementById("wrongZone").addEventListener("click", () => {
      answer("wrong", getStudyBase(ctx.state.study.queue.length));
    });
    document.getElementById("correctZone").addEventListener("click", () => {
      answer("correct", getStudyBase(ctx.state.study.queue.length) * 6);
    });
    document.getElementById("unsureZone").addEventListener("click", () => {
      answer("unsure", getStudyBase(ctx.state.study.queue.length) * 3);
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
          toggleFlip();
          break;
        case "ArrowLeft":
          event.preventDefault();
          answer("wrong", getStudyBase(ctx.state.study.queue.length));
          break;
        case "ArrowDown":
          event.preventDefault();
          answer("unsure", getStudyBase(ctx.state.study.queue.length) * 3);
          break;
        case "ArrowRight":
          event.preventDefault();
          answer("correct", getStudyBase(ctx.state.study.queue.length) * 6);
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
