(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  const DEFINITION_SOURCES = {
    en: {
      labelKey: "cardForm.dictLangEn",
      sourceLabel: "dictionaryapi.dev"
    },
    de: {
      labelKey: "cardForm.dictLangDe",
      sourceLabel: "DWDS"
    },
    ru: {
      labelKey: "cardForm.dictLangRu",
      sourceLabel: "Wiktionary"
    }
  };

  const TRANSLATION_TARGETS = {
    en: { labelKey: "cardForm.dictLangEn" },
    de: { labelKey: "cardForm.dictLangDe" },
    ru: { labelKey: "cardForm.dictLangRu" }
  };

  function createCardFormView(ctx) {
    const frontInput = document.getElementById("frontTextInput");
    const backInput = document.getElementById("backTextInput");
    const imageInput = document.getElementById("imageInput");
    const fileInput = document.getElementById("imageFileInput");
    const deckSelect = document.getElementById("deckSelect");
    const imageResults = document.getElementById("imageResults");
    const imagePreviewWrap = document.getElementById("imagePreviewWrap");
    const imagePreviewThumb = document.getElementById("imagePreviewThumb");
    const definitionSelectionLabel = document.getElementById("definitionSelectionLabel");
    const translationSelectionLabel = document.getElementById("translationSelectionLabel");
    const definitionMenu = document.getElementById("getDefinitionMenu");
    const translationMenu = document.getElementById("translateMenu");
    const definitionIndicatorBtn = document.getElementById("definitionIndicatorBtn");
    const translationIndicatorBtn = document.getElementById("translationIndicatorBtn");
    const definitionBtn = document.getElementById("getDefinitionBtn");
    const translateBtn = document.getElementById("translateBtn");
    const definitionControl = definitionMenu.closest(".lookup-control");
    const translationControl = translationMenu.closest(".lookup-control");
    const frontSearchImagesBtn = document.getElementById("frontSearchImagesBtn");
    const frontUploadImageBtn = document.getElementById("frontUploadImageBtn");
    const imageSideFrontBtn = document.getElementById("imageSideFrontBtn");
    const imageSideBackBtn = document.getElementById("imageSideBackBtn");

    function normalizeSide(value) {
      return value === "front" ? "front" : "back";
    }

    function getLanguageCode(lang) {
      return String(lang || "").toUpperCase();
    }

    function resolveDefaultLookupLanguage() {
      const lang = getCurrentLanguage();
      return DEFINITION_SOURCES[lang] ? lang : "en";
    }

    function ensureFormState() {
      if (!DEFINITION_SOURCES[ctx.state.cardForm.definitionLang]) {
        ctx.state.cardForm.definitionLang = resolveDefaultLookupLanguage();
      }

      if (!TRANSLATION_TARGETS[ctx.state.cardForm.translationLang]) {
        ctx.state.cardForm.translationLang = resolveDefaultLookupLanguage();
      }

      ctx.state.cardForm.imageSide = normalizeSide(ctx.state.cardForm.imageSide);
      ctx.state.cardForm.imageTargetSide = normalizeSide(
        ctx.state.cardForm.imageTargetSide || ctx.state.cardForm.imageSide
      );
    }

    function syncImageSideButtons() {
      ensureFormState();
      const imageSide = normalizeSide(ctx.state.cardForm.imageSide);
      imageSideFrontBtn.classList.toggle("is-active", imageSide === "front");
      imageSideBackBtn.classList.toggle("is-active", imageSide === "back");
    }

    function setImageSide(side) {
      const normalizedSide = normalizeSide(side);
      ensureFormState();
      ctx.state.cardForm.imageSide = normalizedSide;
      ctx.state.cardForm.imageTargetSide = normalizedSide;
      syncImageSideButtons();
    }

    function setImageTargetSide(side) {
      ensureFormState();
      ctx.state.cardForm.imageTargetSide = normalizeSide(side);
    }

    function getImageSearchQuery() {
      return frontInput.value.trim();
    }

    function deriveFormImageThumb(value) {
      return Karto.deriveTileImageUrl?.(value) || "";
    }

    function deriveFormStudyImage(value) {
      return Karto.deriveStudyImageUrl?.(value) || value;
    }

    function showImagePreview(src) {
      imagePreviewThumb.src = src;
      imagePreviewWrap.classList.add("visible");
    }

    function clearImagePreview() {
      imagePreviewThumb.src = "";
      imagePreviewWrap.classList.remove("visible");
      fileInput.value = "";
    }

    function applyImageValue(value, imageThumb, imageStudy) {
      ensureFormState();
      ctx.state.cardForm.imageSide = normalizeSide(ctx.state.cardForm.imageTargetSide);
      ctx.state.cardForm.imageThumb = value
        ? typeof imageThumb === "string"
          ? imageThumb
          : deriveFormImageThumb(value)
        : "";
      ctx.state.cardForm.imageStudy = value
        ? typeof imageStudy === "string"
          ? imageStudy
          : deriveFormStudyImage(value)
        : "";
      imageInput.value = value;

      if (value) {
        showImagePreview(value);
      } else {
        clearImagePreview();
      }

      syncImageSideButtons();
    }

    function promptImageUpload() {
      ensureFormState();
      setImageTargetSide(ctx.state.cardForm.imageSide);
      fileInput.click();
    }

    function setImageResultsMessage(message) {
      replaceChildren(imageResults, [document.createTextNode(message)]);
    }

    function populateDeckSelect(selectedDeckId) {
      clearElement(deckSelect);

      ctx.state.decks.forEach((deck) => {
        deckSelect.appendChild(createElement("option", {
          value: deck.id,
          text: deck.name,
          properties: {
            selected: deck.id === selectedDeckId
          }
        }));
      });
    }

    function updateCardFormTitle() {
      document.getElementById("cardFormTitle").textContent = t(
        ctx.state.cardForm.editDeckId !== null && ctx.state.cardForm.editCardId !== null
          ? "cardForm.titleEdit"
          : "cardForm.titleCreate"
      );
    }

    function appendLookupResult(currentText, newText) {
      const existing = String(currentText || "");
      const addition = String(newText || "").trim();

      if (!addition) {
        return existing;
      }

      if (!existing.trim()) {
        return addition;
      }

      return `${existing}${existing.endsWith("\n") ? "" : "\n"}${addition}`;
    }

    function formatDefinitionSelection(lang) {
      return getLanguageCode(lang);
    }

    function formatTranslationSelection(lang) {
      return getLanguageCode(lang);
    }

    function syncSelectedMenuOption(menu, datasetKey, value) {
      menu.querySelectorAll(".split-control-option").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset[datasetKey] === value);
      });
    }

    function renderLookupSelections() {
      ensureFormState();
      definitionSelectionLabel.textContent = formatDefinitionSelection(ctx.state.cardForm.definitionLang);
      translationSelectionLabel.textContent = formatTranslationSelection(ctx.state.cardForm.translationLang);
      syncSelectedMenuOption(definitionMenu, "dictLang", ctx.state.cardForm.definitionLang);
      syncSelectedMenuOption(translationMenu, "targetLang", ctx.state.cardForm.translationLang);
    }

    function setMenuOpen(control, menu, button, isOpen) {
      control.classList.toggle("is-open", isOpen);
      menu.hidden = !isOpen;
      button.setAttribute("aria-expanded", String(isOpen));
    }

    function closeMenus() {
      setMenuOpen(definitionControl, definitionMenu, definitionIndicatorBtn, false);
      setMenuOpen(translationControl, translationMenu, translationIndicatorBtn, false);
    }

    function toggleMenu(control, menu, button) {
      const shouldOpen = menu.hidden;
      closeMenus();
      if (shouldOpen) {
        setMenuOpen(control, menu, button, true);
      }
    }

    function setDefinitionLanguage(lang) {
      if (!DEFINITION_SOURCES[lang]) return;
      ctx.state.cardForm.definitionLang = lang;
      renderLookupSelections();
      closeMenus();
    }

    function setTranslationLanguage(lang) {
      if (!TRANSLATION_TARGETS[lang]) return;
      ctx.state.cardForm.translationLang = lang;
      renderLookupSelections();
      closeMenus();
    }

    async function open(deckId, cardId, returnScreen) {
      ctx.state.cardForm.returnScreen = returnScreen || "homeScreen";
      ctx.state.cardForm.editDeckId = deckId;
      ctx.state.cardForm.editCardId = cardId;
      ensureFormState();

      if (deckId !== null && cardId !== null) {
        await ctx.store.ensureDeckHydrated?.(deckId);
        await ctx.store.loadCardMedia?.([cardId]);
      }

      populateDeckSelect(deckId);
      clearElement(imageResults);
      clearImagePreview();
      fileInput.value = "";
      closeMenus();

      if (deckId !== null && cardId !== null) {
        const deck = ctx.getDeckById(deckId);
        const card = deck?.cards.find((item) => item.id === cardId);

        frontInput.value = card?.frontText || "";
        backInput.value = card?.backText || "";
        imageInput.value = card?.image || card?.imageStudy || "";
        ctx.state.cardForm.imageThumb = card?.imageThumb || deriveFormImageThumb(card?.image || "");
        ctx.state.cardForm.imageStudy = card?.imageStudy || deriveFormStudyImage(card?.image || "");
        ctx.state.cardForm.imageSide = normalizeSide(card?.imageSide);
        ctx.state.cardForm.imageTargetSide = ctx.state.cardForm.imageSide;
      } else {
        frontInput.value = "";
        backInput.value = "";
        imageInput.value = "";
        ctx.state.cardForm.imageThumb = "";
        ctx.state.cardForm.imageStudy = "";
        ctx.state.cardForm.imageSide = "back";
        ctx.state.cardForm.imageTargetSide = "back";
      }

      if (imageInput.value.trim()) {
        showImagePreview(imageInput.value.trim());
      }

      updateCardFormTitle();
      syncImageSideButtons();
      renderLookupSelections();
      ctx.router.goTo("createCardScreen", ctx.navTargetForScreen(ctx.state.cardForm.returnScreen));
      closeMenus();
      frontInput.focus();
    }

    function navigateBack() {
      const returnScreen = ctx.state.cardForm.returnScreen;

      if (returnScreen === "editDeckScreen") {
        ctx.deckEditorView.render();
      }

      if (returnScreen === "libraryScreen") {
        ctx.libraryView.render();
      }

      ctx.router.goTo(returnScreen, ctx.navTargetForScreen(returnScreen));
    }

    async function saveCard() {
      const frontText = frontInput.value.trim();
      const backText = backInput.value.trim();
      const image = imageInput.value.trim();
      const imageThumb = image ? ctx.state.cardForm.imageThumb || deriveFormImageThumb(image) : "";
      const imageStudy = image ? ctx.state.cardForm.imageStudy || deriveFormStudyImage(image) : "";
      const imageSide = normalizeSide(ctx.state.cardForm.imageSide);

      if (!frontText || !backText) {
        ctx.toast.error(t("alerts.requiredFields"));
        return;
      }

      if (image && !ctx.isValidImageValue(image)) {
        ctx.toast.error(t("alerts.invalidImageUrl"));
        return;
      }

      await ctx.store.ensureDeckHydrated?.(deckSelect.value);
      if (ctx.state.cardForm.editDeckId) {
        await ctx.store.ensureDeckHydrated?.(ctx.state.cardForm.editDeckId, { includeMedia: true });
      }

      const targetDeck = ctx.getDeckById(deckSelect.value);
      if (!targetDeck) {
        ctx.toast.error(t("alerts.chooseDeck"));
        return;
      }

      const editingDeck = ctx.getDeckById(ctx.state.cardForm.editDeckId);
      const editingCard = editingDeck?.cards.find((card) => card.id === ctx.state.cardForm.editCardId);

      const savedCard = createCard({ frontText, backText, image, imageThumb, imageStudy, imageSide }, editingCard?.id || null);
      if (!savedCard) {
        ctx.toast.error(t("alerts.requiredFields"));
        return;
      }

      let saveResult = null;

      if (editingDeck && editingCard) {
        saveResult = saveEditedCardToDeck(editingDeck, targetDeck, savedCard, editingCard.id);

        if (!saveResult.isValid) {
          ctx.toast.error(t("alerts.requiredFields"));
          return;
        }

        if (!saveResult.didSave) {
          if (saveResult.skippedCount > 0) {
            ctx.toast.info(t("alerts.cardMoveSkipped", { deckName: targetDeck.name }));
          }
          return;
        }

        ctx.state.editingDeckId = saveResult.didMove ? targetDeck.id : editingDeck.id;
      } else {
        targetDeck.cards.push(savedCard);
        ctx.state.editingDeckId = targetDeck.id;
      }

      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      ctx.deckEditorView.render();
      ctx.toast.success(
        saveResult?.didMove
          ? t("alerts.cardMoved", { deckName: targetDeck.name })
          : t("alerts.cardSaved")
      );
      navigateBack();
    }

    function hasGermanArticle(value) {
      return /^(der|die|das)\s+/i.test(String(value || "").trim());
    }

    function isSingleWord(value) {
      const text = String(value || "").trim();
      return text.length > 0 && !/\s/.test(text);
    }

    function genderToArticle(gender) {
      const normalized = String(gender || "").trim().toLowerCase();

      if (["m", "maskulin", "maskulinum", "masculine"].includes(normalized)) {
        return "der";
      }

      if (["f", "feminin", "femininum", "feminine"].includes(normalized)) {
        return "die";
      }

      if (["n", "neutrum", "neutral", "neuter"].includes(normalized)) {
        return "das";
      }

      return null;
    }

    async function fetchDefinition(button) {
      const word = frontInput.value.trim();
      if (!word) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      ensureFormState();
      const initialText = button.textContent;
      button.disabled = true;
      button.textContent = t("common.loading");

      try {
        const response = await ctx.api.fetchDefinition(
          word,
          ctx.state.cardForm.definitionLang
        );

        if (response.aborted) return;

        if (response.ok && response.data.definition) {
          backInput.value = appendLookupResult(backInput.value, response.data.definition);

          const article = response.data.article;
          const word = frontInput.value.trim();

          if (
            ctx.state.cardForm.definitionLang === "de" &&
            ctx.state.autoGermanArticle !== false &&
            article &&
            !/^(der|die|das)\s/i.test(word) &&
            !/\s/.test(word)
          ) {
            frontInput.value = `${article} ${word}`;
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

      ensureFormState();
      const initialText = button.textContent;
      button.disabled = true;
      button.textContent = t("common.loading");

      try {
        const response = await ctx.api.translateText(
          text,
          ctx.state.cardForm.translationLang
        );

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

    function setIconButtonLoading(button, isLoading) {
      button.disabled = isLoading;
      button.classList.toggle("is-loading", isLoading);
    }

    async function searchImages(button) {
      const query = getImageSearchQuery();
      if (!query) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      ensureFormState();
      setImageTargetSide(ctx.state.cardForm.imageSide);
      setIconButtonLoading(button, true);
      setImageResultsMessage(t("common.loading"));

      try {
        const response = await ctx.api.searchImages(query);

        if (response.aborted) return;

        clearElement(imageResults);

        if (!response.ok) {
          ctx.toast.error(response.data?.error || t("alerts.serverUnavailable"));
          setImageResultsMessage(response.data?.error || t("alerts.serverUnavailable"));
          return;
        }

        const images = Array.isArray(response.data.images) ? response.data.images : [];
        if (images.length === 0) {
          setImageResultsMessage(t("alerts.nothingFound"));
          return;
        }

        images.forEach((photo) => {
          imageResults.appendChild(createElement("img", {
            attrs: {
              src: photo.small,
              alt: photo.alt || query,
              title: t("cardForm.imageSelectTitle"),
              "data-regular": deriveFormStudyImage(photo.regular),
              "data-thumb": deriveFormImageThumb(photo.small || photo.regular),
              "data-study": deriveFormStudyImage(photo.regular)
            }
          }));
        });
      } catch {
        setImageResultsMessage(t("alerts.serverUnavailable"));
      } finally {
        setIconButtonLoading(button, false);
      }
    }

    document.getElementById("closeCardFormBtn").addEventListener("click", navigateBack);
    document.getElementById("saveCardBtn").addEventListener("click", saveCard);
    definitionBtn.addEventListener("click", (event) => {
      fetchDefinition(event.currentTarget);
    });
    translateBtn.addEventListener("click", (event) => {
      translateText(event.currentTarget);
    });
    frontSearchImagesBtn.addEventListener("click", (event) => {
      searchImages(event.currentTarget);
    });
    frontUploadImageBtn.addEventListener("click", () => {
      promptImageUpload();
    });
    imageSideFrontBtn.addEventListener("click", () => {
      setImageSide("front");
    });
    imageSideBackBtn.addEventListener("click", () => {
      setImageSide("back");
    });
    definitionIndicatorBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(definitionControl, definitionMenu, definitionIndicatorBtn);
    });
    translationIndicatorBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(translationControl, translationMenu, translationIndicatorBtn);
    });
    definitionMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const option = event.target.closest("[data-dict-lang]");
      if (!option) return;
      setDefinitionLanguage(option.dataset.dictLang);
    });
    translationMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const option = event.target.closest("[data-target-lang]");
      if (!option) return;
      setTranslationLanguage(option.dataset.targetLang);
    });
    imageResults.addEventListener("click", (event) => {
      const image = event.target.closest("img[data-regular]");
      if (!image) return;

      imageResults.querySelectorAll("img").forEach((item) => item.classList.remove("selected"));
      image.classList.add("selected");
      applyImageValue(image.dataset.regular, image.dataset.thumb || "", image.dataset.study || "");
    });
    imageInput.addEventListener("input", () => {
      const value = imageInput.value.trim();
      ctx.state.cardForm.imageThumb = value ? deriveFormImageThumb(value) : "";
      ctx.state.cardForm.imageStudy = value ? deriveFormStudyImage(value) : "";
      if (value) {
        showImagePreview(value);
      } else {
        clearImagePreview();
      }

      syncImageSideButtons();
    });
    document.getElementById("imagePreviewClearBtn").addEventListener("click", () => {
      applyImageValue("");
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;

      const targetSide = normalizeSide(ctx.state.cardForm.imageTargetSide);
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.addEventListener("load", () => {
        const studyImage = Karto.resizeImageElementToDataUrl(image, {
          maxSide: Karto.STUDY_DATA_IMAGE_MAX_SIDE || 720,
          quality: Karto.STUDY_IMAGE_QUALITY || 0.68,
          mimeType: "image/jpeg"
        });
        const imageThumb = Karto.resizeImageElementToDataUrl(image, {
          maxSide: Karto.TILE_THUMB_MAX_SIDE || 360,
          quality: Karto.TILE_THUMB_QUALITY || 0.72,
          mimeType: "image/jpeg"
        });
        ctx.state.cardForm.imageTargetSide = targetSide;
        applyImageValue(studyImage, imageThumb, "");
        URL.revokeObjectURL(objectUrl);
        fileInput.value = "";
      });

      image.addEventListener("error", () => {
        URL.revokeObjectURL(objectUrl);
        fileInput.value = "";
        ctx.toast.error(t("alerts.invalidImageUrl"));
      }, { once: true });

      image.src = objectUrl;
    });

    [frontInput, backInput, imageInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          saveCard();
        }
      });
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

    return {
      open,
      navigateBack,
      render() {
        ensureFormState();
        updateCardFormTitle();
        syncImageSideButtons();
        renderLookupSelections();
        if (imageInput.value.trim()) {
          showImagePreview(imageInput.value.trim());
        } else {
          clearImagePreview();
        }
        closeMenus();
      }
    };
  }

  Karto.createCardFormView = createCardFormView;
})(window);
