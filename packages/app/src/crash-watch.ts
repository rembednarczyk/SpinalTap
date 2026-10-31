/** The part of `window` the crash watch reads; tests pass a fake. */
export interface CrashWindow {
  addEventListener(type: "error" | "unhandledrejection", listener: (e: Event) => void): void;
  removeEventListener(type: "error" | "unhandledrejection", listener: (e: Event) => void): void;
}

/** The canvas events of a lost and restored WebGL context. */
export interface CrashCanvas {
  addEventListener(type: "webglcontextlost" | "webglcontextrestored", listener: () => void): void;
  removeEventListener(type: "webglcontextlost" | "webglcontextrestored", listener: () => void): void;
}

export type CrashReport = { readonly kind: "error"; readonly message: string } | { readonly kind: "context-lost" } | { readonly kind: "context-restored" };

/** One error notice per this many milliseconds: a failing frame loop would throw every frame. */
export const CRASH_NOTICE_MS = 10_000;

const messageOf = (e: Event): string => {
  const reason = (e as Event & { reason?: unknown }).reason;
  const error = (e as Event & { error?: unknown; message?: unknown }).error ?? reason;
  if (error instanceof Error) return error.message;
  const message = (e as Event & { message?: unknown }).message;
  if (typeof message === "string" && message !== "") return message;
  return typeof error === "string" ? error : "unknown error";
};

/**
 * Tells the player when the game broke instead of leaving a frozen or black screen (gap audit,
 * Technika): uncaught errors and rejected promises, at most one notice per `CRASH_NOTICE_MS`, and the
 * WebGL context lost and restored on a phone under memory pressure. `now` is the page clock; this
 * lives in the app, outside the simulation. Returns the unbinding.
 */
export const bindCrashWatch = (win: CrashWindow, canvas: CrashCanvas, now: () => number, report: (r: CrashReport) => void): (() => void) => {
  let last = Number.NEGATIVE_INFINITY;
  const onError = (e: Event) => {
    const t = now();
    if (t - last < CRASH_NOTICE_MS) return;
    last = t;
    report({ kind: "error", message: messageOf(e) });
  };
  const lost = () => report({ kind: "context-lost" });
  const restored = () => report({ kind: "context-restored" });
  win.addEventListener("error", onError);
  win.addEventListener("unhandledrejection", onError);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return () => {
    win.removeEventListener("error", onError);
    win.removeEventListener("unhandledrejection", onError);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
  };
};
