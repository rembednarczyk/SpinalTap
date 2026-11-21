"""The extra CC-BY props of ADR-0096 in packages/app/public/city/extra-props.glb, on the city kit's swatch
palette like the other props files (the engine merges them, `mergeCityProps`).

Sources (tools/assets/sources.json, fetched by tools/assets/fetch.mjs into DIR/<source id>/), Sketchfab GLBs
under CC-BY 4.0, each credited in packages/ui/src/credits/credits.ts:
- Street Asset Pack (vmatthew): one model per thing of the pack, picked by its nodes' names (`nodes`): the
  concrete and the red plastic barrier, the four metal crowd barriers (two kinds, whole and bent), the cone,
  the traffic barrel, the boarded bin, two bin bags, two cardboard boxes, a bottle, a cup and a hydrant. Its
  road signs are American (STOP, give way) and stay out.
- Simple Mini-ATM (Blender3D): the cash machine set into a wall, lying on its back in the file.
- Satellite Comms (Duane's Mind): the dish on its deck and legs, 17 units tall, a roof's dish here.
- Fire Escape / Exit Doors (blue man group): the steel double door with its frame and push bar.

Each model is coloured per triangle from its texture (`city_ccby.roles_of`), turned front to +Z, scaled to
its real height (`height`, metres) and stood on y = 0 at the middle of its foot. It keeps the source's
triangles up to `MAX_TRIS`, above it the finest vertex clustering under it (comic realism: the shape of the
original, ADR-0058 note of 20.11). Node extras: {"size", "styles", "credit"}.

Usage: python3 -I tools/city_kit.py --extras DIR --out DIR
"""
import os
import zlib
import numpy as np
from city_ccby import flat_normals, roles_of, simplify, weld
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SWATCHES, palette_images, swatch_uv

MAX_TRIS = 6000
# Models that hang on a wall: their bottom this high over the foot (m), the origin staying on the ground.
LIFT = {'ex-atm-wall': 0.8}

STREET = ('sketchfab-street-asset-pack', 'street_asset_pack.glb')
TAIWAN = ('sketchfab-taiwan-signboard', 'taiwan_style_signboard_lowpoly.glb')


def starts(*prefixes):
    return lambda name: any(name.startswith(p) for p in prefixes)


def exact(*names):
    return lambda name: name in names


# key, (source id, file), node filter, styles, yaw and pitch (deg, front to +Z), height (m)
EXTRAS = [
    # Barriers at the building sites and the road works (ADR-0096 rule 2): a concrete one 0.81 m (the
    # New Jersey profile), a red water-filled one, the steel crowd barriers 1.1 m.
    ('ex-barrier-concrete', STREET, starts('concrete_barrier'), ['site-barrier'], 0, 0, 0.81),
    ('ex-barrier-red', STREET, exact('red_barrier_Barrier_0'), ['site-barrier'], 0, 0, 0.8),
    ('ex-railing-a', STREET, exact('metal_barrier1_Metal_Barrier1_0'), ['crowd-barrier'], 0, 0, 1.1),
    ('ex-railing-a-bent', STREET, starts('metal_barrier_damaged1'), ['crowd-barrier-bent'], 0, 0, 1.1),
    ('ex-railing-b', STREET, exact('metal_barrier2_Metal_Barrier2_0'), ['crowd-barrier'], 0, 0, 1.1),
    ('ex-railing-b-bent', STREET, starts('metal_barrier_damaged2'), ['crowd-barrier-bent'], 0, 0, 1.1),
    ('ex-cone', STREET, starts('Cone_'), ['cone'], 0, 0, 0.75),
    ('ex-barrel', STREET, starts('Barrel_'), ['traffic-barrel'], 0, 0, 1.05),
    # The back of a restaurant (ADR-0096 rule 1): a boarded bin, bin bags, boxes, a bottle and a cup.
    ('ex-bin-boarded', STREET, starts('Bin_'), ['bin-boarded'], 0, 0, 1.0),
    ('ex-bag-a', STREET, exact('trashbag_trash1_0'), ['bin-bag'], 0, 0, 0.62),
    ('ex-bag-b', STREET, exact('trashbag2_trash2_0'), ['bin-bag'], 0, 0, 0.55),
    ('ex-box-a', STREET, exact('Cardboard_Box_Cardboard_0'), ['cardboard'], 0, 0, 0.32),
    ('ex-box-b', STREET, starts('Cube.001_Cardboard2'), ['cardboard'], 0, 0, 0.45),
    ('ex-bottle', STREET, exact('Bottle_bottle1_0'), ['litter'], 0, 0, 0.3),
    ('ex-cup', STREET, exact('cup1_cup1_0'), ['litter'], 0, 0, 0.15),
    # A second hydrant beside Quaternius' (the hydrants' pool takes both, by position).
    ('ex-hydrant', STREET, exact('Hydrant_Hydrant_0'), ['hydrant'], 0, 0, 0.9),
    # A cash machine set into a bank's wall (ADR-0096 rule 3), screen to +Z: 0.85 m tall, its bottom 0.8 m up (`LIFT`).
    ('ex-atm-wall', ('sketchfab-mini-atm', 'simple_mini-atm.glb'), None, ['atm-wall'], -90, -90, 0.85),
    # A roof's dish on its deck (ADR-0096 rule 4): 3.4 m to the top of the dish.
    ('ex-dish', ('sketchfab-satellite-comms', 'satellite_comms.glb'), None, ['roof-dish'], 0, 0, 3.4),
    # A steel double door at a back wall (ADR-0096 rule 7): 2.1 m with its frame, face to +Z.
    ('ex-exit-door', ('sketchfab-fire-escape-doors', 'fire_escape__exit_doors.glb'), None, ['exit-door'], 90, 0, 2.1),
    # The housings of the blade signs (ADR-0096 rule 5): the plane of the sign across the wall (local YZ),
    # its arms' wall plates at -Z. Heights put the panel at 2.4 m (the Taiwan frames) and 1.7 m (the LED
    # sign); the renderer lights the panel with the atlas's blade (`blade-housings.ts`).
    ('ex-blade-frame', TAIWAN, exact('board02_metal_0', 'board02_board_0'), ['blade-frame'], 90, 0, 3.585),
    ('ex-blade-narrow', TAIWAN, exact('board13_metal_0', 'board13_board_0'), ['blade-narrow'], 90, 0, 4.336),
    ('ex-blade-led', ('sketchfab-cyberpunk-led-neon-sign', 'cyberpunk_animated_japanese_led_neon_sign.glb'), exact('Object_36'), ['blade-led'], -90, 0, 1.778),
]
# Models placed by their box's middle (`onWall`), not their foot's: a frame whose stay reaches down to one side.
BOX_CENTRED = {'ex-blade-frame', 'ex-blade-narrow', 'ex-blade-led'}


def source_file(folder, source, name):
    """The file of a source: by its name, else the only GLB under its folder (the fetch unpacks zips)."""
    path = os.path.join(folder, source, name)
    if os.path.exists(path):
        return path
    found = [os.path.join(r, f) for r, _, fs in os.walk(os.path.join(folder, source)) for f in fs if f.endswith('.glb')]
    if len(found) != 1:
        raise SystemExit(f'{source}: expected {name}, found {found}')
    return found[0]


def bake_extra(folder, src, keep, yaw, pitch, height, box=False):
    path = source_file(folder, *src)
    P, _, mat, uv, j, blob = scene_triangles(path, keep)
    if len(P) == 0:
        raise SystemExit(f'{src}: no mesh left by the node filter')
    roles = roles_of(mat, uv, j, blob, os.path.dirname(path), None)
    b, a = np.radians(pitch), np.radians(yaw)
    Rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    Ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    flat = P.reshape(-1, 3) @ (Ry @ Rx).T
    flat = flat * (height / float(flat[:, 1].max() - flat[:, 1].min()))
    P = flat.reshape(-1, 3, 3)
    P, roles = simplify(P, roles, MAX_TRIS)
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    foot = flat if box else flat[flat[:, 1] < lo[1] + 0.05 * (hi[1] - lo[1])]
    fl, fh = foot.min(0), foot.max(0)
    P = P - np.array([(fl[0] + fh[0]) / 2, lo[1], (fl[2] + fh[2]) / 2])
    return P, roles, [round(float(x), 3) for x in hi - lo]


def build_extras(folder, out_dir):
    out, extras = [], {}
    for key, src, keep, styles, yaw, pitch, height in EXTRAS:
        P, roles, size = bake_extra(folder, src, keep, yaw, pitch, height, key in BOX_CENTRED)
        if key in BOX_CENTRED:
            # The panel's printed colours (the pack's own lettering) go dark: the game's blade lights it.
            roles = ['dark' if r.startswith(('neon', 'win', 'fabric')) else r for r in roles]
        P = P + np.array([0, LIFT.get(key, 0), 0])
        m = weld(key, P, flat_normals(P), roles, swatch_uv, MAX_TRIS)
        out.append(m)
        extras[key] = {'size': size, 'styles': styles, 'credit': src[0]}
        print(f"{key:20s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'extra-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
