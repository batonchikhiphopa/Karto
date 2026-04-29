"use strict";

const {
  createId,
  normalizeExtraSides
} = require("../data-model");
const {
  deriveStudyImageUrl,
  deriveTileImageUrl,
  getResizedDimensions,
  isDataImageUrl,
  normalizeImageSource,
  STUDY_DATA_IMAGE_MAX_SIDE,
  STUDY_IMAGE_QUALITY,
  TILE_THUMB_MAX_SIDE,
  TILE_THUMB_QUALITY
} = require("../image-utils");

const DEFAULT_THEME_PREFERENCE = "system";
const DEFAULT_HOME_GRID_COLUMNS = "auto";
const DEFAULT_LANGUAGE = "en";
const MAX_STUDY_SESSIONS_PER_DECK = 5;
const APP_SHELL_LAST_DECK_CARD_LIMIT = 5;
const APP_SHELL_OTHER_DECK_CARD_LIMIT = 1;

const SETTINGS_KEYS = Object.freeze({
  language: "language",
  theme: "theme",
  homeGridColumns: "homeGridColumns",
  homeMediaCache: "homeMediaCache"
});

function normalizeThemePreference(value) {
  return ["system", "dark", "light"].includes(value) ? value : DEFAULT_THEME_PREFERENCE;
}

function normalizeHomeGridColumns(value) {
  return ["auto", "2", "3", "4"].includes(value) ? value : DEFAULT_HOME_GRID_COLUMNS;
}

function normalizeLanguage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
  return ["ru", "en", "de"].includes(normalized) ? normalized : null;
}

function normalizeStudyProgressEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const seenCount = Number.isFinite(Number(entry.seenCount)) ? Math.max(0, Math.round(Number(entry.seenCount))) : 0;
  const correctCount = Number.isFinite(Number(entry.correctCount))
    ? Math.max(0, Math.round(Number(entry.correctCount)))
    : 0;

  return {
    seenCount,
    correctCount,
    lastResult: typeof entry.lastResult === "string" && entry.lastResult ? entry.lastResult : null,
    lastReviewedAt: typeof entry.lastReviewedAt === "string" && entry.lastReviewedAt ? entry.lastReviewedAt : null
  };
}

function normalizeStudyProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((result, [cardId, entry]) => {
    if (typeof cardId !== "string" || !cardId.trim()) {
      return result;
    }

    const normalizedEntry = normalizeStudyProgressEntry(entry);
    if (!normalizedEntry) {
      return result;
    }

    result[cardId] = normalizedEntry;
    return result;
  }, {});
}

function normalizeStudySession(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const deckId = typeof entry.deckId === "string" ? entry.deckId.trim() : "";
  if (!deckId || !Object.prototype.hasOwnProperty.call(entry, "completedRounds")) {
    return null;
  }

  const completedRounds = Number.isFinite(Number(entry.completedRounds))
    ? Math.max(0, Math.round(Number(entry.completedRounds)))
    : null;

  if (completedRounds === null) {
    return null;
  }

  return {
    deckId,
    deckName: typeof entry.deckName === "string" && entry.deckName ? entry.deckName : "Deck",
    completedRounds,
    finishedAt: typeof entry.finishedAt === "string" && entry.finishedAt ? entry.finishedAt : new Date().toISOString()
  };
}

function compareStudySessionsByFinishedAtDesc(left, right) {
  const leftTime = Date.parse(left.finishedAt) || 0;
  const rightTime = Date.parse(right.finishedAt) || 0;
  return rightTime - leftTime;
}

function normalizeStudySessions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const countsByDeckId = new Map();

  return value
    .map(normalizeStudySession)
    .filter(Boolean)
    .sort(compareStudySessionsByFinishedAtDesc)
    .filter((session) => {
      const count = countsByDeckId.get(session.deckId) || 0;
      if (count >= MAX_STUDY_SESSIONS_PER_DECK) {
        return false;
      }

      countsByDeckId.set(session.deckId, count + 1);
      return true;
    });
}

function safeParseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseExtraSides(value) {
  return normalizeExtraSides(safeParseJson(value, []));
}

function normalizeHomeMediaCacheEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const signature = typeof entry.signature === "string" ? entry.signature.trim() : "";
  if (!signature) {
    return null;
  }

  const seenImages = new Set();
  const images = (Array.isArray(entry.images) ? entry.images : [])
    .map((image) => (typeof image === "string" ? image.trim() : ""))
    .filter((image) => {
      if (!image || seenImages.has(image)) {
        return false;
      }

      seenImages.add(image);
      return true;
    });

  return {
    signature,
    images,
    updatedAt: typeof entry.updatedAt === "string" && entry.updatedAt
      ? entry.updatedAt
      : new Date().toISOString()
  };
}

function normalizeHomeMediaCache(value) {
  const parsedValue = safeParseJson(value, {});
  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return {};
  }

  return Object.entries(parsedValue).reduce((result, [deckId, entry]) => {
    if (typeof deckId !== "string" || !deckId.trim()) {
      return result;
    }

    const normalizedEntry = normalizeHomeMediaCacheEntry(entry);
    if (!normalizedEntry) {
      return result;
    }

    result[deckId] = normalizedEntry;
    return result;
  }, {});
}

function deriveLightStudyImageUrl(image, imageStudy) {
  const explicitStudyImage = normalizeImageSource(imageStudy);
  if (explicitStudyImage && !isDataImageUrl(explicitStudyImage)) {
    return explicitStudyImage;
  }

  const source = normalizeImageSource(image);
  if (!source || isDataImageUrl(source)) {
    return "";
  }

  return deriveStudyImageUrl(source);
}

function deriveLightThumbImageUrl(image, imageThumb) {
  const explicitThumb = normalizeImageSource(imageThumb);
  if (explicitThumb) {
    return explicitThumb;
  }

  const source = normalizeImageSource(image);
  if (!source || isDataImageUrl(source)) {
    return "";
  }

  return deriveTileImageUrl(source);
}

function isJpegDataImageUrl(value) {
  return /^data:image\/jpe?g[;,]/i.test(normalizeImageSource(value));
}

function resolveStoredDerivedStudyUrl(image) {
  const derived = deriveStudyImageUrl(image);
  return derived && derived !== image ? derived : "";
}

function resolveNativeImage(options) {
  return options?.nativeImage && typeof options.nativeImage.createFromDataURL === "function"
    ? options.nativeImage
    : null;
}

function resizeDataImageWithNativeImage(source, options = {}) {
  const normalizedSource = normalizeImageSource(source);
  const nativeImage = resolveNativeImage(options);
  if (!isDataImageUrl(normalizedSource) || !nativeImage) {
    return "";
  }

  try {
    const image = nativeImage.createFromDataURL(normalizedSource);
    if (!image || image.isEmpty?.()) {
      return "";
    }

    const size = typeof image.getSize === "function" ? image.getSize() : {};
    const dimensions = getResizedDimensions(size.width, size.height, options.maxSide);
    const sourceWidth = Math.max(1, Math.round(Number(size.width) || dimensions.width));
    const sourceHeight = Math.max(1, Math.round(Number(size.height) || dimensions.height));
    const shouldResize = dimensions.width !== sourceWidth || dimensions.height !== sourceHeight;

    if (!options.force && !shouldResize && isJpegDataImageUrl(normalizedSource)) {
      return normalizedSource;
    }

    const outputImage = shouldResize && typeof image.resize === "function"
      ? image.resize({
        width: dimensions.width,
        height: dimensions.height,
        quality: "good"
      })
      : image;
    const quality = Math.round(Math.max(0, Math.min(1, Number(options.quality) || 0.72)) * 100);
    const buffer = typeof outputImage.toJPEG === "function" ? outputImage.toJPEG(quality) : null;

    return buffer?.length
      ? `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`
      : "";
  } catch {
    return "";
  }
}

function normalizeLocalDataImageForStudy(source, nativeImage) {
  return resizeDataImageWithNativeImage(source, {
    maxSide: STUDY_DATA_IMAGE_MAX_SIDE,
    quality: STUDY_IMAGE_QUALITY,
    nativeImage
  }) || normalizeImageSource(source);
}

function createLocalDataImageThumb(source, nativeImage) {
  return resizeDataImageWithNativeImage(source, {
    force: true,
    maxSide: TILE_THUMB_MAX_SIDE,
    quality: TILE_THUMB_QUALITY,
    nativeImage
  });
}

function normalizePersistedCardMedia(card, options = {}) {
  if (!card) {
    return card;
  }

  const nativeImage = resolveNativeImage(options);
  let image = normalizeImageSource(card.image);
  let imageThumb = normalizeImageSource(card.imageThumb);
  let imageStudy = normalizeImageSource(card.imageStudy);
  const imageIsData = isDataImageUrl(image);
  const studyIsData = isDataImageUrl(imageStudy);

  if (imageIsData || (!image && studyIsData)) {
    image = studyIsData ? imageStudy : normalizeLocalDataImageForStudy(image, nativeImage);
    imageThumb = imageThumb || createLocalDataImageThumb(image, nativeImage);
    imageStudy = "";
  } else if (image) {
    imageThumb = imageThumb || deriveTileImageUrl(image);
    imageStudy = imageStudy && !studyIsData
      ? imageStudy
      : resolveStoredDerivedStudyUrl(image);
  } else if (studyIsData) {
    image = imageStudy;
    imageThumb = imageThumb || createLocalDataImageThumb(image, nativeImage);
    imageStudy = "";
  } else {
    imageStudy = imageStudy && !studyIsData ? imageStudy : "";
  }

  return {
    ...card,
    image,
    imageThumb,
    imageStudy,
    hasImage: card.hasImage || !!image || !!imageThumb || !!imageStudy,
    mediaLoaded: card.mediaLoaded
  };
}

function mapCardRow(row, options = {}) {
  const fullImage = normalizeImageSource(row?.image);
  const imageThumb = options.includeFullImage
    ? normalizeImageSource(row.imageThumb)
    : deriveLightThumbImageUrl(fullImage, row.imageThumb);
  const imageStudy = options.includeFullImage
    ? normalizeImageSource(row?.imageStudy) || (isDataImageUrl(fullImage) ? "" : deriveStudyImageUrl(fullImage))
    : "";
  const hasImage = !!fullImage || !!imageThumb || !!deriveLightStudyImageUrl(fullImage, row?.imageStudy);

  return {
    id: row.id,
    frontText: row.frontText,
    backText: row.backText,
    extraSides: parseExtraSides(row.extraSides),
    image: options.includeFullImage ? fullImage : "",
    imageThumb,
    imageStudy,
    imageSide: row.imageSide === "front" ? "front" : "back",
    hasImage,
    mediaLoaded: options.includeFullImage || !fullImage
  };
}

function mergeCardWithExistingMedia(card, existingCard) {
  if (!existingCard || card.mediaLoaded !== false) {
    return card;
  }

  return {
    ...card,
    image: existingCard.image || card.image || "",
    imageThumb: card.imageThumb || existingCard.imageThumb || "",
    imageStudy: card.imageStudy || existingCard.imageStudy || "",
    hasImage: card.hasImage || existingCard.hasImage,
    mediaLoaded: true
  };
}

function mergePartialDeckCards(deck, existingCards) {
  if (deck.cardsHydrated === true || !Array.isArray(existingCards) || existingCards.length === 0) {
    return deck.cards;
  }

  const partialCardsById = new Map(deck.cards.map((card) => [card.id, card]));
  const mergedCards = existingCards.map((existingCard) => {
    const partialCard = partialCardsById.get(existingCard.id);
    if (!partialCard) {
      return existingCard;
    }

    partialCardsById.delete(existingCard.id);
    return mergeCardWithExistingMedia(partialCard, existingCard);
  });

  partialCardsById.forEach((card) => {
    mergedCards.push(card);
  });

  return mergedCards;
}

function createRepositoryError(message) {
  return new Error(`[karto][sqlite] ${message}`);
}

module.exports = {
  APP_SHELL_LAST_DECK_CARD_LIMIT,
  APP_SHELL_OTHER_DECK_CARD_LIMIT,
  DEFAULT_HOME_GRID_COLUMNS,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_PREFERENCE,
  MAX_STUDY_SESSIONS_PER_DECK,
  SETTINGS_KEYS,
  createRepositoryError,
  deriveLightStudyImageUrl,
  deriveLightThumbImageUrl,
  mapCardRow,
  mergeCardWithExistingMedia,
  mergePartialDeckCards,
  normalizeHomeGridColumns,
  normalizeHomeMediaCache,
  normalizeLanguage,
  normalizePersistedCardMedia,
  normalizeStudySession,
  normalizeStudyProgress,
  normalizeStudyProgressEntry,
  normalizeStudySessions,
  normalizeThemePreference,
  parseExtraSides,
  safeParseJson
};
