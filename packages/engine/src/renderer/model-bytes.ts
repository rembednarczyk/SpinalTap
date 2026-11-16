import { fetchModelBytes } from "./model-fetch";

interface Download {
  readonly bytes: Promise<ArrayBuffer>;
  readers: number;
  /** A second library reads the file too (`share`): the bytes wait for it after the download. */
  shared: boolean;
  settled: boolean;
}

/**
 * The model files' bytes on their way, one download per file for every `ModelLibrary` on an engine
 * (G-808): the game's scene and the menu's preview (ADR-0015) both dress Seki and hold the same
 * weapons, and a second fetch of the 7 MB VRM on a slow link only doubled the transfer. A download
 * is forgotten once its readers have it, so released files (ADR-0076 stage 4b) and failed ones
 * (G-562, G-807) are fetched again on the next ask; only a shared file's bytes wait for the second.
 */
export class ModelBytes {
  private readonly downloads = new Map<string, Download>();
  /** Shared files not on their way yet. */
  private readonly owed = new Set<string>();
  /** Files ever shared: once per session, so a file both have read and one released later is not held for nobody. */
  private readonly declared = new Set<string>();

  /** The file's bytes; a reader that joins a download gets its own copy, as if it had fetched them. */
  get(url: string): Promise<ArrayBuffer> {
    const known = this.downloads.get(url);
    if (known) {
      known.readers++;
      this.forgetIfDone(url, known);
      return known.bytes.then((b) => b.slice(0));
    }
    const download: Download = { bytes: fetchModelBytes(url), readers: 1, shared: this.owed.delete(url), settled: false };
    this.downloads.set(url, download);
    download.bytes.then(
      () => {
        download.settled = true;
        this.forgetIfDone(url, download);
      },
      () => {
        if (this.downloads.get(url) === download) this.downloads.delete(url);
        // Both libraries ask again (G-807): the next download waits for the second one too.
        if (download.shared) this.owed.add(url);
      },
    );
    return download.bytes;
  }

  /**
   * A second library will read these files too: the next download of each waits for it instead of
   * being forgotten. A file shared before is not held again.
   */
  share(urls: Iterable<string>): void {
    for (const url of urls) {
      if (this.declared.has(url)) continue;
      this.declared.add(url);
      const known = this.downloads.get(url);
      if (known) {
        if (known.readers < 2) known.shared = true;
      } else this.owed.add(url);
    }
  }

  /** Files whose bytes are kept now (on their way or waiting for a second reader). */
  get held(): number {
    return this.downloads.size;
  }

  private forgetIfDone(url: string, download: Download): void {
    if (download.settled && !(download.shared && download.readers < 2) && this.downloads.get(url) === download) this.downloads.delete(url);
  }
}

const perEngine = new WeakMap<object, ModelBytes>();

/** The downloads of every library on the engine: the game's scene and the preview's share one (ADR-0015). */
export const modelBytesOf = (engine: object): ModelBytes => {
  let bytes = perEngine.get(engine);
  if (!bytes) perEngine.set(engine, (bytes = new ModelBytes()));
  return bytes;
};
