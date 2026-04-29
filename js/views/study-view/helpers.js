(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  Karto.studyViewHelpers = {
    clamp,
    createStudyTextNode,
    getAnswerTexts,
    getCurrentImage,
    getImageOrientation,
    getStudyImageSource,
    getStudyImageSources,
    isLongStudyText,
    normalizeStudyImageUrl,
    splitStudyParagraphs
  };
})(window);
