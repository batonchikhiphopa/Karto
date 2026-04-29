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
  Karto.CARD_FORM_DEFINITION_SOURCES = DEFINITION_SOURCES;
  Karto.CARD_FORM_TRANSLATION_TARGETS = TRANSLATION_TARGETS;

  function createCardFormView(ctx) {
    const frontInput = document.getElementById("frontTextInput");
    const backInput = document.getElementById("backTextInput");
    const extraSidesList = document.getElementById("extraSidesList");
    const addExtraSideBtn = document.getElementById("addExtraSideBtn");
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
    const textLimits = Karto.CARD_TEXT_LIMITS || {
      maxExtraSides: 5
    };
    let extraSidesController = null;

    function normalizeSide(value) {
      return value === "front" ? "front" : "back";
    }

    function getLanguageCode(lang) {
      return String(lang || "").toUpperCase();
    }

    const {
      bindLimitField,
      hideLimitTooltip,
      syncLimitStates,
      validateTextLimits
    } = Karto.createCardFormTextLimitController({
      backInput,
      frontInput,
      getExtraSideControls: () => extraSidesController?.getControls() || [],
      toast: ctx.toast
    });

    extraSidesController = Karto.createCardFormExtraSidesController({
      addButton: addExtraSideBtn,
      bindLimitField,
      listElement: extraSidesList,
      maxExtraSides: textLimits.maxExtraSides || 5,
      onCtrlEnter: () => saveCard(),
      onStateChanged: syncLimitStates
    });

    const createExtraSideControl = extraSidesController.create;
    const readExtraSidesFromForm = extraSidesController.read;
    const renderExtraSides = extraSidesController.render;
    const renumberExtraSides = extraSidesController.renumber;

    const imageController = Karto.createCardFormImageController({
      ctx,
      fileInput,
      imageInput,
      imagePreviewThumb,
      imagePreviewWrap,
      imageResults,
      imageSideBackBtn,
      imageSideFrontBtn,
      normalizeSide,
      queryInput: frontInput
    });

    const lookupController = Karto.createCardFormLookupController({
      backInput,
      ctx,
      definitionControl,
      definitionMenu,
      definitionSelectionLabel,
      frontInput,
      getDefaultLanguage: resolveDefaultLookupLanguage,
      translationControl,
      translationMenu,
      translationSelectionLabel
    });

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
      imageController.clearResults();
      imageController.clearPreview();
      fileInput.value = "";
      hideLimitTooltip();
      lookupController.closeMenus();

      if (deckId !== null && cardId !== null) {
        const deck = ctx.getDeckById(deckId);
        const card = deck?.cards.find((item) => item.id === cardId);

        frontInput.value = card?.frontText || "";
        backInput.value = card?.backText || "";
        renderExtraSides(card?.extraSides || []);
        imageController.setFromCard(card);
      } else {
        frontInput.value = "";
        backInput.value = "";
        renderExtraSides([]);
        imageController.reset();
      }

      imageController.render();

      updateCardFormTitle();
      imageController.syncSideButtons();
      lookupController.render();
      ctx.router.goTo("createCardScreen", ctx.navTargetForScreen(ctx.state.cardForm.returnScreen));
      lookupController.closeMenus();
      syncLimitStates();
      root.requestAnimationFrame(syncLimitStates);
      frontInput.focus();
    }

    function navigateBack() {
      const returnScreen = ctx.state.cardForm.returnScreen;
      hideLimitTooltip();

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
      const extraSides = readExtraSidesFromForm();
      const { image, imageThumb, imageStudy, imageSide } = imageController.readFields();

      if (!frontText || !backText) {
        ctx.toast.error(t("alerts.requiredFields"));
        return;
      }

      if (!validateTextLimits()) {
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

      const savedCard = createCard({ frontText, backText, extraSides, image, imageThumb, imageStudy, imageSide }, editingCard?.id || null);
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

    document.getElementById("closeCardFormBtn").addEventListener("click", navigateBack);
    document.getElementById("saveCardBtn").addEventListener("click", saveCard);
    addExtraSideBtn.addEventListener("click", () => {
      const control = createExtraSideControl();
      if (control) {
        control.textarea.focus();
      }
    });
    bindLimitField(frontInput, "front");
    bindLimitField(backInput, "back");
    lookupController.bind({
      definitionBtn,
      definitionIndicatorBtn,
      translateBtn,
      translationIndicatorBtn
    });
    imageController.bind({
      searchButton: frontSearchImagesBtn,
      uploadButton: frontUploadImageBtn
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

      lookupController.closeMenus();
    });

    return {
      open,
      navigateBack,
      render() {
        ensureFormState();
        updateCardFormTitle();
        imageController.syncSideButtons();
        lookupController.render();
        renumberExtraSides();
        imageController.render();
        syncLimitStates();
        root.requestAnimationFrame(syncLimitStates);
        lookupController.closeMenus();
      }
    };
  }

  Karto.createCardFormView = createCardFormView;
})(window);
