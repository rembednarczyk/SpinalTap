import { type IDBPDatabase, openDB } from "idb";
import type { SaveStore } from "./storage";

const DB_NAME = "seki-senshi";
const STORE = "saves";

/** IndexedDB-backed SaveStore. One record per slot, value is the encoded save string. */
export class IndexedDbSaveStore implements SaveStore {
  private db: Promise<IDBPDatabase> | null = null;

  constructor(private readonly dbName = DB_NAME) {}

  private open(): Promise<IDBPDatabase> {
    this.db ??= openDB(this.dbName, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
    return this.db;
  }

  async get(slot: string): Promise<string | undefined> {
    const v: unknown = await (await this.open()).get(STORE, slot);
    return typeof v === "string" ? v : undefined;
  }

  async put(slot: string, value: string): Promise<void> {
    await (await this.open()).put(STORE, value, slot);
  }

  async keys(): Promise<string[]> {
    return (await (await this.open()).getAllKeys(STORE)).map(String);
  }
}
