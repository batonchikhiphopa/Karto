(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createCardFormExtraSidesController(options) {
    const {
      addButton,
      bindLimitField,
      listElement,
      maxExtraSides = 5,
      onCtrlEnter,
      onStateChanged
    } = options;

    let controls = [];

    function getControls() {
      return controls;
    }

    function updateAddState() {
      const isAtLimit = controls.length >= maxExtraSides;
      addButton.disabled = isAtLimit;
      addButton.title = isAtLimit ? t("cardForm.extraSideLimit") : "";
    }

    function renumber() {
      controls.forEach((control, index) => {
        control.label.textContent = t("cardForm.answerSideLabel", { number: index + 1 });
        control.textarea.placeholder = t("cardForm.answerSidePlaceholder", { number: index + 1 });
        control.removeBtn.setAttribute("aria-label", t("cardForm.removeAnswerSide", { number: index + 1 }));
        control.removeBtn.title = t("cardForm.removeAnswerSide", { number: index + 1 });
      });

      updateAddState();
    }

    function remove(sideId) {
      const control = controls.find((item) => item.id === sideId);
      if (!control) {
        return;
      }

      control.wrap.remove();
      controls = controls.filter((item) => item.id !== sideId);
      renumber();
      onStateChanged();
    }

    function create(side = {}) {
      if (controls.length >= maxExtraSides) {
        return null;
      }

      let sideId = typeof side.id === "string" && side.id.trim() ? side.id.trim() : createId("side");
      if (controls.some((control) => control.id === sideId)) {
        sideId = createId("side");
      }
      const fieldId = `extraSideInput_${controls.length + 1}_${sideId.replace(/[^a-z0-9_-]/gi, "_")}`;
      const label = createElement("label", {
        className: "form-label form-label-with-side",
        attrs: { for: fieldId },
        children: [
          createElement("span", {
            className: "side-indicator side-indicator-back",
            attrs: { "aria-hidden": "true" }
          }),
          createElement("span")
        ]
      });
      const removeBtn = createElement("button", {
        className: "icon-btn extra-side-remove-btn",
        children: [createElement("span", { text: "\u00d7", attrs: { "aria-hidden": "true" } })],
        attrs: {
          type: "button"
        },
        listeners: {
          click() {
            remove(sideId);
          }
        }
      });
      const textarea = createElement("textarea", {
        className: "form-input form-textarea",
        value: side.text || "",
        attrs: {
          id: fieldId,
          "data-extra-side-input": sideId
        },
        listeners: {
          keydown(event) {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              onCtrlEnter();
            }
          }
        }
      });
      bindLimitField(textarea, "extra");
      const wrap = createElement("div", {
        className: "extra-side-item",
        dataset: { sideId },
        children: [
          createElement("div", {
            className: "form-label-row",
            children: [
              label,
              removeBtn
            ]
          }),
          textarea
        ]
      });

      listElement.appendChild(wrap);
      const control = { id: sideId, wrap, label: label.querySelector("span:last-child"), textarea, removeBtn };
      controls.push(control);
      renumber();
      onStateChanged();
      return control;
    }

    function render(sides = []) {
      clearElement(listElement);
      controls = [];
      (Array.isArray(sides) ? sides : []).slice(0, maxExtraSides).forEach((side) => {
        create(side);
      });
      renumber();
      onStateChanged();
    }

    function read() {
      return controls
        .map((control) => ({
          id: control.id,
          text: control.textarea.value.trim()
        }))
        .filter((side) => side.text);
    }

    return {
      create,
      getControls,
      read,
      render,
      renumber
    };
  }

  Karto.createCardFormExtraSidesController = createCardFormExtraSidesController;
})(window);
