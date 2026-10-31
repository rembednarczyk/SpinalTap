/** The part of `document` the page lifecycle reads; tests pass a fake. */
export interface LifecycleDocument {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/** The part of `window` the page lifecycle reads; tests pass a fake. */
export interface LifecycleWindow {
  addEventListener(type: "pagehide", listener: () => void): void;
  removeEventListener(type: "pagehide", listener: () => void): void;
}

/**
 * Calls `onHidden` when the page stops being seen: `visibilitychange` to hidden (a phone switching
 * apps, a tab in the background, the screen locking) and `pagehide` (closing, navigating away,
 * the back-forward cache). A mobile browser may freeze or discard a hidden tab without another
 * event, so the hidden change is the last moment to write; `pagehide` covers browsers that skip
 * it on unload. The handler must start its write synchronously. Returns the unbinding.
 */
export const bindPageHidden = (doc: LifecycleDocument, win: LifecycleWindow, onHidden: () => void): (() => void) => {
  const visibility = () => {
    if (doc.visibilityState === "hidden") onHidden();
  };
  doc.addEventListener("visibilitychange", visibility);
  win.addEventListener("pagehide", onHidden);
  return () => {
    doc.removeEventListener("visibilitychange", visibility);
    win.removeEventListener("pagehide", onHidden);
  };
};
