import { type AmmoId, type ItemDefId, type ItemIconKey, type Rarity, ammoIcon, itemIcon } from "@seki/core";
import { ICON_PATHS, ICON_VIEWBOX } from "./icon-paths";
import { RARITY_INK } from "./rarity-ink";
import "./item-icon.css";

/**
 * An item's icon (ADR-0073), drawn in the colour of its rarity. `framed` adds a frame in the
 * same colour (counter cards, slots); a bag cell has its own frame. Hidden from screen readers:
 * the button or card around it says the name and the rarity.
 */
export const ItemIcon = ({ icon, rarity = "common", framed = false, className }: { icon: ItemIconKey; rarity?: Rarity; framed?: boolean; className?: string }) => {
  const drawing = ICON_PATHS[icon];
  return (
    <span
      className={`item-icon${framed ? " item-icon--framed" : ""}${className ? ` ${className}` : ""}`}
      data-testid="item-icon"
      data-icon={icon}
      data-rarity={rarity}
      style={{ color: RARITY_INK[rarity] }}
      aria-hidden="true"
    >
      <svg viewBox={ICON_VIEWBOX} focusable="false">
        {drawing.body.map((d) => (
          <path key={d} className="item-icon__body" d={d} />
        ))}
        {drawing.line?.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
};

/** The icon of an item from the catalogs (every kind has one since stage 2). */
export const ItemDefIcon = ({ def, rarity, framed, className }: { def: ItemDefId; rarity?: Rarity; framed?: boolean; className?: string }) => (
  <ItemIcon icon={itemIcon(def)} {...(rarity ? { rarity } : {})} {...(framed ? { framed } : {})} {...(className ? { className } : {})} />
);

export const AmmoIcon = ({ ammo, framed, className }: { ammo: AmmoId; framed?: boolean; className?: string }) => (
  <ItemIcon icon={ammoIcon(ammo)} {...(framed ? { framed } : {})} {...(className ? { className } : {})} />
);
