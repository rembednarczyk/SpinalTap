"""Cuts a garment out of a VRoid VRM 0.x file into a small GLB of its own (ADR-0086, way A).

    python3 -I tools/garments/garment_extract.py SOURCE.vrm OUT.glb --recipe tools/garments/garments.json --id jacket-techwear

The recipe (`garments.json`) names the source file by its sha256, the materials whose primitives
make the garment and, where the garment shares a material with other parts (an exported model
with merged materials), the UV rectangles of its triangles. The result:

- one skinned primitive in the source's bind pose (metres, glTF axes as in the VRM), with
  POSITION, NORMAL, TEXCOORD_0, JOINTS_0 and WEIGHTS_0;
- weights only on `J_Bip_*` bones, names kept: a weight on any other bone (`J_Sec_*` spring
  bones of the bust or the coat's tails) goes to its nearest `J_Bip_*` ancestor, then the four
  largest are kept and normalised;
- a skeleton of the used bones and their `J_Bip_*` ancestors, at their bind positions (VRoid
  binds every bone unrotated, which the tool checks);
- one texture at most SIZE px (default 512): the used parts of the source textures cropped and
  packed into one atlas, so the garment is one mesh and one draw call per character;
- no thumbnail, no other image, no VRM extension.

The source is untrusted data: it is only parsed (JSON and binary buffers), never executed. The
output is the same bytes for the same source and recipe.
"""
import hashlib
import io
import json
import struct
import sys

import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
PAD = 4


class Glb:
    """A GLB's JSON and binary chunk, with typed accessor reads."""

    def __init__(self, data):
        if data[:4] != b'glTF':
            raise ValueError('not a GLB file')
        jl = struct.unpack('<I', data[12:16])[0]
        self.json = json.loads(data[20:20 + jl])
        bl = struct.unpack('<I', data[20 + jl:24 + jl])[0]
        self.bin = data[28 + jl:28 + jl + bl]

    def accessor(self, i):
        a = self.json['accessors'][i]
        v = self.json['bufferViews'][a['bufferView']]
        dt = np.dtype(CT[a['componentType']])
        n = NC[a['type']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride', 0) or dt.itemsize * n
        count = a['count']
        raw = np.frombuffer(self.bin, dtype=np.uint8, count=stride * (count - 1) + dt.itemsize * n, offset=off)
        rows = np.lib.stride_tricks.as_strided(raw, shape=(count, dt.itemsize * n), strides=(stride, 1))
        out = rows.copy().view(dt).reshape(count, n)
        if a.get('normalized') and dt != np.float32:
            out = out.astype(np.float32) / np.iinfo(dt).max
        return out

    def image(self, texture_index):
        img = self.json['images'][self.json['textures'][texture_index]['source']]
        v = self.json['bufferViews'][img['bufferView']]
        return Image.open(io.BytesIO(self.bin[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])).convert('RGBA')


def base_name(name):
    return name.replace(' (Instance)', '')


def j_bip_of(nodes, parent, node):
    """The node itself if it is a `J_Bip_*` bone, else its nearest `J_Bip_*` ancestor."""
    n = node
    while n is not None and not nodes[n].get('name', '').startswith('J_Bip_'):
        n = parent.get(n)
    return n


def collect(glb, recipe):
    """The garment's triangles: per source vertex and texture, its attributes; one list of corners."""
    j = glb.json
    nodes = j['nodes']
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    wanted = recipe['materials']
    rects = recipe.get('uvRects')
    corners = []  # (texture, primitive key, source vertex)
    data = {}
    bind = {}
    for ni, node in enumerate(nodes):
        if 'mesh' not in node or 'skin' not in node:
            continue
        skin = j['skins'][node['skin']]
        ibm = glb.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4)
        for pi, prim in enumerate(j['meshes'][node['mesh']]['primitives']):
            mat = j['materials'][prim['material']]
            if not any(base_name(mat['name']).startswith(w) for w in wanted):
                continue
            tex = mat['pbrMetallicRoughness']['baseColorTexture']['index']
            at = prim['attributes']
            key = (ni, pi)
            pos, nor, uv = glb.accessor(at['POSITION']), glb.accessor(at['NORMAL']), glb.accessor(at['TEXCOORD_0'])
            joints, weights = glb.accessor(at['JOINTS_0']), glb.accessor(at['WEIGHTS_0'])
            bones = []
            for k, jn in enumerate(skin['joints']):
                m = ibm[k]
                if np.abs(m[:3, :3] - np.eye(3)).max() > 1e-4:
                    raise ValueError(f"bone {nodes[jn]['name']} is bound rotated; only VRoid's unrotated binds are supported")
                bones.append(j_bip_of(nodes, parent, jn))
                bind[jn] = -m[3, :3]
            data[key] = (tex, pos, nor, uv, joints, weights, bones)
            idx = glb.accessor(prim['indices']).ravel()
            for t in range(0, len(idx) - 2, 3):
                tri = idx[t:t + 3]
                if rects is not None:
                    c = uv[tri].mean(0)
                    if not any(r[0] <= c[0] <= r[2] and r[1] <= c[1] <= r[3] for r in rects):
                        continue
                corners.extend((tex, key, int(v)) for v in tri)
    if not corners:
        raise ValueError(f'no triangles for materials {wanted}')
    return nodes, parent, corners, data, bind


def pack(boxes, size):
    """Shelf-packs the boxes (w, h) in a size x size square at the largest common scale, tallest first."""
    order = sorted(range(len(boxes)), key=lambda i: (-boxes[i][1], i))

    def place(s):
        x = y = shelf = 0
        out = [None] * len(boxes)
        for i in order:
            w, h = int(np.ceil(boxes[i][0] * s)) + 2 * PAD, int(np.ceil(boxes[i][1] * s)) + 2 * PAD
            if x + w > size:
                x, y, shelf = 0, y + shelf, 0
            if w > size or y + h > size:
                return None
            out[i] = (x + PAD, y + PAD)
            x += w
            shelf = max(shelf, h)
        return out

    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if place(mid):
            lo = mid
        else:
            hi = mid
    return lo, place(lo)


def atlas(glb, corners, data, size):
    """One texture of the used parts of every source texture; returns it and a UV map per texture."""
    texs = sorted({c[0] for c in corners})
    images = {t: glb.image(t) for t in texs}
    crops = {}
    for t in texs:
        uvs = np.array([data[k][3][v] for (tt, k, v) in corners if tt == t], dtype=np.float64)
        w, h = images[t].size
        x0, y0 = np.floor(uvs.min(0) * [w, h]).astype(int) - 2
        x1, y1 = np.ceil(uvs.max(0) * [w, h]).astype(int) + 2
        crops[t] = (max(0, x0), max(0, y0), min(w, x1), min(h, y1))
    boxes = [(c[2] - c[0], c[3] - c[1]) for c in (crops[t] for t in texs)]
    scale, spots = pack(boxes, size)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    maps = {}
    for t, (bw, bh), (ox, oy) in zip(texs, boxes, spots):
        cw, ch = max(1, int(round(bw * scale))), max(1, int(round(bh * scale)))
        part = images[t].crop(crops[t]).resize((cw, ch), Image.LANCZOS)
        # Edges smeared outwards by PAD px, so mipmaps do not bleed the next part in.
        padded = Image.new('RGBA', (cw + 2 * PAD, ch + 2 * PAD))
        padded.paste(part.resize((cw + 2 * PAD, ch + 2 * PAD), Image.NEAREST), (0, 0))
        padded.paste(part, (PAD, PAD))
        out.paste(padded, (ox - PAD, oy - PAD))
        w, h = images[t].size
        x0, y0 = crops[t][0], crops[t][1]
        maps[t] = (w, h, x0, y0, cw / bw, ch / bh, ox, oy)
    return out, maps


def build(glb, recipe, size):
    nodes, parent, corners, data, bind = collect(glb, recipe)
    image, maps = atlas(glb, corners, data, size)
    # One output vertex per (primitive, source vertex), in the order of first use.
    index_of = {}
    verts = []
    indices = []
    for tex, key, v in corners:
        k = (key, v)
        if k not in index_of:
            index_of[k] = len(verts)
            verts.append((tex, key, v))
        indices.append(index_of[k])
    used_bones = set()
    rows = []
    for tex, key, v in verts:
        _, pos, nor, uv, joints, weights, bones = data[key]
        acc = {}
        for jj, ww in zip(joints[v], weights[v]):
            if ww > 0:
                b = bones[int(jj)]
                if b is None:
                    raise ValueError(f'a weight on a bone with no J_Bip_ ancestor (joint {int(jj)})')
                acc[b] = acc.get(b, 0.0) + float(ww)
        top = sorted(acc.items(), key=lambda x: (-x[1], nodes[x[0]]['name']))[:4]
        total = sum(w for _, w in top)
        top = [(b, w / total) for b, w in top]
        used_bones.update(b for b, _ in top)
        w, h, x0, y0, sx, sy, ox, oy = maps[tex]
        u = ((uv[v][0] * w - x0) * sx + ox) / size
        t = ((uv[v][1] * h - y0) * sy + oy) / size
        rows.append((pos[v], nor[v], (u, t), top))
    # The skeleton: used bones and their J_Bip ancestors, parents first, in source node order.
    keep = set()
    for b in used_bones:
        n = b
        while n is not None:
            if nodes[n].get('name', '').startswith('J_Bip_'):
                keep.add(n)
            n = parent.get(n)
    order = sorted(keep)
    missing = [nodes[n]['name'] for n in order if n not in bind]
    if missing:
        raise ValueError(f'bones without a bind pose: {missing}')
    return image, rows, indices, order, nodes, parent, bind


def encode(recipe, image, rows, indices, order, nodes, parent, bind, source_sha):
    """The garment GLB: one mesh node, one skin, one material, one texture."""
    n = len(rows)
    pos = np.array([r[0] for r in rows], dtype=np.float32)
    nor = np.array([r[1] for r in rows], dtype=np.float32)
    nor /= np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-12)
    uv = np.array([r[2] for r in rows], dtype=np.float32)
    joint_index = {b: i for i, b in enumerate(order)}
    jnt = np.zeros((n, 4), dtype=np.uint8)
    wgt = np.zeros((n, 4), dtype=np.float32)
    for i, r in enumerate(rows):
        for k, (b, w) in enumerate(r[3]):
            jnt[i, k] = joint_index[b]
            wgt[i, k] = w
    idx = np.array(indices, dtype=np.uint16 if n < 65536 else np.uint32)
    ibm = np.zeros((len(order), 16), dtype=np.float32)
    for i, b in enumerate(order):
        m = np.eye(4, dtype=np.float32)
        m[3, :3] = -bind[b]
        ibm[i] = m.ravel()
    png = io.BytesIO()
    image.save(png, 'PNG', optimize=True)
    blobs = [pos.tobytes(), nor.tobytes(), uv.tobytes(), jnt.tobytes(), wgt.tobytes(), idx.tobytes(), ibm.tobytes(), png.getvalue()]
    views, binary = [], bytearray()
    for i, b in enumerate(blobs):
        while len(binary) % 4:
            binary.append(0)
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(b)}
        if i < 5:
            view['target'] = 34962
        elif i == 5:
            view['target'] = 34963
        views.append(view)
        binary += b
    while len(binary) % 4:
        binary.append(0)

    def acc(view, comp, typ, count, extra=None):
        a = {'bufferView': view, 'componentType': comp, 'type': typ, 'count': count}
        a.update(extra or {})
        return a

    accessors = [
        acc(0, 5126, 'VEC3', n, {'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()}),
        acc(1, 5126, 'VEC3', n),
        acc(2, 5126, 'VEC2', n),
        acc(3, 5121, 'VEC4', n),
        acc(4, 5126, 'VEC4', n),
        acc(5, 5123 if idx.dtype == np.uint16 else 5125, 'SCALAR', len(idx)),
        acc(6, 5126, 'MAT4', len(order)),
    ]
    # Bones at their bind positions, relative to their kept parent.
    out_nodes = [{'name': recipe['id'], 'children': [], 'extras': {'garment': recipe['id'], 'source': {**recipe['source'], 'sha256': source_sha}}}]
    bone_node = {}
    for b in order:
        bone_node[b] = len(out_nodes)
        out_nodes.append({'name': nodes[b]['name']})
    for b in order:
        p = parent.get(b)
        while p is not None and p not in bone_node:
            p = parent.get(p)
        origin = bind[p] if p is not None else np.zeros(3)
        out_nodes[bone_node[b]]['translation'] = [float(x) for x in (bind[b] - origin)]
        holder = out_nodes[bone_node[p]] if p is not None else out_nodes[0]
        holder.setdefault('children', []).append(bone_node[b])
    mesh_node = len(out_nodes)
    out_nodes.append({'name': f"{recipe['id']}-mesh", 'mesh': 0, 'skin': 0})
    out_nodes[0]['children'].append(mesh_node)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'seki tools/garments/garment_extract.py'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': out_nodes,
        'meshes': [{'name': recipe['id'], 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2, 'JOINTS_0': 3, 'WEIGHTS_0': 4}, 'indices': 5, 'material': 0}]}],
        'skins': [{'inverseBindMatrices': 6, 'joints': [bone_node[b] for b in order]}],
        'materials': [{
            'name': recipe['material'],
            'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
            'alphaMode': 'MASK',
            'alphaCutoff': 0.5,
            'doubleSided': True,
        }],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': 7, 'mimeType': 'image/png'}],
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': len(binary)}],
    }
    js = json.dumps(gltf, separators=(',', ':'), sort_keys=True).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(binary)
    return struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + bytes(binary)


def extract(data, recipe, size=512):
    """The garment GLB's bytes from a source file's bytes and its recipe."""
    sha = hashlib.sha256(data).hexdigest()
    if recipe.get('sha256') and recipe['sha256'] != sha:
        raise ValueError(f"source sha256 {sha}, the recipe expects {recipe['sha256']}")
    glb = Glb(data)
    return encode(recipe, *build(glb, recipe, size), sha)


def main(argv):
    args = argv[1:]
    if len(args) < 2 or '--recipe' not in args or '--id' not in args:
        print(__doc__)
        return 2
    src, dst = args[0], args[1]
    recipes = json.load(open(args[args.index('--recipe') + 1], encoding='utf-8'))['garments']
    rid = args[args.index('--id') + 1]
    recipe = next(r for r in recipes if r['id'] == rid)
    size = int(args[args.index('--size') + 1]) if '--size' in args else 512
    out = extract(open(src, 'rb').read(), recipe, size)
    with open(dst, 'wb') as f:
        f.write(out)
    g = Glb(out)
    tris = g.json['accessors'][5]['count'] // 3
    print(f"{dst}: {len(out)} B, {g.json['accessors'][0]['count']} vertices, {tris} triangles, {len(g.json['skins'][0]['joints'])} bones")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
