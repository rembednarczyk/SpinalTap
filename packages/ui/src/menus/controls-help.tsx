const CONTROLS: [string, string][] = [
  ["WASD", "ruch"],
  ["Shift", "sprint"],
  ["Mysz", "rozglądanie"],
  ["LPM", "strzał"],
  ["E", "interakcja"],
  ["V", "FPP / TPP"],
  ["F5 / F9", "szybki zapis / odczyt"],
  ["Esc", "pauza"],
];

export const ControlsHelp = () => (
  <dl className="controls">
    {CONTROLS.map(([k, v]) => (
      <div key={k} className="controls__row">
        <dt>
          <kbd>{k}</kbd>
        </dt>
        <dd>{v}</dd>
      </div>
    ))}
  </dl>
);
