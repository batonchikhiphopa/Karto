(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  function appendChildren(parent, children) {
    children
      .flat()
      .filter((child) => child !== null && child !== undefined)
      .forEach((child) => {
        if (typeof child === "string") {
          parent.appendChild(document.createTextNode(child));
          return;
        }

        parent.appendChild(child);
      });

    return parent;
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    return element;
  }

  function setAttributes(element, attrs = {}) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === null || value === undefined || value === false) return;

      if (value === true) {
        element.setAttribute(name, "");
        return;
      }

      element.setAttribute(name, String(value));
    });

    return element;
  }

  function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    const {
      className,
      text,
      attrs,
      dataset,
      children,
      value,
      properties,
      listeners
    } = options;

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    if (attrs) {
      setAttributes(element, attrs);
    }

    if (dataset) {
      Object.entries(dataset).forEach(([key, dataValue]) => {
        if (dataValue !== undefined && dataValue !== null) {
          element.dataset[key] = String(dataValue);
        }
      });
    }

    if (value !== undefined) {
      element.value = value;
    }

    if (properties) {
      Object.assign(element, properties);
    }

    if (listeners) {
      Object.entries(listeners).forEach(([eventName, handler]) => {
        element.addEventListener(eventName, handler);
      });
    }

    if (children) {
      appendChildren(element, children);
    }

    return element;
  }

  function replaceChildren(element, children = []) {
    clearElement(element);
    appendChildren(element, children);
    return element;
  }

  return {
    appendChildren,
    clearElement,
    createElement,
    replaceChildren,
    setAttributes
  };
});
