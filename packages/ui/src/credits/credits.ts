/**
 * Who made the models and sounds the game is built from (ADR-0063): the one list the "Credits"
 * screen reads. Titles and names stay as their authors wrote them; only the headings and labels
 * around them are translated (ADR-0056). Every file under `packages/app/public` that holds CC-BY
 * work has its entry here and a row in the README of its folder; `packages/app/test/credits.test.ts`
 * holds the three together (and against `tools/assets/sources.json`).
 */

export type CreditSection = "city" | "street" | "characters" | "weapons" | "audio";

export type CreditLicense = "CC0-1.0" | "CC-BY-4.0" | "VRoid-Hub-1.0";

export interface Credit {
  /** The source's id in `tools/assets/sources.json` where it has one; a CC-BY model carries it in its `extras.credit`. */
  readonly id: string;
  readonly section: CreditSection;
  /** The work's own title. */
  readonly title: string;
  readonly author: string;
  readonly authorUrl?: string;
  /** Where it comes from. */
  readonly url: string;
  readonly license: CreditLicense;
  /** Files under `packages/app/public` built from it. */
  readonly files: readonly string[];
  /** Changed for the game (CC-BY asks to say so): simplified, recoloured, trimmed. */
  readonly changed: boolean;
}

/** The licence's own name and its deed. */
export const LICENSES: Readonly<Record<CreditLicense, { readonly name: string; readonly url?: string }>> = {
  "CC0-1.0": { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "CC-BY-4.0": { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  // Written in each model's VRM metadata (packages/app/public/models/README.md).
  "VRoid-Hub-1.0": { name: "VRoid Hub License 1.0" },
};

/** The order of the sections on the screen. */
export const CREDIT_SECTIONS: readonly CreditSection[] = ["street", "city", "characters", "weapons", "audio"];

const CITY = ["city/city-kit.glb"] as const;
const PROPS = ["city/city-props.glb"] as const;
const STREET = ["city/street-props.glb"] as const;
/** `audio/<name>-000.ogg` ... for the numbers given. */
const ogg = (name: string, ...n: number[]): string[] => n.map((i) => `audio/${name}-${String(i).padStart(3, "0")}.ogg`);

export const CREDITS: readonly Credit[] = [
  // CC-BY 4.0 (ADR-0063): street props of city-props.glb.
  { id: "sketchfab-electric-pole", section: "street", title: "Electric pole", author: "Eh (Just_Eh)", authorUrl: "https://sketchfab.com/Just_Eh", url: "https://sketchfab.com/3d-models/electric-pole-a41cc931ffd84947b8f7b566acc33384", license: "CC-BY-4.0", files: PROPS, changed: true },
  { id: "sketchfab-robotic-animal", section: "street", title: "Robotic Animal", author: "igor.tesV", authorUrl: "https://sketchfab.com/igor.tesV", url: "https://sketchfab.com/3d-models/robotic-animal-d36aed18ec8f4638901e6e5c7ab4e7f6", license: "CC-BY-4.0", files: PROPS, changed: true },
  // CC-BY 4.0 (ADR-0063, second Sketchfab pack): street furniture of street-props.glb.
  { id: "sketchfab-vending-machine", section: "street", title: "Vending Machine", author: "A9908244", authorUrl: "https://sketchfab.com/A9908244", url: "https://sketchfab.com/3d-models/vending-machine-85faa612692e4ec48d6bd9d21484c239", license: "CC-BY-4.0", files: STREET, changed: true },
  { id: "sketchfab-ramen-vending-machine", section: "street", title: "Ramen Vending Machine", author: "JustFaith", authorUrl: "https://sketchfab.com/charljustine", url: "https://sketchfab.com/3d-models/ramen-vending-machine-3d3c8affeaa44620b7a04fa4a987ff99", license: "CC-BY-4.0", files: STREET, changed: true },
  { id: "sketchfab-reston-b2-terminal", section: "street", title: "Reston B2 Terminal", author: "Iteration Unlimited", authorUrl: "https://sketchfab.com/iterationunlimited", url: "https://sketchfab.com/3d-models/reston-b2-terminal-91b08809f18244628385193e396dd3da", license: "CC-BY-4.0", files: STREET, changed: true },
  { id: "sketchfab-scifi-kiosk", section: "street", title: "Scifi Kiosk", author: "Martin Ibbett", authorUrl: "https://sketchfab.com/unyxium", url: "https://sketchfab.com/3d-models/scifi-kiosk-835aac31a9114203b5cb04952f9a273b", license: "CC-BY-4.0", files: STREET, changed: true },
  { id: "sketchfab-cctv-camera", section: "street", title: "CCTV Camera", author: "Smoggybeard", authorUrl: "https://sketchfab.com/Smoggybeard", url: "https://sketchfab.com/3d-models/cctv-camera-e69d5eb37ffb4f188e4d3c84a5d79cdc", license: "CC-BY-4.0", files: STREET, changed: true },
  { id: "sketchfab-paper-lantern-chochin", section: "street", title: "Chinese \\ Japanese paper lantern chochin", author: "DeepDown", authorUrl: "https://sketchfab.com/deepdown", url: "https://sketchfab.com/3d-models/chinese-japanese-paper-lantern-chochin-20bcc5d20f2847f88aef3a267275d16c", license: "CC-BY-4.0", files: STREET, changed: true },
  // CC-BY 4.0 (ADR-0058 stage 2, E2 of the second pack): the food cart and the container, also in street-props.glb.
  { id: "sketchfab-avika-street-food-cart", section: "street", title: "Avika Street Food Cart", author: "AVIKA", authorUrl: "https://sketchfab.com/a-v-i-k-a", url: "https://sketchfab.com/3d-models/avika-street-food-cart-d54005c378fa45c3a06090d65a53fb23", license: "CC-BY-4.0", files: STREET, changed: true },
  { id: "sketchfab-shipping-container", section: "street", title: "Classic Shipping Container (Free/Gameready)", author: "Sebastian Webster", authorUrl: "https://sketchfab.com/Sebastian.Hamish.Webster", url: "https://sketchfab.com/3d-models/classic-shipping-container-freegameready-772f4be391a245f699c54e6cf157c58d", license: "CC-BY-4.0", files: STREET, changed: true },
  // CC-BY 4.0 (ADR-0063 stage 2): the skyline's megatowers, also in city-props.glb.
  { id: "sketchfab-megacity-cluster", section: "city", title: "Sci-Fi Megacity Cluster – Free  Asset Pac", author: "TRYFIELD", authorUrl: "https://sketchfab.com/tryfield", url: "https://sketchfab.com/3d-models/sci-fi-megacity-cluster-free-asset-pac-458380c745dc4e05ae5e0f6e7b4c69b2", license: "CC-BY-4.0", files: PROPS, changed: true },
  // CC0 (ADR-0022, ADR-0058): the city kit and the facade props.
  { id: "kenney-city-kit-commercial", section: "city", title: "City Kit Commercial 2.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/city-kit-commercial", license: "CC0-1.0", files: CITY, changed: true },
  { id: "kenney-car-kit", section: "city", title: "Car Kit 3.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/car-kit", license: "CC0-1.0", files: CITY, changed: true },
  { id: "kenney-city-kit-roads", section: "city", title: "City Kit Roads", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/city-kit-roads", license: "CC0-1.0", files: CITY, changed: true },
  { id: "neon-town", section: "city", title: "Neon Town", author: "leonkin", url: "https://opengameart.org/content/neon-town", license: "CC0-1.0", files: CITY, changed: true },
  { id: "quaternius-cyberpunk-kit", section: "city", title: "Cyberpunk Game Kit", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://drive.google.com/drive/folders/1GyKLypoBxrpLN6GERF9U610Wiub48v9y", license: "CC0-1.0", files: PROPS, changed: true },
  { id: "kenney-modular-buildings", section: "city", title: "Modular Buildings 2.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/modular-buildings", license: "CC0-1.0", files: PROPS, changed: true },
  { id: "kenney-retro-urban-kit", section: "city", title: "Retro Urban Kit 2.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/retro-urban-kit", license: "CC0-1.0", files: PROPS, changed: true },
  // CC0 (ADR-0058 stage 2): the street furniture of street-props.glb.
  { id: "oga-pixelmannen-atms", section: "street", title: "Low poly ATMs", author: "pixelmannen", url: "https://opengameart.org/content/low-poly-atms", license: "CC0-1.0", files: STREET, changed: true },
  { id: "quaternius-zombie-kit", section: "street", title: "Zombie Apocalypse Kit", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://quaternius.com/packs/zombieapocalypsekit.html", license: "CC0-1.0", files: STREET, changed: true },
  { id: "kenney-nature-kit", section: "street", title: "Nature Kit 2.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/nature-kit", license: "CC0-1.0", files: STREET, changed: true },
  { id: "quaternius-public-transport", section: "street", title: "Public Transport Pack", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://quaternius.com/packs/publictransport.html", license: "CC0-1.0", files: STREET, changed: true },
  { id: "oga-lyricsz-bike", section: "street", title: "bike", author: "lyricsz", url: "https://opengameart.org/content/bike-0", license: "CC0-1.0", files: STREET, changed: true },
  // The cast (VRoid Project samples) and the weapons.
  { id: "vroid-samples", section: "characters", title: "VRoid Studio sample models (AvatarSample_D, AvatarSample_F, Sakurada Fumiriya, Sendagaya Shino, Base_Male)", author: "pixiv / VRoid Project", url: "https://opengameart.org/content/vroid-studio-cc0-models", license: "VRoid-Hub-1.0", files: ["models/seki.vrm", "models/kaito.vrm", "models/ganger.vrm", "models/civilian.vrm", "models/mori.vrm"], changed: true },
  { id: "quaternius-ultimate-gun-pack", section: "weapons", title: "Ultimate Gun Pack", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://opengameart.org/content/ultimate-gun-pack", license: "CC0-1.0", files: ["weapons/pistol.glb", "weapons/smg.glb"], changed: true },
  // Sounds (packages/app/public/audio/README.md).
  { id: "kenney-impact-sounds", section: "audio", title: "Impact Sounds 1.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/impact-sounds", license: "CC0-1.0", files: [...ogg("hit-punch", 0, 1, 2), ...ogg("crit-punch", 0, 1, 2), ...ogg("hurt-soft", 0, 1, 2), ...ogg("kill-plate", 0), ...ogg("kill-metal", 0), ...ogg("step-concrete", 0, 1, 2, 3, 4), ...ogg("reload-metal", 0, 1), ...ogg("weapon-switch", 0, 1), ...ogg("loot-pickup", 0, 1), ...ogg("sell-tin", 0, 1), ...ogg("repair-hammer", 0, 1)], changed: false },
  { id: "kenney-interface-sounds", section: "audio", title: "Interface Sounds", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/interface-sounds", license: "CC0-1.0", files: [...ogg("ui-select", 1, 2), ...ogg("ui-confirm", 1), ...ogg("ui-purchase", 2), ...ogg("ui-save-click", 1), ...ogg("ui-error", 4, 5), ...ogg("glitch", 1, 2, 3, 4)], changed: false },
  { id: "kenney-sci-fi-sounds", section: "audio", title: "Sci-fi Sounds", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/sci-fi-sounds", license: "CC0-1.0", files: [...ogg("clinic-heal", 0, 1), "audio/cyber-overdrive.ogg"], changed: true },
  { id: "free-firearm-sound-library", section: "audio", title: "The Free Firearm Sound Library", author: "Ben Jaszczak et al. (freefirearmsfx.com)", url: "https://opengameart.org/content/the-free-firearm-sound-library", license: "CC0-1.0", files: ["audio/gun-pistol-ppq-near.ogg", "audio/gun-pistol-1911-near.ogg", "audio/gun-smg-m45-near.ogg", "audio/gun-pistol-ppq-mid.ogg", "audio/gun-smg-m45-mid.ogg"], changed: true },
  { id: "ylmir-rain-loopable", section: "audio", title: "Rain (loopable)", author: "Ylmir", url: "https://opengameart.org/content/rain-loopable", license: "CC0-1.0", files: ["audio/rain-loop.ogg"], changed: false },
];
