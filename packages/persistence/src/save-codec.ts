import { CorruptSaveError, type SaveSnapshot } from "@seki/core";
import { checksum } from "./checksum";
import { MigrationError, migrate } from "./migrations";
import { findSchemaError } from "./validate";

const FORMAT = "seki-save";

interface Envelope {
  format: typeof FORMAT;
  checksum: string;
  payload: string;
}

export const encodeSave = (snapshot: SaveSnapshot): string => {
  const payload = JSON.stringify(snapshot);
  const envelope: Envelope = { format: FORMAT, checksum: checksum(payload), payload };
  return JSON.stringify(envelope);
};

const parseJson = (slot: string, text: string, what: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new CorruptSaveError(slot, `${what} is not valid JSON`);
  }
};

/** Decodes, verifies, migrates and validates a stored save. Throws CorruptSaveError on any failure. */
export const decodeSave = (slot: string, raw: string): SaveSnapshot => {
  const env = parseJson(slot, raw, "envelope") as Partial<Envelope> | null;
  if (!env || env.format !== FORMAT || typeof env.payload !== "string" || typeof env.checksum !== "string") {
    throw new CorruptSaveError(slot, "unknown format");
  }
  if (checksum(env.payload) !== env.checksum) throw new CorruptSaveError(slot, "checksum mismatch");
  const payload = parseJson(slot, env.payload, "payload");
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new CorruptSaveError(slot, "payload is not an object");
  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(payload as Record<string, unknown>);
  } catch (e) {
    if (e instanceof MigrationError) throw new CorruptSaveError(slot, e.message);
    throw e;
  }
  const error = findSchemaError(migrated);
  if (error) throw new CorruptSaveError(slot, `invalid field: ${error}`);
  return migrated as unknown as SaveSnapshot;
};
