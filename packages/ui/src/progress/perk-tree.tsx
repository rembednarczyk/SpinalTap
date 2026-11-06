import { ATTRIBUTE_IDS, type AttributeId, PERK_IDS, PERK_TIERS, type PerkId, missingTier, perkDef, perkRank, perkRequirement, perkUnlocked } from "@seki/core";
import { useT } from "../i18n/use-t";
import { useProgressionIntents, useUi } from "../use-ui";

/** The perks of one attribute's tree, tier by tier (the table's order). */
const treeOf = (tree: AttributeId): readonly PerkId[] => PERK_IDS.filter((id) => perkDef(id).tree === tree);

/**
 * The sheet's perk trees (ADR-0059, stages 3 and 3b): every perk with its rank and what it does,
 * what its tier needs while it is shut (the attribute, a perk on every tier below), and a button to
 * buy a rank while perk points are left. The bare minimum to spend a point; the Progress tab with
 * the trees comes in stage 7.
 */
export const PerksSection = () => {
  const t = useT();
  const { spendPerkPoint } = useProgressionIntents();
  const attributes = useUi((s) => s.attributes);
  const perks = useUi((s) => s.perks);
  const points = useUi((s) => s.perkPoints);
  return (
    <section data-testid="perks">
      <h3 className="sheet__h">{t("perk.section")}</h3>
      {points > 0 && (
        <div className="sheet__sub" data-testid="perk-points">
          {t("perk.points", { count: points })}
        </div>
      )}
      {ATTRIBUTE_IDS.map((tree) => (
        <dl key={tree} className="sheet__list" aria-label={t(`attribute.${tree}.name`)}>
          {treeOf(tree).map((id) => {
            const def = perkDef(id);
            const name = t(`perk.${id}.name`);
            const rank = perkRank(perks, id);
            const attributeOk = perkUnlocked(attributes, id);
            // The lowest empty tier below; a stage 3 save's perk over empty tiers shows it for its next rank too (stage 3c).
            const missing = missingTier(perks, id);
            const open = attributeOk && missing === null;
            return (
              <div key={id} className="sheet__row" data-testid={`perk-${id}`}>
                <dt>
                  {name}
                  {def.key && <span className="sheet__effect"> · {t("perk.key")}</span>}
                  <div className="sheet__effect">{t(`perk.${id}.desc`)}</div>
                  {!attributeOk && <div className="sheet__effect">{t("perk.requires", { attribute: t(`attribute.${tree}.name`), value: perkRequirement(id) })}</div>}
                  {missing !== null && <div className="sheet__effect">{t("perk.requiresPath", { value: PERK_TIERS[missing] })}</div>}
                </dt>
                <dd>
                  {t("perk.rank", { rank, ranks: def.ranks })}
                  {points > 0 && open && rank < def.ranks && (
                    <button type="button" className="sheet__raise" aria-label={t("perk.buy", { name })} onClick={() => spendPerkPoint(id)}>
                      +
                    </button>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ))}
    </section>
  );
};
