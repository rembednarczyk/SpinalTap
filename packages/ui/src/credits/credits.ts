import { GAME_ICON_SOURCES, type GameIconAuthor } from "../icons/game-icon-paths";
import type { CreditLicense } from "./licenses";

/**
 * Who made the models, sounds and icons the game is built from (ADR-0063): the one list the "Credits"
 * screen reads and the one record of the licence of every file that ships (change of 15.11).
 * Titles and names stay as their authors wrote them; only the headings and labels around them are
 * translated (ADR-0056). Every model, texture, sound and image under `packages/app/public` has its
 * entry here (`packages/app/test/asset-licenses.test.ts`); CC-BY work also a row in the README of
 * its folder (`packages/app/test/credits.test.ts`, also against `tools/assets/sources.json`).
 */

export type CreditSection = "city" | "street" | "characters" | "weapons" | "audio" | "icons" | "app";

export { CREDIT_LICENSES, type CreditLicense, LICENSES, type LicenseInfo, NON_COMMERCIAL, SHARE_ALIKE } from "./licenses";

export interface Credit {
  /** The source's id in `tools/assets/sources.json` where it has one; a CC-BY model carries it in its `extras.credit`. */
  readonly id: string;
  readonly section: CreditSection;
  /** The work's own title. */
  readonly title: string;
  readonly author: string;
  readonly authorUrl?: string;
  /** Where it comes from; none for the game's own work. */
  readonly url?: string;
  readonly license: CreditLicense;
  /** The terms of this one work, where its licence has no deed of its own (a VRoid Hub author's conditions). */
  readonly licenseUrl?: string;
  /** Files under `packages/app/public` built from it; none for the item icons, which are drawn into the code (`icons/`). */
  readonly files: readonly string[];
  /** Changed for the game (CC-BY asks to say so): simplified, recoloured, trimmed. */
  readonly changed: boolean;
}

/** The order of the sections on the screen. */
export const CREDIT_SECTIONS: readonly CreditSection[] = ["street", "city", "characters", "weapons", "audio", "icons", "app"];

const CITY = ["city/city-kit.glb"] as const;
const PROPS = ["city/city-props.glb"] as const;
const STREET = ["city/street-props.glb"] as const;
const MARKET = ["city/market-props.glb"] as const;
const DOORS = ["city/door-props.glb"] as const;
const VEHICLES = ["city/vehicle-props.glb"] as const;
const DRONES = ["city/drone-props.glb"] as const;
const CROWD = ["city/crowd-props.glb"] as const;
const ROOMS = ["city/room-props.glb"] as const;
const EXTRAS = ["city/extra-props.glb"] as const;
/** The icons of one game-icons.net author the game draws after, by their titles there: "Brain, Syringe (game-icons.net)". */
const gameIcons = (author: GameIconAuthor): string => {
  const names = Object.values(GAME_ICON_SOURCES).filter((s) => s.author === author);
  return `${names.map((s) => s.name.charAt(0).toUpperCase() + s.name.slice(1).split("-").join(" ")).join(", ")} (game-icons.net)`;
};
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
  { id: "kenney-car-kit", section: "city", title: "Car Kit 3.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/car-kit", license: "CC0-1.0", files: [...CITY, ...VEHICLES], changed: true },
  { id: "kenney-city-kit-roads", section: "city", title: "City Kit Roads", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/city-kit-roads", license: "CC0-1.0", files: CITY, changed: true },
  { id: "neon-town", section: "city", title: "Neon Town", author: "leonkin", url: "https://opengameart.org/content/neon-town", license: "CC0-1.0", files: CITY, changed: true },
  { id: "quaternius-cyberpunk-kit", section: "city", title: "Cyberpunk Game Kit", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://drive.google.com/drive/folders/1GyKLypoBxrpLN6GERF9U610Wiub48v9y", license: "CC0-1.0", files: PROPS, changed: true },
  { id: "kenney-modular-buildings", section: "city", title: "Modular Buildings 2.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/modular-buildings", license: "CC0-1.0", files: PROPS, changed: true },
  { id: "kenney-retro-urban-kit", section: "city", title: "Retro Urban Kit 2.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/retro-urban-kit", license: "CC0-1.0", files: PROPS, changed: true },
  // CC0 (ADR-0058 stage 2): the street furniture of street-props.glb.
  { id: "oga-pixelmannen-atms", section: "street", title: "Low poly ATMs", author: "pixelmannen", url: "https://opengameart.org/content/low-poly-atms", license: "CC0-1.0", files: STREET, changed: true },
  { id: "quaternius-zombie-kit", section: "street", title: "Zombie Apocalypse Kit", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://quaternius.com/packs/zombieapocalypsekit.html", license: "CC0-1.0", files: STREET, changed: true },
  { id: "kenney-nature-kit", section: "street", title: "Nature Kit 2.1", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/nature-kit", license: "CC0-1.0", files: STREET, changed: true },
  { id: "quaternius-public-transport", section: "street", title: "Public Transport Pack", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://quaternius.com/packs/publictransport.html", license: "CC0-1.0", files: [...STREET, ...VEHICLES], changed: true },
  { id: "oga-lyricsz-bike", section: "street", title: "bike", author: "lyricsz", url: "https://opengameart.org/content/bike-0", license: "CC0-1.0", files: STREET, changed: true },
  // CC0 (ADR-0058 stage 3): the market's stock, the food booths and the goods on the counters of market-props.glb.
  { id: "kenney-food-kit", section: "street", title: "Food Kit 2.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/food-kit", license: "CC0-1.0", files: MARKET, changed: true },
  { id: "kenney-mini-market", section: "street", title: "Mini Market 1.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/mini-market", license: "CC0-1.0", files: MARKET, changed: true },
  { id: "kenney-survival-kit", section: "street", title: "Survival Kit 2.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/survival-kit", license: "CC0-1.0", files: MARKET, changed: true },
  { id: "kenney-furniture-kit", section: "street", title: "Furniture Pack 1.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/furniture-kit", license: "CC0-1.0", files: MARKET, changed: true },
  // CC0 (ADR-0058 stage 8): the still crowd of crowd-props.glb.
  { id: "quaternius-posed-humans", section: "street", title: "Background Posed Humans", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://quaternius.com/packs/backgroundposedhumans.html", license: "CC0-1.0", files: CROWD, changed: true },
  // CC-BY 4.0 (ADR-0058 stage 9, E7 of the second pack): the leaves of the doors on the facades, door-props.glb.
  { id: "sketchfab-cyberpunk-doors-and-windows", section: "street", title: "Cyberpunk City Assets Pack 3# Doors and Windows", author: "carlcapu9", authorUrl: "https://sketchfab.com/carlcapu9", url: "https://sketchfab.com/3d-models/cyberpunk-city-assets-pack-3-doors-and-windows-c6cdc4f6715e4d8eae61eeb81fe636c8", license: "CC-BY-4.0", files: DOORS, changed: true },
  { id: "sketchfab-psx-garage-doors", section: "street", title: "Low-Poly PSX Style Garage Doors Pack", author: "vanillao03", authorUrl: "https://sketchfab.com/vanillao03", url: "https://sketchfab.com/3d-models/low-poly-psx-style-garage-doors-pack-6cd3bb88d27e44ac96f080e533d7015a", license: "CC-BY-4.0", files: DOORS, changed: true },
  { id: "sketchfab-cyberpunk-scifi-door-3", section: "street", title: "Cyberpunk Sci-fi Door 3 - Free", author: "Jesus Fernandez Garcia", authorUrl: "https://sketchfab.com/jamyzgenius", url: "https://sketchfab.com/3d-models/cyberpunk-sci-fi-door-3-free-df980eee6f0f42aaa52d70b668001b4d", license: "CC-BY-4.0", files: DOORS, changed: true },
  // CC-BY 4.0 (ADR-0058 stage 4, E5 of the second pack): the street's cars, vehicle-props.glb.
  { id: "sketchfab-cyberpunk-car", section: "street", title: "Cyberpunk car", author: "4d_Bob", authorUrl: "https://sketchfab.com/3d_Bob", url: "https://sketchfab.com/3d-models/cyberpunk-car-b4301ff99d214d16a7a43708a5866bf0", license: "CC-BY-4.0", files: VEHICLES, changed: true },
  // Also the wreck on its roof on Plac Litewski (`rd-lit-wreck`, room-detail-krakowskie-props.glb, ADR-0102).
  { id: "sketchfab-dirty-car", section: "street", title: "Dirty car", author: "3D Error 404", authorUrl: "https://sketchfab.com/3DError404", url: "https://sketchfab.com/3d-models/dirty-car-da77a8c75ddd4d7a8391912ba35735b8", license: "CC-BY-4.0", files: [...VEHICLES, "city/room-detail-krakowskie-props.glb"], changed: true },
  // CC0 (ADR-0058 stage 4): SUV, pickup and garbage truck, also in vehicle-props.glb (with the far and phone versions of the city kit cars, Car Kit 3.1).
  { id: "kenney-car-kit-2", section: "street", title: "Car Kit 2.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/car-kit", license: "CC0-1.0", files: VEHICLES, changed: true },
  // CC-BY 4.0 (ADR-0058 stage 7, E4 of the second pack): the drones over the street canyons, drone-props.glb.
  { id: "sketchfab-cyberpunk-drone", section: "city", title: "Cyberpunk Drone Concept Design", author: "Berk Gedik", authorUrl: "https://sketchfab.com/berkgedik", url: "https://sketchfab.com/3d-models/cyberpunk-drone-concept-design-09e7406fc76248a2866209025588dad0", license: "CC-BY-4.0", files: DRONES, changed: true },
  // CC-BY 4.0 (ADR-0096): the extra props of extra-props.glb.
  { id: "sketchfab-street-asset-pack", section: "street", title: "Street Asset Pack", author: "vmatthew", authorUrl: "https://sketchfab.com/vmatthew", url: "https://sketchfab.com/3d-models/street-asset-pack-f3eb47d02e2e4ab290e66752fa354b48", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  { id: "sketchfab-mini-atm", section: "street", title: "Simple Mini-ATM", author: "Blender3D", authorUrl: "https://sketchfab.com/Blender3D", url: "https://sketchfab.com/3d-models/simple-mini-atm-297bb83c296b49cf93bfbf157f9ca431", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  { id: "sketchfab-satellite-comms", section: "street", title: "Satellite Comms", author: "Duane's Mind", authorUrl: "https://sketchfab.com/duanesmind", url: "https://sketchfab.com/3d-models/satellite-comms-4be56951da39429a963ee12140bbff57", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  { id: "sketchfab-fire-escape-doors", section: "street", title: "Fire Escape / Exit Doors", author: "blue man group", authorUrl: "https://sketchfab.com/bloobloo", url: "https://sketchfab.com/3d-models/fire-escape-exit-doors-4ad9f395571a4dfaadce33dfeccc7a53", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  { id: "sketchfab-taiwan-signboard", section: "street", title: "Taiwan style Signboard (lowpoly)", author: "Solarliu", authorUrl: "https://sketchfab.com/jacky15621419", url: "https://sketchfab.com/3d-models/taiwan-style-signboard-lowpoly-7eeac0582f7746ffafcdf1091f882a5d", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  { id: "sketchfab-cyberpunk-led-neon-sign", section: "street", title: "Cyberpunk animated japanese LED neon sign", author: "YD Visual", authorUrl: "https://sketchfab.com/ydvisual", url: "https://sketchfab.com/3d-models/cyberpunk-animated-japanese-led-neon-sign-fab087c62fc3459a8b7664757d980c28", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  { id: "sketchfab-asian-shop-pack", section: "street", title: "Asian Shop Pack Free Gameready", author: "abhayexe", authorUrl: "https://sketchfab.com/abhayexe", url: "https://sketchfab.com/3d-models/asian-shop-pack-free-gameready-2f603ad8d5c640f7b9794f6916f9fbdd", license: "CC-BY-4.0", files: EXTRAS, changed: true },
  // CC-BY 4.0 (ADR-0063 stage 3): the capsule room on Jezuicka, room-props.glb.
  { id: "sketchfab-futuristic-compact-room", section: "city", title: "Futuristic Compact Room", author: "igor.tesV", authorUrl: "https://sketchfab.com/igor.tesV", url: "https://sketchfab.com/3d-models/futuristic-compact-room-f49b4d0fbd45427bb47484b0a9ccfe75", license: "CC-BY-4.0", files: ROOMS, changed: true },
  // The cast (VRoid Project samples) and the weapons.
  { id: "vroid-samples", section: "characters", title: "VRoid Studio sample models (AvatarSample_D, AvatarSample_F, Sakurada Fumiriya, Sendagaya Shino, Base_Male)", author: "pixiv / VRoid Project", url: "https://opengameart.org/content/vroid-studio-cc0-models", license: "VRoid-Hub-1.0", files: ["models/seki.vrm", "models/kaito.vrm", "models/ganger.vrm", "models/civilian.vrm", "models/mori.vrm"], changed: true },
  // Ume, Kiku and Sachiko (ADR-0076 decision 7): CC0 in the file's VRM metadata.
  { id: "vroid-base-female", section: "characters", title: "VRoid Studio CC0 models: Base_Female", author: "pixiv / VRoid Project", url: "https://opengameart.org/content/vroid-studio-cc0-models", license: "CC0-1.0", files: ["models/base-female.vrm"], changed: true },
  // Kurosawa (ADR-0076 decision 4, stage 3): CC0 in the file's VRM metadata.
  { id: "vroid-hairsample-male", section: "characters", title: "VRoid Studio CC0 models: HairSample_Male", author: "pixiv / VRoid Project", url: "https://opengameart.org/content/vroid-studio-cc0-models", license: "CC0-1.0", files: ["models/kurosawa.vrm"], changed: true },
  // VRoid Hub, the author's terms of 15.11 (ADR-0086 stage 1): the techwear jacket cut out of the model, the Hebi jacket on imported models.
  { id: "vroid-hub-kimi", section: "characters", title: "Kimi || Desktop Mate Model", author: "Toriss", url: "https://hub.vroid.com/en/characters/7972506988434619525/models/2687543789787584553", license: "VRoid-Hub-NC", licenseUrl: "https://hub.vroid.com/license?allowed_to_use_user=everyone&characterization_allowed_user=everyone&corporate_commercial_use=allow&credit=unnecessary&modification=allow&personal_commercial_use=profit&redistribution=allow&sexual_expression=allow&version=1&violent_expression=allow", files: ["garments/jacket-techwear.glb"], changed: true },
  { id: "quaternius-ultimate-gun-pack", section: "weapons", title: "Ultimate Gun Pack", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://opengameart.org/content/ultimate-gun-pack", license: "CC0-1.0", files: ["weapons/pistol.glb", "weapons/revolver.glb", "weapons/smg.glb", "weapons/shotgun.glb", "weapons/rifle.glb"], changed: true },
  { id: "quaternius-medieval-weapons", section: "weapons", title: "Low poly medieval weapons", author: "Quaternius", authorUrl: "https://quaternius.com", url: "https://opengameart.org/content/low-poly-medieval-weapons", license: "CC0-1.0", files: ["weapons/baton.glb", "weapons/blade.glb"], changed: true },
  // Sounds (packages/app/public/audio/README.md).
  { id: "kenney-impact-sounds", section: "audio", title: "Impact Sounds 1.0", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/impact-sounds", license: "CC0-1.0", files: [...ogg("hit-punch", 0, 1, 2), ...ogg("crit-punch", 0, 1, 2), ...ogg("hurt-soft", 0, 1, 2), ...ogg("kill-plate", 0), ...ogg("kill-metal", 0), ...ogg("step-concrete", 0, 1, 2, 3, 4), ...ogg("weapon-switch", 0, 1), ...ogg("loot-pickup", 0, 1), ...ogg("sell-tin", 0, 1), ...ogg("repair-hammer", 0, 1), ...ogg("car-glass", 0, 1)], changed: false },
  { id: "kenney-interface-sounds", section: "audio", title: "Interface Sounds", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/interface-sounds", license: "CC0-1.0", files: [...ogg("ui-select", 1, 2), ...ogg("ui-confirm", 1), ...ogg("ui-purchase", 2), ...ogg("ui-save-click", 1), ...ogg("ui-error", 4, 5), ...ogg("glitch", 1, 2, 3, 4)], changed: false },
  { id: "kenney-sci-fi-sounds", section: "audio", title: "Sci-fi Sounds", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://kenney.nl/assets/sci-fi-sounds", license: "CC0-1.0", files: [...ogg("clinic-heal", 0, 1), "audio/cyber-overdrive.ogg", ...ogg("blast-crunch", 3, 4)], changed: true },
  { id: "free-firearm-sound-library", section: "audio", title: "The Free Firearm Sound Library", author: "Ben Jaszczak et al. (freefirearmsfx.com)", url: "https://opengameart.org/content/the-free-firearm-sound-library", license: "CC0-1.0", files: ["audio/gun-pistol-ppq-near.ogg", "audio/gun-pistol-1911-near.ogg", "audio/gun-smg-m45-near.ogg", "audio/gun-pistol-ppq-mid.ogg", "audio/gun-smg-m45-mid.ogg", "audio/gun-revolver-642-near.ogg", "audio/gun-smg-ppsh-near.ogg", "audio/gun-shotgun-nova-near.ogg", "audio/gun-shotgun-model12-near.ogg", "audio/gun-rifle-ar15-near.ogg", "audio/gun-rifle-ak47-near.ogg", "audio/gun-shotgun-nova-mid.ogg", "audio/gun-rifle-ar15-mid.ogg", "audio/gun-rifle-sks-mid.ogg"], changed: true },
  // CC BY 3.0 (ADR-0063, ADR-0073 stage 2): the icons of implants and consumables, redrawn into icons/game-icon-paths.ts.
  { id: "game-icons-lorc", section: "icons", title: gameIcons("Lorc"), author: "Lorc", authorUrl: "http://lorcblog.blogspot.com", url: "https://game-icons.net", license: "CC-BY-3.0", files: [], changed: true },
  { id: "game-icons-delapouite", section: "icons", title: gameIcons("Delapouite"), author: "Delapouite", authorUrl: "http://delapouite.com", url: "https://game-icons.net", license: "CC-BY-3.0", files: [], changed: true },
  { id: "zer0-sol-shotgun-reload", section: "audio", title: "Shotgun Reload Sound Effects", author: "zer0_sol", url: "https://opengameart.org/content/shotgun-reload-sound-effects", license: "CC0-1.0", files: [...ogg("reload-shell", 0, 1, 2, 3), ...ogg("shotgun-rack", 0)], changed: true },
  { id: "zer0-sol-handgun-reload", section: "audio", title: "Handgun Reload Sound Effect", author: "zer0_sol", url: "https://opengameart.org/content/handgun-reload-sound-effect", license: "CC0-1.0", files: ["audio/reload-handgun-000.ogg", "audio/draw-pistol-000.ogg"], changed: true },
  { id: "springyspringo-gun-reloads", section: "audio", title: "Gun Reload Sounds", author: "SpringySpringo", url: "https://opengameart.org/content/gun-reload-sounds", license: "CC0-1.0", files: [...ogg("draw-smg", 0), ...ogg("draw-shotgun", 0), ...ogg("draw-rifle", 0)], changed: true },
  { id: "pauliuw-gun-click", section: "audio", title: "Gun Reload lock or Click Sound", author: "pauliuw", url: "https://opengameart.org/content/gun-reload-lock-or-click-sound", license: "CC0-1.0", files: [...ogg("draw-revolver", 0)], changed: true },
  { id: "vehicle-weapons-apparel", section: "audio", title: "Weapons and Apparel SFX Library", author: "Vehicle", url: "https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library", license: "CC0-1.0", files: [...ogg("draw-baton", 0), ...ogg("draw-blade", 0, 1), ...ogg("holster", 0, 1)], changed: true },
  // The game's own work (ADR-0063, 15.11): the app icon, cut from a shot of the game (#131).
  { id: "seki-senshi-app-icon", section: "app", title: "Seki Senshi", author: "Seki Senshi", license: "own", files: ["icons/icon-192.png", "icons/icon-512.png"], changed: false },
  // The game's own work (ADR-0098, 22.11): the rooms' detail, built by Blender from the scripts in tools/blender/ after the rooms' cards.
  { id: "seki-senshi-room-detail", section: "city", title: "Room detail", author: "Seki Senshi", license: "own", files: ["city/room-detail-props.glb", "city/room-detail-doki-props.glb", "city/room-detail-stare-props.glb", "city/room-detail-w3-props.glb", "city/room-detail-metro-props.glb", "city/room-detail-alchemia-props.glb", "city/room-detail-galeria-props.glb", "city/room-detail-kits-props.glb", "city/room-detail-myjnia-props.glb", "city/room-detail-sceny-props.glb", "city/room-detail-krakowskie-props.glb", "city/room-detail-brama-props.glb", "city/room-detail-t1-props.glb", "city/room-detail-rynek-props.glb"], changed: false },
  { id: "ylmir-rain-loopable", section: "audio", title: "Rain (loopable)", author: "Ylmir", url: "https://opengameart.org/content/rain-loopable", license: "CC0-1.0", files: ["audio/rain-loop.ogg"], changed: false },
  // In place of synthesized cues (user's request of 18.11): trimmed, mono, normalized (audio README).
  { id: "kenney-rpg-sounds", section: "audio", title: "RPG Sound Pack", author: "Kenney", authorUrl: "https://kenney.nl", url: "https://opengameart.org/content/50-rpg-sound-effects", license: "CC0-1.0", files: [...ogg("impact-melee", 0), ...ogg("swing", 0, 1), ...ogg("block", 0), ...ogg("parry", 0), ...ogg("jump-cloth", 0, 1), ...ogg("land-step", 0, 1), ...ogg("land-hard", 0), ...ogg("charge-clamp", 0)], changed: true },
  { id: "ezduzziteh-alarm", section: "audio", title: "Alarm", author: "ezduzziteh", url: "https://opengameart.org/content/alarm-1", license: "CC0-1.0", files: ["audio/alarm-klaxon-000.ogg"], changed: true },
  { id: "aquinn-sirens", section: "audio", title: "Sirens and Alarm Noise", author: "aquinn", url: "https://opengameart.org/content/sirens-and-alarm-noise", license: "CC0-1.0", files: ["audio/alarm-siren-000.ogg"], changed: true },
  // The car she drives (ADR-0097, 21.11): the horn, the doors, the engine's start and stop, its loop pitched with the revs.
  { id: "ggbotnet-car-sounds", section: "audio", title: "Car Sound Effects Pack (Low Quality)", author: "GGBotNet", url: "https://opengameart.org/content/car-sound-effects-pack-low-quality", license: "CC0-1.0", files: [...ogg("car-horn", 0), ...ogg("car-door-open", 0), ...ogg("car-door-close", 0), ...ogg("engine-stop", 0), ...ogg("engine-loop", 0)], changed: true },
  // The car's sounds recorded (22.11, the user's request: every sound typical for a car, no stand-ins), Freesound, CC0.
  { id: "freesound-71739", section: "audio", title: "Chrysler LHS tire squeal 04", author: "audible-edge", url: "https://freesound.org/people/audible-edge/sounds/71739/", license: "CC0-1.0", files: ["audio/car-skid-loop.ogg"], changed: true },
  { id: "freesound-237375", section: "audio", title: "Car Crash", author: "squareal", url: "https://freesound.org/people/squareal/sounds/237375/", license: "CC0-1.0", files: [...ogg("car-crash", 0)], changed: true },
  { id: "freesound-449062", section: "audio", title: "Car accident. Real. Interior.", author: "softwalls", url: "https://freesound.org/people/softwalls/sounds/449062/", license: "CC0-1.0", files: [...ogg("car-crash", 1)], changed: true },
  { id: "freesound-592388", section: "audio", title: "Car Crash (with Glass)", author: "magnuswaker", url: "https://freesound.org/people/magnuswaker/sounds/592388/", license: "CC0-1.0", files: [...ogg("car-crash-heavy", 0)], changed: true },
  { id: "freesound-329516", section: "audio", title: "Hood Impact", author: "LPA134", url: "https://freesound.org/people/LPA134/sounds/329516/", license: "CC0-1.0", files: [...ogg("car-bump", 0)], changed: true },
  { id: "freesound-136535", section: "audio", title: "CarBootClose", author: "jmdh", url: "https://freesound.org/people/jmdh/sounds/136535/", license: "CC0-1.0", files: [...ogg("car-bump", 1)], changed: true },
  { id: "freesound-332058", section: "audio", title: "Collision", author: "qubodup", url: "https://freesound.org/people/qubodup/sounds/332058/", license: "CC0-1.0", files: [...ogg("car-bump", 2)], changed: true },
  { id: "freesound-151624", section: "audio", title: "Clank Car Crash Collision", author: "qubodup", url: "https://freesound.org/people/qubodup/sounds/151624/", license: "CC0-1.0", files: [...ogg("car-bump", 3)], changed: true },
  { id: "freesound-837695", section: "audio", title: "touch of car bonnet/hood", author: "cupido-1", url: "https://freesound.org/people/cupido-1/sounds/837695/", license: "CC0-1.0", files: [...ogg("car-tap", 0, 1, 2, 3, 4, 5)], changed: true },
  { id: "freesound-385939", section: "audio", title: "S023_Metal_Rail_Scrape_Mono", author: "Pól", url: "https://freesound.org/people/Pól/sounds/385939/", license: "CC0-1.0", files: ["audio/car-scrape-loop.ogg"], changed: true },
  { id: "freesound-501172", section: "audio", title: "Angle Grinder On Metal (2)", author: "shelbyshark", url: "https://freesound.org/people/shelbyshark/sounds/501172/", license: "CC0-1.0", files: ["audio/car-sparks-loop.ogg"], changed: true },
  { id: "freesound-591079", section: "audio", title: "Car rolling on asphalt", author: "orlandorizo", url: "https://freesound.org/people/orlandorizo/sounds/591079/", license: "CC0-1.0", files: ["audio/car-roll-loop.ogg"], changed: true },
  { id: "freesound-411882", section: "audio", title: "Car Driving (Wind)", author: "Yin_Yang_Jake007", url: "https://freesound.org/people/Yin_Yang_Jake007/sounds/411882/", license: "CC0-1.0", files: ["audio/car-wind-loop.ogg"], changed: true },
  { id: "freesound-116598", section: "audio", title: "MrM_ElantraGearShfit", author: "mrmccormack", url: "https://freesound.org/people/mrmccormack/sounds/116598/", license: "CC0-1.0", files: [...ogg("car-shift", 0, 1, 2)], changed: true },
  { id: "freesound-629324", section: "audio", title: "gear select", author: "greatsoundstube", url: "https://freesound.org/people/greatsoundstube/sounds/629324/", license: "CC0-1.0", files: [...ogg("car-shift", 3)], changed: true },
  { id: "freesound-178422", section: "audio", title: "parking-sensors", author: "jeroenabel", url: "https://freesound.org/people/jeroenabel/sounds/178422/", license: "CC0-1.0", files: ["audio/car-sensor-beep.ogg"], changed: true },
  // CC0 (ADR-0092): detail layers of the city's surfaces, luminance only, four to a file (tools/textures).
  { id: "polyhaven-grey-plaster-02", section: "city", title: "Grey Plaster 02", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/grey_plaster_02", license: "CC0-1.0", files: ["textures/detail-walls.png"], changed: true },
  { id: "polyhaven-medieval-red-brick", section: "city", title: "Medieval Red Brick", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/medieval_red_brick", license: "CC0-1.0", files: ["textures/detail-walls.png"], changed: true },
  { id: "polyhaven-large-sandstone-blocks-01", section: "city", title: "Large Sandstone Blocks 01", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/large_sandstone_blocks_01", license: "CC0-1.0", files: ["textures/detail-walls.png"], changed: true },
  { id: "polyhaven-concrete-wall-006", section: "city", title: "Concrete Wall 006", author: "Dario Barresi, Charlotte Baglioni", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/concrete_wall_006", license: "CC0-1.0", files: ["textures/detail-walls.png"], changed: true },
  { id: "polyhaven-asphalt-02", section: "city", title: "Asphalt 02", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/asphalt_02", license: "CC0-1.0", files: ["textures/detail-ground.png"], changed: true },
  { id: "polyhaven-concrete-pavement", section: "city", title: "Concrete Pavement", author: "Charlotte Baglioni", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/concrete_pavement", license: "CC0-1.0", files: ["textures/detail-ground.png"], changed: true },
  { id: "polyhaven-grass-path-2", section: "city", title: "Grass Path 2", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/grass_path_2", license: "CC0-1.0", files: ["textures/detail-ground.png"], changed: true },
  { id: "polyhaven-forest-ground-04", section: "city", title: "Forest Ground 04", author: "Rob Tuytel, Rico Cilliers", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/forest_ground_04", license: "CC0-1.0", files: ["textures/detail-ground.png"], changed: true },
  { id: "polyhaven-clay-roof-tiles-02", section: "city", title: "Clay Roof Tiles 02", author: "Amal Kumar", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/clay_roof_tiles_02", license: "CC0-1.0", files: ["textures/detail-roofs.png"], changed: true },
  { id: "polyhaven-corrugated-iron-02", section: "city", title: "Corrugated Iron 02", author: "Jenelle van Heerden, Sergej Majboroda", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/corrugated_iron_02", license: "CC0-1.0", files: ["textures/detail-roofs.png"], changed: true },
  { id: "polyhaven-bitumen", section: "city", title: "Bitumen", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/bitumen", license: "CC0-1.0", files: ["textures/detail-roofs.png"], changed: true },
  { id: "polyhaven-granite-tile", section: "city", title: "Granite Tile", author: "Charlotte Baglioni", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/granite_tile", license: "CC0-1.0", files: ["textures/detail-roofs.png"], changed: true },
  { id: "polyhaven-weathered-planks", section: "city", title: "Weathered Planks", author: "Dario Barresi, Dimitrios Savva", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/weathered_planks", license: "CC0-1.0", files: ["textures/detail-extra.png"], changed: true },
  { id: "polyhaven-gray-rocks", section: "city", title: "Gray Rocks", author: "Dimitrios Savva", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/gray_rocks", license: "CC0-1.0", files: ["textures/detail-extra.png"], changed: true },
  { id: "polyhaven-cobblestone-floor-08", section: "city", title: "Cobblestone Floor 08", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/cobblestone_floor_08", license: "CC0-1.0", files: ["textures/detail-extra.png"], changed: true },
  { id: "polyhaven-red-brick-03", section: "city", title: "Red Brick 03", author: "Rob Tuytel", authorUrl: "https://polyhaven.com", url: "https://polyhaven.com/a/red_brick_03", license: "CC0-1.0", files: ["textures/detail-extra.png"], changed: true },
];
