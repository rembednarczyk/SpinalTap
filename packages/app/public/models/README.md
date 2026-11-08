# Obsada postaci (MVP)

Obsada z próbek VRoid Project (pobrane z OpenGameArt, „VRoid Studio CC0 models”). Licencja zapisana
w metadanych każdego pliku: VRoid Hub license v1 (użycie przez każdego, modyfikacja, redystrybucja
i użycie komercyjne dozwolone, bez wymogu atrybucji); `ganger.vrm` (Base_Male) i `base-female.vrm`
(Base_Female) mają w metadanych CC0.

| Plik | Źródło | Licencja | Rola |
|---|---|---|---|
| `seki.vrm` | AvatarSample_D (千駄ヶ谷渋) | VRoid Hub 1.0 | Seki |
| `kaito.vrm` | Sakurada Fumiriya (桜田 史利矢) | VRoid Hub 1.0 | Kaito, fixer |
| `ganger.vrm` | Base_Male | CC0 | gangerzy Hebi |
| `civilian.vrm` | Sendagaya Shino (千駄ヶ谷篠) | VRoid Hub 1.0 | cywile |
| `mori.vrm` | AvatarSample_F (ヴィータ) | VRoid Hub 1.0 | Hana i inne |
| `base-female.vrm` | [Base_Female](https://opengameart.org/content/vroid-studio-cc0-models) (VRoidプロジェクト, `base_female.zip`, sha256 w `tools/assets/sources.json`) | CC0 (metadane VRM: `licenseName` CC0, `allowedUserName` Everyone, `commercialUssageName` Allow) | starsze kobiety: Ume, Kiku, Sachiko (ADR-0076, decyzja 7) |

Zmiany względem oryginałów: tekstury zmniejszone do 1024 px, z morph targetów zostały tylko
mruganie i samogłoski (`blink`, `a`, `i`, `u`, `e`, `o`, same pozycje), pozostałe grupy blend shape
mają puste powiązania. Bez tego pliki ważą 14–21 MB. Polecenie:
`python3 tools/shrink_glb.py ORYGINAŁ.vrm models/x.vrm 1024 --keep-morphs=blink,a,i,u,e,o`.
`base-female.vrm`: 15,9 MB → 5,2 MB, bez COLOR_0 już w oryginale.

Ta obsada zostaje w MVP gry (decyzja z 27.10.2026); własne postacie mogą ją zastąpić później. Wyłączenie: `?models=off`.
