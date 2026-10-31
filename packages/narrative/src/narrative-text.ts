/**
 * Text the narrative writes itself (ADR-0056): it holds catalog keys, never sentences, and the
 * app hands it a function that writes a key in the player's language. Without one a key stays
 * a key, which is what the narrative's own tests read.
 */
export type NarrativeText = (key: string, params?: Readonly<Record<string, string | number>>) => string;

export const keyText: NarrativeText = (key) => key;

/** A speaker of the ink by name: shown as it is in every language (ADR-0056: names stay). */
type Named = { readonly name: string };
/** A speaker who is a role or a thing: the catalog key of what they are called. */
type Keyed = { readonly key: string };

/** Speaker codes of the ink lines (`KAITO: …`); `SEKI` is the player and comes from the alias. */
export const SPEAKERS: Readonly<Record<string, Named | Keyed>> = {
  KAITO: { name: "Kaito" },
  UME: { key: "speaker.ume" },
  MORI: { key: "speaker.mori" },
  REN: { name: "Ren" },
  TECH: { key: "speaker.tech" },
  KUROSAWA: { name: "Kurosawa" },
  HANA: { name: "Hana" },
  OYAJI: { name: "Oyaji" },
  GENZO: { name: "Genzō" },
  // Stare Miasto (ex Ulica Kanałowa) and the market stalls on Podzamcze (ADR-0026, ADR-0042).
  HIDEO: { name: "Hideo" },
  TETSU: { name: "Tetsu" },
  MEI: { name: "Mei" },
  SACHIKO: { name: "Sachiko" },
  GORO: { name: "Goro" },
  KENTA: { name: "Kenta" },
  FUMIKO: { name: "Fumiko" },
  // Neon Koi (ADR-0038).
  BARMAN: { key: "speaker.barman" },
  BYWALEC: { key: "speaker.bywalec" },
  // Street encounters (ADR-0032).
  NOBU: { name: "Nobu" },
  SARARIMAN: { key: "speaker.sarariman" },
  HINA: { name: "Hina" },
  SHIRO: { name: "Shiro" },
  TAKUMI: { name: "Takumi" },
  SABU: { key: "speaker.sabu" },
  AUTOMAT: { key: "speaker.automat" },
  KOJI: { name: "Koji" },
  KIKU: { key: "speaker.kiku" },
  DAIGO: { name: "Daigo" },
  POBORCA: { key: "speaker.poborca" },
  AKANE: { name: "Akane" },
  RIKO: { name: "Riko" },
  TOMO: { name: "Tomo" },
  STRAZNIK: { key: "speaker.straznik" },
  GLOS: { key: "speaker.glos" },
  // Observation hooks, the metro car and the radio (ADR-0032).
  HEBI: { name: "Hebi" },
  GLOSNIK: { key: "speaker.glosnik" },
  PASAZER: { key: "speaker.pasazer" },
  PASAZERKA: { key: "speaker.pasazerka" },
  DZIECKO: { key: "speaker.dziecko" },
  REKLAMA: { key: "speaker.reklama" },
  KASS: { name: "DJ Kass" },
  YUKI: { key: "speaker.yuki" },
  LEKTORKA: { name: "Tessen Info" },
};

/** The player's line when no alias is set yet. */
export const YOU = "speaker.you";

/** What a speaker code is called; an unknown code shows as it is. */
export const speakerName = (code: string, text: NarrativeText): string => {
  const s = SPEAKERS[code];
  if (!s) return code;
  return "name" in s ? s.name : text(s.key);
};
