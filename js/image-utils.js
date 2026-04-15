(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  const Karto = root.Karto || (root.Karto = {});
  Object.assign(Karto, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  const TILE_THUMB_MAX_SIDE = 360;
  const TILE_THUMB_URL_WIDTH = 480;
  const TILE_THUMB_QUALITY = 0.72;
  const STUDY_IMAGE_URL_WIDTH = 800;
  const STUDY_IMAGE_QUALITY = 0.68;
  const STUDY_DATA_IMAGE_MAX_SIDE = 720;

  function normalizeImageSource(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isDataImageUrl(value) {
    return normalizeImageSource(value).startsWith("data:image/");
  }

  function isUnsplashImageUrl(value) {
    const source = normalizeImageSource(value);
    if (!source) {
      return false;
    }

    try {
      return new URL(source).hostname === "images.unsplash.com";
    } catch {
      return false;
    }
  }

  function optimizeUnsplashImageUrl(value, options = {}) {
    const source = normalizeImageSource(value);
    if (!isUnsplashImageUrl(source)) {
      return "";
    }

    try {
      const parsed = new URL(source);
      parsed.searchParams.set("w", String(options.width || TILE_THUMB_URL_WIDTH));
      parsed.searchParams.set("q", String(Math.round((options.quality || TILE_THUMB_QUALITY) * 100)));
      parsed.searchParams.set("fm", options.format || "webp");
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function deriveTileImageUrl(value) {
    return optimizeUnsplashImageUrl(value, {
      width: TILE_THUMB_URL_WIDTH,
      quality: TILE_THUMB_QUALITY
    });
  }

  function deriveStudyImageUrl(value) {
    return optimizeUnsplashImageUrl(value, {
      width: STUDY_IMAGE_URL_WIDTH,
      quality: STUDY_IMAGE_QUALITY
    }) || normalizeImageSource(value);
  }

  function getResizedDimensions(width, height, maxSide) {
    const safeWidth = Number(width) || 0;
    const safeHeight = Number(height) || 0;
    const safeMaxSide = Number(maxSide) || TILE_THUMB_MAX_SIDE;

    if (safeWidth <= 0 || safeHeight <= 0) {
      return { width: 1, height: 1 };
    }

    if (safeWidth <= safeMaxSide && safeHeight <= safeMaxSide) {
      return {
        width: Math.round(safeWidth),
        height: Math.round(safeHeight)
      };
    }

    if (safeWidth > safeHeight) {
      return {
        width: safeMaxSide,
        height: Math.max(1, Math.round(safeHeight * safeMaxSide / safeWidth))
      };
    }

    return {
      width: Math.max(1, Math.round(safeWidth * safeMaxSide / safeHeight)),
      height: safeMaxSide
    };
  }

  function resizeImageElementToDataUrl(image, options = {}) {
    const documentRef = root.document;
    if (!documentRef || typeof documentRef.createElement !== "function") {
      return "";
    }

    const dimensions = getResizedDimensions(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      options.maxSide || TILE_THUMB_MAX_SIDE
    );
    const canvas = documentRef.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    return canvas.toDataURL(options.mimeType || "image/jpeg", options.quality || TILE_THUMB_QUALITY);
  }

  function loadImage(source) {
    const normalizedSource = normalizeImageSource(source);
    if (!normalizedSource || typeof root.Image !== "function") {
      return Promise.reject(new Error("Image loading is unavailable."));
    }

    return new Promise((resolve, reject) => {
      const image = new root.Image();

      image.addEventListener("load", async () => {
        try {
          if (typeof image.decode === "function") {
            await image.decode();
          }
        } catch {
          // decode() is an optimization only; loaded images can still be drawn.
        }

        resolve(image);
      }, { once: true });

      image.addEventListener("error", () => {
        reject(new Error("Image failed to load."));
      }, { once: true });

      image.decoding = "async";
      image.src = normalizedSource;
    });
  }

  async function createDataImageThumbnail(source, options = {}) {
    const normalizedSource = normalizeImageSource(source);
    if (!isDataImageUrl(normalizedSource)) {
      return "";
    }

    const image = await loadImage(normalizedSource);
    return resizeImageElementToDataUrl(image, {
      maxSide: options.maxSide || TILE_THUMB_MAX_SIDE,
      quality: options.quality || TILE_THUMB_QUALITY,
      mimeType: options.mimeType || "image/jpeg"
    });
  }

  async function createDataImageStudyVersion(source, options = {}) {
    const normalizedSource = normalizeImageSource(source);
    if (!isDataImageUrl(normalizedSource)) {
      return "";
    }

    const image = await loadImage(normalizedSource);
    return resizeImageElementToDataUrl(image, {
      maxSide: options.maxSide || STUDY_DATA_IMAGE_MAX_SIDE,
      quality: options.quality || STUDY_IMAGE_QUALITY,
      mimeType: options.mimeType || "image/jpeg"
    });
  }

  return {
    STUDY_DATA_IMAGE_MAX_SIDE,
    TILE_THUMB_MAX_SIDE,
    TILE_THUMB_QUALITY,
    TILE_THUMB_URL_WIDTH,
    STUDY_IMAGE_QUALITY,
    STUDY_IMAGE_URL_WIDTH,
    createDataImageStudyVersion,
    createDataImageThumbnail,
    deriveStudyImageUrl,
    deriveTileImageUrl,
    getResizedDimensions,
    isDataImageUrl,
    isUnsplashImageUrl,
    loadImage,
    normalizeImageSource,
    optimizeUnsplashImageUrl,
    resizeImageElementToDataUrl
  };
});
