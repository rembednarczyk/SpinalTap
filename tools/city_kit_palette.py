"""The shared swatch palette of city-kit.glb and city-props.glb (ADR-0022, ADR-0058) and the colour
roles of Kenney's building colours. Swatch kinds: "lit" shaded, "tint" shaded and tinted per
building or vehicle, "glow" self-lit (also in the glow palette)."""
import colorsys
import numpy as np

# ---------------------------------------------------------------- palette

# name: (hex, kind) with kind "lit" | "tint" | "glow". Order = swatch index (max 256).
SWATCHES = [
    ('wall', '#b4bac4', 'tint'),         # tinted per building; the tint carries the hue
    ('wall-dark', '#868c98', 'tint'),    # plinths, ledges, ground floors
    ('trim', '#3a3f4b', 'lit'),
    ('trim-light', '#5a6170', 'lit'),
    ('roof', '#30343e', 'lit'),
    ('dark', '#15171c', 'lit'),
    ('metal', '#596070', 'lit'),
    ('glass-dark', '#121a24', 'lit'),
    ('glass-blue', '#1d3346', 'lit'),
    ('door', '#1b1514', 'lit'),
    ('fabric-teal', '#167a80', 'lit'),
    ('fabric-magenta', '#8e2457', 'lit'),
    ('fabric-amber', '#9c6a1c', 'lit'),
    ('plant', '#1f4a3a', 'lit'),
    ('paint', '#c8ccd4', 'tint'),         # car paint, tinted per vehicle
    ('tyre', '#18191d', 'lit'),
    ('rust', '#5b3a2c', 'lit'),
    ('dumpster', '#1f5a52', 'lit'),
    ('brick', '#6a4038', 'lit'),
    ('win-warm', '#ffc27a', 'glow'),
    ('win-teal', '#7ff3ff', 'glow'),
    ('win-pink', '#ff8fd8', 'glow'),
    ('shop-warm', '#a87a4c', 'glow'),     # big shop windows: dimmer, they fill whole walls
    ('shop-pink', '#b8579a', 'glow'),
    ('shop-teal', '#3b9ea6', 'glow'),
    ('win-white', '#c9dcf2', 'glow'),
    ('neon-pink', '#ff2e88', 'glow'),
    ('neon-cyan', '#00e5ff', 'glow'),
    ('neon-amber', '#ffb000', 'glow'),
    ('neon-green', '#39ff8a', 'glow'),
    ('neon-violet', '#b46cff', 'glow'),
    ('neon-red', '#ff4040', 'glow'),
    ('neon-blue', '#3f8cff', 'glow'),
    ('office', '#2f6f9a', 'glow'),       # lit office glass of the bank tower
    ('headlight', '#fff6d8', 'glow'),
    ('taillight', '#ff2030', 'glow'),
    # Procedural decor (engine/src/renderer/city-kit.ts).
    ('ac', '#8b929b', 'lit'),
    ('ac-grille', '#2b2f36', 'lit'),
    ('pipe', '#3e444f', 'lit'),
    ('cable', '#0d0f13', 'lit'),
    ('sign-back', '#1a1c22', 'lit'),
]
SW = {name: i for i, (name, _, _) in enumerate(SWATCHES)}
GRID, CELL = 16, 4


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def palette_images():
    size = GRID * CELL
    albedo = np.zeros((size, size, 4), np.uint8)
    glow = np.zeros((size, size, 4), np.uint8)
    glow[..., 3] = 255
    for i, (_, h, kind) in enumerate(SWATCHES):
        x, y = (i % GRID) * CELL, (i // GRID) * CELL
        rgb = hex_rgb(h)
        albedo[y:y + CELL, x:x + CELL, :3] = rgb
        albedo[y:y + CELL, x:x + CELL, 3] = {'lit': 255, 'tint': 128, 'glow': 0}[kind]
        if kind == 'glow':
            glow[y:y + CELL, x:x + CELL, :3] = rgb
    return albedo, glow


def swatch_uv(i):
    return ((i % GRID) + 0.5) / GRID, ((i // GRID) + 0.5) / GRID


def hsv(rgb):
    return colorsys.rgb_to_hsv(*rgb)


def kenney_building_role(rgb):
    h, s, v = hsv(rgb)
    hd = h * 360
    if s < 0.3:
        # Kenney's greys: white walls, blue-grey plinths and ledges, dark roofs.
        if v > 0.82:
            return 'wall'
        if v > 0.62:
            return 'trim-light'
        if v > 0.44:
            return 'wall-dark'
        if v > 0.27:
            return 'roof'
        return 'dark'
    if 195 <= hd <= 235 and v > 0.55:
        return 'window'
    if 195 <= hd <= 250:
        return 'trim'
    if 80 <= hd < 195:
        return 'fabric-teal' if s > 0.45 else 'plant'
    if 30 <= hd < 60 and s > 0.5:
        return 'fabric-amber'
    if 12 <= hd < 30 and s > 0.5 and v > 0.85:
        return 'shop-warm'
    if 12 <= hd < 40:
        return 'brick'
    if hd >= 330 or hd < 12:
        return 'fabric-magenta'
    if 250 <= hd < 330:
        return 'neon-violet' if v > 0.8 else 'fabric-magenta'
    return 'trim'
