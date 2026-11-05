import { ATTRIBUTE_IDS, ATTRIBUTE_MAX } from "@seki/core";
import { useT } from "../i18n/use-t";
import { useProgressionIntents, useUi } from "../use-ui";

/**
 * The sheet's attributes (ADR-0059, stage 2): the level, each attribute with its value and what a
 * point does, and a button to raise it while points are left. The bare minimum to spend a point;
 * the Progress tab with the trees comes in stage 7.
 */
export const AttributesSection = () => {
  const t = useT();
  const { spendAttributePoint } = useProgressionIntents();
  const level = useUi((s) => s.level);
  const attributes = useUi((s) => s.attributes);
  const points = useUi((s) => s.attributePoints);
  return (
    <section data-testid="attributes">
      <h3 className="sheet__h">{t("attribute.section")}</h3>
      <div className="sheet__sub">
        {t("attribute.level", { level })}
        {points > 0 && <span data-testid="attribute-points"> · {t("attribute.points", { count: points })}</span>}
      </div>
      <dl className="sheet__list">
        {ATTRIBUTE_IDS.map((id) => {
          const name = t(`attribute.${id}.name`);
          return (
            <div key={id} className="sheet__row" data-testid={`attribute-${id}`}>
              <dt>
                {name}
                <div className="sheet__effect">{t(`attribute.${id}.effect`)}</div>
              </dt>
              <dd>
                {attributes[id]}
                {points > 0 && attributes[id] < ATTRIBUTE_MAX && (
                  <button type="button" className="sheet__raise" aria-label={t("attribute.raise", { name })} onClick={() => spendAttributePoint(id)}>
                    +
                  </button>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};
