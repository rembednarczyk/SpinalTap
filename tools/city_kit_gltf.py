"""glTF reading and writing for tools/city_kit.py (ADR-0022, ADR-0058).

Reads .glb and .gltf (buffers embedded as data URIs or next to the file) into world-space
triangles, and writes the quantized one-material GLBs the engine parses (`city-kit.glb`,
`city-props.glb`): one mesh per model, positions float, normals int8, UVs uint8
(`KHR_mesh_quantization`), the swatch palette and its glow twin as embedded PNGs.
"""
import base64, io, json, os, struct
import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    blob = d[off + 8: off + 8 + struct.unpack('<I', d[off:off + 4])[0]] if off < len(d) else b''
    return j, blob


def read_gltf(path):
    """A .gltf with one buffer, as a data URI or a file next to it (never fetched from anywhere else)."""
    j = json.load(open(path, encoding='utf-8'))
    bufs = j.get('buffers', [])
    if len(bufs) != 1:
        raise ValueError(f'{path}: expected one buffer, got {len(bufs)}')
    uri = bufs[0].get('uri', '')
    if uri.startswith('data:'):
        blob = base64.b64decode(uri.split(',', 1)[1])
    else:
        if '/' in uri or '\\' in uri or uri.startswith('.'):
            raise ValueError(f'{path}: buffer outside the model folder: {uri}')
        blob = open(os.path.join(os.path.dirname(path), uri), 'rb').read()
    return j, blob


def read_model(path):
    return read_gltf(path) if path.lower().endswith('.gltf') else read_glb(path)


def accessor(j, blob, i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    dt = np.dtype(CT[a['componentType']])
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', 0) or n * dt.itemsize
    raw = np.frombuffer(blob, dtype=np.uint8, count=stride * (a['count'] - 1) + n * dt.itemsize, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], n * dt.itemsize), strides=(stride, 1)).copy()
    out = rows.view(dt).reshape(a['count'], n)
    if a.get('normalized') and dt != np.float32:
        out = out.astype(np.float32) / np.iinfo(dt).max
    return out.astype(np.float64)


def quat_matrix(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def node_matrix(n):
    m = np.eye(4)
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    s = np.diag(n.get('scale', [1, 1, 1]))
    r = quat_matrix(n.get('rotation', [0, 0, 0, 1]))
    m[:3, :3] = r @ s
    m[:3, 3] = n.get('translation', [0, 0, 0])
    return m


def scene_triangles(path):
    """World-space triangles of a glTF scene: positions [T,3,3], normals [T,3,3], material index [T],
    UVs per corner [T,3,2] (NaN without TEXCOORD_0), the glTF json and its binary buffer."""
    j, blob = read_model(path)
    out = {'p': [], 'n': [], 'mat': [], 'uv': []}

    def visit(ni, parent):
        node = j['nodes'][ni]
        m = parent @ node_matrix(node)
        if 'mesh' in node:
            for pr in j['meshes'][node['mesh']]['primitives']:
                P = accessor(j, blob, pr['attributes']['POSITION'])
                N = accessor(j, blob, pr['attributes']['NORMAL']) if 'NORMAL' in pr['attributes'] else None
                I = accessor(j, blob, pr['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
                Pw = P @ m[:3, :3].T + m[:3, 3]
                if N is None:
                    fn = np.cross(Pw[I[:, 1]] - Pw[I[:, 0]], Pw[I[:, 2]] - Pw[I[:, 0]])
                    Nw = np.repeat(fn[:, None, :], 3, 1)
                else:
                    Nw = (N @ np.linalg.inv(m[:3, :3])).reshape(-1, 3)[I]
                Nw = Nw / np.maximum(np.linalg.norm(Nw, axis=-1, keepdims=True), 1e-9)
                out['p'].append(Pw[I])
                out['n'].append(Nw)
                out['mat'] += [pr.get('material', -1)] * len(I)
                if 'TEXCOORD_0' in pr['attributes']:
                    out['uv'].append(accessor(j, blob, pr['attributes']['TEXCOORD_0'])[I])
                else:
                    out['uv'].append(np.full((len(I), 3, 2), np.nan))
        for c in node.get('children', []):
            visit(c, m)

    scene = j['scenes'][j.get('scene', 0)]
    for ni in scene['nodes']:
        visit(ni, np.eye(4))
    return np.concatenate(out['p']), np.concatenate(out['n']), np.array(out['mat']), np.concatenate(out['uv']), j, blob


def triangles(path):
    """As `scene_triangles`, with one UV per triangle (the mean of its corners) and the materials."""
    P, N, mat, uv, j, _ = scene_triangles(path)
    return P, N, mat, uv.mean(1), j.get('materials', [])


def png_bytes(arr):
    buf = io.BytesIO()
    Image.fromarray(arr, 'RGBA').save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def write_glb(models, albedo_png, glow_png, dst, extras, swatches, grid):
    """`models`: dicts with key, pos [V,3] float32, nor [V,3], uv [V,2] in 0..1, ind; `extras[key]`
    goes to the model's node."""
    binbuf = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    def add_view(data, target=None):
        while len(binbuf) % 4:
            binbuf.append(0)
        v = {'buffer': 0, 'byteOffset': len(binbuf), 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        binbuf.extend(data)
        return len(views) - 1

    for m in models:
        pos = m['pos']
        nrm = np.clip(np.round(m['nor'] * 127), -127, 127).astype(np.int8)
        nrm4 = np.zeros((len(nrm), 4), np.int8)
        nrm4[:, :3] = nrm
        uv = np.clip(np.round(m['uv'] * 255), 0, 255).astype(np.uint8)
        uv4 = np.zeros((len(uv), 4), np.uint8)
        uv4[:, :2] = uv
        ind = m['ind'].astype(np.uint16 if len(pos) < 65536 else np.uint32)
        a0 = len(accessors)
        accessors.append({'bufferView': add_view(pos.tobytes(), 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                          'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
        v = add_view(nrm4.tobytes(), 34962)
        views[v]['byteStride'] = 4
        accessors.append({'bufferView': v, 'componentType': 5120, 'normalized': True, 'count': len(pos), 'type': 'VEC3'})
        v = add_view(uv4.tobytes(), 34962)
        views[v]['byteStride'] = 4
        accessors.append({'bufferView': v, 'componentType': 5121, 'normalized': True, 'count': len(pos), 'type': 'VEC2'})
        accessors.append({'bufferView': add_view(ind.tobytes(), 34963), 'componentType': 5123 if ind.dtype == np.uint16 else 5125,
                          'count': len(ind), 'type': 'SCALAR'})
        meshes.append({'name': m['key'], 'primitives': [{'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2},
                                                         'indices': a0 + 3, 'material': 0}]})
        nodes.append({'name': m['key'], 'mesh': len(meshes) - 1, 'extras': extras[m['key']]})
    img_albedo = add_view(albedo_png)
    img_glow = add_view(glow_png)
    while len(binbuf) % 4:
        binbuf.append(0)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'tools/city_kit.py',
                  'extras': {'swatches': [{'name': n, 'color': h, 'kind': k} for n, h, k in swatches], 'grid': grid}},
        'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
        'materials': [{'name': 'city-palette', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
                       'emissiveTexture': {'index': 1}, 'emissiveFactor': [1, 1, 1]}],
        'samplers': [{'magFilter': 9728, 'minFilter': 9728}],
        'images': [{'name': 'palette', 'bufferView': img_albedo, 'mimeType': 'image/png'},
                   {'name': 'palette-glow', 'bufferView': img_glow, 'mimeType': 'image/png'}],
        'textures': [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}],
        'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(binbuf)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binbuf)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(binbuf), 0x004E4942))
        f.write(binbuf)
