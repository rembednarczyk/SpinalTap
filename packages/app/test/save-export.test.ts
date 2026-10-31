import { describe, expect, it } from "vitest";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence, decodeSave } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { exportFileName } from "../src/controllers/save-controller";
import { GameSession } from "../src/game-session";
import { FakeRender } from "./story-helpers";

/** Exporting a slot to a file (gap audit, Platformy: no export of saves). */
const setup = (withDownload = true) => {
  const files: { name: string; text: string }[] = [];
  const store = new MemorySaveStore();
  const ui = createUiStore();
  const session = new GameSession({
    render: new FakeRender(),
    audio: { play() {}, stopAll() {} },
    persistence: new SavePersistence(store),
    ui,
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 9, 31, 21, 5),
    ...(withDownload ? { download: (name: string, text: string) => void files.push({ name, text }) } : {}),
  });
  return { session, ui, store, files };
};

describe("save export", () => {
  it("writes a saved slot to a file that decodes back to the same save", async () => {
    const { session, store, files } = setup();
    session.newGame();
    expect(await session.saveAsync("slot-1")).toBe(true);
    expect(await session.exportAsync("slot-1")).toBe(true);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe("seki-senshi-slot-1-2026-10-31.json");
    expect(files[0]!.text).toBe(store.data.get("slot-1"));
    expect(decodeSave("slot-1", files[0]!.text).meta.label).toBe(decodeSave("slot-1", store.data.get("slot-1")!).meta.label);
  });

  it("writes nothing for an empty slot, or where the host cannot hand out files, and says so", async () => {
    const empty = setup();
    empty.session.newGame();
    expect(await empty.session.exportAsync("slot-2")).toBe(false);
    expect(empty.files).toHaveLength(0);
    expect(empty.ui.getState().toasts.at(-1)?.title).toBe("Empty slot");
    const none = setup(false);
    none.session.newGame();
    await none.session.saveAsync("slot-1");
    expect(await none.session.exportAsync("slot-1")).toBe(false);
    expect(none.ui.getState().toasts.at(-1)?.title).toBe("Could not export the save");
  });

  it("names the file by the slot and the day", () => {
    expect(exportFileName("auto", new Date(2026, 0, 5))).toBe("seki-senshi-auto-2026-01-05.json");
  });
});
