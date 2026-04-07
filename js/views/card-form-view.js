(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createCardFormView(ctx) {
    const frontInput = document.getElementById("frontTextInput");
    const backInput = document.getElementById("backTextInput");
    const imageInput = document.getElementById("imageInput");
    const fileInput = document.getElementById("imageFileInput");
    const deckSelect = document.getElementById("deckSelect");
    const imageResults = document.getElementById("imageResults");
    const previewCard = document.getElementById("formPreviewCard");
    const previewTag = document.getElementById("formPreviewTag");
    const previewText = document.getElementById("formPreviewText");
    const previewImage = document.getElementById("formPreviewImage");
    const imagePreviewWrap = document.getElementById("imagePreviewWrap");
    const imagePreviewThumb = document.getElementById("imagePreviewThumb");

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

    function showImagePreview(src) {
      imagePreviewThumb.src = src;
      imagePreviewWrap.classList.add("visible");
    }

    function clearImagePreview() {
      imagePreviewThumb.src = "";
      imagePreviewWrap.classList.remove("visible");
      fileInput.value = "";
    }

    function updatePreview() {
      const isFront = ctx.state.cardForm.previewFace === "front";
      const imageValue = imageInput.value.trim();

      previewTag.textContent = t(isFront ? "study.question" : "study.answer");
      previewText.textContent = isFront
        ? frontInput.value.trim() || t("cardForm.frontPlaceholder")
        : backInput.value.trim() || t("cardForm.backPlaceholder");

      if (!isFront && imageValue) {
        previewImage.hidden = false;
        previewImage.src = imageValue;
        previewImage.alt = frontInput.value.trim() || "Card image";
      } else {
        previewImage.hidden = true;
        previewImage.src = "";
      }
    }

    function updateCardFormTitle() {
      document.getElementById("cardFormTitle").textContent = t(
        ctx.state.cardForm.editDeckId !== null && ctx.state.cardForm.editCardId !== null
          ? "cardForm.titleEdit"
          : "cardForm.titleCreate"
      );
    }

    function open(deckId, cardId, returnScreen) {
      ctx.state.cardForm.returnScreen = returnScreen || "homeScreen";
      ctx.state.cardForm.editDeckId = deckId;
      ctx.state.cardForm.editCardId = cardId;
      ctx.state.cardForm.previewFace = "front";

      populateDeckSelect(deckId);
      clearElement(imageResults);
      clearImagePreview();
      fileInput.value = "";

      if (deckId !== null && cardId !== null) {
        const deck = ctx.getDeckById(deckId);
        const card = deck?.cards.find((item) => item.id === cardId);

        frontInput.value = card?.frontText || "";
        backInput.value = card?.backText || "";
        imageInput.value = card?.image || "";
      } else {
        frontInput.value = "";
        backInput.value = "";
        imageInput.value = "";
      }

      if (imageInput.value.trim()) {
        showImagePreview(imageInput.value.trim());
      }

      updateCardFormTitle();
      updatePreview();
      ctx.router.goTo("createCardScreen", ctx.navTargetForScreen(ctx.state.cardForm.returnScreen));
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

    function saveCard() {
      const frontText = frontInput.value.trim();
      const backText = backInput.value.trim();
      const image = imageInput.value.trim();
      const targetDeck = ctx.getDeckById(deckSelect.value);

      if (!frontText || !backText) {
        ctx.toast.error(t("alerts.requiredFields"));
        return;
      }

      if (!targetDeck) {
        ctx.toast.error(t("alerts.chooseDeck"));
        return;
      }

      if (image && !ctx.isValidImageValue(image)) {
        ctx.toast.error(t("alerts.invalidImageUrl"));
        return;
      }

      const editingDeck = ctx.getDeckById(ctx.state.cardForm.editDeckId);
      const editingCard = editingDeck?.cards.find((card) => card.id === ctx.state.cardForm.editCardId);

      const savedCard = createCard({ frontText, backText, image }, editingCard?.id || null);
      if (!savedCard) {
        ctx.toast.error(t("alerts.requiredFields"));
        return;
      }

      if (editingDeck && editingCard) {
        editingDeck.cards = editingDeck.cards.filter((card) => card.id !== editingCard.id);
      }

      targetDeck.cards.push(savedCard);
      ctx.state.editingDeckId = targetDeck.id;
      ctx.store.saveDecksSoon();
      ctx.homeView.render();
      ctx.libraryView.render();
      ctx.deckEditorView.render();
      ctx.toast.success(t("alerts.cardSaved"));
      navigateBack();
    }

    async function fetchDefinition(button) {
      const word = frontInput.value.trim();
      if (!word) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      const initialText = button.textContent;
      button.disabled = true;
      button.textContent = t("common.loading");

      try {
        const response = await ctx.api.fetchDefinition(
          word,
          document.getElementById("dictLangSelect").value
        );

        if (response.aborted) return;

        if (response.ok && response.data.definition) {
          backInput.value = response.data.definition;
          updatePreview();
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

    async function searchImages(button) {
      const query = frontInput.value.trim();
      if (!query) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      button.disabled = true;
      button.textContent = t("common.loading");
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
              "data-regular": photo.regular
            }
          }));
        });
      } catch {
        setImageResultsMessage(t("alerts.serverUnavailable"));
      } finally {
        button.disabled = false;
        button.textContent = t("cardForm.searchImages");
      }
    }

    document.getElementById("backFromCardFormBtn").addEventListener("click", navigateBack);
    document.getElementById("saveCardBtn").addEventListener("click", saveCard);
    document.getElementById("getDefinitionBtn").addEventListener("click", (event) => {
      fetchDefinition(event.currentTarget);
    });
    document.getElementById("searchImagesBtn").addEventListener("click", (event) => {
      searchImages(event.currentTarget);
    });
    document.getElementById("previewFlipBtn").addEventListener("click", () => {
      ctx.state.cardForm.previewFace = ctx.state.cardForm.previewFace === "front" ? "back" : "front";
      updatePreview();
    });
    previewCard.addEventListener("click", () => {
      ctx.state.cardForm.previewFace = ctx.state.cardForm.previewFace === "front" ? "back" : "front";
      updatePreview();
    });
    previewCard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        previewCard.click();
      }
    });
    imageResults.addEventListener("click", (event) => {
      const image = event.target.closest("img[data-regular]");
      if (!image) return;

      imageResults.querySelectorAll("img").forEach((item) => item.classList.remove("selected"));
      image.classList.add("selected");
      imageInput.value = image.dataset.regular;
      showImagePreview(image.dataset.regular);
      updatePreview();
    });
    imageInput.addEventListener("input", () => {
      const value = imageInput.value.trim();
      if (value) {
        showImagePreview(value);
      } else {
        clearImagePreview();
      }

      updatePreview();
    });
    document.getElementById("imagePreviewClearBtn").addEventListener("click", () => {
      imageInput.value = "";
      clearImagePreview();
      updatePreview();
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.addEventListener("load", () => {
        const maxSide = 800;
        let width = image.width;
        let height = image.height;

        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round(height * maxSide / width);
            width = maxSide;
          } else {
            width = Math.round(width * maxSide / height);
            height = maxSide;
          }
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        imageInput.value = dataUrl;
        showImagePreview(dataUrl);
        updatePreview();
        URL.revokeObjectURL(objectUrl);
      });

      image.src = objectUrl;
    });

    [frontInput, backInput].forEach((input) => {
      input.addEventListener("input", updatePreview);
    });

    [frontInput, backInput, imageInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          saveCard();
        }
      });
    });

    return {
      open,
      navigateBack,
      render: updatePreview
    };
  }

  Karto.createCardFormView = createCardFormView;
})(window);
