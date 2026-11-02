"""The still crowd of ADR-0058 stage 8 in packages/app/public/city/crowd-props.glb, on the city kit's swatch
palette like the other props files (the engine loads it after them and merges them, `mergeCityProps`).

People in still poses from Quaternius' Background Posed Humans (CC0, tools/assets/sources.json, fetched by
tools/assets/fetch.mjs into DIR/quaternius-posed-humans/): a man and a woman, each sitting, standing and
standing with a hand on the hip, each pose with two of the pack's hairstyles of that body, style
`figure-<pose>-<body>` (pose `sit`, `stand`, `hips`; body `a` the man's build, `b` the woman's). Every model
also has a phone version (style `lite` too) clustered down to `LITE` triangles.

The pack's flat materials mark the parts, which the engine paints per figure from its look (`figure-models.ts`):
the skin `brick`, the top `fabric-teal`, the trousers or skirt `trim`, the shoes `tyre`, the hair `dark`, a hair
tie `fabric-magenta`. So the swatches are only roles here; no colour of the pack is kept.

Frame: front +Z (as the pack's people face), in metres, the man 1.76 m and the woman 1.66 m tall standing.
A standing figure has its origin under its feet' middle, on the soles. A sitting one has it under its hips'
middle at the seat (the lowest point of the seat of the trousers): it is set with y = 0 on the seat, its feet
`seat` below it (extras). Each standing model keeps the point of its right hand as `lights[0]`, where a
smoker's ember goes. The hair of a pose is set on its head: the head's top and middle (the skin above the
neck) as on the standing pose, where the pack's hairstyles were cut for.

Node `extras`: {"size", "styles", "seat" (sitting), "lights" (standing)}; no credit, the source is CC0.

Usage: python3 -I tools/city_kit.py --crowd DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import simplify, weld
from city_kit_gltf import png_bytes, write_glb
from city_kit_palette import GRID, SWATCHES, palette_images, swatch_uv
from city_street_e2 import obj_triangles

SRC = 'quaternius-posed-humans'
# body: (folder, file prefix, height standing in m)
BODIES = {'a': ('Male', 'Male', 1.76), 'b': ('Female', 'Female', 1.66)}
POSES = {'sit': 'Sitting', 'stand': 'Standing', 'hips': 'Standing_Hips'}
# Two hairstyles of each body, by the pack's numbers.
HAIR = {'a': (1, 3), 'b': (1, 3)}
ROLES = {'Skin': 'brick', 'Shirt': 'fabric-teal', 'Pants': 'trim', 'Shoes': 'tyre', 'Hair': 'dark', 'HairTie': 'fabric-magenta'}
FULL = 1100
LITE = 260
MAX_TRIS = 1500
# The head: the skin this far (pack units) under the top of a standing or sitting figure, above its neck.
HEAD = 0.62


def obj_part(folder, rel):
    P, mats = obj_triangles(os.path.join(folder, SRC, rel))
    return P, [ROLES.get(m.split('.')[0], 'trim') for m in mats]


def head_of(P, roles):
    """Top and middle (x, z) of the head: the skin within `HEAD` of the figure's top."""
    flat = P.reshape(-1, 3)
    skin = np.repeat(np.array([r == 'brick' for r in roles]), 3)
    top = flat[:, 1].max()
    h = flat[skin & (flat[:, 1] > top - HEAD)]
    lo, hi = h.min(0), h.max(0)
    return top, (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2


def with_hair(P, roles, hair, hroles):
    """The hair set on the head: its top a little over the head's, its middle on the head's middle."""
    top, x, z = head_of(P, roles)
    flat = hair.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    at = np.array([x - (lo[0] + hi[0]) / 2, top + 0.04 - hi[1], z - (lo[2] + hi[2]) / 2])
    return np.concatenate([P, hair + at]), roles + hroles


def smooth_normals(P):
    """Normals per corner, averaged over the faces meeting at a point with the same swatch (soft bodies)."""
    flat = P.reshape(-1, 3)
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    keys = np.round(flat, 4)
    _, inv = np.unique(keys, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    acc = np.zeros((inv.max() + 1, 3))
    np.add.at(acc, inv, np.repeat(n, 3, 0))
    out = acc[inv]
    out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-12)
    return out.reshape(-1, 3, 3)


def framed(P, roles, pose, height, stand_top):
    """Front +Z, metres, and the origin of the pose (feet or seat); the seat's height over the feet, the right hand."""
    k = height / stand_top
    P = P * k
    flat = P.reshape(-1, 3)
    lo = flat.min(0)
    corner_roles = np.repeat(np.array(roles), 3)
    if pose == 'sit':
        # The seat: the lowest trousers behind the knees (the back half of the thighs' run).
        pants = flat[corner_roles == 'trim']
        back = pants[pants[:, 2] < pants[:, 2].min() + 0.25]
        seat_y = back[:, 1].min()
        origin = np.array([(back[:, 0].min() + back[:, 0].max()) / 2, seat_y, (back[:, 2].min() + back[:, 2].max()) / 2])
        P = P - origin
        return P, {'seat': round(float(seat_y - lo[1]), 3)}
    shoes = flat[corner_roles == 'tyre']
    origin = np.array([(shoes[:, 0].min() + shoes[:, 0].max()) / 2, lo[1], (shoes[:, 2].min() + shoes[:, 2].max()) / 2])
    P = P - origin
    # The right hand (the figure's right is -X with its front on +Z): the skin farthest along -X below the chest.
    flat = P.reshape(-1, 3)
    skin = flat[corner_roles == 'brick']
    low = skin[skin[:, 1] < height * 0.7]
    hand = low[np.argmin(low[:, 0])]
    return P, {'lights': [[round(float(v), 3) for v in hand]]}


def bake(folder, body, pose, hair):
    sub, prefix, height = BODIES[body]
    stand, sroles = obj_part(folder, f'{sub}/{sub} Poses/OBJ/{prefix}_Standing.obj')
    stand_top = stand.reshape(-1, 3)[:, 1].max() - stand.reshape(-1, 3)[:, 1].min()
    P, roles = obj_part(folder, f'{sub}/{sub} Poses/OBJ/{prefix}_{POSES[pose]}.obj')
    H, hroles = obj_part(folder, f'{sub}/{sub} Hairstyles/OBJ/{prefix}_Hairstyle_{hair}.obj')
    P, roles = with_hair(P, roles, H, hroles)
    return framed(P, roles, pose, height, stand_top) + (roles,)


def build_crowd(folder, out_dir):
    out, extras = [], {}
    for body in BODIES:
        for pose in POSES:
            for n, hair in enumerate(HAIR[body]):
                P0, ex, roles0 = bake(folder, body, pose, hair)
                for lite, target in ((False, FULL), (True, LITE)):
                    key = f"cr-{pose}-{body}{n}{'-lite' if lite else ''}"
                    P, roles = simplify(P0, roles0, target)
                    m = weld(key, P, smooth_normals(P), roles, swatch_uv, MAX_TRIS)
                    flat = P.reshape(-1, 3)
                    size = [round(float(v), 3) for v in flat.max(0) - flat.min(0)]
                    out.append(m)
                    extras[key] = {'size': size, 'styles': [f'figure-{pose}-{body}'] + (['lite'] if lite else []), **ex}
                    print(f"{key:18s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} {ex}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'crowd-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
