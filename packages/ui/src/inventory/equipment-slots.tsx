import { type EquipSlot, type Equipment, GARMENT_SLOTS, type InventoryState, WEAPON_SLOTS, findItem, itemIcon } from "@seki/core";
import { useT, useText } from "../i18n/use-t";
import { ItemIcon } from "../icons/item-icon";
import { itemName, rarityLabel, slotLabel } from "./item-text";

const KEY: Readonly<Partial<Record<EquipSlot, number>>> = { primary: 1, secondary: 2, melee: 3 };

/** Garment slots beside the preview, or the three weapon slots under it. A tap selects the piece. */
export const EquipmentSlots = ({
  kind,
  inventory,
  equipment,
  selectedUid,
  onSelect,
}: {
  kind: "garments" | "weapons";
  inventory: InventoryState;
  equipment: Equipment;
  selectedUid: string | null;
  onSelect: (uid: string) => void;
}) => {
  const t = useT();
  const tx = useText();
  const slots = kind === "weapons" ? WEAPON_SLOTS : GARMENT_SLOTS;
  return (
    <div className={`inv__slots inv__slots--${kind}`} data-testid={`slots-${kind}`}>
      {slots.map((slot) => {
        const uid = equipment[slot];
        const item = uid === null ? undefined : findItem(inventory, uid);
        const active = kind === "weapons" && equipment.active === slot;
        const name = item ? itemName(tx, item.def) : null;
        // Icons in the weapon slots only (ADR-0073 stage 1); the garment column keeps its names.
        const icon = item && kind === "weapons" ? itemIcon(item.def) : null;
        return (
          <button
            key={slot}
            type="button"
            className={`inv__slot${icon ? " inv__slot--icon" : ""}${item ? "" : " inv__slot--empty"}${active ? " inv__slot--active" : ""}${item && uid === selectedUid ? " inv__slot--on" : ""}${
              item && item.rarity !== "common" ? ` rarity--${item.rarity}` : ""
            }`}
            data-testid={`slot-${slot}`}
            aria-label={`${slotLabel(t, slot)}: ${name ?? t("inventory.empty")}${item && item.rarity !== "common" ? `, ${rarityLabel(t, item.rarity)}` : ""}`}
            disabled={!item}
            onClick={() => item && onSelect(item.uid)}
          >
            {icon && item && <ItemIcon icon={icon} rarity={item.rarity} className="inv__slot-icon" />}
            <span className="inv__slot-text">
              <span className="inv__slot-label">
                {KEY[slot] !== undefined && <span className="inv__slot-key">{KEY[slot]}</span>}
                {slotLabel(t, slot)}
              </span>
              <span className="inv__slot-name">{name ?? t("inventory.empty")}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
