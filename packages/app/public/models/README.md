# Obsada postaci (MVP)

Obsada z próbek VRoid Project (pobrane z OpenGameArt, „VRoid Studio CC0 models”). Licencja zapisana
w metadanych każdego pliku: VRoid Hub license v1 (użycie przez każdego, modyfikacja, redystrybucja
i użycie komercyjne dozwolone, bez wymogu atrybucji); `ganger.vrm` (Base_Male) ma w metadanych CC0.

| Plik | Źródło | Rola |
|---|---|---|
| `seki.vrm` | AvatarSample_D (千駄ヶ谷渋) | Seki |
| `kaito.vrm` | Sakurada Fumiriya (桜田 史利矢) | Kaito, fixer |
| `ganger.vrm` | Base_Male | gangerzy Hebi |
| `civilian.vrm` | Sendagaya Shino (千駄ヶ谷篠) | cywile (Ume, Oyaji) |
| `mori.vrm` | AvatarSample_F (ヴィータ) | doktor Mori |

Zmiany względem oryginałów: tekstury zmniejszone do 1024 px, z morph targetów zostały tylko
mruganie i samogłoski (`blink`, `a`, `i`, `u`, `e`, `o`, same pozycje), pozostałe grupy blend shape
mają puste powiązania. Bez tego pliki ważą 14–21 MB. Polecenie:
`python3 tools/shrink_glb.py ORYGINAŁ.vrm models/x.vrm 1024 --keep-morphs=blink,a,i,u,e,o`.

Ta obsada zostaje w MVP gry (decyzja z 27.10.2026); własne postacie mogą ją zastąpić później. Wyłączenie: `?models=off`.
