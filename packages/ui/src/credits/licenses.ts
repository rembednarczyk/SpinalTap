import type { MessageKey } from "../i18n/en";

/**
 * The closed list of licences a file of the game may ship under (ADR-0063, change of 15.11): CC0,
 * CC BY 4.0, the non-commercial CC BY-NC 4.0 and CC BY-NC-SA 4.0, a VRoid Hub model whose author's
 * terms allow non-commercial use and redistribution, and the game's own work. CC BY 3.0 only for
 * the icons of game-icons.net (ADR-0073); "VRoid Hub License 1.0" for the VRoid Project samples.
 */
export type CreditLicense =
  | "CC0-1.0"
  | "CC-BY-4.0"
  | "CC-BY-3.0"
  | "CC-BY-NC-4.0"
  | "CC-BY-NC-SA-4.0"
  | "VRoid-Hub-1.0"
  | "VRoid-Hub-NC"
  | "own";

/**
 * How the screen names a licence: its own name (not translated) or, for the game's own work and
 * the terms of a VRoid Hub author, a line of the catalogue (ADR-0056); and its deed, where it has
 * one for every work (a VRoid Hub author's terms are linked by the credit itself).
 */
export type LicenseInfo =
  | { readonly name: string; readonly url?: string }
  | { readonly key: MessageKey; readonly url?: string };

export const LICENSES: Readonly<Record<CreditLicense, LicenseInfo>> = {
  "CC0-1.0": { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "CC-BY-4.0": { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  "CC-BY-3.0": { name: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/" },
  "CC-BY-NC-4.0": { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/" },
  "CC-BY-NC-SA-4.0": { name: "CC BY-NC-SA 4.0", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/" },
  // Written in each model's VRM metadata (packages/app/public/models/README.md).
  "VRoid-Hub-1.0": { name: "VRoid Hub License 1.0" },
  "VRoid-Hub-NC": { key: "credits.license.vroidNc" },
  own: { key: "credits.license.own" },
};

/** Every licence of the list, in its order. */
export const CREDIT_LICENSES = Object.keys(LICENSES) as readonly CreditLicense[];

/** Licences that forbid commercial use: what to replace before the game is ever sold (ADR-0063, 15.11). */
export const NON_COMMERCIAL: readonly CreditLicense[] = ["CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "VRoid-Hub-NC"];

/** Licences whose changed work ships under the same licence, with the licence next to the file. */
export const SHARE_ALIKE: readonly CreditLicense[] = ["CC-BY-NC-SA-4.0"];
