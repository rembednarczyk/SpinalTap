"""Tests of garment_extract.py on a made-up VRoid-like file.

    python3 -I -m unittest discover -s tools/garments -p 'test_*.py'
"""
import hashlib
import io
import json
import struct
import unittest

import numpy as np
from PIL import Image

import garment_extract as ge


def png(colour):
    out = io.BytesIO()
    Image.new('RGBA', (64, 64), colour).save(out, 'PNG')
    return out.getvalue()


def made_up_vrm():
    """Root > J_Bip_C_Hips > J_Bip_C_Spine > J_Sec_Coat; two quads of cloth and one of skin on one vertex buffer."""
    pos = np.array([[0, 1, 0], [1, 1, 0], [1, 2, 0], [0, 2, 0], [0, 0, 0], [1, 0, 0], [1, 0.5, 0], [0, 0.5, 0], [2, 1, 0], [3, 1, 0], [3, 2, 0], [2, 2, 0]], dtype=np.float32)
    nor = np.tile(np.array([0, 0, -1], dtype=np.float32), (12, 1))
    uv = np.array([[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4], [0.5, 0.5], [0.9, 0.5], [0.9, 0.9], [0.5, 0.9], [0.6, 0.1], [0.9, 0.1], [0.9, 0.4], [0.6, 0.4]], dtype=np.float32)
    # Joint indices into the skin: 0 Root, 1 Hips, 2 Spine, 3 J_Sec_Coat.
    jnt = np.array([[1, 3, 0, 0]] * 4 + [[1, 0, 0, 0]] * 4 + [[2, 3, 1, 0]] * 4, dtype=np.uint8)
    wgt = np.array([[0.5, 0.5, 0, 0]] * 4 + [[1, 0, 0, 0]] * 4 + [[0.6, 0.3, 0.1, 0]] * 4, dtype=np.float32)
    cloth = np.array([0, 1, 2, 0, 2, 3, 8, 9, 10, 8, 10, 11], dtype=np.uint16)
    skin = np.array([4, 5, 6, 4, 6, 7], dtype=np.uint16)
    binds = {'Root': [0, 0, 0], 'J_Bip_C_Hips': [0, 1, 0], 'J_Bip_C_Spine': [0, 1.2, 0], 'J_Sec_Coat': [0, 1.1, 0.1]}
    ibm = np.zeros((4, 16), dtype=np.float32)
    for i, p in enumerate(binds.values()):
        m = np.eye(4, dtype=np.float32)
        m[3, :3] = -np.array(p)
        ibm[i] = m.ravel()
    blobs = [pos.tobytes(), nor.tobytes(), uv.tobytes(), jnt.tobytes(), wgt.tobytes(), cloth.tobytes(), skin.tobytes(), ibm.tobytes(), png((200, 30, 30, 255)), png((30, 200, 30, 255)), png((0, 0, 0, 255))]
    views, binary = [], bytearray()
    for b in blobs:
        while len(binary) % 4:
            binary.append(0)
        views.append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(b)})
        binary += b
    while len(binary) % 4:
        binary.append(0)
    acc = [('VEC3', 5126, 12), ('VEC3', 5126, 12), ('VEC2', 5126, 12), ('VEC4', 5121, 12), ('VEC4', 5126, 12), ('SCALAR', 5123, 12), ('SCALAR', 5123, 6), ('MAT4', 5126, 4)]
    attrs = {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2, 'JOINTS_0': 3, 'WEIGHTS_0': 4}
    gltf = {
        'asset': {'version': '2.0'},
        'nodes': [
            {'name': 'Root', 'children': [1]},
            {'name': 'J_Bip_C_Hips', 'translation': [0, 1, 0], 'children': [2]},
            {'name': 'J_Bip_C_Spine', 'translation': [0, 0.2, 0], 'children': [3]},
            {'name': 'J_Sec_Coat', 'translation': [0, -0.1, 0.1]},
            {'name': 'Body', 'mesh': 0, 'skin': 0},
        ],
        'skins': [{'joints': [0, 1, 2, 3], 'inverseBindMatrices': 7}],
        'meshes': [{'primitives': [
            {'attributes': attrs, 'indices': 5, 'material': 0},
            {'attributes': attrs, 'indices': 6, 'material': 1},
        ]}],
        'materials': [
            {'name': 'N00_007_Tops_01_CLOTH (Instance)', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}},
            {'name': 'N00_000_Body_00_SKIN (Instance)', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 1}}},
        ],
        'textures': [{'source': 0}, {'source': 1}, {'source': 2}],
        'images': [{'bufferView': 8, 'mimeType': 'image/png'}, {'bufferView': 9, 'mimeType': 'image/png'}, {'bufferView': 10, 'mimeType': 'image/png', 'name': 'Thumbnail'}],
        'accessors': [{'bufferView': i, 'type': t, 'componentType': c, 'count': n} for i, (t, c, n) in enumerate(acc)],
        'bufferViews': views,
        'buffers': [{'byteLength': len(binary)}],
        'extensions': {'VRM': {'meta': {'title': 'made up'}}},
    }
    js = json.dumps(gltf).encode()
    while len(js) % 4:
        js += b' '
    total = 28 + len(js) + len(binary)
    return struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + bytes(binary)


RECIPE = {'id': 'coat-test', 'materials': ['N00_007_Tops_01_CLOTH'], 'material': 'Garment_coat-test', 'source': {'id': 'test', 'title': 'made up', 'author': 'nobody', 'page': 'https://example.org'}}


class GarmentExtractTest(unittest.TestCase):
    def setUp(self):
        self.src = made_up_vrm()
        self.out = ge.Glb(ge.extract(self.src, RECIPE, 32))

    def test_keeps_only_the_garment_triangles(self):
        j = self.out.json
        self.assertEqual(len(j['meshes']), 1)
        self.assertEqual(len(j['meshes'][0]['primitives']), 1)
        self.assertEqual(j['accessors'][5]['count'], 12)
        pos = self.out.accessor(0)
        self.assertEqual(len(pos), 8)
        # The skin's quad (y below 1) is not in it.
        self.assertGreaterEqual(float(pos[:, 1].min()), 1.0)

    def test_weights_only_on_j_bip_bones_with_names_kept(self):
        j = self.out.json
        names = [j['nodes'][n]['name'] for n in j['skins'][0]['joints']]
        self.assertEqual(names, ['J_Bip_C_Hips', 'J_Bip_C_Spine'])
        w = self.out.accessor(4)
        np.testing.assert_allclose(w.sum(1), 1, atol=1e-6)
        joints = self.out.accessor(3)
        # The first quad: half on the hips, half on the coat's spring bone, whose J_Bip_ ancestor is the spine.
        first = {names[int(k)]: float(x) for k, x in zip(joints[0], w[0]) if x > 0}
        self.assertEqual(first, {'J_Bip_C_Hips': 0.5, 'J_Bip_C_Spine': 0.5})
        # The second: 0.6 spine and 0.3 coat merged on the spine, 0.1 hips.
        second = {names[int(k)]: round(float(x), 5) for k, x in zip(joints[4], w[4]) if x > 0}
        self.assertEqual(second, {'J_Bip_C_Spine': 0.9, 'J_Bip_C_Hips': 0.1})
        ibm = self.out.accessor(6).reshape(-1, 4, 4)
        np.testing.assert_allclose(-ibm[1][3, :3], [0, 1.2, 0], atol=1e-6)

    def test_one_small_texture_and_no_thumbnail(self):
        j = self.out.json
        self.assertEqual(len(j['images']), 1)
        self.assertNotIn('extensions', j)
        im = self.out.image(0)
        self.assertLessEqual(max(im.size), 32)
        uv = self.out.accessor(2)
        self.assertTrue(((uv >= 0) & (uv <= 1)).all())
        # Every corner samples the cloth's red, not the skin's green.
        px = np.asarray(im)
        for u, v in uv:
            r, g, _, _ = px[min(31, int(v * 32)), min(31, int(u * 32))]
            self.assertGreater(int(r), int(g))

    def test_same_source_same_bytes_and_a_wrong_source_refused(self):
        self.assertEqual(ge.extract(self.src, RECIPE, 32), ge.extract(self.src, RECIPE, 32))
        with self.assertRaises(ValueError):
            ge.extract(self.src, {**RECIPE, 'sha256': '0' * 64}, 32)
        ok = {**RECIPE, 'sha256': hashlib.sha256(self.src).hexdigest()}
        self.assertEqual(ge.extract(self.src, ok, 32)[:4], b'glTF')

    def test_uv_rects_cut_a_garment_out_of_a_merged_material(self):
        out = ge.Glb(ge.extract(self.src, {**RECIPE, 'uvRects': [[0.5, 0, 1, 0.5]]}, 32))
        self.assertEqual(out.json['accessors'][5]['count'], 6)
        self.assertGreaterEqual(float(out.accessor(0)[:, 0].min()), 2.0)

    def test_hem_cuts_the_garment_at_a_height_with_one_welded_edge(self):
        out = ge.Glb(ge.extract(self.src, {**RECIPE, 'hem': 1.5}, 32))
        # Each quad (y 1..2): of its two triangles, one keeps a triangle above y 1.5, the other a quad (two).
        self.assertEqual(out.json['accessors'][5]['count'], 18)
        pos = out.accessor(0)
        # Per quad: the two top corners and three points on the cut, the diagonal's made once for both triangles.
        self.assertEqual(len(pos), 10)
        self.assertAlmostEqual(float(pos[:, 1].min()), 1.5, places=6)
        self.assertEqual(out.json['accessors'][0]['min'][1], float(pos[:, 1].min()))
        np.testing.assert_allclose(out.accessor(4).sum(1), 1, atol=1e-6)
        n = out.accessor(1)
        np.testing.assert_allclose(np.linalg.norm(n, axis=1), 1, atol=1e-6)
        # A point half way up the quad's right edge samples the texture half way along it.
        cut = [i for i in range(len(pos)) if abs(pos[i][1] - 1.5) < 1e-6 and abs(pos[i][0] - 1) < 1e-6]
        self.assertEqual(len(cut), 1)
        full = self.out
        right = [i for i in range(len(full.accessor(0))) if abs(full.accessor(0)[i][0] - 1) < 1e-6]
        np.testing.assert_allclose(out.accessor(2)[cut[0]], full.accessor(2)[right].mean(0), atol=1e-6)
        self.assertEqual(out.json['nodes'][0]['extras']['hem'], 1.5)
        # The texture and the skeleton are the extraction's own.
        self.assertEqual(out.json['skins'], full.json['skins'])
        self.assertEqual(np.asarray(out.image(0)).tobytes(), np.asarray(full.image(0)).tobytes())

    def test_hem_in_the_recipe_is_the_hem_of_the_extracted_file(self):
        long = ge.extract(self.src, RECIPE, 32)
        self.assertEqual(ge.extract(self.src, {**RECIPE, 'hem': 1.5}, 32), ge.hem(long, 1.5))
        # Under the garment: nothing cut, the same geometry.
        low = ge.Glb(ge.hem(long, 0.5))
        self.assertEqual(low.json['accessors'][5]['count'], 12)
        np.testing.assert_array_equal(low.accessor(0), self.out.accessor(0))


if __name__ == '__main__':
    unittest.main()
