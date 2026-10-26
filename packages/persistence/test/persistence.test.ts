import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CorruptSaveError, type PersistencePort } from "@seki/core";
import { IndexedDbSaveStore, MemorySaveStore, SavePersistence, type SaveStore } from "../src";
import { snapshot } from "./fixtures";

let dbCounter = 0;
const stores: [string, () => SaveStore][] = [
  ["memory", () => new MemorySaveStore()],
  ["indexeddb", () => new IndexedDbSaveStore(`test-db-${dbCounter++}`)],
];

// Port contract: every adapter must pass the same suite.
describe.each(stores)("PersistencePort contract (%s)", (_name, makeStore) => {
  const make = (): [PersistencePort, SaveStore] => {
    const store = makeStore();
    return [new SavePersistence(store), store];
  };

  it("returns null for an empty slot", async () => {
    const [port] = make();
    expect(await port.load("missing")).toBeNull();
  });

  it("saves, loads and overwrites slots", async () => {
    const [port] = make();
    await port.save("quick", snapshot());
    await port.save("quick", snapshot({ tick: 1000 }));
    expect((await port.load("quick"))?.tick).toBe(1000);
  });

  it("lists slots with their labels and flags corrupt ones", async () => {
    const [port, store] = make();
    await port.save("slot-2", snapshot());
    await port.save("slot-1", snapshot({ meta: { label: "A", objective: "B" } }));
    await store.put("slot-3", "garbage");
    expect(await port.list()).toEqual([
      { slot: "slot-1", savedAtLabel: "A", objective: "B" },
      { slot: "slot-2", savedAtLabel: "26.10 22:30", objective: "Zneutralizuj kuriera" },
      { slot: "slot-3", savedAtLabel: "—", objective: "Uszkodzony zapis" },
    ]);
  });

  it("rejects a corrupt slot with CorruptSaveError", async () => {
    const [port, store] = make();
    await store.put("bad", '{"format":"seki-save"');
    await expect(port.load("bad")).rejects.toBeInstanceOf(CorruptSaveError);
  });
});
