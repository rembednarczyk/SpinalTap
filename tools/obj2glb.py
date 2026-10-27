"""OBJ + MTL (flat Kd colours) -> GLB. Default: one primitive per material with baseColorFactor
from Kd. With --vertex-colors: a single primitive, the Kd colours baked into COLOR_0 (one draw
call per instance). Optional uniform scale so the longest side is TARGET metres."""
import json, struct, sys, math, os
src, dst = sys.argv[1], sys.argv[2]
target = float(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else 0
vertex_colors = '--vertex-colors' in sys.argv
base = os.path.dirname(src)
V, N, mats, cur, groups, mtl = [], [], {}, None, {}, None
for line in open(src, encoding='utf-8', errors='replace'):
    p = line.split()
    if not p: continue
    if p[0] == 'v': V.append(tuple(map(float, p[1:4])))
    elif p[0] == 'vn': N.append(tuple(map(float, p[1:4])))
    elif p[0] == 'mtllib': mtl = os.path.join(base, ' '.join(p[1:]))
    elif p[0] == 'usemtl': cur = ' '.join(p[1:]); groups.setdefault(cur, [])
    elif p[0] == 'f':
        idx = []
        for t in p[1:]:
            a = t.split('/')
            vi = int(a[0]); ni = int(a[2]) if len(a) > 2 and a[2] else 0
            idx.append((vi - 1 if vi > 0 else len(V) + vi, (ni - 1 if ni > 0 else len(N) + ni) if ni else -1))
        for k in range(1, len(idx) - 1):
            groups.setdefault(cur, []).append((idx[0], idx[k], idx[k + 1]))
if mtl and os.path.exists(mtl):
    name = None
    for line in open(mtl, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p: continue
        if p[0] == 'newmtl': name = ' '.join(p[1:]); mats[name] = (0.8, 0.8, 0.8)
        elif p[0] == 'Kd' and name: mats[name] = tuple(map(float, p[1:4]))
xs = [v[0] for v in V]; ys = [v[1] for v in V]; zs = [v[2] for v in V]
size = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
k = target / size if target else 1.0
cx, cy, cz = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2
binbuf = bytearray(); views = []; accessors = []; prims = []; materials = []
def add_view(data, target_kind):
    while len(binbuf) % 4: binbuf.append(0)
    views.append({"buffer": 0, "byteOffset": len(binbuf), "byteLength": len(data), "target": target_kind}); binbuf.extend(data)
    return len(views) - 1
merged = {'pos': [], 'nor': [], 'col': [], 'ind': []}
for mi, (mname, tris) in enumerate(groups.items()):
    if not tris: continue
    pos, nor, ind, cache = [], [], [], {}
    for tri in tris:
        a = [V[t[0]] for t in tri]
        fn = [(a[1][1]-a[0][1])*(a[2][2]-a[0][2])-(a[1][2]-a[0][2])*(a[2][1]-a[0][1]), (a[1][2]-a[0][2])*(a[2][0]-a[0][0])-(a[1][0]-a[0][0])*(a[2][2]-a[0][2]), (a[1][0]-a[0][0])*(a[2][1]-a[0][1])-(a[1][1]-a[0][1])*(a[2][0]-a[0][0])]
        l = math.sqrt(sum(c*c for c in fn)) or 1; fn = [c / l for c in fn]
        for (vi, ni) in tri:
            key = (vi, ni)
            if key not in cache:
                cache[key] = len(pos)
                v = V[vi]; pos.append(((v[0]-cx)*k, (v[1]-cy)*k, (v[2]-cz)*k))
                nor.append(N[ni] if ni >= 0 else tuple(fn))
            ind.append(cache[key])
    if vertex_colors:
        c = mats.get(mname, (0.8, 0.8, 0.8)); base_i = len(merged['pos'])
        merged['pos'] += pos; merged['nor'] += nor; merged['col'] += [(c[0], c[1], c[2], 1.0)] * len(pos)
        merged['ind'] += [i + base_i for i in ind]
        continue
    pb = b''.join(struct.pack('<3f', *p) for p in pos); nb = b''.join(struct.pack('<3f', *n) for n in nor)
    ib = b''.join(struct.pack('<I', i) for i in ind)
    pv = add_view(pb, 34962); nv = add_view(nb, 34962); iv = add_view(ib, 34963)
    mn = [min(p[i] for p in pos) for i in range(3)]; mx = [max(p[i] for p in pos) for i in range(3)]
    accessors += [{"bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mn, "max": mx},
                  {"bufferView": nv, "componentType": 5126, "count": len(nor), "type": "VEC3"},
                  {"bufferView": iv, "componentType": 5125, "count": len(ind), "type": "SCALAR"}]
    a0 = len(accessors) - 3
    c = mats.get(mname, (0.8, 0.8, 0.8))
    materials.append({"name": mname or f"m{mi}", "pbrMetallicRoughness": {"baseColorFactor": [c[0], c[1], c[2], 1], "metallicFactor": 0, "roughnessFactor": 1}})
    prims.append({"attributes": {"POSITION": a0, "NORMAL": a0 + 1}, "indices": a0 + 2, "material": len(materials) - 1})
if vertex_colors:
    pos, nor, col, ind = merged['pos'], merged['nor'], merged['col'], merged['ind']
    pv = add_view(b''.join(struct.pack('<3f', *p) for p in pos), 34962)
    nv = add_view(b''.join(struct.pack('<3f', *n) for n in nor), 34962)
    cv = add_view(b''.join(struct.pack('<4f', *c) for c in col), 34962)
    iv = add_view(b''.join(struct.pack('<I', i) for i in ind), 34963)
    mn = [min(p[i] for p in pos) for i in range(3)]; mx = [max(p[i] for p in pos) for i in range(3)]
    accessors += [{"bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mn, "max": mx},
                  {"bufferView": nv, "componentType": 5126, "count": len(nor), "type": "VEC3"},
                  {"bufferView": cv, "componentType": 5126, "count": len(col), "type": "VEC4"},
                  {"bufferView": iv, "componentType": 5125, "count": len(ind), "type": "SCALAR"}]
    materials = [{"name": "baked", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1}}]
    prims = [{"attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2}, "indices": 3, "material": 0}]
while len(binbuf) % 4: binbuf.append(0)
name = os.path.splitext(os.path.basename(src))[0]
gltf = {"asset": {"version": "2.0", "generator": "obj2glb"}, "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}], "meshes": [{"name": name, "primitives": prims}],
        "materials": materials, "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(binbuf)}]}
js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binbuf)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(binbuf), 0x004E4942)); f.write(binbuf)
print(dst, f"{len(binbuf)//1024}KB", "size", round(size, 3), "->", round(size * k, 3), "materials", [m["name"] for m in materials])
