import { type Equipment, type InventoryState, MOD_CATALOG, type ModSlot, WEAPON_CATALOG, findItem, freeCells, isModId, isPlaced, isWeaponId } from "@seki/core";
import { MOD_SLOT_LABEL, itemName } from "./item-text";

/**
 * Mods of one weapon (plan §7): its mod slots with what is mounted, and the matching mods
 * from the bag. A tap on a mod mounts it (a mod already in that slot goes back to the bag);
 * taking one off needs a free cell.
 */
export const ModOverlay = ({
  weaponUid,
  inventory,
  equipment,
  onInstall,
  onRemove,
  onClose,
}: {
  weaponUid: string;
  inventory: InventoryState;
  equipment: Equipment;
  onInstall: (modUid: string) => void;
  onRemove: (slot: ModSlot) => void;
  onClose: () => void;
}) => {
  const weapon = findItem(inventory, weaponUid);
  if (!weapon || !isWeaponId(weapon.def)) return null;
  const slots = WEAPON_CATALOG[weapon.def].modSlots as readonly ModSlot[];
  const loose = inventory.items.filter((i) => isModId(i.def) && !isPlaced(inventory, equipment, i.uid));
  const roomy = freeCells(inventory, equipment) > 0;
  return (
    <div className="inv__sheet inv__mods" role="dialog" aria-label={`Mody: ${itemName(weapon.def)}`} data-testid="mod-overlay">
      <header className="inv__mods-head">
        <h3 className="inv__detail-name">Mody · {itemName(weapon.def)}</h3>
        <button type="button" className="inv__action" onClick={onClose}>
          Gotowe
        </button>
      </header>
      <ul className="inv__mod-slots">
        {slots.map((slot) => {
          const mountedUid = weapon.mods?.[slot];
          const mounted = mountedUid ? findItem(inventory, mountedUid) : undefined;
          const fitting = loose.filter((m) => isModId(m.def) && MOD_CATALOG[m.def].slot === slot);
          return (
            <li key={slot} className="inv__mod-slot" data-testid={`mod-slot-${slot}`}>
              <div className="inv__mod-label">{MOD_SLOT_LABEL[slot]}</div>
              <div className="inv__mod-now">{mounted ? itemName(mounted.def) : "pusto"}</div>
              {mounted && (
                <button type="button" className="inv__action" disabled={!roomy} title={roomy ? undefined : "Brak miejsca w torbie"} onClick={() => onRemove(slot)}>
                  Zdejmij
                </button>
              )}
              {fitting.map((m) => (
                <button key={m.uid} type="button" className="inv__action inv__action--equip" onClick={() => onInstall(m.uid)}>
                  Zamontuj: {itemName(m.def)}
                </button>
              ))}
              {!mounted && fitting.length === 0 && <span className="inv__hint">Brak pasujących modów w torbie</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
