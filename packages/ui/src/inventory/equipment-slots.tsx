import { type EquipSlot, type Equipment, GARMENT_SLOTS, type InventoryState, RARITY, WEAPON_SLOTS, findItem } from "@seki/core";
import { SLOT_LABEL, itemName } from "./item-text";

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
  const slots = kind === "weapons" ? WEAPON_SLOTS : GARMENT_SLOTS;
  return (
    <div className={`inv__slots inv__slots--${kind}`} data-testid={`slots-${kind}`}>
      {slots.map((slot) => {
        const uid = equipment[slot];
        const item = uid === null ? undefined : findItem(inventory, uid);
        const active = kind === "weapons" && equipment.active === slot;
        const name = item ? itemName(item.def) : null;
        return (
          <button
            key={slot}
            type="button"
            className={`inv__slot${item ? "" : " inv__slot--empty"}${active ? " inv__slot--active" : ""}${item && uid === selectedUid ? " inv__slot--on" : ""}${
              item && item.rarity !== "common" ? ` rarity--${item.rarity}` : ""
            }`}
            data-testid={`slot-${slot}`}
            aria-label={`${SLOT_LABEL[slot]}: ${name ?? "pusto"}${item && item.rarity !== "common" ? `, ${RARITY[item.rarity].label}` : ""}`}
            disabled={!item}
            onClick={() => item && onSelect(item.uid)}
          >
            <span className="inv__slot-label">
              {KEY[slot] !== undefined && <span className="inv__slot-key">{KEY[slot]}</span>}
              {SLOT_LABEL[slot]}
            </span>
            <span className="inv__slot-name">{name ?? "pusto"}</span>
          </button>
        );
      })}
    </div>
  );
};
