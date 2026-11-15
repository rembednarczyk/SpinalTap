/**
 * How long a model download may go without a single new chunk, once the server has answered, before
 * it counts as failed (G-562 path: the character keeps its stand-in and the next ask fetches it
 * again). The clock restarts with every chunk, so a slow link that keeps delivering never
 * trips it (G-637: a flat total limit made the 8 MB VRM impossible below ~0.5 Mbit/s). 30 s is long
 * for a radio handover or a congested cell to recover and short enough that a hung connection frees
 * the file for a retry in half a minute (G-561).
 */
export const MODEL_FETCH_IDLE_MS = 30_000;

/**
 * How long a model request may wait for the response headers. Kept apart from the idle clock (G-809):
 * the browser holds a request in its own queue (six HTTP/1.1 connections per host) until the files
 * ahead of it finish, and on an 8 Mbit/s link that alone kept seki.vrm 32 s behind the other model
 * files, so the idle clock gave up on a download that had not even begun. This limit only catches a
 * request that never gets an answer at all.
 */
export const MODEL_FETCH_START_MS = 180_000;

/** The whole-download limit for a response without a readable body, where progress cannot be seen. */
export const MODEL_FETCH_TIMEOUT_MS = 120_000;

/**
 * The file's bytes, or a rejection (with the fetch aborted) once `MODEL_FETCH_START_MS` passes without
 * an answer or `MODEL_FETCH_IDLE_MS` without a chunk after it, or when the server answers with an error
 * status: the error page is not a model (G-634).
 */
export const fetchModelBytes = async (url: string): Promise<ArrayBuffer> => {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let giveUp: (err: Error) => void = () => undefined;
  // Raced as well as aborted: a stalled body or a fetch that ignores the signal must not hang the load.
  const timeout = new Promise<never>((_, reject) => {
    giveUp = reject;
  });
  let finished = false;
  let reader: { cancel: () => Promise<void> } | undefined;
  const arm = (ms: number, why: string): void => {
    // After the end (failure included) a late chunk must not start a clock nobody clears.
    if (finished) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const err = new Error(`Model ${url} did not download: ${why} ${ms / 1000} s`);
      abort.abort(err);
      giveUp(err);
    }, ms);
  };
  const read = async (): Promise<ArrayBuffer> => {
    arm(MODEL_FETCH_START_MS, "no answer within");
    const r = await fetch(url, { signal: abort.signal });
    if (!r.ok) {
      r.body?.cancel().catch(() => undefined);
      throw new Error(`Model ${url} could not be downloaded: HTTP ${r.status}${r.statusText ? ` ${r.statusText}` : ""}`);
    }
    if (!r.body) {
      arm(MODEL_FETCH_TIMEOUT_MS, "not finished within");
      return r.arrayBuffer();
    }
    arm(MODEL_FETCH_IDLE_MS, "no data for");
    const body = r.body.getReader();
    reader = body;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await body.read();
      if (done || finished) break;
      chunks.push(value);
      size += value.byteLength;
      arm(MODEL_FETCH_IDLE_MS, "no data for");
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.byteLength;
    }
    return bytes.buffer;
  };
  try {
    return await Promise.race([read(), timeout]);
  } finally {
    finished = true;
    clearTimeout(timer);
    // The read loop may still be parked on a fetch that ignored the abort: release the connection.
    reader?.cancel().catch(() => undefined);
  }
};
