import { useEffect } from "react";
import { RADIO_STATIONS } from "../store/ui-store";
import { useRadioIntents, useUi } from "../use-ui";
import { useT } from "../i18n/use-t";

/** The radio key (ADR-0035): next station, then off; kept out of the key bindings (menus.RESERVED_KEYS). */
export const RADIO_KEY = "KeyB";

/** B switches to the next station while playing with no panel on screen. */
export const RadioKey = () => {
  const intents = useRadioIntents();
  const free = useUi((s) => s.screen === "playing" && s.dialogue === null && !s.shopOpen && s.loot === null && s.characterTab === null && s.breach === null && s.metroMap === null);
  useEffect(() => {
    if (!free) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === RADIO_KEY && !e.repeat) intents.nextRadioStation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [free, intents]);
  return null;
};

/** The radio in the phone: three stations and off, the one playing marked. */
export const RadioTuner = () => {
  const station = useUi((s) => s.settings.radioStation);
  const intents = useRadioIntents();
  const t = useT();
  // Station names stay as they are in every language (ADR-0056); the genres are translated.
  const options = [...RADIO_STATIONS.map((s) => ({ id: s.id, name: s.name, genre: t(`radio.genre.${s.id}`) })), { id: null, name: t("radio.off"), genre: t("radio.silence") }];
  return (
    <section className="radio" aria-label={t("radio.title")} data-testid="radio-tuner">
      <h3 className="radio__title">
        {t("radio.title")} <kbd>B</kbd>
      </h3>
      <div className="radio__stations" role="radiogroup" aria-label={t("radio.station")}>
        {options.map((o) => (
          <button
            key={o.id ?? "off"}
            type="button"
            role="radio"
            aria-checked={station === o.id}
            className={`radio__station${station === o.id ? " radio__station--on" : ""}`}
            data-testid={`radio-${o.id ?? "off"}`}
            onClick={() => intents.setRadioStation(o.id)}
          >
            <span className="radio__name">{o.name}</span>
            <span className="radio__genre">{o.genre}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
