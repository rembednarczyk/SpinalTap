# Nagrania audio (CC0)

Pliki ładuje `SynthAudio` leniwie po pierwszym geście (`unlock()`); mapowanie cue → pliki jest w `packages/app/src/audio-manifest.ts`. Brak pliku albo błąd dekodowania (np. Vorbis w starym Safari) cicho wraca do syntezy. `?audio=off` wyłącza nagrania. Proceduralne zostają (stan 18.11, klakson nagrany od 21.11): muzyka, koniec wgrywania wirusa (`upload-done`), szum miasta, para i deszcz pod nagraniem (`ambience.ts`), warstwy hali W-3 (`w3-scape.ts`), radio (muzyka i lektor z formantów, ADR-0036).

Wszystkie pliki są na licencji **CC0 1.0** (domena publiczna, https://creativecommons.org/publicdomain/zero/1.0/): bez obowiązku atrybucji, użycie komercyjne dozwolone. Autorów i tak wymieniamy.

Format: OGG Vorbis, 44,1 kHz. Dźwięki auta (21.11) są zgrane do mono, Vorbis q4, bez przycinania (gaszenie silnika ucięte na 1,82 s, przed ciszą); pętla silnika bez zmian poza kodekiem. Dźwięki dobycia broni i chowania (21.11) są przycięte do jednego ruchu (0,28-0,45 s, krócej niż dobycie w grze), zgrane do mono, z wyciszeniem ostatnich 0,05 s i normalizacją do -18 LUFS (rewolwer bez normalizacji, -6 dB), Vorbis q4. Pliki z 18.11 (paczka RPG, alarm, syrena) są przycięte z ciszy na początku, zgrane do mono, z wyciszeniem ogona i szczytem −3 dB (alarm i syrena −4 dB), Vorbis q3. Pliki Kenney i deszcz są skopiowane bez zmian (już małe; pętla deszczu zostaje bezszwowa). Strzały i `cyber-overdrive.ogg` są przycięte i zgrane do mono (`ffmpeg`, Vorbis q3): pojedynczy strzał od początku transjentu, 1,1-1,4 s z wyciszeniem ogona, -5 dB (strzelby i karabiny 1,4 s, wyciszenie ostatnich 0,4 s).

## Źródła

| Paczka | Autor | Licencja | Link | Pobranie |
|---|---|---|---|---|
| Impact Sounds 1.0 | Kenney (www.kenney.nl) | CC0 (License.txt w paczce) | https://kenney.nl/assets/impact-sounds | `kenney_impact-sounds.zip` |
| Interface Sounds | Kenney | CC0 (License.txt w paczce) | https://kenney.nl/assets/interface-sounds | `kenney_interface-sounds.zip` |
| Sci-fi Sounds | Kenney | CC0 (License.txt w paczce) | https://kenney.nl/assets/sci-fi-sounds | `kenney_sci-fi-sounds.zip` |
| The Free Firearm Sound Library (Prepared SFX Library) | Ben Jaszczak i in. (freefirearmsfx.com), mirror OGA: bart | CC0 (strona OGA: "CC0 NO RIGHTS RESERVED") | https://opengameart.org/content/the-free-firearm-sound-library | `Prepared SFX Library.7z` (194 MB, z niego 14 plików) |
| Handgun Reload Sound Effect | zer0_sol | CC0 (strona OGA) | https://opengameart.org/content/handgun-reload-sound-effect | `reload.wav` |
| Gun Reload Sounds | SpringySpringo | CC0 (strona OGA) | https://opengameart.org/content/gun-reload-sounds | `gunreload1.wav`, `assaultriflereload1_0.wav`, `shotguncock_0.wav` (pobrane 21.11) |
| Gun Reload lock or Click Sound | pauliuw | CC0 (strona OGA) | https://opengameart.org/content/gun-reload-lock-or-click-sound | `gun_reload_lock_or_click_sound.mp3` (pobrane 21.11) |
| Weapons and Apparel SFX Library | Vehicle (Jan Schupke) | CC0 (readme.txt w paczce) | https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library | `weapons-apparel.zip` (pobrane 21.11) |
| Shotgun Reload Sound Effects | zer0_sol | CC0 (strona OGA: „Feel free to use these sounds without attribution”) | https://opengameart.org/content/shotgun-reload-sound-effects | `shotgunsounds.zip` (pobrane 21.11) |
| Car Sound Effects Pack (Low Quality) | GGBotNet | CC0 (strona OGA) | https://opengameart.org/content/car-sound-effects-pack-low-quality | `car_sound_effects_pack.zip` (pobrane 21.11, nagrania telefonem, 64 kb/s) |
| racing car engine sound loops | domasx2 (z nagrania public domain z pdsounds.org) | CC0 (strona OGA) | https://opengameart.org/content/racing-car-engine-sound-loops | `loop_0.wav` (pobrane 21.11) |
| Rain (loopable) | Ylmir | CC0 (strona OGA) | https://opengameart.org/content/rain-loopable | `Rain OGG.zip` |
| RPG Sound Pack (50 RPG sound effects) | Kenney | CC0 (license.txt w paczce) | https://opengameart.org/content/50-rpg-sound-effects | `RPGsounds_Kenney.zip` (pobrane 18.11) |
| Alarm | ezduzziteh | CC0 (strona OGA) | https://opengameart.org/content/alarm-1 | `alarm_2.ogg` (pobrane 18.11) |
| Sirens and Alarm Noise | aquinn | CC0 (strona OGA) | https://opengameart.org/content/sirens-and-alarm-noise | `siren.mp3` (pobrane 18.11) |

## Pliki

| Plik | Źródło (plik oryginalny) | Użycie (cue) |
|---|---|---|
| `gun-pistol-ppq-near.ogg` | Firearm Library, Walther PPQ 9 mm, `X_39P.wav` (near) | `shot` |
| `gun-pistol-1911-near.ogg` | Firearm Library, 1911 .45, `A_42P.wav` (near) | `shot` |
| `gun-smg-m45-near.ogg` | Firearm Library, Carl Gustav M45 SMG 9 mm, `G_31P.wav` (near, pojedynczy) | `shot-smg` |
| `gun-revolver-642-near.ogg` | Firearm Library, Smith & Wesson 642 .38 Special, `V_27P.wav` (near) | `shot-revolver` |
| `gun-smg-ppsh-near.ogg` | Firearm Library, PPSh 7,62x25, `P_30P.wav` (near, pojedynczy) | `shot-smg` |
| `gun-shotgun-nova-near.ogg` | Firearm Library, Benelli Nova 12 ga, `O_21P.wav` (near) | `shot-shotgun` |
| `gun-shotgun-model12-near.ogg` | Firearm Library, Winchester Model 12 12 ga, `K_22P.wav` (near) | `shot-shotgun` |
| `gun-rifle-ar15-near.ogg` | Firearm Library, AR-15 5,56, `D_32P.wav` (near) | `shot-rifle` |
| `gun-rifle-ak47-near.ogg` | Firearm Library, AK-47 7,62x39, `C_28P.wav` (near, pojedynczy) | `shot-rifle` |
| `gun-shotgun-nova-mid.ogg` | Firearm Library, Benelli Nova, `O_17P.wav` (mid distance) | `enemy-shot-shotgun` |
| `gun-rifle-ar15-mid.ogg` | Firearm Library, AR-15, `D_24P.wav` (mid distance) | `enemy-shot-rifle` |
| `gun-rifle-sks-mid.ogg` | Firearm Library, Norinco SKS 7,62x39, `U_19P.wav` (mid distance) | `enemy-shot-rifle` |
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
| `reload-handgun-000.ogg` | Handgun Reload Sound Effect, `reload.wav` (od 0,09 s do 1,47 s, mono, -4 dB, wyciszenie ostatnich 0,12 s): wypięcie magazynka, nowy magazynek, zamek | `reload` (przeładowanie magazynka gracza) |
| `reload-shell-000.ogg`, `reload-shell-001.ogg`, `reload-shell-002.ogg`, `reload-shell-003.ogg` | Shotgun Reload Sound Effects, `4 Shell Reload.mp3`, cztery naboje (od 0,05 s, 1,13 s, 2,19 s i 3,25 s po 0,53 s, mono, normalizacja do -18 LUFS, wyciszenie ostatnich 0,06 s): palce na mosiądzu i trzask podajnika | `reload-round` (nabój do strzelby, po jednym) |
| `weapon-switch-000.ogg`, `weapon-switch-001.ogg` | Impact Sounds, `impactPlate_light_000-001.ogg` | `weapon-switch` (zmiana slotu broni) |
| `loot-pickup-000.ogg`, `loot-pickup-001.ogg` | Impact Sounds, `impactSoft_medium_000-001.ogg` | `loot-pickup` (podniesienie łupu z torby) |
| `sell-tin-000.ogg`, `sell-tin-001.ogg` | Impact Sounds, `impactTin_medium_000-001.ogg` | `sell` (sprzedaż, z syntezą monet) |
| `repair-hammer-000.ogg`, `repair-hammer-001.ogg` | Impact Sounds, `impactMining_000-001.ogg` | `repair` (naprawa odzieży u Oyajiego) |
| `blast-crunch-003.ogg`, `blast-crunch-004.ogg` | Sci-fi Sounds, `explosionCrunch_003.ogg`, `explosionCrunch_004.ogg` (bez zmian; paczka pobrana 17.11 z mirroru OGA https://opengameart.org/content/sci-fi-sounds, `sci-fi_sounds.zip`, License.txt: CC0) | `explosion` (wybuch ładunków W-3, z syntezą niskiego huku) |
| `shotgun-rack-000.ogg` | Shotgun Reload Sound Effects, `Rack.mp3` (od 0,60 s do 1,06 s, mono, normalizacja do -14 LUFS, wyciszenie ostatnich 0,06 s): czółenko w tył i w przód | `shotgun-pump` (przeładowanie po ostatnim naboju) |
| `impact-melee-000.ogg` | RPG Sound Pack, `chop.ogg` | `impact-melee` (uderzenie broni białej) |
| `swing-000.ogg`, `swing-001.ogg` | RPG Sound Pack, `knifeSlice.ogg`, `knifeSlice2.ogg` | `swing` (zamach) |
| `block-000.ogg` | RPG Sound Pack, `metalPot3.ogg` (pierwsze 0,3 s) | `block` (cios na gardzie) |
| `parry-000.ogg` | RPG Sound Pack, `metalPot3.ogg` (pierwsze 0,6 s) | `parry` (z syntezą dźwięczenia) |
| `jump-cloth-000.ogg`, `jump-cloth-001.ogg` | RPG Sound Pack, `cloth1.ogg`, `cloth3.ogg` | `jump` (wybicie) |
| `land-step-000.ogg`, `land-step-001.ogg` | RPG Sound Pack, `footstep05.ogg`, `footstep06.ogg` | `land` (z syntezą niskiego tąpnięcia) |
| `land-hard-000.ogg` | RPG Sound Pack, `dropLeather.ogg` | `land-hard` (z syntezą) |
| `charge-clamp-000.ogg` | RPG Sound Pack, `metalLatch.ogg` (pierwsze 0,22 s) | `charge-plant` (z syntezą piknięć uzbrojenia) |
| `draw-pistol-000.ogg` | Handgun Reload Sound Effect, `reload.wav` (od 1,00 s do 1,40 s: zamek puszczony do przodu) | `draw-pistol` (pistolet dobyty albo wybrany) |
| `draw-revolver-000.ogg` | Gun Reload lock or Click Sound, `gun_reload_lock_or_click_sound.mp3` (0-0,34 s, -6 dB) | `draw-revolver` |
| `draw-smg-000.ogg` | Gun Reload Sounds, `gunreload1.wav` (od 1,22 s do 1,54 s: zamek) | `draw-smg` |
| `draw-shotgun-000.ogg` | Gun Reload Sounds, `shotguncock_0.wav` (od 0,02 s do 0,45 s: czółenko) | `draw-shotgun` |
| `draw-rifle-000.ogg` | Gun Reload Sounds, `assaultriflereload1_0.wav` (od 1,00 s do 1,45 s: rączka zamka) | `draw-rifle` |
| `draw-baton-000.ogg` | Weapons and Apparel SFX Library, `knife-unsheathe-04.wav` (od 0,02 s do 0,36 s) | `draw-baton` (pałka) |
| `draw-blade-000.ogg`, `draw-blade-001.ogg` | Weapons and Apparel SFX Library, `seax-unsheathe-01.wav` (0-0,30 s), `seax-unsheathe-03.wav` (od 0,05 s do 0,33 s) | `draw-blade` (miecz z pochwy) |
| `holster-000.ogg`, `holster-001.ogg` | Weapons and Apparel SFX Library, `knife-sheathe-02.wav` (od 0,10 s do 0,42 s), `knife-sheathe-05.wav` (od 0,04 s do 0,34 s) | `holster` (broń schowana) |
| `alarm-klaxon-000.ogg` | Alarm (ezduzziteh), `alarm_2.ogg` (pierwsze 0,96 s, dwa tony) | `alarm` (podniesiony alarm W-3) |
| `alarm-siren-000.ogg` | Sirens and Alarm Noise (aquinn), `siren.mp3` (3,48-5,0 s, jedno wycie) | `alarm-siren` (co 2,4 s w trakcie alarmu) |
| `rain-loop.ogg` | Rain (loopable), `1.ogg` (27 s, stereo) | pętla deszczu na szynie `ambience` (synteza pod spodem na 30%) |
| `car-horn-000.ogg` | GGBotNet, `Car_Horn.ogg` | `horn` (klakson aut z ruchu i auta gracza) |
| `car-door-open-000.ogg` | GGBotNet, `Car_Door_Open.ogg` | `car-door-open` |
| `car-door-close-000.ogg` | GGBotNet, `Car_Door_Close.ogg` | `car-door-close` |
| `engine-start-000.ogg` | GGBotNet, `Car_Engine_Start_Up.ogg` | `engine-start` |
| `engine-stop-000.ogg` | GGBotNet, `Car_Engine_Turning_Off.ogg` (do 1,82 s) | `engine-stop` |
| `engine-loop-000.ogg` | domasx2, `loop_0.wav` | pętla silnika auta gracza (`EngineLoop`, wysokość od obrotów) |

Łącznie ok. 1,4 MB. Nowy plik: dopisz go tutaj i w manifeście (test `packages/app/test/audio-manifest.test.ts` pilnuje obu i budżetu 4 MB).
