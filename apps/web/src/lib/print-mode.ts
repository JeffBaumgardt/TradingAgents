/**
 * @file apps/web/src/lib/print-mode.ts
 * Helpers for applying body attributes during browser print/export.
 */

interface PrintModeOptions {
  attributes: Record<string, string>;
  removeAttributes?: string[];
}

export function runWithPrintMode(printAction: () => void, options: PrintModeOptions): void {
  const { attributes, removeAttributes = [] } = options;

  function applyAttributes() {
    for (const key of removeAttributes) {
      document.body.removeAttribute(key);
    }
    for (const [key, value] of Object.entries(attributes)) {
      document.body.setAttribute(key, value);
    }
  }

  function cleanupAttributes() {
    for (const key of [...Object.keys(attributes), ...removeAttributes]) {
      document.body.removeAttribute(key);
    }
  }

  function handleAfterPrint() {
    cleanupAttributes();
    window.removeEventListener("afterprint", handleAfterPrint);
  }

  window.addEventListener("afterprint", handleAfterPrint);
  applyAttributes();
  printAction();
}
