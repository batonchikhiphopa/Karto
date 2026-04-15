"use strict";

const { URL } = require("node:url");

const SAFE_EXTERNAL_ORIGINS = new Set([
  "https://github.com"
]);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isSameOrigin(url, baseUrl) {
  const parsedUrl = parseUrl(url);
  const parsedBaseUrl = parseUrl(baseUrl);
  return !!parsedUrl && !!parsedBaseUrl && parsedUrl.origin === parsedBaseUrl.origin;
}

function isAllowedAppNavigation(url, getAppBaseUrl) {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  if (url.startsWith("data:text/html")) {
    return true;
  }

  const appBaseUrl = getAppBaseUrl?.();
  if (appBaseUrl && isSameOrigin(url, appBaseUrl)) {
    return true;
  }

  return false;
}

function isSafeExternalUrl(url) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return false;
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    return false;
  }

  return SAFE_EXTERNAL_ORIGINS.has(parsedUrl.origin);
}

function configureAppSecurity({ app, session, shell, getAppBaseUrl }) {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, url) => {
      if (!isAllowedAppNavigation(url, getAppBaseUrl)) {
        event.preventDefault();
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) {
        setImmediate(() => {
          shell.openExternal(url).catch((error) => {
            console.error("[karto] Failed to open external URL:", error);
          });
        });
      }

      return { action: "deny" };
    });
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });

    session.defaultSession.setPermissionCheckHandler(() => false);
  });
}

module.exports = {
  configureAppSecurity,
  isAllowedAppNavigation,
  isSafeExternalUrl
};
