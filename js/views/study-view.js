(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createStudyView(ctx) {
    const wrap = document.getElementById("studyWrap");
    const cardElement = document.getElementById("studyCard");
    const hintElement = document.getElementById("studyHint");
    const progressElement = document.getElementById("studyProgress");
    const statsElement = document.getElementById("studySessionStats");

    function getModeLabel(mode) {
      return t(
        mode === "new" ? "study.modeNew" :
        mode === "review" ? "study.modeReview" :
        "study.modeAll"
      );
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
      const session = ctx.state.study.session;

      if (!card) {
        clearElement(cardElement);
        cardElement.textContent = t("study.emptyQueue");
        progressElement.textContent = "";
        statsElement.textContent = "";
        hintElement.textContent = "";
        return;
      }

      clearElement(cardElement);
      progressElement.textContent = `${ctx.state.study.currentIndex + 1} / ${ctx.state.study.queue.length}`;

      const correctPercent = session.reviewed
        ? Math.round((session.correct / session.reviewed) * 100)
        : 0;

      statsElement.textContent = t("study.stats", {
        reviewed: session.reviewed,
        percent: correctPercent,
        mode: getModeLabel(session.mode)
      });

      cardElement.appendChild(createElement("div", {
        className: "study-card-tag",
        text: t(ctx.state.study.flipped ? "study.answer" : "study.question")
      }));

      if (ctx.state.study.flipped && card.image) {
        cardElement.appendChild(createElement("img", {
          className: "study-card-img",
          attrs: {
            src: card.image,
            alt: card.frontText
          }
        }));
      }

      cardElement.appendChild(createElement("div", {
        className: ctx.state.study.flipped ? "study-back-text" : "study-front-text",
        text: ctx.state.study.flipped ? card.backText : card.frontText
      }));

      hintElement.textContent = t(ctx.state.study.flipped ? "study.hintBack" : "study.hintFront");
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

    function handleCardAdvance() {
      if (!ctx.state.study.queue.length) return;

      if (!ctx.state.study.flipped) {
        ctx.state.study.pendingInterval = getStudyBase(ctx.state.study.queue.length) * 3;
        ctx.state.study.flipped = true;
        render();
        return;
      }

      answer("unsure", ctx.state.study.pendingInterval ?? getStudyBase(ctx.state.study.queue.length) * 3);
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

    cardElement.addEventListener("click", handleCardAdvance);
    cardElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardAdvance();
      }
    });

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

      const left = (1 - clamp(event.clientX / edge, 0, 1)) * 0.85;
      const right = (1 - clamp((width - event.clientX) / edge, 0, 1)) * 0.85;
      const bottom = (1 - clamp((height - event.clientY) / edge, 0, 1)) * 0.85;
      const top = (1 - clamp(event.clientY / edge, 0, 1)) * 0.85;

      wrap.style.setProperty("--left-glow", left.toFixed(3));
      wrap.style.setProperty("--right-glow", right.toFixed(3));
      wrap.style.setProperty("--bottom-glow", bottom.toFixed(3));
      wrap.style.setProperty("--top-glow", top.toFixed(3));

      document.getElementById("wrongLabel").classList.toggle("visible", left > 0.2);
      document.getElementById("correctLabel").classList.toggle("visible", right > 0.2);
      document.getElementById("unsureLabel").classList.toggle("visible", bottom > 0.2);
      document.getElementById("backLabel").classList.toggle("visible", top > 0.2);
    });

    root.document.addEventListener("keydown", (event) => {
      if (!ctx.router.isVisible("studyScreen")) return;

      const tagName = event.target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;

      switch (event.key) {
        case " ":
        case "Enter":
          event.preventDefault();
          handleCardAdvance();
          break;
        case "ArrowLeft":
        case "1":
          event.preventDefault();
          answer("wrong", getStudyBase(ctx.state.study.queue.length));
          break;
        case "ArrowDown":
        case "2":
          event.preventDefault();
          answer("unsure", getStudyBase(ctx.state.study.queue.length) * 3);
          break;
        case "ArrowRight":
        case "3":
          event.preventDefault();
          answer("correct", getStudyBase(ctx.state.study.queue.length) * 6);
          break;
        case "ArrowUp":
        case "Backspace":
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
