"""A contact sheet of the rooms' detail's models for review without a GPU (ADR-0099): every mesh of a baked file whose
name starts with a prefix, on a grid, rendered by Cycles on the CPU (the container has no EGL for Workbench).

    blender -b --factory-startup --python tools/blender/sheet.py -- FILE.glb PREFIX OUT.png
"""
import math
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
glb, prefix, out = args[0], args[1], args[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
shown = sorted((o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith(prefix)), key=lambda o: o.name)
for o in bpy.context.scene.objects:
    if o.type == 'MESH' and o not in shown:
        o.hide_render = True
cols = max(1, math.ceil(math.sqrt(len(shown) * 1.6)))
for i, o in enumerate(shown):
    o.parent = None
    o.location = ((i % cols) * 1.1, (i // cols) * 1.4, 0)
rows = math.ceil(len(shown) / cols)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
bpy.context.scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = max(cols * 1.1, rows * 1.4 * 1.75) + 0.8
cam.location = ((cols - 1) * 0.55, (rows - 1) * 0.7 - 5.0, 4.6)
cam.rotation_euler = (math.radians(55), 0, 0)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.rotation_euler = (math.radians(40), math.radians(20), 0)
sun.data.energy = 4
bpy.context.scene.collection.objects.link(sun)
s = bpy.context.scene
s.camera = cam
s.render.engine = 'CYCLES'
s.cycles.device = 'CPU'
s.cycles.samples = 24
s.cycles.use_denoising = False
for layer in s.view_layers:
    layer.cycles.use_denoising = False
world = bpy.data.worlds.new('w')
world.color = (0.35, 0.35, 0.38)
s.world = world
s.render.resolution_x, s.render.resolution_y = 1400, 800
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print('SHEET', len(shown))
