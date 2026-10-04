const initialState = () => ({
  selectedFile: null,
  previewUrl: null,
  uploadStatus: "idle",
  uploadMessage: "Choose an image to begin.",
  scanStatus: "not-started",
  result: null,
  scanError: null,
  selectedAction: null,
});

/**
 * Local placeholder for the future Vision LLM request.
 * Keep the response shape stable when wiring an API into this seam.
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

export function createScannerState() {
  let state = initialState();
  let uploadVersion = 0;
  let scanVersion = 0;
  const subscribers = new Set();

  function update(nextState) {
    state = { ...state, ...nextState };
    subscribers.forEach((subscriber) => subscriber(state));
  }

  function releasePreview() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  }

  return {
    getState() {
      return state;
    },

    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    async selectFile(file) {
      const currentUpload = ++uploadVersion;
      ++scanVersion;
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

    proceed() {
      if (state.uploadStatus !== "success") return;
      update({ scanStatus: "ready" });
    },

    async scan() {
      if (state.uploadStatus !== "success" || state.scanStatus !== "ready")
        return;
      const currentScan = ++scanVersion;
      update({
        scanStatus: "scanning",
        result: null,
        scanError: null,
        selectedAction: null,
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

    chooseAction(action) {
      if (state.scanStatus !== "scanned") return;
      update({ selectedAction: action });
    },

    dispose() {
      ++uploadVersion;
      ++scanVersion;
      releasePreview();
      subscribers.clear();
    },
  };
}
