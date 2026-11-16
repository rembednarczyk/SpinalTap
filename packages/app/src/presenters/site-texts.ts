import { LUBLIN_CONSTRUCTION_SITES, type LublinConstructionSiteData } from "@seki/sim/lublin";
import { type SettingsVm, isMessageKey, translate } from "@seki/ui";

/**
 * The building sites' board texts as the renderer draws them (ADR-0087 stage 2): every key the
 * sites' table holds (the name, the developer and the term of each board) in the player's
 * language (ADR-0056). The engine knows no catalogs; a key the catalogs lack is left out.
 */
export const siteBoardTexts = (locale: SettingsVm["locale"], sites: readonly LublinConstructionSiteData[] = LUBLIN_CONSTRUCTION_SITES): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const s of sites) {
    if (!s.board) continue;
    for (const key of [s.board.name, s.board.developer, s.board.term]) if (isMessageKey(key)) out[key] = translate(locale, key);
  }
  return out;
};
