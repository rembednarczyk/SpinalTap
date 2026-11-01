import type {
  CameraIntents,
  CharacterIntents,
  ContractIntents,
  DialogueIntents,
  DifficultyIntents,
  HackIntents,
  JournalIntents,
  LootIntents,
  MetroIntents,
  PhoneIntents,
  RadioIntents,
  SessionIntents,
  SettingsIntents,
  ShopIntents,
  UiIntents,
} from "@seki/ui";
import type { Controllers } from "./controllers/compose";
import type { SimRef } from "./controllers/shared";

/** Every method name of an intents interface, once: the compiler checks the list is complete. */
type Keys<I> = { readonly [K in keyof I]-?: true };

/** The intents the controllers implement: all of `UiIntents` but the session's own (ADR-0031). */
export type ControllerIntents = Omit<UiIntents, keyof SessionIntents>;

/** The methods of `impl` named in `keys`, bound to it: one controller's part of the intents. */
const part = <I extends object>(impl: I, keys: Keys<I>): I => {
  const out: Partial<I> = {};
  for (const key of Object.keys(keys) as (keyof I)[]) {
    const method = impl[key];
    out[key] = typeof method === "function" ? method.bind(impl) : method;
  }
  return out as I;
};

/** The session's intents in two parts: the course of the game (`SessionFlow`) and the saves (`SaveController`). */
export type SaveIntents = Pick<SessionIntents, "save" | "load" | "exportSave" | "importSave">;
export type FlowIntents = Omit<SessionIntents, keyof SaveIntents>;
const SESSION: Keys<SessionIntents> = { newGame: true, resume: true, pause: true, save: true, load: true, exportSave: true, importSave: true, quitToTitle: true };
const DIALOGUE: Keys<DialogueIntents> = { choose: true, closeDialogue: true };
const SHOP: Keys<ShopIntents> = {
  buyCyberware: true,
  buyItem: true,
  sellItem: true,
  repairItem: true,
  upgradeBackpack: true,
  installCyberwareItem: true,
  removeCyberware: true,
  closeShop: true,
  talkToShopkeeper: true,
};
const LOOT: Keys<LootIntents> = { takeLoot: true, closeLoot: true };
const CHARACTER: Keys<CharacterIntents> = {
  openCharacterScreen: true,
  closeCharacterScreen: true,
  setPreviewViewport: true,
  rotatePreview: true,
  resetPreview: true,
  equip: true,
  unequip: true,
  useItem: true,
  dropItem: true,
  installMod: true,
  removeMod: true,
};
const SETTINGS: Keys<SettingsIntents> = { changeSettings: true, bindKey: true, resetControls: true, reload: true };
const DIFFICULTY: Keys<DifficultyIntents> = { setDifficulty: true };
const CAMERA: Keys<CameraIntents> = { setFieldOfView: true };
const PHONE: Keys<PhoneIntents> = { openPhone: true, closePhone: true, readThread: true };
const CONTRACT: Keys<ContractIntents> = { dismissDebrief: true };
const HACK: Keys<HackIntents> = { setScan: true, pickQuickhack: true, submitBreach: true };
const METRO: Keys<MetroIntents> = { travelMetro: true, closeMetro: true };
const RADIO: Keys<RadioIntents> = { setRadioStation: true, nextRadioStation: true };

/** The journal has no controller: following an entry is one command to the simulation. */
const journalIntents = (sim: SimRef): JournalIntents => ({
  trackQuest: (questId) => sim().enqueue({ type: "track-quest", questId }),
});

/** Each controller's part of the UI intents, spread into one object. */
export const controllerIntents = (c: Controllers, sim: SimRef): ControllerIntents => ({
  ...part<DialogueIntents>(c.dialogue, DIALOGUE),
  ...part<ShopIntents>(c.shop, SHOP),
  ...part<LootIntents>(c.loot, LOOT),
  ...part<CharacterIntents>(c.character, CHARACTER),
  ...part<SettingsIntents>(c.settings, SETTINGS),
  ...part<CameraIntents>(c.settings, CAMERA),
  ...part<DifficultyIntents>(c.difficulty, DIFFICULTY),
  ...part<PhoneIntents>(c.phone, PHONE),
  ...part<ContractIntents>(c.hud, CONTRACT),
  ...journalIntents(sim),
  ...part<HackIntents>(c.hack, HACK),
  ...part<MetroIntents>(c.metro, METRO),
  ...part<RadioIntents>(c.radio, RADIO),
});

/** What the UI gets (`GameUi`'s `intents`): the session's own intents and the controllers' parts. */
export const composeIntents = (session: SessionIntents, controllers: ControllerIntents): UiIntents => ({
  ...part<SessionIntents>(session, SESSION),
  ...controllers,
});
