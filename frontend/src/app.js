import { createScannerState } from "./scanner-state.js";

const scanner = createScannerState();
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

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setHidden(element, hidden) {
  element.hidden = hidden;
}

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

function selectFromInput() {
  const file = elements.fileInput.files?.[0];
  void scanner.selectFile(file);
  elements.fileInput.value = "";
}

elements.chooseImage.addEventListener("click", () =>
  elements.fileInput.click(),
);
elements.changeImage.addEventListener("click", () =>
  elements.fileInput.click(),
);
elements.fileInput.addEventListener("change", selectFromInput);
elements.proceed.addEventListener("click", () => scanner.proceed());
elements.scan.addEventListener("click", () => void scanner.scan());
elements.findProduct.addEventListener("click", () =>
  scanner.chooseAction("find"),
);
elements.aboutProduct.addEventListener("click", () =>
  scanner.chooseAction("about"),
);

elements.dropzone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  elements.dropzone.classList.add("dragging");
});
elements.dropzone.addEventListener("dragover", (event) =>
  event.preventDefault(),
);
elements.dropzone.addEventListener("dragleave", (event) => {
  if (event.currentTarget === event.target)
    elements.dropzone.classList.remove("dragging");
});
elements.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove("dragging");
  void scanner.selectFile(event.dataTransfer.files?.[0]);
});

scanner.subscribe(render);
render(scanner.getState());
window.addEventListener("pagehide", () => scanner.dispose(), { once: true });
