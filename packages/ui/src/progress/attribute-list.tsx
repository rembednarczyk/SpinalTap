import { ATTRIBUTE_IDS, ATTRIBUTE_MAX, type AttributeId } from "@seki/core";
import { useT } from "../i18n/use-t";
import { useProgressionIntents, useUi } from "../use-ui";
import { ranksIn } from "./perk-view";

/**
 * The Progress tab's attributes (ADR-0059, stages 2 and 7): each with its value and what a point
 * does, a button to raise it while points are left, and the attribute itself picks its perk tree.
 */
export const AttributeList = ({ tree, onTree }: { readonly tree: AttributeId; readonly onTree: (tree: AttributeId) => void }) => {
  const t = useT();
  const { spendAttributePoint } = useProgressionIntents();
  const attributes = useUi((s) => s.attributes);
  const perks = useUi((s) => s.perks);
  const points = useUi((s) => s.attributePoints);
  return (
    <section className="progress__attrs" data-testid="attributes" aria-label={t("attribute.section")}>
      <h3 className="sheet__h">{t("attribute.section")}</h3>
      {points > 0 && (
        <div className="progress__points" data-testid="attribute-points">
          {t("attribute.points", { count: points })}
        </div>
      )}
      <ul className="progress__attr-list">
        {ATTRIBUTE_IDS.map((id) => {
          const name = t(`attribute.${id}.name`);
          const ranks = ranksIn(perks, id);
          return (
            <li key={id} className={`progress__attr${tree === id ? " progress__attr--on" : ""}`} data-testid={`attribute-${id}`}>
              <button
                type="button"
                className="progress__attr-pick"
                aria-pressed={tree === id}
                aria-label={t("progress.showTree", { attribute: name })}
                data-testid={`attribute-tree-${id}`}
                onClick={() => onTree(id)}
              >
                <span className="progress__attr-name">{name}</span>
                <span className="progress__attr-effect">{t(`attribute.${id}.effect`)}</span>
                {ranks > 0 && <span className="progress__attr-ranks">{t("perk.rankCount", { count: ranks })}</span>}
              </button>
              <span className="progress__attr-value">{attributes[id]}</span>
              {points > 0 && attributes[id] < ATTRIBUTE_MAX ? (
                <button type="button" className="progress__raise" aria-label={t("attribute.raise", { name })} onClick={() => spendAttributePoint(id)}>
                  +
                </button>
              ) : (
                <span className="progress__raise-gap" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
