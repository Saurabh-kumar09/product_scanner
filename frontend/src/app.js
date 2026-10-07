import { createScannerState } from "./scanner-state.js";

const scanner = createScannerState();
const response = await fetch("http://127.0.0.1:8000/abc");
const data = await response.json();

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
  actionResult: document.querySelector("#content-action-result"),
  actionResultKicker: document.querySelector("#text-action-result-kicker"),
  actionResultTitle: document.querySelector("#text-action-result-title"),
  actionResultLoading: document.querySelector("#status-action-result-loading"),
  actionResultBody: document.querySelector("#content-action-result-body"),
  actionResultNote: document.querySelector("#text-action-result-note"),
  actionResultError: document.querySelector("#status-action-result-error"),
  actionResultErrorText: document.querySelector("#text-action-result-error"),
  retryAction: document.querySelector("#button-retry-action"),
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
 * Converts API field names into readable labels for the action result panel.
 *
 * @param {string} key Raw object key from a backend response.
 * @returns {string} User-facing label for display.
 */
function humanizeKey(key) {
  const label = String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  const friendlyLabels = {
    name: "Product name",
    description: "Description",
    link: "Product link",
    links: "Product links",
    url: "Product link",
    urls: "Product links",
    productlink: "Product link",
    productlinks: "Product links",
    message: "Details",
    text: "Details",
    confidencelabel: "Match note",
  };
  const friendlyLabel = friendlyLabels[label.replace(/\s+/g, "").toLowerCase()];
  if (friendlyLabel) return friendlyLabel;
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Details";
}

/**
 * Accepts only HTTP(S) links before rendering external anchors.
 *
 * @param {unknown} value Candidate URL from the action response.
 * @returns {string | null} Normalized URL href, or null for unsafe/invalid data.
 */
function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Normalizes arbitrary action response JSON into display rows and links.
 *
 * Backends can return a primitive, object, array of URLs, or array of structured
 * link objects. This adapter keeps the renderer small and avoids assigning raw
 * objects directly into the DOM.
 *
 * @param {unknown} data Action response payload.
 * @returns {{ entries: Array<{ label: string, value: string }>, links: Array<{ label: string, href: string, description: string }> }}
 */
function normalizeActionData(data) {
  const entries = [];
  const links = [];

  /**
   * Adds a plain label/value row when a response field is not a usable link.
   *
   * @param {string} label Display label for the row.
   * @param {unknown} value Field value to stringify for display.
   */
  function addEntry(label, value) {
    if (value == null || typeof value === "boolean") return;
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : Array.isArray(value)
          ? value
              .map((item) =>
                typeof item === "object" ? JSON.stringify(item) : String(item),
              )
              .join(" · ")
          : JSON.stringify(value);
    if (text) entries.push({ label, value: text });
  }

  /**
   * Adds a safe external link or falls back to a plain entry.
   *
   * @param {unknown} value URL string or structured link-like object.
   * @param {string} fallbackLabel Label to use when the payload has no title.
   */
  function addLink(value, fallbackLabel) {
    const item = typeof value === "string" ? { url: value } : value;
    const rawUrl =
      typeof item === "object" && item !== null
        ? (item.url ?? item.href ?? item.link)
        : null;
    const href = safeExternalUrl(rawUrl);
    if (!href) {
      addEntry(fallbackLabel, typeof value === "string" ? value : value);
      return;
    }
    const linkLabel =
      typeof item === "object" && item !== null
        ? (item.label ?? item.title ?? item.name ?? fallbackLabel)
        : fallbackLabel;
    links.push({
      label: String(linkLabel),
      href,
      description:
        typeof item === "object" &&
        item !== null &&
        typeof item.description === "string"
          ? item.description
          : "",
    });
  }

  /**
   * Identifies response fields that should be treated as link collections.
   *
   * @param {string} key Raw response key.
   * @returns {boolean} True when the key usually contains links.
   */
  function isLinkKey(key) {
    return /^(links?|urls?|productlinks?|products)$/i.test(key);
  }

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (typeof item === "string" && safeExternalUrl(item)) {
        addLink(item, `Product link ${index + 1}`);
      } else if (
        item &&
        typeof item === "object" &&
        (item.url || item.href || item.link)
      ) {
        addLink(
          item,
          item.label ?? item.title ?? item.name ?? `Product link ${index + 1}`,
        );
      } else {
        addEntry(`Result ${index + 1}`, item);
      }
    });
  } else if (typeof data === "string" || typeof data === "number") {
    addEntry("Details", data);
  } else if (data && typeof data === "object") {
    Object.entries(data).forEach(([key, value]) => {
      if (key === "source") return;
      if (isLinkKey(key)) {
        const values = Array.isArray(value) ? value : [value];
        values.forEach((link, index) =>
          addLink(
            link,
            values.length > 1
              ? `${humanizeKey(key)} ${index + 1}`
              : humanizeKey(key),
          ),
        );
      } else {
        addEntry(humanizeKey(key), value);
      }
    });
  }

  return { entries, links };
}

/**
 * Renders normalized action data into the action-result panel.
 *
 * @param {unknown} data Action response payload to render.
 */
function renderActionData(data) {
  const { entries, links } = normalizeActionData(data);
  const fragment = document.createDocumentFragment();

  entries.forEach(({ label, value }) => {
    const item = document.createElement("div");
    item.className = "action-result-item";
    const itemLabel = document.createElement("p");
    itemLabel.className = "action-result-item-label";
    itemLabel.textContent = label;
    const itemValue = document.createElement("p");
    itemValue.className = "action-result-item-value";
    itemValue.textContent = value;
    item.append(itemLabel, itemValue);
    fragment.append(item);
  });

  if (links.length) {
    const list = document.createElement("ul");
    list.className = "action-result-links";
    links.forEach(({ label, href, description }) => {
      const item = document.createElement("li");
      item.className = "action-result-link";
      const copy = document.createElement("div");
      copy.className = "action-result-link-copy";
      const title = document.createElement("span");
      title.className = "action-result-link-title";
      title.textContent = label;
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = href;
      anchor.setAttribute("aria-label", `${label}, opens in a new tab`);
      copy.append(title, anchor);
      if (description) {
        const detail = document.createElement("p");
        detail.className = "action-result-item-value";
        detail.textContent = description;
        copy.append(detail);
      }
      item.append(copy);
      list.append(item);
    });
    fragment.append(list);
  }

  if (!entries.length && !links.length) {
    const empty = document.createElement("p");
    empty.className = "action-result-item-value";
    empty.textContent = "The service returned no readable details or links.";
    fragment.append(empty);
  }

  elements.actionResultBody.replaceChildren(fragment);
}

/**
 * Reconciles the full scanner UI from the current state snapshot.
 *
 * The renderer is intentionally pure with respect to scanner state: event
 * handlers mutate the store, then this function updates DOM classes, disabled
 * states, live regions, and preview/result/action content in one pass.
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

  const hasAction = Boolean(state.selectedAction);
  const isActionLoading = state.actionStatus === "loading";
  const isActionError = state.actionStatus === "error";
  const hasActionResult =
    state.actionStatus === "success" && Boolean(state.actionResult);
  setHidden(elements.actionResult, !hasAction);
  elements.actionResult.setAttribute("aria-busy", String(isActionLoading));
  elements.actionResultKicker.textContent =
    state.selectedAction === "find" ? "Product search" : "Product information";
  elements.actionResultTitle.textContent =
    state.selectedAction === "find"
      ? "Matching product links"
      : "About this item";
  setHidden(elements.actionResultLoading, !isActionLoading);
  setHidden(elements.actionResultBody, !hasActionResult);
  if (hasActionResult) renderActionData(state.actionResult);
  const isSampleAbout =
    state.selectedAction === "about" && state.actionResult?.source === "sample";
  elements.actionResultNote.textContent = isSampleAbout
    ? "This overview uses the current sample scan information."
    : "";
  setHidden(elements.actionResultNote, !isSampleAbout);
  setHidden(elements.actionResultError, !isActionError);
  elements.actionResultErrorText.textContent = state.actionError ?? "";

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
elements.findProduct.addEventListener(
  "click",
  () => void scanner.chooseAction("find"),
);
elements.aboutProduct.addEventListener(
  "click",
  () => void scanner.chooseAction("about"),
);
elements.retryAction.addEventListener(
  "click",
  () => void scanner.chooseAction("find"),
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
