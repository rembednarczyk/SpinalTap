# Broń

Z paczki **Ultimate Gun Pack** autorstwa Quaterniusa (OpenGameArt, `ultimate_gun_pack_by_quaternius.zip`), licencja **CC0**.
Paczkę pobiera `node tools/assets/fetch.mjs DIR --only quaternius-ultimate-gun-pack` (źródło i sha256 w `tools/assets/sources.json`).

| Plik | Źródło | Rola | Długość |
|---|---|---|---|
| `pistol.glb` | `OBJ/Pistol_6.obj` | Unity-9, pistolet Seki | 0,22 m |
| `revolver.glb` | `OBJ/Revolver_3.obj` | Oni .44, rewolwer | 0,27 m |
| `smg.glb` | `OBJ/SubmachineGun_1.obj` | SMG gangerów Hebi | 0,42 m |
| `shotgun.glb` | `OBJ/Shotgun_ShortStock.obj` | Raijin 12, strzelba z chwytem pistoletowym | 0,75 m |
| `rifle.glb` | `OBJ/AssaultRifle2_2.obj` | Tessen AR-5 i Kagero DMR | 0,80 m |

Konwersja: `python3 tools/obj2glb.py <obj> <glb> <długość> --vertex-colors` (płaskie kolory Kd z MTL wypalone
w kolory wierzchołków, jedna siatka na model; model wyśrodkowany i przeskalowany tak, by najdłuższy bok miał
podaną długość). Materiały zamienia na toon `ModelLibrary`. Lufa leży wzdłuż +X pliku; miejsce chwytu każdego
modelu jest w `GRIP` (`packages/engine/src/renderer/weapon-mount.ts`).

## Broń biała

Z paczki **Low poly medieval weapons** autorstwa Quaterniusa (OpenGameArt, `MedievalPack.zip`), licencja **CC0**.
Paczkę pobiera `node tools/assets/fetch.mjs DIR --only quaternius-medieval-weapons` (źródło i sha256 w `tools/assets/sources.json`).

| Plik | Źródło | Rola | Długość |
|---|---|---|---|
| `baton.glb` | `OBJ/Club.obj` | pałka teleskopowa (`baton`) | 0,53 m |
| `blade.glb` | `OBJ/Katana.obj` | ostrze shirasaya (`shirasaya`) | 0,80 m |

Paczka koloruje modele małymi teksturami-paletami, więc najpierw `python3 -I tools/melee_obj.py DIR/quaternius-medieval-weapons/x/MedievalPack OUT`
zamienia je na OBJ z płaskimi kolorami Kd i kładzie w układzie broni gry (czubek wzdłuż +X, grzbiet w górę +Y).
Pałka to przerobiona maczuga: kolce złożone do trzonu, profil pałki teleskopowej (rękojeść, dwa segmenty, nasadka),
kolory stali i gumy. Ostrze to katana z nowymi kolorami oprawy shirasaya (jasne drewno, ciemna obręcz).
Potem `python3 tools/obj2glb.py OUT/baton.obj baton.glb 0.53 --vertex-colors` i tak samo `blade.glb` z długością 0.8.
Miejsce chwytu jest w `GRIP`, a kąt rękojeści w `MELEE_HOLD` (`packages/engine/src/renderer/weapon-mount.ts`).
