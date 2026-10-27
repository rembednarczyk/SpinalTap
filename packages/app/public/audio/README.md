# Nagrania audio (CC0)

Pliki ładuje `SynthAudio` leniwie po pierwszym geście (`unlock()`); mapowanie cue → pliki jest w `packages/app/src/audio-manifest.ts`. Brak pliku albo błąd dekodowania (np. Vorbis w starym Safari) cicho wraca do syntezy. `?audio=off` wyłącza nagrania. Muzyka pozostaje proceduralna.

Wszystkie pliki są na licencji **CC0 1.0** (domena publiczna, https://creativecommons.org/publicdomain/zero/1.0/): bez obowiązku atrybucji, użycie komercyjne dozwolone. Autorów i tak wymieniamy.

Format: OGG Vorbis, 44,1 kHz. Pliki Kenney i deszcz są skopiowane bez zmian (już małe; pętla deszczu zostaje bezszwowa). Strzały i `cyber-overdrive.ogg` są przycięte i zgrane do mono (`ffmpeg`, Vorbis q3): pojedynczy strzał od początku transjentu, 1,1-1,4 s z wyciszeniem ogona, -5 dB.

## Źródła

| Paczka | Autor | Licencja | Link | Pobranie |
|---|---|---|---|---|
| Impact Sounds 1.0 | Kenney (www.kenney.nl) | CC0 (License.txt w paczce) | https://kenney.nl/assets/impact-sounds | `kenney_impact-sounds.zip` |
| Interface Sounds | Kenney | CC0 (License.txt w paczce) | https://kenney.nl/assets/interface-sounds | `kenney_interface-sounds.zip` |
| Sci-fi Sounds | Kenney | CC0 (License.txt w paczce) | https://kenney.nl/assets/sci-fi-sounds | `kenney_sci-fi-sounds.zip` |
| The Free Firearm Sound Library (Prepared SFX Library) | Ben Jaszczak i in. (freefirearmsfx.com), mirror OGA: bart | CC0 (strona OGA: "CC0 NO RIGHTS RESERVED") | https://opengameart.org/content/the-free-firearm-sound-library | `Prepared SFX Library.7z` (194 MB, z niego 5 plików) |
| Rain (loopable) | Ylmir | CC0 (strona OGA) | https://opengameart.org/content/rain-loopable | `Rain OGG.zip` |

## Pliki

| Plik | Źródło (plik oryginalny) | Użycie (cue) |
|---|---|---|
| `gun-pistol-ppq-near.ogg` | Firearm Library, Walther PPQ 9 mm, `X_39P.wav` (near) | `shot` |
| `gun-pistol-1911-near.ogg` | Firearm Library, 1911 .45, `A_42P.wav` (near) | `shot` |
| `gun-smg-m45-near.ogg` | Firearm Library, Carl Gustav M45 SMG 9 mm, `G_31P.wav` (near, pojedynczy) | `shot` |
| `gun-pistol-ppq-mid.ogg` | Firearm Library, Walther PPQ, `X_31P.wav` (mid distance) | `enemy-shot` |
| `gun-smg-m45-mid.ogg` | Firearm Library, Carl Gustav M45, `G_20P.wav` (mid distance) | `enemy-shot` |
| `hit-punch-000.ogg`, `hit-punch-001.ogg`, `hit-punch-002.ogg` | Impact Sounds, `impactPunch_medium_000-002.ogg` | `hit` |
| `crit-punch-000.ogg`, `crit-punch-001.ogg`, `crit-punch-002.ogg` | Impact Sounds, `impactPunch_heavy_000-002.ogg` | `critical` (pod syntezą) |
| `hurt-soft-000.ogg`, `hurt-soft-001.ogg`, `hurt-soft-002.ogg` | Impact Sounds, `impactSoft_heavy_000-002.ogg` | `hurt` |
| `kill-plate-000.ogg` | Impact Sounds, `impactPlate_heavy_000.ogg` | `kill` (z syntezą) |
| `kill-metal-000.ogg` | Impact Sounds, `impactMetal_heavy_000.ogg` | `kill` (z syntezą) |
| `step-concrete-000.ogg`, `step-concrete-001.ogg`, `step-concrete-002.ogg`, `step-concrete-003.ogg`, `step-concrete-004.ogg` | Impact Sounds, `footstep_concrete_000-004.ogg` | kroki (zależne od prędkości) |
| `ui-select-001.ogg`, `ui-select-002.ogg` | Interface Sounds, `select_001.ogg`, `select_002.ogg` | `ui-select` |
| `ui-confirm-001.ogg` | Interface Sounds, `confirmation_001.ogg` | `quest-update` |
| `ui-purchase-002.ogg` | Interface Sounds, `confirmation_002.ogg` | `purchase` |
| `ui-save-click-001.ogg` | Interface Sounds, `click_001.ogg` | `save` |
| `ui-error-004.ogg`, `ui-error-005.ogg` | Interface Sounds, `error_004.ogg`, `error_005.ogg` | `denied` |
| `glitch-001.ogg`, `glitch-002.ogg`, `glitch-003.ogg`, `glitch-004.ogg` | Interface Sounds, `glitch_001-004.ogg` | `memory` (z syntezą, przez bitcrusher) |
| `clinic-heal-000.ogg`, `clinic-heal-001.ogg` | Sci-fi Sounds, `forceField_000.ogg`, `forceField_001.ogg` | `heal` (klinika) |
| `cyber-overdrive.ogg` | Sci-fi Sounds, `computerNoise_000.ogg` (pierwsze 1,2 s, mono) | `overdrive` (z syntezą) |
| `rain-loop.ogg` | Rain (loopable), `1.ogg` (27 s, stereo) | pętla deszczu na szynie `ambience` (synteza pod spodem na 30%) |

Łącznie ok. 0,95 MB. Nowy plik: dopisz go tutaj i w manifeście (test `packages/app/test/audio-manifest.test.ts` pilnuje obu i budżetu 4 MB).
