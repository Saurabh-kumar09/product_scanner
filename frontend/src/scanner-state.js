/**
 * @typedef {"idle" | "validating" | "success" | "error"} UploadStatus
 * @typedef {"not-started" | "ready" | "scanning" | "scanned"} ScanStatus
 * @typedef {"idle" | "loading" | "success" | "error"} ActionStatus
 * @typedef {"find" | "about" | null} ScannerAction
 *
 * @typedef {object} ScanResult
 * @property {string} name Display name returned by the scanner.
 * @property {string} description Short product summary returned by the scanner.
 * @property {string} confidenceLabel User-facing confidence/source label.
 * @property {string} source Internal source identifier for the result.
 *
 * @typedef {object} ScannerState
 * @property {File | null} selectedFile Browser File chosen by the user.
 * @property {string | null} previewUrl Object URL used by the image preview.
 * @property {UploadStatus} uploadStatus Current file validation state.
 * @property {string} uploadMessage User-facing upload status copy.
 * @property {ScanStatus} scanStatus Current scan workflow state.
 * @property {ScanResult | null} result Last scan result payload.
 * @property {string | null} scanError User-facing scan error copy.
 * @property {ScannerAction} selectedAction Post-scan action selected by the user.
 * @property {ActionStatus} actionStatus Current post-scan action request state.
 * @property {unknown} actionResult Payload returned by the selected action.
 * @property {string | null} actionError User-facing action error copy.
 */

/**
 * Product-link API endpoint, overridable for deployed environments.
 */
const PRODUCT_LINK_ENDPOINT = "http://127.0.0.1:8000/abc";

/**
 * Creates a fresh baseline state for resets and first render.
 *
 * @returns {ScannerState}
 */
const initialState = () => ({
  selectedFile: null,
  previewUrl: null,
  uploadStatus: "idle",
  uploadMessage: "Choose an image to begin.",
  scanStatus: "not-started",
  result: null,
  scanError: null,
  selectedAction: null,
  actionStatus: "idle",
  actionResult: null,
  actionError: null,
});

/**
 * Local placeholder for the future Vision LLM request.
 * Keep the response shape stable when wiring an API into this seam.
 *
 * @returns {Promise<ScanResult>} Sample scan result shaped like the future API.
 */
export async function scanProductSample() {
  await new Promise((resolve) => window.setTimeout(resolve, 1250));
  return {
    name: "Everyday carry object",
    description:
      "A thoughtfully made daily-use item with a clean, functional silhouette.",
    confidenceLabel: "Visual match · sample",
    source: "sample",
  };
}

/**
 * Confirms the selected file is an image the browser can decode.
 *
 * @param {File} file Candidate upload from the file picker or drop event.
 * @param {string} objectUrl Temporary object URL for browser image loading.
 * @returns {Promise<boolean>} True when the image loads with non-zero dimensions.
 */
function isReadableImage(file, objectUrl) {
  if (!file.type.startsWith("image/")) return Promise.resolve(false);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.src = objectUrl;
  });
}

/**
 * Builds the scanner state store used by the UI.
 *
 * The store keeps all workflow transitions in one place, guards against stale
 * async file validations/scans, and exposes a tiny subscribe/update interface
 * for the DOM renderer.
 *
 * @returns {object} Public scanner state API.
 */
export function createScannerState() {
  let state = initialState();
  // Monotonic versions invalidate async work when a newer upload/scan starts.
  let uploadVersion = 0;
  let scanVersion = 0;
  // Separately invalidates post-scan action requests when the workflow changes.
  let actionVersion = 0;
  const subscribers = new Set();

  /**
   * Applies a partial state update and synchronously notifies subscribers.
   *
   * @param {Partial<ScannerState>} nextState Fields to merge into the store.
   */
  function update(nextState) {
    state = { ...state, ...nextState };
    subscribers.forEach((subscriber) => subscriber(state));
  }

  /**
   * Releases the active preview URL to avoid leaking browser object URLs.
   */
  function releasePreview() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  }

  return {
    /**
     * Reads the current state snapshot.
     *
     * @returns {ScannerState}
     */
    getState() {
      return state;
    },

    /**
     * Registers a render listener and returns its unsubscribe callback.
     *
     * @param {(state: ScannerState) => void} subscriber Listener called after updates.
     * @returns {() => boolean} Function that removes the subscriber.
     */
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    /**
     * Validates a user-selected image and prepares a preview URL.
     *
     * Passing no file resets the store. Version checks prevent an older async
     * validation from overwriting a newer selection.
     *
     * @param {File | undefined | null} file Candidate image file.
     * @returns {Promise<void>}
     */
    async selectFile(file) {
      const currentUpload = ++uploadVersion;
      ++scanVersion;
      ++actionVersion;
      releasePreview();

      if (!file) {
        state = initialState();
        subscribers.forEach((subscriber) => subscriber(state));
        return;
      }

      update({
        ...initialState(),
        uploadStatus: "validating",
        uploadMessage: "Checking image…",
      });

      const objectUrl = URL.createObjectURL(file);
      const valid = await isReadableImage(file, objectUrl);
      if (currentUpload !== uploadVersion) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      if (!valid) {
        URL.revokeObjectURL(objectUrl);
        update({
          ...initialState(),
          uploadStatus: "error",
          uploadMessage: "Please upload a valid image",
        });
        return;
      }

      update({
        selectedFile: file,
        previewUrl: objectUrl,
        uploadStatus: "success",
        uploadMessage: "Image uploaded successfully",
        scanStatus: "not-started",
        result: null,
        scanError: null,
        selectedAction: null,
      });
    },

    /**
     * Advances a valid upload into the preview-ready scan step.
     */
    proceed() {
      if (state.uploadStatus !== "success") return;
      update({ scanStatus: "ready" });
    },

    /**
     * Runs the product scan once the preview step is ready.
     *
     * Version checks protect the UI from stale scan results after a new upload.
     *
     * @returns {Promise<void>}
     */
    async scan() {
      if (state.uploadStatus !== "success" || state.scanStatus !== "ready")
        return;
      const currentScan = ++scanVersion;
      ++actionVersion;
      update({
        scanStatus: "scanning",
        result: null,
        scanError: null,
        selectedAction: null,
        actionStatus: "idle",
        actionResult: null,
        actionError: null,
      });

      try {
        const result = await scanProductSample();
        if (currentScan !== scanVersion || state.scanStatus !== "scanning")
          return;
        update({ scanStatus: "scanned", result });
      } catch {
        if (currentScan !== scanVersion) return;
        update({
          scanStatus: "ready",
          scanError: "The scan could not finish. Please try again.",
        });
      }
    },

    /**
     * Runs the selected post-scan action and stores its display payload.
     *
     * The "about" action reuses the scan result immediately. The "find" action
     * fetches product-link data and ignores stale responses after retry/new scan.
     *
     * @param {"find" | "about"} action Action identifier from the result buttons.
     * @returns {Promise<void>}
     */
    async chooseAction(action) {
      if (state.scanStatus !== "scanned" || !["find", "about"].includes(action))
        return;

      const currentAction = ++actionVersion;
      if (action === "about") {
        update({
          selectedAction: action,
          actionStatus: "success",
          actionResult: state.result,
          actionError: null,
        });
        return;
      }

      update({
        selectedAction: action,
        actionStatus: "loading",
        actionResult: null,
        actionError: null,
      });

      try {
        const response = await fetch(PRODUCT_LINK_ENDPOINT, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        if (result == null)
          throw new Error("The product search returned no data.");
        if (currentAction !== actionVersion || state.selectedAction !== action)
          return;

        update({
          actionStatus: "success",
          actionResult: result,
          actionError: null,
        });
      } catch (error) {
        if (currentAction !== actionVersion || state.selectedAction !== action)
          return;

        const httpStatus =
          error instanceof Error && error.message.match(/^HTTP (\d+)$/)?.[1];
        update({
          actionStatus: "error",
          actionResult: null,
          actionError: httpStatus
            ? `Product search is temporarily unavailable (HTTP ${httpStatus}). Please try again.`
            : "We couldn't connect to product search. Make sure its API is running, then try again.",
        });
      }
    },

    /**
     * Cancels pending async work, releases preview resources, and clears listeners.
     */
    dispose() {
      ++uploadVersion;
      ++scanVersion;
      ++actionVersion;
      releasePreview();
      subscribers.clear();
    },
  };
}
