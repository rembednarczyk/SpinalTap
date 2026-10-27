"""Used to prepare packages/app/public/models. Rewrites a GLB/VRM with every embedded image downscaled to at most MAX px (PNG kept for alpha)."""
import io, json, struct, sys
from PIL import Image
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]
j = json.loads(d[20:20 + jl])
bin_start = 20 + jl + 8
blob = d[bin_start:bin_start + struct.unpack('<I', d[20 + jl:24 + jl])[0]]
# Optional: drop morph targets (the toon shader has none yet) and every buffer view nothing uses.
if '--strip-morphs' in sys.argv:
    for mesh in j.get('meshes', []):
        mesh.pop('weights', None)
        mesh.get('extras', {}).pop('targetNames', None)
        for prim in mesh['primitives']:
            prim.pop('targets', None)
            prim.get('extras', {}).pop('targetNames', None)
    used_acc = set()
    for mesh in j.get('meshes', []):
        for prim in mesh['primitives']:
            used_acc.update(prim['attributes'].values())
            if 'indices' in prim: used_acc.add(prim['indices'])
    for skin in j.get('skins', []):
        if 'inverseBindMatrices' in skin: used_acc.add(skin['inverseBindMatrices'])
    for anim in j.get('animations', []):
        for smp in anim['samplers']: used_acc.update([smp['input'], smp['output']])
    acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
    j['accessors'] = [j['accessors'][i] for i in sorted(used_acc)]
    def remap_acc(i): return acc_map[i]
    for mesh in j.get('meshes', []):
        for prim in mesh['primitives']:
            prim['attributes'] = {k: remap_acc(v) for k, v in prim['attributes'].items()}
            if 'indices' in prim: prim['indices'] = remap_acc(prim['indices'])
    for skin in j.get('skins', []):
        if 'inverseBindMatrices' in skin: skin['inverseBindMatrices'] = remap_acc(skin['inverseBindMatrices'])
    for anim in j.get('animations', []):
        for smp in anim['samplers']: smp['input'] = remap_acc(smp['input']); smp['output'] = remap_acc(smp['output'])
    used_views = {a['bufferView'] for a in j['accessors'] if 'bufferView' in a} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im}
    view_map = {old: new for new, old in enumerate(sorted(used_views))}
    j['bufferViews'] = [j['bufferViews'][i] for i in sorted(used_views)]
    old_views = sorted(used_views)
    for a in j['accessors']:
        if 'bufferView' in a: a['bufferView'] = view_map[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im: im['bufferView'] = view_map[im['bufferView']]
    # Blend shape groups point at targets that are gone.
    vrm = j.get('extensions', {}).get('VRM', {})
    for g in vrm.get('blendShapeMaster', {}).get('blendShapeGroups', []):
        g['binds'] = []
views = j['bufferViews']
image_views = {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im}
new = bytearray()
for i, v in enumerate(views):
    chunk = blob[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    if i in image_views:
        im = Image.open(io.BytesIO(chunk))
        if max(im.size) > MAX:
            k = MAX / max(im.size)
            im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
        out = io.BytesIO()
        if im.mode in ('RGBA', 'LA', 'P') and 'A' in im.getbands() or im.mode == 'P':
            im.save(out, 'PNG', optimize=True)
            mime = 'image/png'
        else:
            im.convert('RGB').save(out, 'JPEG', quality=88)
            mime = 'image/jpeg'
        chunk = out.getvalue()
        for img in j['images']:
            if img.get('bufferView') == i:
                img['mimeType'] = mime
    while len(new) % 4:
        new.append(0)
    v['byteOffset'] = len(new)
    v['byteLength'] = len(chunk)
    new += chunk
while len(new) % 4:
    new.append(0)
j['buffers'][0]['byteLength'] = len(new)
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
total = 12 + 8 + len(js) + 8 + len(new)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(new), 0x004E4942)); f.write(new)
print(dst, len(d) // 1024, '->', total // 1024, 'KB')
