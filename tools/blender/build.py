"""Builds the room detail's models in Blender without a window and exports them as one glTF (ADR-0098).

    blender -b --factory-startup --python tools/blender/build.py -- OUT.glb

Each room's module in `rooms/` lists its models (`MODELS`, functions giving a `shapes.Model`); every model
becomes one object at the origin named by its key, its faces' materials named by the palette's roles.
`tools/city_blender.py` runs this and bakes the result into `room-detail-props.glb`.
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, 'rooms')]

import clinic  # noqa: E402
import neon_koi  # noqa: E402
import tessen_office  # noqa: E402
import trasa  # noqa: E402
import capsule  # noqa: E402
import w3_basement  # noqa: E402
import w3_hall  # noqa: E402
import metro  # noqa: E402
import alchemia_shelter  # noqa: E402
import alchemia_p2  # noqa: E402
import alchemia_p1  # noqa: E402
import alchemia_foodhall  # noqa: E402
import alchemia_gallery  # noqa: E402
import common  # noqa: E402
import kits2  # noqa: E402
import car_wash  # noqa: E402
import koi_back  # noqa: E402
import plac_litewski  # noqa: E402
import alchemia_pavilion  # noqa: E402
import brama_krakowska  # noqa: E402
import alchemia_t1  # noqa: E402
import alchemia_t2  # noqa: E402
import w3_outside  # noqa: E402

# In the order the rooms came: their models' keys go into ROOM_DETAIL_SHAPES in the same order.
ROOMS = [neon_koi, clinic, tessen_office, trasa, capsule, w3_basement, w3_hall, metro, alchemia_shelter, alchemia_p2, alchemia_p1, alchemia_foodhall, alchemia_gallery, common, kits2, car_wash, koi_back, plac_litewski, alchemia_pavilion, brama_krakowska, alchemia_t1, alchemia_t2, w3_outside]


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    keys = []
    for room in ROOMS:
        for make in room.MODELS:
            obj = make().to_object()
            keys.append(f'{obj.name}={room.FILE}')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=True,
                              export_yup=True, export_normals=True, export_texcoords=False, export_materials='EXPORT')
    print('BUILT', len(keys), ' '.join(keys))


main()
