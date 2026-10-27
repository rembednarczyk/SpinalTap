# Broń (modele zastępcze)

Z paczki **Ultimate Gun Pack** autorstwa Quaterniusa (OpenGameArt, `ultimate_gun_pack_by_quaternius.zip`), licencja **CC0**.

| Plik | Źródło | Rola | Długość |
|---|---|---|---|
| `pistol.glb` | `OBJ/Pistol_6.obj` | Unity-9, pistolet Seki | 0,22 m |
| `smg.glb` | `OBJ/SubmachineGun_1.obj` | SMG gangerów Hebi | 0,42 m |

Konwersja: `tools/obj2glb.py <obj> <glb> <długość>` (płaskie kolory Kd z MTL jako `baseColorFactor`,
model wyśrodkowany i przeskalowany tak, by najdłuższy bok miał podaną długość). Materiały zamienia
na toon `ModelLibrary`.
