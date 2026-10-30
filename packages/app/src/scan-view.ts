import { type EnemyTypeId, FACTIONS, type HackTargetKind, type Locale } from "@seki/core";
import type { Entity } from "@seki/sim";
import { type MessageKey, type ScanTargetVm, translate } from "@seki/ui";

/** What the scanner calls an enemy, by type: a catalog key (ADR-0056). */
const ENEMY_NAMES: Readonly<Record<EnemyTypeId, MessageKey>> = {
  hebi_ganger: "scan.enemy.hebi_ganger",
  hebi_lookout: "scan.enemy.hebi_lookout",
  hebi_enforcer: "scan.enemy.hebi_enforcer",
  hebi_brawler: "scan.enemy.hebi_brawler",
  kagami_cleaner: "scan.enemy.kagami_cleaner",
  tessen_guard: "scan.enemy.tessen_guard",
  tessen_sniper: "scan.enemy.tessen_sniper",
};

/** People the player knows by name, by the ink knot they talk through; names stay as they are (ADR-0056). */
const NAMED: Readonly<Record<string, string>> = {
  fixer: "Kaito",
  kaito: "Kaito",
  mori: "Doktor Mori",
  oyaji: "Oyaji",
  hana: "Hana",
  genzo: "Genzō",
  fumiko: "Fumiko",
  fumiko_closed: "Fumiko",
};

const GIVEN = ["Akira", "Yumi", "Kenji", "Rin", "Daichi", "Mei", "Sora", "Haru", "Nao", "Ren", "Emi", "Taro"] as const;
const FAMILY = ["Tanaka", "Suzuki", "Kobayashi", "Watanabe", "Ito", "Nakamura", "Yamada", "Kato", "Hayashi", "Ogawa"] as const;
/** A passer-by's job, income and one thing about them: catalog keys, picked by position. */
const JOBS = ["scan.job.0", "scan.job.1", "scan.job.2", "scan.job.3", "scan.job.4", "scan.job.5", "scan.job.6", "scan.job.7", "scan.job.8", "scan.job.9", "scan.job.10", "scan.job.11"] as const satisfies readonly MessageKey[];
const INCOME = ["scan.income.0", "scan.income.1", "scan.income.2", "scan.income.3", "scan.income.4"] as const satisfies readonly MessageKey[];
const QUIRKS = ["scan.quirk.0", "scan.quirk.1", "scan.quirk.2", "scan.quirk.3", "scan.quirk.4", "scan.quirk.5", "scan.quirk.6", "scan.quirk.7", "scan.quirk.8", "scan.quirk.9", "scan.quirk.10", "scan.quirk.11"] as const satisfies readonly MessageKey[];

/** A 32-bit integer hash (lowbias32), so a passer-by's profile follows from their id alone. */
export const hashId = (id: number): number => {
  let x = id >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
};

const from = <T,>(list: readonly T[], seed: number, salt: number): T => list[(hashId(seed + salt * 7919) % list.length) | 0] as T;

/**
 * Name and three lines of a passer-by's profile (Watch Dogs 2 style), the same for the same id;
 * the lines in `locale`, picked by position, so a passer-by is the same person in every language.
 */
export const passerBy = (id: number, locale: Locale): { name: string; profile: string[] } => ({
  name: `${from(GIVEN, id, 1)} ${from(FAMILY, id, 2)}`,
  profile: [from(JOBS, id, 3), from(INCOME, id, 4), from(QUIRKS, id, 5)].map((key) => translate(locale, key)),
});

/**
 * What the scanner can tell about an entity. The contract (ScanFocusChanged) gives only the id,
 * so the kind is read from the entity: people have health and a mind of some kind; a camera is
 * recognised by its key or tag until the simulation names the kind (see the report).
 */
export const scanKind = (e: Entity): HackTargetKind => {
  const label = `${e.key ?? ""} ${e.tag ?? ""}`;
  if (/camera|kamera/i.test(label)) return "camera";
  if (e.health && (e.ai || e.civilian || e.enemy || e.escort || e.sniper || e.interactable?.kind === "dialogue" || e.interactable?.kind === "shop")) return "person";
  return "device";
};

export const scanTargetVm = (e: Entity, locale: Locale): ScanTargetVm => {
  const kind = scanKind(e);
  const hostile = e.ai !== undefined || e.enemy !== undefined || e.sniper !== undefined;
  const faction = e.faction ? FACTIONS[e.faction] : null;
  if (kind === "camera") return { id: e.id, kind, name: translate(locale, "scan.camera"), faction, profile: null, hostile: false };
  if (kind === "device") return { id: e.id, kind, name: translate(locale, e.interactable?.kind === "terminal" ? "scan.terminal" : "scan.device"), faction, profile: null, hostile: false };
  const named = e.interactable ? NAMED[e.interactable.dialogueId] : undefined;
  if (named) return { id: e.id, kind, name: named, faction, profile: null, hostile };
  if (e.enemy) return { id: e.id, kind, name: translate(locale, ENEMY_NAMES[e.enemy.type]), faction, profile: [translate(locale, from(QUIRKS, e.id, 5))], hostile };
  const p = passerBy(e.id, locale);
  return { id: e.id, kind, name: p.name, faction, profile: p.profile, hostile };
};
