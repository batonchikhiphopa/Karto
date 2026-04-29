(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createCardFormImageController(options) {
    const {
      ctx,
      fileInput,
      imageInput,
      imagePreviewThumb,
      imagePreviewWrap,
      imageResults,
      imageSideBackBtn,
      imageSideFrontBtn,
      normalizeSide,
      queryInput
    } = options;

    function ensureImageState() {
      ctx.state.cardForm.imageSide = normalizeSide(ctx.state.cardForm.imageSide);
      ctx.state.cardForm.imageTargetSide = normalizeSide(
        ctx.state.cardForm.imageTargetSide || ctx.state.cardForm.imageSide
      );
    }

    function deriveThumb(value) {
      return Karto.deriveTileImageUrl?.(value) || "";
    }

    function deriveStudy(value) {
      return Karto.deriveStudyImageUrl?.(value) || value;
    }

    function syncSideButtons() {
      ensureImageState();
      const imageSide = normalizeSide(ctx.state.cardForm.imageSide);
      imageSideFrontBtn.classList.toggle("is-active", imageSide === "front");
      imageSideBackBtn.classList.toggle("is-active", imageSide === "back");
    }

    function setSide(side) {
      const normalizedSide = normalizeSide(side);
      ensureImageState();
      ctx.state.cardForm.imageSide = normalizedSide;
      ctx.state.cardForm.imageTargetSide = normalizedSide;
      syncSideButtons();
    }

    function setTargetSide(side) {
      ensureImageState();
      ctx.state.cardForm.imageTargetSide = normalizeSide(side);
    }

    function showPreview(src) {
      imagePreviewThumb.src = src;
      imagePreviewWrap.classList.add("visible");
    }

    function clearPreview() {
      imagePreviewThumb.src = "";
      imagePreviewWrap.classList.remove("visible");
      fileInput.value = "";
    }

    function applyValue(value, imageThumb, imageStudy) {
      ensureImageState();
      ctx.state.cardForm.imageSide = normalizeSide(ctx.state.cardForm.imageTargetSide);
      ctx.state.cardForm.imageThumb = value
        ? typeof imageThumb === "string" ? imageThumb : deriveThumb(value)
        : "";
      ctx.state.cardForm.imageStudy = value
        ? typeof imageStudy === "string" ? imageStudy : deriveStudy(value)
        : "";
      imageInput.value = value;

      if (value) {
        showPreview(value);
      } else {
        clearPreview();
      }

      syncSideButtons();
    }

    function clearResults() {
      clearElement(imageResults);
    }

    function setResultsMessage(message) {
      replaceChildren(imageResults, [document.createTextNode(message)]);
    }

    function promptUpload() {
      ensureImageState();
      setTargetSide(ctx.state.cardForm.imageSide);
      fileInput.click();
    }

    function setButtonLoading(button, isLoading) {
      button.disabled = isLoading;
      button.classList.toggle("is-loading", isLoading);
    }

    async function search(button) {
      const query = queryInput.value.trim();
      if (!query) {
        ctx.toast.error(t("alerts.enterFrontWord"));
        return;
      }

      ensureImageState();
      setTargetSide(ctx.state.cardForm.imageSide);
      setButtonLoading(button, true);
      setResultsMessage(t("common.loading"));

      try {
        const response = await ctx.api.searchImages(query);
        if (response.aborted) return;

        clearResults();
        if (!response.ok) {
          const message = response.data?.error || t("alerts.serverUnavailable");
          ctx.toast.error(message);
          setResultsMessage(message);
          return;
        }

        const images = Array.isArray(response.data.images) ? response.data.images : [];
        if (images.length === 0) {
          setResultsMessage(t("alerts.nothingFound"));
          return;
        }

        images.forEach((photo) => {
          imageResults.appendChild(createElement("img", {
            attrs: {
              src: photo.small,
              alt: photo.alt || query,
              title: t("cardForm.imageSelectTitle"),
              "data-regular": deriveStudy(photo.regular),
              "data-thumb": deriveThumb(photo.small || photo.regular),
              "data-study": deriveStudy(photo.regular)
            }
          }));
        });
      } catch {
        setResultsMessage(t("alerts.serverUnavailable"));
      } finally {
        setButtonLoading(button, false);
      }
    }

    function readFields() {
      const image = imageInput.value.trim();
      return {
        image,
        imageSide: normalizeSide(ctx.state.cardForm.imageSide),
        imageStudy: image ? ctx.state.cardForm.imageStudy || deriveStudy(image) : "",
        imageThumb: image ? ctx.state.cardForm.imageThumb || deriveThumb(image) : ""
      };
    }

    function setFromCard(card) {
      imageInput.value = card?.image || card?.imageStudy || "";
      ctx.state.cardForm.imageThumb = card?.imageThumb || deriveThumb(card?.image || "");
      ctx.state.cardForm.imageStudy = card?.imageStudy || deriveStudy(card?.image || "");
      ctx.state.cardForm.imageSide = normalizeSide(card?.imageSide);
      ctx.state.cardForm.imageTargetSide = ctx.state.cardForm.imageSide;
    }

    function reset() {
      imageInput.value = "";
      ctx.state.cardForm.imageThumb = "";
      ctx.state.cardForm.imageStudy = "";
      ctx.state.cardForm.imageSide = "back";
      ctx.state.cardForm.imageTargetSide = "back";
    }

    function render() {
      syncSideButtons();
      if (imageInput.value.trim()) {
        showPreview(imageInput.value.trim());
      } else {
        clearPreview();
      }
    }

    function bind({ searchButton, uploadButton }) {
      searchButton.addEventListener("click", (event) => search(event.currentTarget));
      uploadButton.addEventListener("click", promptUpload);
      imageSideFrontBtn.addEventListener("click", () => setSide("front"));
      imageSideBackBtn.addEventListener("click", () => setSide("back"));
      imageResults.addEventListener("click", (event) => {
        const image = event.target.closest("img[data-regular]");
        if (!image) return;

        imageResults.querySelectorAll("img").forEach((item) => item.classList.remove("selected"));
        image.classList.add("selected");
        applyValue(image.dataset.regular, image.dataset.thumb || "", image.dataset.study || "");
      });
      imageInput.addEventListener("input", () => {
        const value = imageInput.value.trim();
        ctx.state.cardForm.imageThumb = value ? deriveThumb(value) : "";
        ctx.state.cardForm.imageStudy = value ? deriveStudy(value) : "";
        render();
      });
      document.getElementById("imagePreviewClearBtn").addEventListener("click", () => applyValue(""));
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
          applyValue(studyImage, imageThumb, "");
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
    }

    return {
      bind,
      clearPreview,
      clearResults,
      deriveStudy,
      deriveThumb,
      readFields,
      render,
      reset,
      setFromCard,
      syncSideButtons
    };
  }

  Karto.createCardFormImageController = createCardFormImageController;
})(window);
