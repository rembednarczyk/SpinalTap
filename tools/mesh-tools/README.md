# tools/mesh-tools

Narzędzia siatek do wypieków `tools/city_*.py` (decyzja użytkownika 20.11), przypięte w lockfile:

- `meshoptimizer` 1.3.0: upraszczanie kwadrykami błędu, `src/simplify.ts` (JSON na stdin i stdout), wołane z `tools/city_qem.py` (auta i tłum, ADR-0058, wpis z 20.11).
- `gltfpack` 1.3.0: `pnpm --filter @seki/mesh-tools exec gltfpack -i in.glb -o out.glb [-cc] [-tc]`; `-tc` koduje tekstury do KTX2 z BasisU. Gra wczytuje dziś pliki rekwizytów własnym parserem (`city-props.ts`) bez dekodera meshopt i KTX2, więc kompresja to osobny etap z pomiarem.

Blender 4.0.2 bez okna (`blender -b -P skrypt.py`) jest z repozytorium Ubuntu (`apt-get install blender`), nie z npm.
