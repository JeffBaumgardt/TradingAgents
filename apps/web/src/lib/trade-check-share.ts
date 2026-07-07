/**
 * @file apps/web/src/lib/trade-check-share.ts
 * Capture the Trade Check digest as a PNG for Discord paste/drop.
 */

import { toBlob } from "html-to-image";

export const TRADE_CHECK_SHARE_ROOT_ID = "trade-check-share-root";
export const TRADE_CHECK_PRINT_ROOT_ID = "trade-check-print-root";
const SHARE_EXPORT_PADDING = "20px";
const SHARE_EXPORT_BACKGROUND = "#0f1419";

function applyShareExportFrame(root: HTMLElement): () => void {
  const previous = {
    padding: root.style.padding,
    backgroundColor: root.style.backgroundColor,
    boxSizing: root.style.boxSizing,
    overflow: root.style.overflow,
  };

  root.style.padding = SHARE_EXPORT_PADDING;
  root.style.backgroundColor = SHARE_EXPORT_BACKGROUND;
  root.style.boxSizing = "border-box";
  root.style.overflow = "visible";

  return () => {
    root.style.padding = previous.padding;
    root.style.backgroundColor = previous.backgroundColor;
    root.style.boxSizing = previous.boxSizing;
    root.style.overflow = previous.overflow;
  };
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "trade-check";
}

function shouldIncludeExportNode(node: HTMLElement): boolean {
  if (!(node instanceof Element)) {
    return true;
  }

  if (
    node instanceof HTMLElement &&
    (node.dataset.printHide === "true" ||
      node.dataset.exportHide === "true" ||
      node.dataset.exportHidden === "true")
  ) {
    return false;
  }

  const tag = node.tagName;
  if (tag === "SCRIPT" || tag === "NOSCRIPT" || tag === "IFRAME") {
    return false;
  }
  return true;
}

function inlineChartCanvases(root: HTMLElement): () => void {
  const restores: Array<() => void> = [];

  root.querySelectorAll("canvas").forEach((node) => {
    if (!(node instanceof HTMLCanvasElement)) {
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    let dataUrl = "";
    try {
      dataUrl = node.toDataURL("image/png");
    } catch {
      return;
    }

    if (!dataUrl || dataUrl === "data:,") {
      return;
    }

    const image = document.createElement("img");
    image.src = dataUrl;
    image.alt = "Price chart";
    image.style.width = `${rect.width}px`;
    image.style.height = `${rect.height}px`;
    image.style.display = "block";
    image.style.maxWidth = "100%";

    const parent = node.parentElement;
    if (!parent) {
      return;
    }

    parent.insertBefore(image, node);
    node.setAttribute("data-export-hidden", "true");
    node.style.visibility = "hidden";
    node.style.position = "absolute";
    node.style.pointerEvents = "none";

    restores.push(() => {
      image.remove();
      node.removeAttribute("data-export-hidden");
      node.style.visibility = "";
      node.style.position = "";
      node.style.pointerEvents = "";
    });
  });

  return () => {
    restores.forEach((restore) => restore());
  };
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.onload = () => resolve();
          image.onerror = () => resolve();
        }),
    ),
  );
}

async function waitForNextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function renderShareBlob(root: HTMLElement, pixelRatio: number): Promise<Blob | null> {
  return toBlob(root, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: SHARE_EXPORT_BACKGROUND,
    skipFonts: true,
    filter: shouldIncludeExportNode,
  });
}

export async function captureTradeCheckPng(): Promise<Blob> {
  const root =
    document.getElementById(TRADE_CHECK_SHARE_ROOT_ID) ??
    document.getElementById(TRADE_CHECK_PRINT_ROOT_ID);

  if (!root) {
    throw new Error("Trade Check digest is not on screen yet.");
  }

  if (root.clientWidth <= 0 || root.clientHeight <= 0) {
    throw new Error("Trade Check digest is still rendering. Try again in a moment.");
  }

  await waitForNextPaint();
  const restoreExportFrame = applyShareExportFrame(root);
  const restoreCanvases = inlineChartCanvases(root);

  try {
    await waitForNextPaint();
    await waitForImages(root);

    let lastError: unknown;
    for (const pixelRatio of [1.5, 1]) {
      try {
        const blob = await renderShareBlob(root, pixelRatio);
        if (blob) {
          return blob;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw new Error(`PNG render failed: ${lastError.message}`);
    }
    throw new Error("Could not render Trade Check PNG.");
  } finally {
    restoreCanvases();
    restoreExportFrame();
  }
}

export type TradeCheckShareResult = "clipboard" | "share" | "download";

export async function shareTradeCheckPng(ticker: string): Promise<TradeCheckShareResult> {
  const blob = await captureTradeCheckPng();
  const filename = `${sanitizeFilenamePart(ticker)}-trade-check.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "clipboard";
    } catch {
      // Fall through to file share or download.
    }
  }

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${ticker} Trade Check`,
        text: `${ticker} Trade Check`,
      });
      return "share";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
  return "download";
}
