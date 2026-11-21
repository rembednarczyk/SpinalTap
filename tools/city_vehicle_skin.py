"""The close-up of a textured car in its own skin (tools/city_vehicles.py, user's notes of 21.11): its own
UVs on its own texture, as the original is drawn, instead of one palette swatch per triangle.

The city kit's toon shader reads the alpha of its texture (ADR-0022): 128 lit and tinted by the vertex
colour, 255 lit as it is, 0 self-lit. The skin is the original's base colour in that code:
- the body (the triangles whose settled role is paint, metal or light trim) tinted, its texels brightened so
  the body's own grey comes out at `BODY` and the vehicle's paint gives the hue: the panels, vents and
  lines of the texture stay, the colour is the street's;
- tyres, rims and skirts as they are, a little brighter (`PLAIN`), never tinted; the glass darker (`GLASS`);
- the emissive texels self-lit in their own colour, also in the glow twin (the glow layer's map).
Its UVs are kept at 16 bits (a palette swatch needs 8; a 1024 px texture does not).
"""
import io
import numpy as np
from PIL import Image, ImageDraw

# The body's texel value in the original (its median), what it becomes, and how the untinted parts brighten.
BODY_SOURCE = 0.118
BODY = 0.6
PLAIN = 1.4
# Glass darker still: the original's tinted panes, the street's lights in them (the shader's speculars).
GLASS = 0.55
# Emissive texels brighter than this shine.
GLOW_AT = 0.2
TINTED = {'paint', 'metal', 'trim-light'}
SIDE = 1024


def _png(arr, mode='RGBA'):
    buf = io.BytesIO()
    Image.fromarray(arr, mode).save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def _fit(img):
    return np.asarray(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((SIDE, SIDE), Image.LANCZOS)).astype(np.float64) / 255


def skin_images(base, emissive, uv, roles):
    """The skin's colour and glow PNGs: `base` and `emissive` the original's images (float RGB 0..1, or
    None), `uv` [T, 3, 2] the triangles' UVs (glTF, v down), `roles` their settled roles."""
    base = _fit(base)
    mask = Image.new('L', (SIDE, SIDE), 0)
    draw = ImageDraw.Draw(mask)
    for t, r in enumerate(roles):
        if (r in TINTED or r == 'glass-dark') and not np.isnan(uv[t]).any():
            draw.polygon([(float(u % 1) * SIDE, float(v % 1) * SIDE) for u, v in uv[t]], fill=255 if r in TINTED else 128)
    code = np.asarray(mask)
    tinted = code > 191
    glass = (code > 63) & ~tinted
    rgb = np.where(tinted[..., None], base * (BODY / BODY_SOURCE), base * np.where(glass, GLASS, PLAIN)[..., None])
    alpha = np.where(tinted, 128, 255).astype(np.uint8)
    glow = np.zeros((SIDE, SIDE, 4), np.uint8)
    glow[..., 3] = 255
    if emissive is not None:
        em = _fit(emissive)
        lit = em.max(-1) > GLOW_AT
        rgb = np.where(lit[..., None], em, rgb)
        alpha = np.where(lit, 0, alpha).astype(np.uint8)
        glow[..., :3] = np.where(lit[..., None], em * 255, 0).astype(np.uint8)
    color = np.dstack([(np.clip(rgb, 0, 1) * 255).astype(np.uint8), alpha])
    return _png(color), _png(glow)


def skin_model(key, P, N, uv, tail=()):
    """A model on its own UVs: triangles P [T, 3, 3] with normals N [T, 3, 3] and UVs [T, 3, 2], welded.

    `tail`: the triangle counts of the parts at its end (the wheels, `city_vehicle_wheels`), in turn; the model
    then has 'parts', the first vertex and the vertex count of each (parts share no vertex with the rest)."""
    verts = {}
    pos, nor, uvs, ind = [], [], [], []
    starts = np.cumsum([len(P) - sum(tail)] + list(tail))[:-1] if tail else []
    firsts = []
    for t in range(len(P)):
        if len(firsts) < len(starts) and t == starts[len(firsts)]:
            firsts.append(len(pos))
        for k in range(3):
            p = np.round(P[t, k], 4)
            n = N[t, k] / max(np.linalg.norm(N[t, k]), 1e-9)
            w = np.nan_to_num(uv[t, k]) % 1
            vk = (tuple(p), tuple(np.round(n, 2)), tuple(np.round(w, 5)))
            vi = verts.get(vk)
            if vi is None:
                vi = verts[vk] = len(pos)
                pos.append(p)
                nor.append(n)
                uvs.append(w)
            ind.append(vi)
    m = {'key': key, 'pos': np.array(pos, np.float32), 'nor': np.array(nor), 'uv': np.array(uvs), 'ind': np.array(ind, np.uint32), 'uv16': True}
    if tail:
        ends = firsts[1:] + [len(pos)]
        m['parts'] = [[int(a), int(b - a)] for a, b in zip(firsts, ends)]
    return m


def fitted_normals(N, before, after):
    """Normals of triangles scaled from `before` to `after` (both [T, 3, 3], the same triangles): each axis
    divided by its scale (the inverse transpose of a scaling), renormalized."""
    span = lambda P: np.ptp(P.reshape(-1, 3), 0)
    s = span(after) / np.maximum(span(before), 1e-9)
    n = N / s
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)
