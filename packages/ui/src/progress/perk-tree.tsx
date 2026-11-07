import { type AttributeId, PERK_TIERS, type PerkId, perkDef } from "@seki/core";
import { useT } from "../i18n/use-t";
import { useProgressionIntents, useUi } from "../use-ui";
import { perkView, tiersOf } from "./perk-view";

/** One perk: name, key mark, what it does, its rank as pips, what still shuts it and the buy button. */
const PerkCard = ({ id }: { readonly id: PerkId }) => {
  const t = useT();
  const { spendPerkPoint } = useProgressionIntents();
  const attributes = useUi((s) => s.attributes);
  const perks = useUi((s) => s.perks);
  const points = useUi((s) => s.perkPoints);
  const def = perkDef(id);
  const v = perkView(attributes, perks, points, id);
  const name = t(`perk.${id}.name`);
  const state = v.rank > 0 ? "owned" : v.attributeOk && v.missing === null ? "open" : "shut";
  return (
    <li className={`perk perk--${state}${def.key ? " perk--key" : ""}`} data-testid={`perk-${id}`}>
      <div className="perk__text">
        <div className="perk__name">
          {name}
          {def.key && <span className="perk__key"> · {t("perk.key")}</span>}
        </div>
        <div className="perk__desc">{t(`perk.${id}.desc`)}</div>
        {!v.attributeOk && <div className="perk__need">{t("perk.requires", { attribute: t(`attribute.${def.tree}.name`), value: PERK_TIERS[def.tier] })}</div>}
        {/* The lowest empty tier below; a stage 3 save's perk over empty tiers shows it for its next rank too (stage 3c). */}
        {v.missing !== null && <div className="perk__need">{t("perk.requiresPath", { value: PERK_TIERS[v.missing] })}</div>}
      </div>
      <div className="perk__side">
        <span className="perk__rank">
          {Array.from({ length: v.ranks }, (_, i) => (
            <span key={i} className={`perk__pip${i < v.rank ? " perk__pip--on" : ""}`} aria-hidden="true" />
          ))}
          <span className="perk__rank-text">{t("perk.rank", { rank: v.rank, ranks: v.ranks })}</span>
        </span>
        {v.canBuy && (
          <button type="button" className="progress__raise" aria-label={t("perk.buy", { name })} onClick={() => spendPerkPoint(id)}>
            +
          </button>
        )}
      </div>
    </li>
  );
};

/**
 * One attribute's perk tree on the Progress tab (ADR-0059, stages 3, 3b and 7): its four tiers,
 * each with the value of the attribute that opens it, and every perk with its rank and the
 * button to buy one while perk points are left.
 */
export const PerkTree = ({ tree }: { readonly tree: AttributeId }) => {
  const t = useT();
  const attributes = useUi((s) => s.attributes);
  const points = useUi((s) => s.perkPoints);
  const attribute = t(`attribute.${tree}.name`);
  return (
    <section className="progress__tree" data-testid="perks" aria-label={t("progress.tree", { attribute })}>
      <h3 className="sheet__h">
        {t("perk.section")} · {attribute}
      </h3>
      {points > 0 && (
        <div className="progress__points" data-testid="perk-points">
          {t("perk.points", { count: points })}
        </div>
      )}
      {tiersOf(tree).map((ids, tier) => {
        const value = PERK_TIERS[tier] ?? 0;
        const open = attributes[tree] >= value;
        return (
          <div key={value} className={`progress__tier${open ? "" : " progress__tier--shut"}`} data-testid={`tier-${tree}-${value}`}>
            <h4 className="progress__tier-h">
              {t("progress.tier", { value })}
              {!open && <span className="progress__tier-need"> · {t("progress.tierShut", { attribute, value })}</span>}
            </h4>
            <ul className="progress__perks">
              {ids.map((id) => (
                <PerkCard key={id} id={id} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
};
