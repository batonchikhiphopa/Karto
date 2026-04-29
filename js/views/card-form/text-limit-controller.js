(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createCardFormTextLimitController(options) {
    const {
      backInput,
      frontInput,
      getExtraSideControls,
      getTextLimit,
      toast
    } = options;

    let measureElement = null;
    let limitTooltip = null;
    let activeLimitField = null;

    function normalizeLimitKind(kind) {
      if (kind === "front" || kind === "extra") {
        return kind;
      }

      return "back";
    }

    function getLimit(kind) {
      const normalizedKind = normalizeLimitKind(kind);
      return getTextLimit?.(normalizedKind) || Karto.getCardTextLimit?.(normalizedKind) || {
        hardChars: normalizedKind === "front" ? 120 : normalizedKind === "extra" ? 1600 : 700,
        softChars: normalizedKind === "front" ? 80 : normalizedKind === "extra" ? 1600 : 700,
        hardLines: normalizedKind === "front" ? 2 : normalizedKind === "extra" ? 9 : 6,
        softLines: normalizedKind === "front" ? 2 : normalizedKind === "extra" ? 9 : 6
      };
    }

    function getFieldLimitKind(field) {
      if (field === frontInput) {
        return "front";
      }

      if (getExtraSideControls().some((control) => control.textarea === field)) {
        return "extra";
      }

      return "back";
    }

    function getMeasureElement() {
      if (measureElement) {
        return measureElement;
      }

      measureElement = document.createElement("div");
      measureElement.className = "text-line-measure";
      measureElement.setAttribute("aria-hidden", "true");
      document.body.appendChild(measureElement);
      return measureElement;
    }

    function getLineHeightPx(computedStyle) {
      const explicitLineHeight = parseFloat(computedStyle.lineHeight);
      if (Number.isFinite(explicitLineHeight)) {
        return explicitLineHeight;
      }

      const fontSize = parseFloat(computedStyle.fontSize);
      return Number.isFinite(fontSize) ? fontSize * 1.2 : 20;
    }

    function measureVisualLineCount(field, value) {
      const text = Karto.normalizeLineBreaks?.(value) || String(value || "").replace(/\r\n?/g, "\n");
      if (!text) {
        return 0;
      }

      const width = Math.max(0, field.clientWidth || field.getBoundingClientRect().width || 0);
      if (width <= 0) {
        return Karto.countWrappedLines?.(text, { maxColumns: field === frontInput ? 60 : 86 }) || 1;
      }

      const computedStyle = root.getComputedStyle(field);
      const measure = getMeasureElement();
      const style = measure.style;
      style.width = `${width}px`;
      style.boxSizing = computedStyle.boxSizing;
      style.padding = computedStyle.padding;
      style.border = computedStyle.border;
      style.font = computedStyle.font;
      style.fontSize = computedStyle.fontSize;
      style.fontFamily = computedStyle.fontFamily;
      style.fontWeight = computedStyle.fontWeight;
      style.letterSpacing = computedStyle.letterSpacing;
      style.lineHeight = computedStyle.lineHeight;
      style.whiteSpace = "pre-wrap";
      style.overflowWrap = "anywhere";
      style.wordBreak = "normal";
      measure.textContent = text.endsWith("\n") ? `${text}\u200b` : text;

      const lineHeight = getLineHeightPx(computedStyle);
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
      const contentHeight = Math.max(0, measure.scrollHeight - paddingTop - paddingBottom);
      return Math.max(1, Math.round(contentHeight / lineHeight));
    }

    function createMetrics(field, kind) {
      const lineCount = measureVisualLineCount(field, field.value);
      if (typeof Karto.createCardTextMetrics === "function") {
        return Karto.createCardTextMetrics(field.value, kind, { lineCount });
      }

      const limit = getLimit(kind);
      const charCount = field.value.length;
      return {
        kind,
        charCount,
        lineCount,
        maxChars: limit.hardChars,
        maxLines: limit.hardLines,
        isEmpty: field.value.trim().length === 0,
        isWarning: charCount >= limit.softChars || lineCount >= limit.softLines,
        isError: charCount > limit.hardChars || lineCount > limit.hardLines
      };
    }

    function formatLimitMessage(metrics) {
      return metrics.isError ? t("cardForm.textLimitError") : "";
    }

    function getLimitTooltip() {
      if (limitTooltip) {
        return limitTooltip;
      }

      limitTooltip = createElement("div", {
        className: "field-limit-tooltip",
        attrs: {
          id: "cardTextLimitTooltip",
          role: "status",
          "aria-live": "polite"
        }
      });
      document.body.appendChild(limitTooltip);
      return limitTooltip;
    }

    function placeLimitTooltip(field) {
      const tooltip = getLimitTooltip();
      const rect = field.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 12;
      const tooltipWidth = tooltip.offsetWidth || 320;
      const left = Math.min(
        Math.max(viewportPadding, rect.right - tooltipWidth),
        Math.max(viewportPadding, root.innerWidth - tooltipWidth - viewportPadding)
      );
      const top = Math.min(
        rect.bottom + gap,
        Math.max(viewportPadding, root.innerHeight - (tooltip.offsetHeight || 64) - viewportPadding)
      );

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function showLimitTooltip(field, metrics = createMetrics(field, getFieldLimitKind(field))) {
      if (!metrics.isError) {
        hideLimitTooltip(field);
        return;
      }

      const tooltip = getLimitTooltip();
      tooltip.textContent = formatLimitMessage(metrics);
      tooltip.classList.toggle("is-error", metrics.isError);
      tooltip.classList.add("visible");
      activeLimitField = field;
      placeLimitTooltip(field);
    }

    function hideLimitTooltip(field) {
      if (field && activeLimitField && field !== activeLimitField) {
        return;
      }

      if (limitTooltip) {
        limitTooltip.classList.remove("visible", "is-error");
      }
      activeLimitField = null;
    }

    function refreshActiveLimitTooltip() {
      if (!activeLimitField) {
        return;
      }

      const metrics = createMetrics(activeLimitField, getFieldLimitKind(activeLimitField));
      showLimitTooltip(activeLimitField, metrics);
    }

    function updateLimitState(field, kind) {
      const metrics = createMetrics(field, kind);
      field.classList.remove("is-limit-warning");
      field.classList.toggle("is-limit-error", metrics.isError);

      if (metrics.isError) {
        const message = formatLimitMessage(metrics);
        getLimitTooltip();
        field.title = message;
        field.setAttribute("aria-describedby", "cardTextLimitTooltip");
      } else {
        field.removeAttribute("title");
        field.removeAttribute("aria-describedby");
      }
      if (metrics.isError) {
        field.setAttribute("aria-invalid", "true");
      } else {
        field.removeAttribute("aria-invalid");
      }

      return metrics;
    }

    function syncLimitStates() {
      updateLimitState(frontInput, "front");
      updateLimitState(backInput, "back");
      getExtraSideControls().forEach((control) => {
        updateLimitState(control.textarea, "extra");
      });
      refreshActiveLimitTooltip();
    }

    function bindLimitField(field, kind) {
      field.addEventListener("input", () => {
        syncLimitStates();
        if (document.activeElement === field) {
          showLimitTooltip(field, updateLimitState(field, kind));
        }
      });
      field.addEventListener("focus", () => {
        showLimitTooltip(field, updateLimitState(field, kind));
      });
      field.addEventListener("mouseenter", () => {
        showLimitTooltip(field, updateLimitState(field, kind));
      });
      field.addEventListener("blur", () => {
        hideLimitTooltip(field);
      });
      field.addEventListener("mouseleave", () => {
        if (document.activeElement !== field) {
          hideLimitTooltip(field);
        }
      });
    }

    function validateTextLimits() {
      const fields = [
        { field: frontInput, kind: "front" },
        { field: backInput, kind: "back" },
        ...getExtraSideControls()
          .filter((control) => control.textarea.value.trim())
          .map((control) => ({
            field: control.textarea,
            kind: "extra"
          }))
      ];
      const invalidEntry = fields
        .map((entry) => ({
          ...entry,
          metrics: updateLimitState(entry.field, entry.kind)
        }))
        .find((entry) => entry.metrics.isEmpty || entry.metrics.isError);

      if (!invalidEntry) {
        return true;
      }

      invalidEntry.field.focus();
      if (invalidEntry.metrics.isError) {
        showLimitTooltip(invalidEntry.field, invalidEntry.metrics);
      }
      if (invalidEntry.metrics.isEmpty) {
        toast.error(t("alerts.requiredFields"));
      } else {
        toast.error(t("alerts.textLimitExceeded"));
      }

      return false;
    }

    return {
      bindLimitField,
      hideLimitTooltip,
      showLimitTooltip,
      syncLimitStates,
      updateLimitState,
      validateTextLimits
    };
  }

  Karto.createCardFormTextLimitController = createCardFormTextLimitController;
})(window);
