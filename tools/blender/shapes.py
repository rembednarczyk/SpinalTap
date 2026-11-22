"""Shapes for the room detail built in Blender without a window (ADR-0098, `docs/zasady-lokacji.md` §11).

Runs inside Blender (`blender -b --python tools/blender/build.py`). A model is a function of its sizes (and,
where it varies, a seed): no randomness from the clock, so the same script gives the same file. Coordinates
are the game's: x across, y up, z out of the model's front, in metres, the foot on y = 0; `Model` turns them
into Blender's (z up, -y forward), which the glTF exporter turns back. The game's frame is Babylon's, left-handed:
the engine reads a glTF into it by negating z and turns a prop's front (-z) to its yaw, so a model's x would come
out mirrored. `Model` mirrors x on the way in (and each shape turns its faces back outwards), so x here is the world's
x at yaw 0. Every face carries a role of the city
kit's palette (`tools/city_kit_palette.py`) as its material's name; `tools/city_blender.py` bakes the roles
into the palette's UVs.

Shapes: boxes with bevelled edges, upright and lying cylinders and tubes between two points, solids of
revolution from a profile (bottles, lanterns, a stool's seat), quads for flat things (labels, stickers).
Round things have `seg` sides: 8 for small ones, 12-16 for what the eye meets near (comic realism: a round
thing is round, `docs/zasady-lokacji.md` §9).
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector


def hashf(*xs):
    """A number in [0, 1) from numbers: the seed of a variation, the same in every build."""
    h = 2166136261
    for x in xs:
        for b in repr(round(float(x), 4)).encode():
            h = ((h ^ b) * 16777619) & 0xFFFFFFFF
    return h / 4294967296.0


def _b(x, y, z):
    # x mirrored: Blender and glTF are right-handed, the game left-handed (see above).
    return Vector((-x, -z, y))


class Model:
    """One model: a bmesh in the game's frame, its faces' roles kept as material indices."""

    def __init__(self, key):
        self.key = key
        self.bm = bmesh.new()
        self.roles = []

    def _mat(self, role):
        if role not in self.roles:
            self.roles.append(role)
        return self.roles.index(role)

    def _finish(self, geom_faces, role, smooth=False):
        m = self._mat(role)
        for f in geom_faces:
            f.material_index = m
            f.smooth = smooth

    def box(self, x0, x1, y0, y1, z0, z1, role, bevel=0.0):
        """An axis-aligned box from (x0, y0, z0) to (x1, y1, z1), its edges bevelled by `bevel`."""
        r = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = r['verts']
        sx, sy, sz = max(x1 - x0, 1e-4), max(y1 - y0, 1e-4), max(z1 - z0, 1e-4)
        for v in verts:
            gx = (x0 + x1) / 2 + v.co.x * sx
            gy = (y0 + y1) / 2 + v.co.z * sy
            gz = (z0 + z1) / 2 - v.co.y * sz
            v.co = _b(gx, gy, gz)
        faces = list({f for v in verts for f in v.link_faces})
        # The mirror of `_b` turned the cube's faces inwards: back out, before the bevel (which follows them).
        bmesh.ops.reverse_faces(self.bm, faces=faces)
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            out = bmesh.ops.bevel(self.bm, geom=verts + edges, offset=min(bevel, sx / 2.2, sy / 2.2, sz / 2.2), segments=1, affect='EDGES', profile=0.5)
            # The box's own faces stay (shrunk), the bevel adds its strips and corners.
            faces = [f for f in faces if f.is_valid] + list(out['faces'])
        self._finish(faces, role)

    def obox(self, centre, ax, ay, half, role, bevel=0.0):
        """A box turned in the game's frame: its centre, its x and y axes (unit vectors; z is their cross product) and half sizes."""
        a, b = Vector(ax).normalized(), Vector(ay).normalized()
        c = a.cross(b)
        r = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = r['verts']
        for v in verts:
            g = Vector(centre) + a * (v.co.x * 2 * half[0]) + b * (v.co.z * 2 * half[1]) + c * (-v.co.y * 2 * half[2])
            v.co = _b(g.x, g.y, g.z)
        faces = list({f for v in verts for f in v.link_faces})
        # The mirror of `_b` turned the cube's faces inwards: back out, before the bevel (which follows them).
        bmesh.ops.reverse_faces(self.bm, faces=faces)
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            out = bmesh.ops.bevel(self.bm, geom=verts + edges, offset=min(bevel, *[h / 1.1 for h in half]), segments=1, affect='EDGES', profile=0.5)
            faces = [f for f in faces if f.is_valid] + list(out['faces'])
        self._finish(faces, role)

    def lathe(self, cx, cz, profile, role, seg=12, y0=0.0, cap=True):
        """A solid of revolution round the upright axis at (cx, cz): `profile` is [(radius, height)] bottom up."""
        rings = []
        for r, y in profile:
            ring = []
            for k in range(seg):
                a = 2 * math.pi * (k + 0.5) / seg
                ring.append(self.bm.verts.new(_b(cx + r * math.cos(a), y0 + y, cz + r * math.sin(a))))
            rings.append(ring)
        faces = []
        for i in range(len(rings) - 1):
            a, b = rings[i], rings[i + 1]
            for k in range(seg):
                faces.append(self.bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k])))
        if cap:
            if profile[0][0] > 1e-4:
                faces.append(self.bm.faces.new(list(reversed(rings[0]))))
            if profile[-1][0] > 1e-4:
                faces.append(self.bm.faces.new(rings[-1]))
        # Wound in the game's frame, mirrored by `_b`: turned back out.
        bmesh.ops.reverse_faces(self.bm, faces=faces)
        self._finish(faces, role, smooth=True)
        for f in faces[-2:] if cap else []:
            f.smooth = False

    def cyl(self, cx, cz, r, y0, y1, role, seg=12):
        """An upright cylinder."""
        self.lathe(cx, cz, [(r, 0.0), (r, y1 - y0)], role, seg, y0)

    def tube(self, p0, p1, r, role, seg=8):
        """A cylinder between two points (x, y, z) of the game's frame: pipes, rails, legs, cables."""
        a, b = _b(*p0), _b(*p1)
        d = b - a
        length = d.length
        if length < 1e-6:
            return
        rot = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
        r_ = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=length,
                                   matrix=Matrix.Translation((a + b) / 2) @ rot)
        faces = list({f for v in r_['verts'] for f in v.link_faces})
        self._finish(faces, role, smooth=True)

    def quad(self, corners, role):
        """A flat quad (a label, a sticker, a sheet of paper) from four corners in the game's frame, counter-clockwise seen from its front."""
        vs = [self.bm.verts.new(_b(*c)) for c in corners]
        # Wound in the game's frame, mirrored by `_b`: listed backwards.
        self._finish([self.bm.faces.new(list(reversed(vs)))], role)

    def mirrored(self, key):
        """The same model mirrored across x under another key: the same goods in the other order (a second variant)."""
        bmesh.ops.scale(self.bm, vec=Vector((-1.0, 1.0, 1.0)), verts=list(self.bm.verts))
        # A mirror turns the faces inwards: back out.
        bmesh.ops.reverse_faces(self.bm, faces=list(self.bm.faces))
        self.key = key
        return self

    def to_object(self):
        """The model as a Blender object at the origin, its materials named by role, its faces triangulated."""
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(self.key)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for role in self.roles:
            mesh.materials.append(bpy.data.materials.get(role) or bpy.data.materials.new(role))
        obj = bpy.data.objects.new(self.key, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj
