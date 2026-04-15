const assert = require("node:assert/strict");

const {
  deriveStudyImageUrl,
  deriveTileImageUrl,
  getResizedDimensions,
  isDataImageUrl,
  isUnsplashImageUrl
} = require("../js/image-utils.js");

function testUnsplashTileUrlIsSmallAndWebp() {
  const source = "https://images.unsplash.com/photo-123?ixid=test&w=1200&q=80";
  const tileUrl = deriveTileImageUrl(source);
  const studyUrl = deriveStudyImageUrl(source);
  const parsed = new URL(tileUrl);
  const parsedStudy = new URL(studyUrl);

  assert.equal(parsed.hostname, "images.unsplash.com");
  assert.equal(parsed.searchParams.get("w"), "480");
  assert.equal(parsed.searchParams.get("q"), "72");
  assert.equal(parsed.searchParams.get("fm"), "webp");
  assert.equal(parsedStudy.searchParams.get("w"), "800");
  assert.equal(parsedStudy.searchParams.get("q"), "68");
  assert.equal(parsedStudy.searchParams.get("fm"), "webp");
}

function testNonUnsplashFallbacksStayUnmodified() {
  const remoteUrl = "https://example.com/full.jpg";

  assert.equal(isUnsplashImageUrl(remoteUrl), false);
  assert.equal(deriveTileImageUrl(remoteUrl), "");
  assert.equal(deriveStudyImageUrl(remoteUrl), remoteUrl);
}

function testDataImageDetectionAndResizeMath() {
  assert.equal(isDataImageUrl("data:image/png;base64,abc"), true);
  assert.equal(isDataImageUrl("https://example.com/image.png"), false);
  assert.deepEqual(getResizedDimensions(1600, 800, 360), { width: 360, height: 180 });
  assert.deepEqual(getResizedDimensions(400, 1200, 360), { width: 120, height: 360 });
}

testUnsplashTileUrlIsSmallAndWebp();
testNonUnsplashFallbacksStayUnmodified();
testDataImageDetectionAndResizeMath();

console.log("image-utils tests passed");
