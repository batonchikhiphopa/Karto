const assert = require("node:assert/strict");

const {
  isEditableTarget,
  shouldHandleGlobalEscape
} = require("../js/global-shortcuts.js");

function testEditableTargetsAreIgnored() {
  assert.equal(isEditableTarget({ tagName: "input" }), true);
  assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isEditableTarget({ isContentEditable: true }), true);
}

function testGlobalEscapeRequiresUnmodifiedUnhandledEscape() {
  assert.equal(shouldHandleGlobalEscape({ key: "Escape", defaultPrevented: false, target: {} }), true);
  assert.equal(shouldHandleGlobalEscape({ key: "Escape", defaultPrevented: true, target: {} }), false);
  assert.equal(shouldHandleGlobalEscape({ key: "Escape", defaultPrevented: false, ctrlKey: true, target: {} }), false);
  assert.equal(shouldHandleGlobalEscape({ key: "Enter", defaultPrevented: false, target: {} }), false);
}

function testGlobalEscapeIgnoresEditableTargets() {
  assert.equal(
    shouldHandleGlobalEscape({ key: "Escape", defaultPrevented: false, target: { tagName: "INPUT" } }),
    false
  );
}

testEditableTargetsAreIgnored();
testGlobalEscapeRequiresUnmodifiedUnhandledEscape();
testGlobalEscapeIgnoresEditableTargets();

console.log("global-shortcuts tests passed");
