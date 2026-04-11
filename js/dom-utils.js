(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const ICON_DEFINITIONS = Object.freeze({
    addFromOther: [
      { tag: "rect", attrs: { x: "5", y: "7", width: "10", height: "10", rx: "1.8" } },
      { tag: "path", attrs: { d: "M9 4h8a2 2 0 0 1 2 2v8" } },
      { tag: "path", attrs: { d: "M19 13v6" } },
      { tag: "path", attrs: { d: "M16 16h6" } }
    ],
    mergeDeck: [
      { tag: "rect", attrs: { x: "4", y: "4", width: "9", height: "7", rx: "1.6" } },
      { tag: "rect", attrs: { x: "11", y: "13", width: "9", height: "7", rx: "1.6" } },
      { tag: "path", attrs: { d: "M8 14c.6 1.8 2.2 3 4 3" } },
      { tag: "path", attrs: { d: "M10 15l2 2-2 2" } }
    ],
    moveCard: [
      { tag: "rect", attrs: { x: "3", y: "6", width: "10", height: "12", rx: "2" } },
      { tag: "path", attrs: { d: "M15 12h6" } },
      { tag: "path", attrs: { d: "M18 9l3 3-3 3" } }
    ],
    share: [
      { tag: "circle", attrs: { cx: "6", cy: "12", r: "2.2" } },
      { tag: "circle", attrs: { cx: "17", cy: "7", r: "2.2" } },
      { tag: "circle", attrs: { cx: "17", cy: "17", r: "2.2" } },
      { tag: "path", attrs: { d: "M8 11l7-3" } },
      { tag: "path", attrs: { d: "M8 13l7 3" } }
    ],
    uploadImage: [
      { tag: "rect", attrs: { x: "4", y: "5", width: "16", height: "14", rx: "2" } },
      { tag: "path", attrs: { d: "M8 16l3-3 2 2 2-3 3 4" } },
      { tag: "path", attrs: { d: "M12 11V3" } },
      { tag: "path", attrs: { d: "M9 6l3-3 3 3" } }
    ]
  });

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

  function createSvgElement(tagName, attrs = {}) {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);
    setAttributes(element, attrs);
    return element;
  }

  function createIcon(name, options = {}) {
    const definition = ICON_DEFINITIONS[name];
    const className = ["ui-icon", options.className].filter(Boolean).join(" ");

    if (!definition) {
      return createElement("span", {
        className,
        attrs: {
          "aria-hidden": "true"
        }
      });
    }

    const icon = createSvgElement("svg", {
      class: className,
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      focusable: "false",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });

    definition.forEach((shape) => {
      icon.appendChild(createSvgElement(shape.tag, shape.attrs));
    });

    return icon;
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
    createIcon,
    createElement,
    replaceChildren,
    setAttributes
  };
});
