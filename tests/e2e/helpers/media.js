const { fs, path } = require("./electron-app");

function createSvgDataUrl(label, color, width = 640, height = 420) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/><text x="40" y="${Math.round(height / 2)}" font-size="56" fill="white">${label}</text></svg>`
  )}`;
}

function writeSvgImageFile(directory, filename, label, color) {
  const filePath = path.join(directory, filename);
  fs.writeFileSync(
    filePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="${color}"/><text x="120" y="520" font-size="120" fill="white">${label}</text></svg>`
  );
  return filePath;
}

module.exports = {
  createSvgDataUrl,
  writeSvgImageFile
};
