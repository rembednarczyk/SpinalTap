import { type EnemyTypeId, FACTIONS, type HackTargetKind } from "@seki/core";
import type { Entity } from "@seki/sim";
import type { ScanTargetVm } from "@seki/ui";

const ENEMY_NAMES: Readonly<Record<EnemyTypeId, string>> = {
  hebi_ganger: "Gangster Hebi",
  hebi_lookout: "Czujka Hebi",
  hebi_enforcer: "Egzekutor Hebi",
  hebi_brawler: "Zabijaka Hebi",
  kagami_cleaner: "Czyściciel Kagami",
  tessen_guard: "Strażnik Tessen",
  tessen_sniper: "Snajper Tessen",
};

/** People the player knows by name, by the ink knot they talk through. */
const NAMED: Readonly<Record<string, string>> = {
  fixer: "Kaito",
  kaito: "Kaito",
  mori: "Doktor Mori",
  oyaji: "Oyaji",
  hana: "Hana",
  genzo: "Genzō",
};

const GIVEN = ["Akira", "Yumi", "Kenji", "Rin", "Daichi", "Mei", "Sora", "Haru", "Nao", "Ren", "Emi", "Taro"] as const;
const FAMILY = ["Tanaka", "Suzuki", "Kobayashi", "Watanabe", "Ito", "Nakamura", "Yamada", "Kato", "Hayashi", "Ogawa"] as const;
const JOBS = [
  "Kurier dronów",
  "Kucharz w barze ramen",
  "Technik sieci miejskiej",
  "Sprzedawca na targu",
  "Ochroniarz na kontrakcie",
  "Pielęgniarka w klinice",
  "Student cybernetyki",
  "Mechanik skuterów",
  "Barman w Neon Koi",
  "Operator dźwigu w porcie",
  "Bezrobotny",
  "Dostawca makaronu",
] as const;
const INCOME = ["Dochód: 900 €$/mies.", "Dochód: 1 400 €$/mies.", "Dochód: 2 300 €$/mies.", "Dochód: 4 100 €$/mies.", "Dochód: brak danych"] as const;
const QUIRKS = [
  "Zadłużony u Hebi",
  "Kolekcjonuje stare winyle",
  "Dwa wszczepy z czarnego rynku",
  "Śpi cztery godziny na dobę",
  "Pisze anonimowo na netboardach",
  "Ma brata w ochronie Tessen",
  "Właśnie dostał eksmisję",
  "Co noc gra w pachinko",
  "Nie ufa Kagami Biotech",
  "Uczy się kaligrafii",
  "Karany za drobne kradzieże",
  "Wspiera schronisko dla kotów",
] as const;

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

/** Name and three lines of a passer-by's profile (Watch Dogs 2 style), the same for the same id. */
export const passerBy = (id: number): { name: string; profile: string[] } => ({
  name: `${from(GIVEN, id, 1)} ${from(FAMILY, id, 2)}`,
  profile: [from(JOBS, id, 3), from(INCOME, id, 4), from(QUIRKS, id, 5)],
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

export const scanTargetVm = (e: Entity): ScanTargetVm => {
  const kind = scanKind(e);
  const hostile = e.ai !== undefined || e.enemy !== undefined || e.sniper !== undefined;
  const faction = e.faction ? FACTIONS[e.faction] : null;
  if (kind === "camera") return { id: e.id, kind, name: "Kamera ochrony", faction, profile: null, hostile: false };
  if (kind === "device") return { id: e.id, kind, name: e.interactable?.kind === "terminal" ? "Terminal" : "Urządzenie", faction, profile: null, hostile: false };
  const named = e.interactable ? NAMED[e.interactable.dialogueId] : undefined;
  if (named) return { id: e.id, kind, name: named, faction, profile: null, hostile };
  if (e.enemy) return { id: e.id, kind, name: ENEMY_NAMES[e.enemy.type], faction, profile: [from(QUIRKS, e.id, 5)], hostile };
  const p = passerBy(e.id);
  return { id: e.id, kind, name: p.name, faction, profile: p.profile, hostile };
};
