(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function appendLookupResult(currentText, newText) {
    const existing = String(currentText || "");
    const addition = String(newText || "").trim();
    if (!addition) return existing;
    if (!existing.trim()) return addition;
    return `${existing}${existing.endsWith("\n") ? "" : "\n"}${addition}`;
  }

  function createCardFormLookupController(options) {
    const {
      backInput,
      ctx,
      definitionControl,
      definitionMenu,
      definitionSelectionLabel,
      frontInput,
      getDefaultLanguage,
      translationControl,
      translationMenu,
      translationSelectionLabel
    } = options;

    function getLanguageCode(lang) {
      return String(lang || "").toUpperCase();
    }

    function syncSelectedMenuOption(menu, datasetKey, value) {
      menu.querySelectorAll(".split-control-option").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset[datasetKey] === value);
      });
    }

    function ensureState() {
      if (!Karto.CARD_FORM_DEFINITION_SOURCES[ctx.state.cardForm.definitionLang]) {
        ctx.state.cardForm.definitionLang = getDefaultLanguage();
      }

      if (!Karto.CARD_FORM_TRANSLATION_TARGETS[ctx.state.cardForm.translationLang]) {
        ctx.state.cardForm.translationLang = getDefaultLanguage();
      }
    }

    function render() {
      ensureState();
      definitionSelectionLabel.textContent = getLanguageCode(ctx.state.cardForm.definitionLang);
      translationSelectionLabel.textContent = getLanguageCode(ctx.state.cardForm.translationLang);
      syncSelectedMenuOption(definitionMenu, "dictLang", ctx.state.cardForm.definitionLang);
      syncSelectedMenuOption(translationMenu, "targetLang", ctx.state.cardForm.translationLang);
    }

    function setMenuOpen(control, menu, button, isOpen) {
      control.classList.toggle("is-open", isOpen);
      menu.hidden = !isOpen;
      button.setAttribute("aria-expanded", String(isOpen));
    }

    function closeMenus() {
      setMenuOpen(definitionControl, definitionMenu, document.getElementById("definitionIndicatorBtn"), false);
      setMenuOpen(translationControl, translationMenu, document.getElementById("translationIndicatorBtn"), false);
    }

    function toggleMenu(control, menu, button) {
      const shouldOpen = menu.hidden;
      closeMenus();
      if (shouldOpen) {
        setMenuOpen(control, menu, button, true);
      }
    }

    function setDefinitionLanguage(lang) {
      if (!Karto.CARD_FORM_DEFINITION_SOURCES[lang]) return;
      ctx.state.cardForm.definitionLang = lang;
      render();
      closeMenus();
    }

    function setTranslationLanguage(lang) {
      if (!Karto.CARD_FORM_TRANSLATION_TARGETS[lang]) return;
      ctx.state.cardForm.translationLang = lang;
      render();
      closeMenus();
    }

    async function fetchDefinition(button) {
      const word = frontInput.value.trim();
      if (!word) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      ensureState();
      const initialText = button.textContent;
      button.disabled = true;
      button.textContent = t("common.loading");

      try {
        const response = await ctx.api.fetchDefinition(word, ctx.state.cardForm.definitionLang);
        if (response.aborted) return;

        if (response.ok && response.data.definition) {
          backInput.value = appendLookupResult(backInput.value, response.data.definition);
          const article = response.data.article;
          const currentWord = frontInput.value.trim();
          if (
            ctx.state.cardForm.definitionLang === "de" &&
            ctx.state.autoGermanArticle !== false &&
            article &&
            !/^(der|die|das)\s/i.test(currentWord) &&
            !/\s/.test(currentWord)
          ) {
            frontInput.value = `${article} ${currentWord}`;
          }
          return;
        }

        ctx.toast.error(response.data?.error || t("alerts.definitionNotFound"));
      } catch {
        ctx.toast.error(t("alerts.serverUnavailable"));
      } finally {
        button.disabled = false;
        button.textContent = initialText;
      }
    }

    async function translateText(button) {
      const text = frontInput.value.trim();
      if (!text) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      ensureState();
      const initialText = button.textContent;
      button.disabled = true;
      button.textContent = t("common.loading");

      try {
        const response = await ctx.api.translateText(text, ctx.state.cardForm.translationLang);
        if (response.aborted) return;

        if (response.ok && response.data.translation) {
          backInput.value = appendLookupResult(backInput.value, response.data.translation);
          return;
        }

        ctx.toast.error(response.data?.error || t("alerts.translationUnavailable"));
      } catch {
        ctx.toast.error(t("alerts.serverUnavailable"));
      } finally {
        button.disabled = false;
        button.textContent = initialText;
      }
    }

    function bind(buttons) {
      buttons.definitionBtn.addEventListener("click", (event) => fetchDefinition(event.currentTarget));
      buttons.translateBtn.addEventListener("click", (event) => translateText(event.currentTarget));
      buttons.definitionIndicatorBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu(definitionControl, definitionMenu, buttons.definitionIndicatorBtn);
      });
      buttons.translationIndicatorBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu(translationControl, translationMenu, buttons.translationIndicatorBtn);
      });
      definitionMenu.addEventListener("click", (event) => {
        event.stopPropagation();
        const option = event.target.closest("[data-dict-lang]");
        if (option) setDefinitionLanguage(option.dataset.dictLang);
      });
      translationMenu.addEventListener("click", (event) => {
        event.stopPropagation();
        const option = event.target.closest("[data-target-lang]");
        if (option) setTranslationLanguage(option.dataset.targetLang);
      });
      root.document.addEventListener("click", (event) => {
        if (
          event.target.closest("#definitionIndicatorBtn") ||
          event.target.closest("#translationIndicatorBtn") ||
          event.target.closest("#getDefinitionMenu") ||
          event.target.closest("#translateMenu")
        ) {
          return;
        }
        closeMenus();
      });
    }

    return {
      bind,
      closeMenus,
      ensureState,
      render
    };
  }

  Karto.createCardFormLookupController = createCardFormLookupController;
})(window);
