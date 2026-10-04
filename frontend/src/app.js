import { createScannerState } from "./scanner-state.js";

const scanner = createScannerState();

// Cache all DOM targets once so render() can stay deterministic and fast.
const elements = {
  fileInput: document.querySelector("#product-image"),
  dropzone: document.querySelector("#dropzone-image"),
  chooseImage: document.querySelector("#button-choose-image"),
  changeImage: document.querySelector("#button-change-image"),
  proceed: document.querySelector("#button-proceed"),
  scan: document.querySelector("#button-scan-product"),
  findProduct: document.querySelector("#button-find-product"),
  aboutProduct: document.querySelector("#button-about-product"),
  uploadState: document.querySelector("#status-upload"),
  uploadMessage: document.querySelector("#upload-message"),
  uploadCheck: document.querySelector(".status-check"),
  uploadError: document.querySelector(".status-error-icon"),
  uploadValidating: document.querySelector(".status-validating"),
  emptyPreview: document.querySelector("#content-empty-preview"),
  preview: document.querySelector("#content-image-preview"),
  previewImage: document.querySelector("#img-product-preview"),
  filename: document.querySelector("#text-selected-filename"),
  filesize: document.querySelector("#text-selected-filesize"),
  scanActionRow: document.querySelector("#scan-action-row"),
  scanning: document.querySelector("#status-scanning"),
  scanError: document.querySelector("#status-scan-error"),
  result: document.querySelector("#content-scan-result"),
  resultName: document.querySelector("#text-result-name"),
  resultDescription: document.querySelector("#text-result-description"),
  actionFeedback: document.querySelector("#status-product-action"),
  workflowSteps: document.querySelectorAll(".workflow-item"),
};

/**
 * Formats a byte count for compact display beside the image preview.
 *
 * @param {number} bytes File size in bytes.
 * @returns {string} Human-readable size in KB or MB.
 */
function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Small wrapper for toggling visibility through the semantic hidden attribute.
 *
 * @param {HTMLElement} element Element whose visibility should change.
 * @param {boolean} hidden Whether the element should be hidden.
 */
function setHidden(element, hidden) {
  element.hidden = hidden;
}

/**
 * Reconciles the full scanner UI from the current state snapshot.
 *
 * The renderer is intentionally pure with respect to scanner state: event
 * handlers mutate the store, then this function updates DOM classes, disabled
 * states, status text, and preview/result content in one pass.
 *
 * @param {import("./scanner-state.js").ScannerState} state Current scanner state.
 */
function render(state) {
  const showPreview =
    state.uploadStatus === "success" && state.scanStatus !== "not-started";
  const isScanning = state.scanStatus === "scanning";
  const isScanned = state.scanStatus === "scanned";

  elements.uploadMessage.textContent = state.uploadMessage;
  elements.uploadState.classList.toggle(
    "success",
    state.uploadStatus === "success",
  );
  elements.uploadState.classList.toggle(
    "error",
    state.uploadStatus === "error",
  );
  elements.uploadState.classList.toggle(
    "idle",
    state.uploadStatus === "idle" || state.uploadStatus === "validating",
  );
  setHidden(elements.uploadCheck, state.uploadStatus !== "success");
  setHidden(elements.uploadError, state.uploadStatus !== "error");
  setHidden(elements.uploadValidating, state.uploadStatus !== "validating");

  elements.proceed.disabled = state.uploadStatus !== "success";
  setHidden(elements.proceed, showPreview);
  setHidden(elements.changeImage, !showPreview);

  setHidden(elements.emptyPreview, showPreview);
  setHidden(elements.preview, !showPreview);
  if (showPreview && state.previewUrl && state.selectedFile) {
    elements.previewImage.src = state.previewUrl;
    elements.filename.textContent = state.selectedFile.name;
    elements.filename.title = state.selectedFile.name;
    elements.filesize.textContent = formatBytes(state.selectedFile.size);
  } else {
    elements.previewImage.removeAttribute("src");
    elements.filename.textContent = "";
    elements.filesize.textContent = "";
  }

  elements.scan.disabled = state.scanStatus !== "ready";
  setHidden(elements.scanActionRow, !showPreview || isScanning || isScanned);
  setHidden(elements.scanning, !isScanning);
  setHidden(elements.scanError, !state.scanError);
  elements.scanError.textContent = state.scanError ?? "";

  setHidden(elements.result, !isScanned || !state.result);
  if (state.result) {
    elements.resultName.textContent = state.result.name;
    elements.resultDescription.textContent = state.result.description;
  }

  const actionEnabled = isScanned && Boolean(state.result);
  elements.findProduct.disabled = !actionEnabled;
  elements.aboutProduct.disabled = !actionEnabled;
  elements.findProduct.setAttribute(
    "aria-pressed",
    String(state.selectedAction === "find"),
  );
  elements.aboutProduct.setAttribute(
    "aria-pressed",
    String(state.selectedAction === "about"),
  );
  elements.findProduct.classList.toggle(
    "selected",
    state.selectedAction === "find",
  );
  elements.aboutProduct.classList.toggle(
    "selected",
    state.selectedAction === "about",
  );
  elements.actionFeedback.textContent =
    state.selectedAction === "find"
      ? "Similar product search is ready for the future product catalog."
      : state.selectedAction === "about"
        ? "Product details are ready for a future structured response."
        : "";

  const stage = isScanned
    ? "result"
    : isScanning
      ? "scan"
      : showPreview
        ? "preview"
        : "upload";
  elements.workflowSteps.forEach((step) => {
    step.classList.toggle(
      "active",
      ["upload", "preview", "scan", "result"].indexOf(step.dataset.step) <=
        ["upload", "preview", "scan", "result"].indexOf(stage),
    );
  });
}

/**
 * Pulls the first file from the native picker and hands it to the store.
 *
 * The input value is cleared so choosing the same file again still fires a
 * change event in browsers that otherwise suppress duplicate selections.
 */
function selectFromInput() {
  const file = elements.fileInput.files?.[0];
  void scanner.selectFile(file);
  elements.fileInput.value = "";
}

// File-picker entry points share the same hidden input for accessibility.
elements.chooseImage.addEventListener("click", () =>
  elements.fileInput.click(),
);
elements.changeImage.addEventListener("click", () =>
  elements.fileInput.click(),
);
elements.fileInput.addEventListener("change", selectFromInput);

// Primary workflow controls delegate state transitions to the scanner store.
elements.proceed.addEventListener("click", () => scanner.proceed());
elements.scan.addEventListener("click", () => void scanner.scan());
elements.findProduct.addEventListener("click", () =>
  scanner.chooseAction("find"),
);
elements.aboutProduct.addEventListener("click", () =>
  scanner.chooseAction("about"),
);

// Drag-and-drop support mirrors the file input path while showing hover state.
elements.dropzone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  elements.dropzone.classList.add("dragging");
});

// Required so the browser allows dropping files onto the custom dropzone.
elements.dropzone.addEventListener("dragover", (event) =>
  event.preventDefault(),
);

// Clear drag styling only when the pointer leaves the dropzone itself.
elements.dropzone.addEventListener("dragleave", (event) => {
  if (event.currentTarget === event.target)
    elements.dropzone.classList.remove("dragging");
});

// Route the first dropped file through the same validation path as the picker.
elements.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove("dragging");
  void scanner.selectFile(event.dataTransfer.files?.[0]);
});

// Initial render keeps SSR/static markup and JavaScript-enhanced state aligned.
scanner.subscribe(render);
render(scanner.getState());

// Release object URLs when the page is unloaded or moved into bfcache.
window.addEventListener("pagehide", () => scanner.dispose(), { once: true });
