// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import {
  ABILITY_CATALOG,
  ACT_TWO_ENDINGS,
  AMMO_CATALOG,
  ENDINGS,
  FACTIONS,
  MEMORY_CATALOG,
  QUEST_DEFINITIONS,
  QUICKHACKS,
  BUFF_CATALOG,
  CONTRACT_BONUS,
  CONTRACT_GIVERS,
  CONTRACT_KINDS,
  CONTRACT_KIND_IDS,
  CONTRACT_SITES,
  type Contract,
  type ContractFailure,
  CYBERWARE_CATALOG,
  GARMENT_CATALOG,
  MOD_CATALOG,
  RARITY,
  SHOPS,
  STACKABLE_CATALOG,
  WEAPON_CATALOG,
  contractClearedNote,
  contractFailureNote,
  contractObjective,
  giverText,
  starterKit,
  stockEntry,
  stockName,
  shopItemDescription,
  textRef,
  VENUE_KINDS,
  venueKindKey,
} from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, createUiStore, isMessageKey, translateText } from "../src";

/**
 * The game data of `packages/core` in both languages (ADR-0056, stage 3): core hands over keys,
 * the catalogs hold the words, English by default and the former Polish texts when chosen.
 */

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

const job: Contract = { id: "c3", siteId: "car_wash", targets: 3, reward: 625, status: "active" };
const FAILURES: readonly ContractFailure[] = ["timeout", "protectee-killed", "escort-killed", "detected", "connection-lost"];

/** Every key the core catalogs hand over. */
const coreKeys = (): string[] => [
  ...Object.values(STACKABLE_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(AMMO_CATALOG).map((d) => d.name),
  ...Object.values(GARMENT_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(MOD_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(WEAPON_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(RARITY).map((r) => r.label),
  ...Object.values(SHOPS).map((s) => s.name),
  ...Object.values(CYBERWARE_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(ABILITY_CATALOG).map((d) => d.name),
  ...Object.values(BUFF_CATALOG).map((d) => d.name),
  ...Object.values(MEMORY_CATALOG).flatMap((d) => [d.title, d.description]),
  ...Object.values(ENDINGS).map((d) => d.title),
  ...Object.values(ACT_TWO_ENDINGS).map((d) => d.title),
  ...Object.values(FACTIONS),
  ...Object.values(QUICKHACKS).map((d) => d.title),
  ...Object.values(CONTRACT_KINDS).map((k) => k.title),
  ...Object.values(CONTRACT_SITES).map((s) => s.text),
  ...Object.values(CONTRACT_BONUS).map((b) => b.label),
  ...Object.keys(CONTRACT_GIVERS).map((g) => giverText(g as keyof typeof CONTRACT_GIVERS).key),
  ...CONTRACT_KIND_IDS.map((kind) => contractClearedNote({ ...job, kind })),
  ...FAILURES.map((r) => contractFailureNote(r)),
  contractFailureNote("timeout", "eliminate"),
  ...VENUE_KINDS.map(venueKindKey),
  ...QUEST_DEFINITIONS.flatMap((q) => [q.title, ...q.steps.flatMap((s) => [s.objective, ...(s.variants ?? []).map((v) => v.objective)])]),
];

afterEach(cleanup);

describe("domain texts (ADR-0056, stage 3)", () => {
  it("every key core hands over is in the catalogs", () => {
    expect(coreKeys().filter((k) => !isMessageKey(k))).toEqual([]);
  });

  it("writes contract objectives in English, and in Polish exactly as core wrote them before", () => {
    const delivery: Contract = { ...job, kind: "delivery", siteId: "hana_stall", targets: 0 };
    const hack: Contract = { ...job, kind: "hack", siteId: "quay_terminal", progress: 600 };
    expect(translateText("en", contractObjective(job))).toBe("Take out the Hebi gangers (3): the yard behind the car wash past Plac Łokietka");
    expect(translateText("pl", contractObjective(job))).toBe("Zneutralizuj gangerów Hebi (3): podwórko za myjnią za Placem Łokietka");
    expect(translateText("en", contractObjective(delivery, 75))).toBe("Carry Kaito's package to Hana: Hana's cart at the Podzamcze market (1:15 left)");
    expect(translateText("pl", contractObjective(delivery, 75))).toBe("Zanieś paczkę od Kaito Hanie: wózek Hany na targu na Podzamczu (zostało 1:15)");
    expect(translateText("pl", contractObjective(delivery))).toBe("Zanieś paczkę od Kaito Hanie: wózek Hany na targu na Podzamczu");
    expect(translateText("pl", contractObjective(hack, 25))).toBe("Utrzymaj połączenie z terminalem (zostało 0:25): terminal Tessen pod dźwigiem nad rzeką");
    expect(translateText("pl", contractObjective({ ...hack, progress: undefined } as Contract))).toBe("Włam się do terminala i utrzymaj połączenie 40 s: terminal Tessen pod dźwigiem nad rzeką");
    const retrieved: Contract = { ...job, kind: "retrieve", siteId: "hebi_stash", status: "cleared" };
    expect(translateText("en", contractObjective(retrieved))).toBe("Crate taken. Go back to Hana for your pay");
    expect(translateText("pl", contractObjective(retrieved))).toBe("Skrzynka zabrana. Wróć do Hany po zapłatę");
    expect(translateText("pl", contractFailureNote("timeout", "eliminate"))).toBe("Termin minął. Zleceniodawca szuka kogoś szybszego");
    expect(translateText("en", CONTRACT_KINDS.hack.title)).toBe("Terminal hack");
    expect(translateText("pl", CONTRACT_BONUS.delivery.label)).toBe("Bez alarmu i bez heat");
  });

  it("translates a key, a key with parameters and the texts inside them; a non-key stays as it is", () => {
    expect(translateText("en", "item.medkit.name")).toBe("Medkit");
    expect(translateText("pl", "item.medkit.name")).toBe("Apteczka");
    const box = textRef("shop.stock.ammo", { ammo: textRef("ammo.12g"), qty: 8 });
    expect(translateText("en", box)).toBe("12 gauge × 8");
    expect(translateText("pl", box)).toBe("Śrut 12 × 8");
    expect(translateText("pl", "Stragan Oyajiego")).toBe("Stragan Oyajiego");
    expect(translateText("en", textRef("no.such.key"))).toBe("no.such.key");
  });

  it("names the shop's stock and its counter text in the chosen language", () => {
    const box = stockEntry("oyaji", "9mm")!;
    expect(translateText("en", stockName(box))).toBe("9 mm × 24");
    expect(translateText("en", shopItemDescription("556"))).toBe("A box of 5.56 mm rounds, straight into the pouch.");
    expect(translateText("pl", shopItemDescription("556"))).toBe("Pudełko nabojów 5,56 mm, prosto do ładownicy.");
    expect(translateText("pl", shopItemDescription("suppressor"))).toBe("Strzał słychać tylko z bliska (alarm 8 m zamiast 22 m). Obrażenia ×0,95.");
  });

  it("shows items in the inventory in English by default and in Polish when chosen", () => {
    const kit = starterKit();
    const mount = (locale: "en" | "pl") => {
      const store = createUiStore({ screen: "playing", characterTab: "inventory", ...kit, settings: { ...DEFAULT_SETTINGS, locale } });
      render(<GameUi store={store} intents={intents()} />);
    };
    mount("en");
    expect(screen.getByTestId("slot-torso").textContent).toContain("Seki's jacket");
    expect(screen.getByTestId("ammo-pouch").textContent).toContain("9 mm");
    cleanup();
    mount("pl");
    expect(screen.getByTestId("slot-torso").textContent).toContain("Kurtka Seki");
  });

  it("names implants, memories, factions and buffs on the sheet and the HUD in the chosen language", () => {
    const mount = (locale: "en" | "pl", sheet: boolean) => {
      const store = createUiStore({
        screen: "playing",
        ...(sheet ? { characterTab: "sheet" as const } : {}),
        cyberware: { optics: "hitomi_optics_mk1" },
        memories: ["combat_reflex"],
        buffs: [{ id: "steady", name: BUFF_CATALOG.steady.name, left: 20, total: 60 }],
        settings: { ...DEFAULT_SETTINGS, locale },
      });
      render(<GameUi store={store} intents={intents()} />);
    };
    const shown = (locale: "en" | "pl") => {
      mount(locale, true);
      const sheet = screen.getByTestId("character-panel").textContent;
      cleanup();
      mount(locale, false);
      const buff = screen.getByTestId("buff-steady").textContent;
      cleanup();
      return { sheet, buff };
    };
    expect(shown("en").sheet).toContain("Hitomi Mk1 optics");
    expect(shown("en").sheet).toContain("Memory: reflex");
    expect(shown("en").sheet).toContain("Kaito's network");
    expect(shown("pl").sheet).toContain("Wspomnienie: odruch");
    expect(shown("pl").sheet).toContain("Sieć Kaito");
    expect(shown("en").buff).toContain("Steady hand");
    expect(shown("pl").sheet).toContain("Optyka Hitomi Mk1");
    expect(shown("pl").buff).toContain("Pewna ręka");
  });
});
